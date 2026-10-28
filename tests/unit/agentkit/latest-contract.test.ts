import { describe, expect, it, vi } from "vitest";
import { redeployPatch } from "../../../src/agentkit/v3.js";
import type { V3 } from "../../../src/index.js";
import {
    Agent,
    AgoraClient,
    AmazonBedrock,
    AmazonSTT,
    AmazonTTS,
    Area,
    OpenAI,
    OpenAIRealtime,
    SavedAgent,
    secretRef,
} from "../../../src/index.js";

const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ETag: '"next"' } });
function setup(replies: Response[] = []) {
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => replies.shift() ?? response({}));
    const client = new AgoraClient({
        area: Area.US,
        appId: "app",
        appCertificate: "certificate",
        authToken: "token",
        fetch,
    });
    return { client, fetch };
}
const body = (fetch: ReturnType<typeof vi.fn>, index = 0) => JSON.parse(fetch.mock.calls[index][1].body);
const saved = { agent_id: "saved", agent_name: "Support" };
const started = { agent_session_id: "session", status: "RUNNING", create_ts: 1 };
describe("latest public contract", () => {
    it("maps multipart credentials from public Amazon builders without storing inline secrets", async () => {
        const { client, fetch } = setup([response(saved)]);
        const config = new Agent({ client })
            .withStt(
                new AmazonSTT({
                    accessKey: secretRef("aws", "id"),
                    secretKey: secretRef("aws", "secret"),
                    region: "us-east-1",
                    language: "en-US",
                }),
            )
            .withTts(
                new AmazonTTS({
                    accessKey: secretRef("aws", "id"),
                    secretKey: secretRef("aws", "secret"),
                    region: "us-east-1",
                    voiceId: "Joanna",
                    engine: "neural",
                }),
            );
        await config.save({ name: "Support" });
        expect(body(fetch).pipeline.asr.credential).toEqual({
            mode: "byok",
            fields: { access_key_id: "$secrets.aws.id", secret_access_key: "$secrets.aws.secret" },
        });
        expect(body(fetch).pipeline.tts.credential).toEqual({
            mode: "byok",
            fields: { aws_access_key_id: "$secrets.aws.id", aws_secret_access_key: "$secrets.aws.secret" },
        });
        expect(body(fetch).pipeline.asr.params).not.toHaveProperty("access_key_id");
        await expect(
            config
                .withStt(
                    new AmazonSTT({ accessKey: "inline", secretKey: "inline", region: "us-east-1", language: "en-US" }),
                )
                .save(),
        ).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("maps the public Bedrock builder's top-level multipart credentials", async () => {
        const { client, fetch } = setup([response(saved)]);
        const config = new Agent({ client }).withLlm(
            new AmazonBedrock({
                accessKey: secretRef("aws", "id"),
                secretKey: secretRef("aws", "secret"),
                region: "us-east-1",
                model: "model",
            }),
        );
        const before = config.config;
        await config.save();
        expect(body(fetch).pipeline.llm).toMatchObject({
            vendor: "amazon",
            style: "bedrock",
            credential: { mode: "byok", fields: { access_key: "$secrets.aws.id", secret_key: "$secrets.aws.secret" } },
            params: { region: "us-east-1" },
        });
        expect(config.config).toEqual(before);
    });
    it("rejects inline saved credentials but accepts the same builder for ephemeral sessions with automatic UID", async () => {
        const { client, fetch } = setup([response(started)]);
        const config = new Agent({ client }).withLlm(
            new OpenAI({ apiKey: "inline", url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" }),
        );
        await expect(config.save()).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
        const session = config
            .withVariable("name", { type: "str" })
            .createSession({ channel: "room", remoteUids: ["user"], values: { name: "Ada" } });
        await session.start();
        expect(body(fetch).transport).not.toHaveProperty("uid");
        expect(body(fetch).agent.pipeline.llm.credential).toEqual({ mode: "byok", fields: { api_key: "inline" } });
    });
    it("clears known credential names when switching providers, and fields entirely for managed", () => {
        const previous = {
            ...saved,
            pipeline: { mode: "cascaded", tts: { vendor: "amazon", credential: { mode: "byok" } } },
        } as V3.AgentResponse;
        const desired: V3.AgentCreateRequest = {
            agent_name: "Support",
            pipeline: {
                mode: "cascaded",
                tts: { vendor: "elevenlabs", credential: { mode: "byok", fields: { key: "$secrets.voice.key" } } },
            },
        };
        expect((redeployPatch(previous, desired).pipeline as any).tts.credential.fields).toEqual({
            aws_access_key_id: null,
            aws_secret_access_key: null,
            key: "$secrets.voice.key",
        });
        desired.pipeline = { mode: "cascaded", tts: { vendor: "elevenlabs", credential: { mode: "managed" } } };
        expect((redeployPatch(previous, desired).pipeline as any).tts.credential).toEqual({
            mode: "managed",
            fields: null,
        });
    });
    it("clears hidden credentials when the same provider changes authentication form", () => {
        const previous = {
            ...saved,
            pipeline: { mode: "cascaded", llm: { vendor: "amazon", credential: { mode: "byok" } } },
        } as V3.AgentResponse;
        const patch = redeployPatch(previous, {
            agent_name: "Support",
            pipeline: {
                mode: "cascaded",
                llm: {
                    vendor: "amazon",
                    credential: {
                        mode: "byok",
                        fields: { access_key: "$secrets.aws.id", secret_key: "$secrets.aws.secret" },
                    },
                },
            },
        });
        expect((patch.pipeline as any).llm.credential.fields).toEqual({
            api_key: null,
            access_key: "$secrets.aws.id",
            secret_key: "$secrets.aws.secret",
        });
    });
    it("updates saved sessions through their public handle with token, messages and complete params replacement", async () => {
        const { client, fetch } = setup([response(saved), response(started), response({}), response({})]);
        const handle = await SavedAgent.get(client, "saved");
        const session = handle.createSession({ channel: "room", remoteUids: ["2"] });
        await session.start();
        await session.update({
            token: "renewed",
            messages: [{ role: "system", content: "New instructions" }],
            llm: { params: { temperature: 0.5 } },
        });
        expect(body(fetch, 2)).toEqual({
            transport: { token: "renewed" },
            agent: {
                overrides: {
                    messages: [{ role: "system", content: "New instructions" }],
                    pipeline: { llm: { params: { temperature: 0.5 } } },
                },
            },
        });
        expect(fetch.mock.calls[2][0]).toMatch(/\/sessions\/session$/);
        expect(fetch.mock.calls[2][1]?.method).toBe("PATCH");
        await session.update({ llm: { system_messages: [{ role: "system", content: "" }], params: {} } });
        expect(body(fetch, 3)).toEqual({
            agent: { overrides: { messages: [{ role: "system", content: "" }], pipeline: { llm: { params: {} } } } },
        });
        await expect(session.update({ llm: { params: { url: "https://other.test" } } })).rejects.toThrow("endpoint");
        await expect(session.update({ token: "" })).rejects.toThrow();
        await expect(session.update({ llm: { params: {} }, mllm: { params: {} } })).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(4);
    });
    it("uses the same messages update API for existing inline sessions without mutating input", async () => {
        const { client, fetch } = setup([response({ agent_id: "legacy" }), response({})]);
        const session = new Agent({ client })
            .withMllm(new OpenAIRealtime({ apiKey: "inline", model: "gpt-realtime" }))
            .createSession({ channel: "room", agentUid: "1", remoteUids: ["2"], token: "rtc" });
        await session.start();
        const update = {
            messages: [{ role: "system" as const, content: "Help" }],
            mllm: { params: { temperature: 0.3 } },
        };
        const before = JSON.parse(JSON.stringify(update));
        await session.update(update);
        expect(body(fetch, 1)).toMatchObject({
            properties: { llm: { system_messages: update.messages }, mllm: { params: { temperature: 0.3 } } },
        });
        expect(body(fetch, 1).properties).not.toHaveProperty("messages");
        expect(update).toEqual(before);
        await expect(session.update({ ...update, llm: { system_messages: [] } })).rejects.toThrow("not both");
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("rejects realtime updates on saved sessions before HTTP", async () => {
        const { client, fetch } = setup([response(saved), response(started)]);
        const session = (await SavedAgent.get(client, "saved")).createSession({ channel: "room", remoteUids: ["2"] });
        await session.start();
        await expect(session.update({ mllm: { params: { temperature: 0.4 } } })).rejects.toThrow("mllm");
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("rejects low-level realtime payloads before HTTP", async () => {
        const { client, fetch } = setup();
        for (const pipeline of [{ mode: "realtime" }, { mllm: { params: {} } }]) {
            await expect(client.v3.agents.create({ agent_name: "test", pipeline } as any)).rejects.toThrow("MLLM");
            await expect(client.v3.agents.update({ id: "agent", pipeline } as any)).rejects.toThrow("MLLM");
            await expect(
                client.v3.sessions.startEphemeral({
                    agent: { pipeline },
                    transport: { type: "rtc", channel: "room", subscribe_uids: ["2"] },
                } as any),
            ).rejects.toThrow("MLLM");
            await expect(
                client.v3.sessions.update({ agentSessionId: "session", agent: { overrides: { pipeline } } } as any),
            ).rejects.toThrow("MLLM");
        }
        expect(fetch).not.toHaveBeenCalled();
    });
    it("exposes typed session PATCH errors without retries", async () => {
        const { client, fetch } = setup([response({ reason: "TaskConflict" }, 409)]);
        await expect(
            client.v3.sessions.update({ agentSessionId: "s", transport: { token: "new" } }),
        ).rejects.toMatchObject({ statusCode: 409, body: { reason: "TaskConflict" } });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("transmits new campaign and number fields without restoring removed retry controls", async () => {
        const { client, fetch } = setup();
        await client.campaigns.create({
            name: "Call",
            agent_id: "agent",
            transport: { type: "telephony", from: "number", call_policy: { end_call: { on_voicemail: true } } },
            contacts: [{ phone: "+12025550123" }],
            schedule: { mode: "immediate" },
            data_policy: { retention: "none" },
            idempotencyKey: "campaign",
        });
        expect(body(fetch).data_policy).toEqual({ retention: "none" });
        expect(body(fetch).transport.call_policy.end_call.on_voicemail).toBe(true);
        expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Idempotency-Key")).toBe("campaign");
        await client.numbers.create({
            number: "+12025550123",
            sip_trunk: { hostname: "sip.example", allowed_ips: ["203.0.113.1"] },
            inbound: { agent: "agent", call_policy: { end_call: { on_conversation_complete: true } } },
        });
        expect(body(fetch, 1).sip_trunk.allowed_ips).toEqual(["203.0.113.1"]);
    });
    it("does not turn release region availability into a preview SDK gate", async () => {
        const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
            response(init?.method === "POST" && String(_input).endsWith("/sessions") ? started : saved),
        );
        const client = new AgoraClient({
            area: Area.CN,
            appId: "app",
            appCertificate: "cert",
            authToken: "token",
            fetch,
        });
        const handle = await new Agent({ client }).save({ name: "Support" });
        await handle.createSession({ channel: "room", remoteUids: ["2"] }).start();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(String(fetch.mock.calls[1][0])).toContain(
            "preview.ai.agora.io/conversational-ai/v1/projects/app/sessions",
        );
    });
    it("returns the current typed PATCH response", async () => {
        const { client } = setup([response(started)]);
        const updated = await client.v3.sessions.update({ agentSessionId: "session", transport: { token: "new" } });
        expect(updated.agent_session_id).toBe("session");
        expect(updated.create_ts).toBe(1);
        expect(updated.status).toBe("RUNNING");
    });
    it.each(["a b", "é", "x".repeat(257)])(
        "rejects an invalid idempotency key across header sources: %s",
        async (key) => {
            const { client, fetch } = setup();
            await expect(client.campaigns.pause({ id: "campaign", idempotencyKey: key })).rejects.toThrow("ASCII");
            await expect(
                client.campaigns.pause({ id: "campaign" }, { headers: { "Idempotency-Key": key } }),
            ).rejects.toThrow("ASCII");
            expect(() =>
                new Agent({ client }).createSession({ channel: "room", remoteUids: ["2"], idempotencyKey: key }),
            ).toThrow("ASCII");
            expect(fetch).not.toHaveBeenCalled();
        },
    );
    it("secret references use the current write-name alphabet", () => {
        expect(secretRef("support_prod", "api_key")).toBe("$secrets.support_prod.api_key");
        expect(() => secretRef("support-prod", "key")).toThrow();
    });
});
