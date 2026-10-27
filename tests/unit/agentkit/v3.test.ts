import { describe, expect, it, vi } from "vitest";
import { buildV3Agent, redeployPatch } from "../../../src/agentkit/v3.js";
import {
    Agent,
    AgoraClient,
    Area,
    DeepgramSTT,
    DeployedAgent,
    SavedAgent,
    AgentSession,
    UnsupportedSessionOperationError,
    type SaveOptions,
    OpenAI,
    OpenAIRealtime,
    PreconditionFailedError,
    SecretRefNotSupportedError,
    secretRef,
    UnsupportedFieldError,
} from "../../../src/index.js";

const response = (body: unknown, status = 200, tag = '"v1"') =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ETag: tag, "Agora-Request-Id": "req-test" },
    });
function setup(replies: Response[] = []) {
    const fetch = vi.fn(async () => replies.shift() ?? response({}));
    const client = new AgoraClient({
        area: Area.US,
        appId: "app",
        appCertificate: "certificate",
        authToken: "token",
        fetch,
        v3: { baseUrl: "https://staging.test", headers: { "X-Test-Context": "test" } },
    });
    return { client, fetch };
}
const saved = (extra = {}) => ({ agent_id: "agent-1", agent_name: "Test", create_ts: 1, update_ts: 2, ...extra });
const number = (id = "num-1", phone = "+12025550123") => ({ number_id: id, number: phone, create_ts: 1 });
const page = (list: unknown[], cursor: string | null = null) => ({
    data: { count: list.length, list },
    has_more: !!cursor,
    next_cursor: cursor,
});
const request = (fetch: ReturnType<typeof vi.fn>, index = 0) => ({
    url: String(fetch.mock.calls[index][0]),
    init: fetch.mock.calls[index][1] as RequestInit,
});
const body = (fetch: ReturnType<typeof vi.fn>, index = 0) => JSON.parse(request(fetch, index).init.body as string);

describe("v3 preview", () => {
    it("shares transport/auth, injects project, encodes paths and exposes raw headers", async () => {
        const { client, fetch } = setup([response(saved())]);
        const result = await client.v3.agents.get({ id: "a/b" }).withRawResponse();
        expect(result.data.agent_id).toBe("agent-1");
        expect(result.rawResponse.headers.get("etag")).toBe('"v1"');
        const r = request(fetch);
        expect(r.url).toBe("https://staging.test/conversational-ai/v1/projects/app/agents/a%2Fb");
        expect(new Headers(r.init.headers).get("authorization")).toBe("agora token=token");
        expect(new Headers(r.init.headers).get("x-test-context")).toBe("test");
        expect(() => client.v3.agents.get({ id: " " })).toThrow("must not be empty");
    });
    it("pages through results and rejects repeated cursors", async () => {
        const { client, fetch } = setup([response(page([number()], "next")), response(page([number("num-2")]))]);
        const results = [];
        for await (const n of client.v3.numbers.listAll({ limit: 100 })) results.push(n.number_id);
        expect(results).toEqual(["num-1", "num-2"]);
        expect(request(fetch, 1).url).toContain("cursor=next");
        const broken = setup([response(page([], "same")), response(page([], "same"))]);
        await expect(async () => {
            for await (const _ of broken.client.v3.agents.listAll()) {
            }
        }).rejects.toThrow("cursor");
    });
    it("implements every resource operation with the right method and headers", async () => {
        const { client, fetch } = setup();
        await client.v3.agents.create({ agent_name: "A" });
        await client.v3.agents.list();
        await client.v3.agents.get({ id: "a" });
        await client.v3.agents.update({ id: "a", ifMatch: '"1"', instructions: null });
        await client.v3.agents.delete({ id: "a" });
        await client.v3.secrets.create({ name: "s", secrets: { key: "value" } });
        await client.v3.secrets.list();
        await client.v3.secrets.get({ name: "s" });
        await client.v3.secrets.update({ name: "s", secrets: { key: null } });
        await client.v3.secrets.replace({ name: "s", ifMatch: '"1"', secrets: { key: "new" } });
        await client.v3.secrets.delete({ name: "s", ifMatch: '"1"' });
        await client.v3.secrets.setKey({ name: "s", key: "k", value: "new", ifNoneMatch: "*" });
        await client.v3.secrets.deleteKey({ name: "s", key: "k" });
        await client.v3.numbers.create({ number: "+12025550123" });
        await client.v3.numbers.list();
        await client.v3.numbers.get({ id: "n" });
        await client.v3.numbers.update({ id: "n", ifMatch: '"1"', inbound: { agent: null } });
        await client.v3.numbers.delete({ id: "n" });
        await client.v3.sessions.list({ status: "RUNNING", started_after: 1 });
        await client.v3.sessions.get({ agentSessionId: "session" });
        expect(fetch).toHaveBeenCalledTimes(20);
        expect(fetch.mock.calls.map((_, i) => request(fetch, i).init.method)).toEqual([
            "POST",
            "GET",
            "GET",
            "PATCH",
            "DELETE",
            "POST",
            "GET",
            "GET",
            "PATCH",
            "PUT",
            "DELETE",
            "PUT",
            "DELETE",
            "POST",
            "GET",
            "GET",
            "PATCH",
            "DELETE",
            "GET",
            "GET",
        ]);
        expect(new Headers(request(fetch, 11).init.headers).get("If-None-Match")).toBe("*");
        expect(body(fetch, 11)).toEqual({ value: "new" });
        expect(body(fetch, 3)).toEqual({ instructions: null });
    });
    it("does not retry creates or conflicting writes and exposes latest", async () => {
        const { client, fetch } = setup([response({ reason: "PreconditionFailed" }, 412), response(saved())]);
        const error = await client.v3.agents.update({ id: "a", ifMatch: "stale" }).catch((e) => e);
        expect(error).toBeInstanceOf(PreconditionFailedError);
        expect(error.requestId).toBe("req-test");
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(await error.latest()).toMatchObject({ agent_id: "agent-1" });
        const create = setup([response({ reason: "Internal" }, 500)]);
        await expect(create.client.v3.agents.create({ agent_name: "A" })).rejects.toMatchObject({ statusCode: 500 });
        expect(create.fetch).toHaveBeenCalledTimes(1);
    });
    it("deploys immutable variables, credentials, messages and cascaded modules", async () => {
        const { client, fetch } = setup([response(saved(), 201)]);
        const base = new Agent({ client })
            .withLlm(
                new OpenAI({
                    model: "gpt-4o-mini",
                    url: "https://api.openai.com/v1/chat/completions",
                    apiKey: secretRef("prod", "llm"),
                    systemMessages: [
                        { role: "system", content: "Help" },
                        { role: "user", content: "Hello" },
                    ],
                }),
            )
            .withStt(new DeepgramSTT({ apiKey: "asr", model: "nova-3" }));
        const agent = base.withVariable("outcome", { type: "bool", extract: true, description: "Resolved?" });
        const deployed = await agent.deploy({ name: "Test" });
        expect(deployed.id).toBe("agent-1");
        expect(body(fetch)).toMatchObject({
            instructions: "Help",
            messages: [{ role: "user", content: "Hello" }],
            variables: { outcome: { type: "bool" } },
            pipeline: {
                mode: "cascaded",
                llm: { credential: { mode: "byok", api_key: "$secrets.prod.llm" }, model: "gpt-4o-mini" },
                asr: { credential: { mode: "byok", api_key: "asr" } },
            },
        });
        expect(base.createSession({ channel: "room", agentUid: "1", remoteUids: ["2"] })).toBeInstanceOf(AgentSession);
        expect(() => base.toProperties({ channel: "room", agentUid: "1", remoteUids: ["*"], token: "rtc" })).toThrow(
            SecretRefNotSupportedError,
        );
        expect(() => agent.withVariable("Bad", { type: "str" })).toThrow();
        expect(() => agent.withVariable("missing", { type: "str", extract: true })).toThrow();
    });
    it("maps public interaction language to ASR without changing provider language", async () => {
        const { client, fetch } = setup([response(saved())]);
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ apiKey: "asr", model: "nova-3", language: "fr" }))
            .withTurnDetection({
                language: "de-DE",
                mode: "default",
                config: { start_of_speech: { mode: "vad", vad_config: { interrupt_duration_ms: 160 } } },
            });
        await agent.deploy({ name: "German" });
        expect(body(fetch).pipeline.asr).toMatchObject({
            vendor: "deepgram",
            language: "de-DE",
            params: { language: "fr" },
            credential: { mode: "byok", api_key: "asr" },
        });
        expect(body(fetch).pipeline.turn_detection).toEqual({
            start_of_speech: { type: "vad", interrupt_duration_ms: 160 },
        });
        const v2 = agent.toProperties({
            channel: "room",
            agentUid: "1",
            remoteUids: ["*"],
            token: "rtc",
            allowMissingVendorCategories: new Set(["llm", "tts"]),
        });
        expect(v2.asr?.language).toBe(body(fetch).pipeline.asr.language);
    });
    it("uses default ASR for explicit interaction language without adding one to partial configs", async () => {
        const { client, fetch } = setup([response(saved()), response(saved()), response(saved())]);
        await new Agent({ client }).withTurnDetection({ language: "ja-JP" }).deploy({ name: "Japanese" });
        expect(body(fetch).pipeline.asr).toEqual({
            vendor: "ares",
            language: "ja-JP",
            credential: { mode: "managed" },
        });
        expect(body(fetch).pipeline.turn_detection).not.toHaveProperty("language");
        await new Agent({ client }).deploy({ name: "Default" });
        expect(body(fetch, 1).pipeline).not.toHaveProperty("asr");
        await new Agent({ client })
            .withStt(new DeepgramSTT({ apiKey: "key", model: "nova-3", language: "fr" }))
            .deploy({ name: "Default interaction language" });
        expect(body(fetch, 2).pipeline.asr).toMatchObject({ language: "en-US", params: { language: "fr" } });
        expect(buildV3Agent({ client, turnDetection: { language: "es-ES" } }, {}, "Direct").pipeline).toMatchObject({
            mode: "cascaded",
            asr: { vendor: "ares", language: "es-ES" },
        });
    });
    it("keeps cascaded provider instructions separate from Agent instructions", async () => {
        const { client, fetch } = setup([response(saved()), response(saved())]);
        const vendor = new OpenAI({
            apiKey: "key",
            url: "https://api.openai.com/v1/chat/completions",
            model: "gpt-4o-mini",
            params: { instructions: "Provider-specific setting" },
        });
        await new Agent({ client, instructions: "Agent fallback" }).withLlm(vendor).deploy({ name: "Cascaded" });
        expect(body(fetch).instructions).toBe("Agent fallback");
        expect(body(fetch).pipeline.llm.params.instructions).toBe("Provider-specific setting");
        await new Agent({ client }).withLlm(vendor).deploy({ name: "No instructions" });
        expect(body(fetch, 1)).not.toHaveProperty("instructions");
        expect(body(fetch, 1).pipeline.llm.params.instructions).toBe("Provider-specific setting");
        expect(body(fetch, 1).pipeline).not.toHaveProperty("asr");
    });
    it("preserves realtime instructions alongside conversation messages", async () => {
        const { client, fetch } = setup([response(saved()), response(saved())]);
        const agent = new Agent({ client, instructions: "Agent fallback" }).withMllm(
            new OpenAIRealtime({
                apiKey: "key",
                model: "gpt-realtime",
                instructions: "Keep answers concise",
                messages: [{ role: "user", content: "Hi" }],
            }),
        );
        await agent.deploy({ name: "Conversation" });
        expect(body(fetch).instructions).toBe("Keep answers concise");
        expect(body(fetch).messages).toEqual([{ role: "user", content: "Hi" }]);
        expect(body(fetch).pipeline.mllm.params ?? {}).not.toHaveProperty("instructions");
        await new Agent({ client })
            .withMllm(
                new OpenAIRealtime({
                    apiKey: "key",
                    instructions: "Vendor fallback",
                    messages: [
                        { role: "system", content: "System wins" },
                        { role: "user", content: "Hi" },
                    ],
                }),
            )
            .deploy({ name: "System" });
        expect(body(fetch, 1).instructions).toBe("System wins");
        expect(body(fetch, 1).messages).toEqual([{ role: "user", content: "Hi" }]);
    });

    it("promotes public realtime vendor instructions without adding an ASR module", async () => {
        const { client, fetch } = setup([response(saved())]);
        await new Agent({ client, instructions: "Agent fallback" })
            .withMllm(
                new OpenAIRealtime({ apiKey: "key", model: "gpt-realtime", instructions: "Realtime instructions" }),
            )
            .deploy({ name: "Realtime" });
        expect(body(fetch).instructions).toBe("Realtime instructions");
        expect(body(fetch).pipeline.mode).toBe("realtime");
        expect(body(fetch).pipeline).not.toHaveProperty("asr");
        expect(body(fetch).pipeline.mllm.params ?? {}).not.toHaveProperty("instructions");
    });
    it("maps realtime, greeting, turn detection, filler and silence", () => {
        const { client } = setup();
        const realtime = buildV3Agent(
            {
                client,
                mllm: {
                    vendor: "openai",
                    api_key: "key",
                    params: { model: "gpt-realtime", instructions: "Realtime vendor instructions" },
                    turn_detection: { mode: "agora_vad", agora_vad_config: { threshold: 0.5 } },
                },
            },
            {},
            "Live",
        );
        expect(realtime.instructions).toBe("Realtime vendor instructions");
        expect((realtime.pipeline?.mode === "realtime" && realtime.pipeline.mllm?.params) || {}).not.toHaveProperty(
            "instructions",
        );
        expect(realtime.pipeline).toMatchObject({
            mode: "realtime",
            mllm: { credential: { mode: "byok", api_key: "key" } },
            turn_detection: { type: "agora_vad", threshold: 0.5 },
        });
        const cascade = buildV3Agent(
            {
                client,
                greeting: "Hi",
                turnDetection: {
                    mode: "default",
                    config: {
                        start_of_speech: { mode: "vad", vad_config: { interrupt_duration_ms: 160 } },
                        end_of_speech: { mode: "semantic", semantic_config: { max_wait_ms: 1000 } },
                    },
                },
                interruption: { enable: false, disabled_config: { strategy: "append" } },
                fillerWords: {
                    enable: true,
                    trigger: { mode: "fixed_time", fixed_time_config: { response_wait_ms: 500 } },
                    content: { mode: "generated", generated_config: { prompt: "Wait" } },
                },
                parameters: { silence_config: { action: "speak", content: "There?", timeout_ms: 1000 } },
            },
            {},
            "Test",
        );
        expect(cascade.greeting).toEqual({ mode: "text", text: "Hi" });
        expect(cascade.pipeline).toMatchObject({
            turn_detection: {
                start_of_speech: { type: "vad", interrupt_duration_ms: 160 },
                end_of_speech: { type: "semantic", max_wait_ms: 1000 },
                interruption: { mode: "off", when_off: "append" },
            },
            silence_config: { enabled: true, action: "speak" },
        });
        expect(cascade.filler_words).toMatchObject({
            trigger: { mode: "fixed_time", response_wait_ms: 500 },
            content: { mode: "generated", instructions: "Wait" },
        });
    });
    it("collects unsupported fields before any network call", () => {
        const { client, fetch } = setup();
        const agent = new Agent({
            client,
            pipelineId: "old",
            labels: { a: "b" },
            parameters: { enable_metrics: true },
        });
        expect(() => agent.deploy()).toThrow(UnsupportedFieldError);
        expect(fetch).not.toHaveBeenCalled();
        try {
            agent.deploy();
        } catch (e) {
            expect((e as UnsupportedFieldError).fields).toEqual(
                expect.arrayContaining(["pipelineId", "labels", "parameters.enable_metrics"]),
            );
        }
    });
    it("clears readable nested fields but excludes response metadata on redeploy", async () => {
        const previous = saved({
            instructions: "old",
            pipeline: {
                mode: "cascaded",
                llm: { vendor: "openai", credential: { mode: "byok", source: "stored" }, params: { foo: 1, bar: 2 } },
            },
        });
        const desired = {
            agent_name: "New",
            pipeline: {
                mode: "cascaded" as const,
                llm: { vendor: "openai", credential: { mode: "managed" as const }, params: { bar: 2 } },
            },
        };
        expect(redeployPatch(previous as any, desired)).toEqual({
            agent_name: "New",
            instructions: null,
            pipeline: {
                mode: "cascaded",
                llm: {
                    vendor: "openai",
                    credential: { mode: "managed", api_key: null },
                    params: { bar: 2, foo: null },
                },
            },
        });
        const { client, fetch } = setup([response(previous), response(saved())]);
        await new Agent({ client }).deploy({ name: "New", agentId: "agent-1" });
        expect(new Headers(request(fetch, 1).init.headers).get("If-Match")).toBe('"v1"');
        expect(body(fetch, 1)).not.toHaveProperty("create_ts");
    });
    it("resolves numbers across pages and retries one assignment conflict", async () => {
        const { client, fetch } = setup([
            response(saved()),
            response(page([number("other", "+14155550000")], "next")),
            response(page([number("num-1", "+1 (202) 555-0123")])),
            response(number()),
            response({ reason: "PreconditionFailed" }, 412),
            response(number(), 200, '"v2"'),
            response(number()),
            response(number()),
            response(number()),
        ]);
        const deployed = await DeployedAgent.get(client, "agent-1");
        await deployed.assignNumber("+12025550123", { maxCallDurationSeconds: 900 });
        expect(body(fetch, 4)).toEqual({
            inbound: { agent: "agent-1", call_policy: { max_call_duration_seconds: 900 } },
        });
        expect(new Headers(request(fetch, 6).init.headers).get("If-Match")).toBe('"v2"');
        await deployed.unassignNumber("num-1");
        expect(body(fetch, 8)).toEqual({ inbound: { agent: null } });
    });
    it("copies variable options and does not leak v3 settings into v2 configuration", async () => {
        const { client, fetch } = setup([response(saved(), 201), response(saved(), 201)]);
        const base = new Agent({ client });
        const options = ["yes", "no"];
        const configured = base.withVariable("choice", { type: "str", options });
        options.push("mutated");
        await configured.deploy();
        await base.deploy();
        expect(body(fetch).variables.choice.options).toEqual(["yes", "no"]);
        expect(body(fetch, 1)).not.toHaveProperty("variables");
    });
    it("clears arbitrary params named credential without diffing actual credentials", () => {
        const previous = saved({
            pipeline: {
                mode: "cascaded",
                llm: { credential: { mode: "byok", source: "server" }, params: { credential: { stale: true } } },
            },
        });
        const patch = redeployPatch(previous as any, {
            agent_name: "A",
            pipeline: { mode: "cascaded", llm: { credential: { mode: "byok", api_key: "fresh" }, params: {} } },
        });
        expect(patch.pipeline).toMatchObject({
            llm: { params: { credential: null }, credential: { mode: "byok", api_key: "fresh" } },
        });
        expect(JSON.stringify(patch)).not.toContain("source");
    });
    it("maps audio greeting and rejects unrepresentable settings before transport", () => {
        const { client } = setup();
        const mapped = buildV3Agent(
            {
                client,
                llm: {
                    greeting_message: "Hi",
                    greeting_audio_url: "https://example.test/hi.wav",
                    greeting_configs: { audio_download_timeout_ms: 1000, audio_pcm_sample_rate: 16000 },
                },
            },
            {},
            "A",
        );
        expect(mapped.greeting).toEqual({
            mode: "audio",
            url: "https://example.test/hi.wav",
            text: "Hi",
            download_timeout_ms: 1000,
            pcm_sample_rate: 16000,
        });
        expect(() =>
            buildV3Agent({ client, tts: { vendor: "elevenlabs", params: {}, skip_patterns: [1] } }, {}, "A"),
        ).toThrow(UnsupportedFieldError);
        expect(() => buildV3Agent({ client, llm: { template_variables: { name: "Ana" } } }, {}, "A")).toThrow(
            UnsupportedFieldError,
        );
        expect(() => buildV3Agent({ client, turnDetection: { config: { speech_threshold: 1 } } }, {}, "A")).toThrow(
            UnsupportedFieldError,
        );
    });
    it("retains per-call auth and headers when loading latest without write conditions", async () => {
        const { client, fetch } = setup([response({ reason: "PreconditionFailed" }, 412), response(saved())]);
        const error = await client.v3.agents
            .update(
                { id: "a", ifMatch: "stale" },
                {
                    authorization: "agora token=per-call",
                    headers: {
                        "X-Tenant": "tenant-1",
                        "If-Match": "stale",
                        "If-None-Match": "*",
                    },
                },
            )
            .catch((error) => error);
        await error.latest();
        const latest = request(fetch, 1);
        const headers = new Headers(latest.init.headers);
        expect(latest.init.method).toBe("GET");
        expect(headers.get("Authorization")).toBe("agora token=per-call");
        expect(headers.get("X-Tenant")).toBe("tenant-1");
        for (const name of ["If-Match", "If-None-Match", "Idempotency-Key"]) expect(headers.has(name)).toBe(false);
    });
    it("lists assigned numbers across project pages without fetching individual numbers", async () => {
        const owned1 = { ...number("owned-1"), inbound: { agent: "agent-1" } };
        const owned2 = { ...number("owned-2"), inbound: { agent: "agent-1" } };
        const { client, fetch } = setup([
            response(saved()),
            response(
                page(
                    [
                        owned1,
                        { ...number("other"), inbound: { agent: "agent-2" } },
                        { ...number("none"), inbound: null },
                    ],
                    "next",
                ),
            ),
            response(page([number("missing"), { ...number("unassigned"), inbound: { agent: null } }, owned2])),
        ]);
        const deployed = await DeployedAgent.get(client, "agent-1");
        expect(await deployed.listNumbers()).toEqual([owned1, owned2]);
        expect(fetch).toHaveBeenCalledTimes(3);
        for (const index of [1, 2]) {
            const call = request(fetch, index);
            expect(call.init.method).toBe("GET");
            expect(new URL(call.url).pathname).toBe("/conversational-ai/v1/projects/app/numbers");
            expect(new URL(call.url).searchParams.get("limit")).toBe("100");
        }
        expect(new URL(request(fetch, 2).url).searchParams.get("cursor")).toBe("next");
    });
});

describe("configuration lifecycle", () => {
    it("forks one immutable configuration into a running session or a saved handle", async () => {
        const { client, fetch } = setup([
            response({ agent_id: "running-1" }),
            response(saved()),
            response(saved()),
            response(saved({ greeting: { mode: "text", text: "Updated" } })),
            response(number()),
            response({ ...number(), inbound: { agent: "agent-1" } }),
            response(page([{ ...number(), inbound: { agent: "agent-1" } }])),
        ]);
        const config = new Agent({ client }).withMllm(
            new OpenAIRealtime({
                apiKey: "inline-key",
                model: "gpt-realtime",
                instructions: "Help callers",
            }),
        );
        const original = config.config;
        const session = config.createSession({ channel: "room", agentUid: "1", remoteUids: ["*"], token: "rtc-token" });
        expect(await session.start()).toBe("running-1");
        expect(request(fetch).url).toContain("/join");
        const options: SaveOptions = { name: "Support" };
        const stored = await config.save(options);
        expect(stored).toBeInstanceOf(SavedAgent);
        expect(stored).toBeInstanceOf(DeployedAgent);
        expect(stored.id).toBe("agent-1");
        expect(stored.raw).toBe(client.v3.agents);
        const updated = await stored.update(config.withGreeting("Updated"));
        expect(updated.id).toBe(stored.id);
        expect(body(fetch, 3).agent_name).toBe(stored.name);
        expect(body(fetch, 3).greeting).toEqual({ mode: "text", text: "Updated" });
        expect(new Headers(request(fetch, 3).init.headers).get("if-match")).toBe('"v1"');
        await updated.assignNumber("num-1");
        expect(body(fetch, 5).inbound.agent).toBe(stored.id);
        expect(await updated.listNumbers()).toHaveLength(1);
        expect(config.config).toEqual(original);
        expect(session.id).toBe("running-1");
        expect("start" in stored).toBe(false);
        expect(typeof stored.createSession).toBe("function");
    });
    it("shares provisioning resources and keeps compatibility aliases", async () => {
        const { client, fetch } = setup([
            response({ name: "keys" }),
            response(number()),
            response(saved()),
            response(saved()),
        ]);
        expect(client.secrets).toBe(client.v3.secrets);
        expect(client.numbers).toBe(client.v3.numbers);
        await client.secrets.create({ name: "keys", secrets: { key: "secret" } });
        await client.numbers.create({ number: "+12025550123", sip_trunk: { hostname: "sip.example" } });
        const config = new Agent({ client });
        expect(await config.deploy({ name: "Legacy" })).toBeInstanceOf(SavedAgent);
        expect(await SavedAgent.get(client, "agent-1")).toBeInstanceOf(DeployedAgent);
        expect(DeployedAgent).toBe(SavedAgent);
        expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("snapshots the save target while the current configuration is being fetched", async () => {
        const { client, fetch } = setup([response(saved())]);
        let releaseGet!: () => void;
        let getStarted!: () => void;
        const pendingGet = new Promise<void>((resolve) => {
            releaseGet = resolve;
        });
        const started = new Promise<void>((resolve) => {
            getStarted = resolve;
        });
        fetch.mockImplementationOnce(async () => {
            getStarted();
            await pendingGet;
            return response(saved(), 200, '"original-etag"');
        });
        const options: SaveOptions = { name: "Original", agentId: "agent-1" };
        const pendingSave = new Agent({ client }).save(options);
        await started;
        options.agentId = "different-agent";
        options.name = "Changed";
        releaseGet();
        await pendingSave;
        expect(request(fetch, 0).url).toMatch(/\/agents\/agent-1$/);
        expect(request(fetch, 1).url).toMatch(/\/agents\/agent-1$/);
        expect(request(fetch, 1).init.method).toBe("PATCH");
        expect(new Headers(request(fetch, 1).init.headers).get("if-match")).toBe('"original-etag"');
        expect(body(fetch, 1).agent_name).toBe("Original");
    });
    it("rejects cross-client updates before a request", async () => {
        const first = setup([response(saved())]);
        const second = setup();
        const stored = await new Agent({ client: first.client }).save({ name: "Support" });
        expect(() => stored.update(new Agent({ client: second.client }))).toThrow("same client");
        expect(first.fetch).toHaveBeenCalledTimes(1);
        expect(second.fetch).not.toHaveBeenCalled();
    });
    it("rejects realtime interaction language even when vendor turn settings override it", () => {
        const { client, fetch } = setup();
        const config = new Agent({ client })
            .withMllm(
                new OpenAIRealtime({
                    apiKey: "key",
                    model: "gpt-realtime",
                    turnDetection: { mode: "server_vad" },
                }),
            )
            .withTurnDetection({ language: "ja-JP" });
        expect(() => config.save()).toThrow(UnsupportedFieldError);
        try {
            config.save();
        } catch (error) {
            expect((error as UnsupportedFieldError).fields).toContain("turnDetection.language");
        }
        expect(fetch).not.toHaveBeenCalled();
    });
});

describe("stored and ephemeral session adapters", () => {
    it("starts a saved identity, reads its real session ID, and stops with no body", async () => {
        const { client, fetch } = setup([
            response(saved()),
            response({ agent_session_id: "session/a", status: "running", created_at: 123 }, 201),
            response({
                agent_session_id: "session/a",
                status: "RUNNING",
                start_ts: 123,
                analysis: { result: { resolved: true } },
            }),
            response({}),
        ]);
        const stored = await SavedAgent.get(client, "agent-1");
        const options = {
            channel: "room",
            agentUid: "1002",
            remoteUids: ["1001"],
            name: "reference",
            labels: { owner: "test" },
            idleTimeout: 60,
            maxDuration: 120,
        };
        const session = stored.createSession(options);
        options.remoteUids.push("changed");
        options.labels.owner = "changed";
        expect(fetch).toHaveBeenCalledTimes(1);
        const started = vi.fn(),
            stopped = vi.fn();
        session.on("started", started);
        session.on("stopped", stopped);
        expect(await session.start()).toBe("session/a");
        expect(session.status).toBe("running");
        expect(session.id).toBe("session/a");
        expect(body(fetch, 1)).toEqual({
            agent_id: "agent-1",
            labels: { owner: "test" },
            transport: { type: "rtc", channel: "room", uid: "1002", subscribe_uids: ["1001"] },
            lifecycle: { idle_timeout_ms: 60000, max_duration_ms: 120000 },
        });
        expect(request(fetch, 1).url).toMatch(/\/sessions$/);
        const info = await session.getInfo();
        expect(info.agent_session_id).toBe("session/a");
        expect(info).not.toHaveProperty("agent_id");
        expect(request(fetch, 2).url).toMatch(/\/sessions\/session%2Fa$/);
        await session.stop();
        expect(request(fetch, 3).url).toMatch(/\/sessions\/session%2Fa\/stop$/);
        expect(request(fetch, 3).init.body).toBeUndefined();
        expect(session.status).toBe("stopped");
        expect(started).toHaveBeenCalledOnce();
        expect(stopped).toHaveBeenCalledOnce();
    });
    it("automatically starts an unsaved configuration with secrets and variables inline", async () => {
        const { client, fetch } = setup([
            response({ agent_session_id: "ephemeral", status: "running", created_at: 123 }, 201),
            response({}),
        ]);
        const config = new Agent({ client })
            .withMllm(
                new OpenAIRealtime({
                    apiKey: secretRef("support", "key"),
                    model: "gpt-realtime",
                    instructions: "Help",
                }),
            )
            .withVariable("resolved", { type: "bool" });
        const before = config.config;
        const session = config.createSession({ channel: "room", agentUid: "1", remoteUids: ["2"] });
        expect(fetch).not.toHaveBeenCalled();
        expect(await session.start()).toBe("ephemeral");
        expect(request(fetch).url).toMatch(/\/sessions\/ephemeral$/);
        expect(body(fetch).agent).not.toHaveProperty("agent_name");
        expect(body(fetch)).not.toHaveProperty("agent_id");
        expect(body(fetch).agent.variables).toEqual({ resolved: { type: "bool" } });
        expect(body(fetch).agent.pipeline.mllm.credential.api_key).toBe("$secrets.support.key");
        expect(config.config).toEqual(before);
        for (const call of [
            () => session.say("Hi"),
            () => session.interrupt(),
            () => session.think("Hi"),
            () => session.update({}),
            () => session.getHistory(),
            () => session.getTurns(),
            () => session.getAllTurns(),
        ])
            await expect(call()).rejects.toBeInstanceOf(UnsupportedSessionOperationError);
        expect(() => session.raw).toThrow(UnsupportedSessionOperationError);
        expect(() => session.rawAgentManagement).toThrow(UnsupportedSessionOperationError);
        expect(fetch).toHaveBeenCalledTimes(1);
        await session.stop();
    });
    it("does not retry session creation and preserves failures/events", async () => {
        const { client, fetch } = setup([response({ reason: "Busy" }, 503)]);
        const session = new Agent({ client })
            .withVariable("choice", { type: "bool" })
            .createSession({ channel: "room", agentUid: "1", remoteUids: ["2"] });
        const error = vi.fn();
        session.on("error", error);
        await expect(session.start()).rejects.toMatchObject({ statusCode: 503 });
        expect(session.status).toBe("error");
        expect(session.id).toBeNull();
        expect(error).toHaveBeenCalledOnce();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("rejects unsupported session options without silently losing them", () => {
        const { client, fetch } = setup();
        const config = new Agent({ client }).withVariable("choice", { type: "bool" });
        for (const extra of [
            { preset: "x" },
            { pipelineId: "published" },
            { expiresIn: 60 },
            { enableStringUid: true },
            { idleTimeout: -1 },
            { maxDuration: NaN },
        ]) {
            expect(() =>
                config.createSession({ channel: "room", agentUid: "1", remoteUids: ["2"], ...extra }),
            ).toThrow();
        }
        expect(fetch).not.toHaveBeenCalled();
    });
    it("propagates TaskNotFound stop responses", async () => {
        const { client, fetch } = setup([
            response({ agent_session_id: "s", status: "running", created_at: 1 }, 201),
            response({ reason: "TaskNotFound" }, 404),
        ]);
        const session = new Agent({ client })
            .withVariable("choice", { type: "bool" })
            .createSession({ channel: "room", agentUid: "1", remoteUids: ["2"] });
        await session.start();
        await expect(session.stop()).rejects.toMatchObject({ statusCode: 404, body: { reason: "TaskNotFound" } });
        expect(session.status).toBe("error");
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
