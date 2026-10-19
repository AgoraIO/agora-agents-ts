import { describe, expect, it, vi } from "vitest";
import { buildV3Agent, redeployPatch } from "../../../src/agentkit/v3.js";
import {
    Agent,
    AgoraClient,
    Area,
    DeepgramSTT,
    DeployedAgent,
    OpenAI,
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
        v3: { baseUrl: "https://staging.test", headers: { "X-Consumer-Username": "test" } },
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
        expect(r.url).toBe("https://staging.test/conversational-ai/v3/projects/app/agents/a%2Fb");
        expect(new Headers(r.init.headers).get("authorization")).toBe("agora token=token");
        expect(new Headers(r.init.headers).get("x-consumer-username")).toBe("test");
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
        await client.v3.secrets.create({ name: "s", secrets: { key: "value" }, idempotencyKey: "once" });
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
        expect(() => base.createSession({ channel: "room", agentUid: "1", remoteUids: ["*"] })).toThrow(
            SecretRefNotSupportedError,
        );
        expect(() => agent.withVariable("Bad", { type: "str" })).toThrow();
        expect(() => agent.withVariable("missing", { type: "str", extract: true })).toThrow();
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
                    authorization: "Bearer per-call",
                    headers: {
                        "X-Tenant": "tenant-1",
                        "If-Match": "stale",
                        "If-None-Match": "*",
                        "Idempotency-Key": "write",
                    },
                },
            )
            .catch((error) => error);
        await error.latest();
        const latest = request(fetch, 1);
        const headers = new Headers(latest.init.headers);
        expect(latest.init.method).toBe("GET");
        expect(headers.get("Authorization")).toBe("Bearer per-call");
        expect(headers.get("X-Tenant")).toBe("tenant-1");
        for (const name of ["If-Match", "If-None-Match", "Idempotency-Key"]) expect(headers.has(name)).toBe(false);
    });
});
