import { describe, expect, it, vi } from "vitest";
import * as tokenModule from "../../../src/agentkit/token.js";
import {
    Agent,
    AgoraClient,
    AmazonBedrock,
    Area,
    AresSTT,
    AssemblyAISTT,
    DeepgramSTT,
    Gemini,
    GenericAvatar,
    HeyGenAvatar,
    MiniMaxTTS,
    OpenAI,
    SarvamSTT,
    SavedAgent,
    SpeechmaticsSTT,
    secretRef,
} from "../../../src/index.js";

const response = (data: unknown) =>
    new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", ETag: '"1"' } });
function setup(credentials = false) {
    const fetch = vi.fn(async () =>
        response({
            agent_id: "saved",
            agent_name: "Support",
            agent_session_id: "session",
            status: "RUNNING",
            create_ts: 1,
        }),
    );
    const client = new AgoraClient({
        area: Area.US,
        appId: credentials ? "a".repeat(32) : "app",
        authToken: "token",
        ...(credentials ? { appCertificate: "b".repeat(32) } : {}),
        fetch,
    });
    return { client, fetch };
}
const body = (fetch: ReturnType<typeof vi.fn>, i = 0) => JSON.parse(fetch.mock.calls[i][1].body);
describe("Platform docs feedback", () => {
    it("defaults OpenAI vendor and lets the service validate new managed models", async () => {
        const { client, fetch } = setup();
        const agent = new Agent({ client }).withLlm(new OpenAI({ model: "gpt-5.6-luna" }));
        await agent.save();
        expect(body(fetch).pipeline.llm).toMatchObject({
            vendor: "openai",
            model: "gpt-5.6-luna",
            credential: { mode: "managed" },
        });
        await agent.createEphemeralSession({ channel: "room", remoteUids: ["2"], idleTimeout: 30 }).start();
        expect(String(fetch.mock.calls[1][0])).toContain("/sessions/ephemeral");
        expect(body(fetch, 1).lifecycle).toEqual({ idle_timeout_ms: 30000 });
    });
    it.each([undefined, "https://gemini.example/stream"])(
        "maps Gemini credentials without placing secret refs in URLs: %s",
        async (url) => {
            const { client, fetch } = setup();
            await new Agent({ client })
                .withLlm(new Gemini({ apiKey: secretRef("models", "gemini"), model: "gemini-flash", url }))
                .save();
            const llm = body(fetch).pipeline.llm;
            expect(llm.vendor).toBe("gemini");
            expect(llm.credential.fields.api_key).toBe("$secrets.models.gemini");
            expect(llm.url).not.toContain("key=");
            expect(llm.url).not.toContain("$secrets");
        },
    );
    it("supports Bedrock API keys and rejects mixed credentials", async () => {
        const { client, fetch } = setup();
        await new Agent({ client })
            .withLlm(new AmazonBedrock({ apiKey: secretRef("aws", "key"), region: "us-east-1", model: "model" }))
            .save();
        expect(body(fetch).pipeline.llm).toMatchObject({
            vendor: "amazon",
            credential: { fields: { api_key: "$secrets.aws.key" } },
        });
        expect(
            () =>
                new AmazonBedrock({
                    apiKey: "key",
                    accessKey: "id",
                    secretKey: "secret",
                    region: "us-east-1",
                    model: "m",
                }),
        ).toThrow("not both");
    });
    it("maps ARES keywords and default language", async () => {
        const { client, fetch } = setup();
        await new Agent({ client }).withStt(new AresSTT({ keywords: ["Agora"] })).save();
        expect(body(fetch).pipeline.asr).toMatchObject({
            vendor: "ares",
            language: "en-US",
            params: { keywords: ["Agora"] },
        });
    });
    it("preserves vendor language and promotes endpoint aliases", async () => {
        for (const [stt, language, url] of [
            [new DeepgramSTT({ apiKey: secretRef("asr", "key"), model: "nova-3", language: "fr" }), "fr", undefined],
            [new SarvamSTT({ apiKey: secretRef("asr", "key"), language: "hi-IN" }), "hi-IN", undefined],
            [
                new AssemblyAISTT({
                    apiKey: secretRef("asr", "key"),
                    language: "en",
                    ws_url: "wss://assembly.example",
                }),
                "en",
                "wss://assembly.example",
            ],
            [
                new SpeechmaticsSTT({ key: secretRef("asr", "key"), language: "en", uri: "wss://speech.example" }),
                "en",
                "wss://speech.example",
            ],
        ] as const) {
            const { client, fetch } = setup();
            await new Agent({ client }).withStt(stt).save();
            const asr = body(fetch).pipeline.asr;
            expect(asr.language).toBe(language);
            expect(asr.params?.language).toBe(asr.vendor === "deepgram" ? undefined : language);
            expect(asr.url).toBe(url);
        }
    });
    it("preserves MiniMax nested extras and typed voice/audio settings", async () => {
        const { client, fetch } = setup();
        await new Agent({ client })
            .withTts(
                new MiniMaxTTS({
                    model: "speech-2.8-turbo",
                    voiceId: "voice",
                    speed: 1.2,
                    sampleRate: 24000,
                    additionalParams: {
                        voice_setting: { emotion: "happy", speed: 0.5 },
                        audio_setting: { format: "pcm" },
                    },
                }),
            )
            .save();
        expect(body(fetch).pipeline.tts.params).toMatchObject({
            voice_setting: { voice_id: "voice", speed: 1.2, emotion: "happy" },
            audio_setting: { sample_rate: 24000, format: "pcm" },
        });
    });
    it("keeps generic avatar endpoints in params and maps HeyGen to LiveAvatar", async () => {
        const { client, fetch } = setup();
        await new Agent({ client })
            .withAvatar(
                new GenericAvatar({
                    apiKey: secretRef("avatar", "key"),
                    apiBaseUrl: "https://avatar.example",
                    avatarId: "avatar",
                    agoraUid: "3",
                }),
            )
            .save();
        expect(body(fetch).pipeline.avatar.params.api_base_url).toBe("https://avatar.example");
        expect(body(fetch).pipeline.avatar.url).toBeUndefined();
        await new Agent({ client })
            .withAvatar(new HeyGenAvatar({ apiKey: secretRef("avatar", "key"), avatarId: "avatar", agoraUid: "3" }))
            .save();
        expect(body(fetch, 1).pipeline.avatar.vendor).toBe("liveavatar");
    });
    it("generates a fixed-UID RTC token, preserves explicit tokens, and leaves automatic UID to the server", async () => {
        const { client, fetch } = setup(true);
        const agent = new Agent({ client });
        await agent.createEphemeralSession({ channel: "room", agentUid: "1", remoteUids: ["2"] }).start();
        expect(body(fetch).transport.token).toMatch(/^007/);
        await agent
            .createEphemeralSession({ channel: "room", agentUid: "1", remoteUids: ["2"], token: "provided" })
            .start();
        expect(body(fetch, 1).transport.token).toBe("provided");
        await agent.createEphemeralSession({ channel: "room", remoteUids: ["2"] }).start();
        expect(body(fetch, 2).transport.token).toBeUndefined();
    });
    it("creates saved and unsaved outbound calls and accepts full inbound end-call policy", async () => {
        const { client, fetch } = setup();
        const saved = await SavedAgent.get(client, "saved");
        const opts = {
            from: "12345678-1234-1234-1234-123456789abc",
            to: "+12025550123",
            callPolicy: { max_ring_duration_ms: 30000 },
        };
        await saved.call(opts).start();
        expect(body(fetch, 1).transport).toEqual({
            type: "telephony",
            from: opts.from,
            to: opts.to,
            call_policy: opts.callPolicy,
        });
        await new Agent({ client }).call(opts).start();
        expect(String(fetch.mock.calls[2][0])).toContain("sessions/ephemeral");
        await saved.assignNumber("number", { callPolicy: { end_call: { on_user_request: true } } });
        expect(body(fetch, 4).inbound.call_policy.end_call).toEqual({ on_user_request: true });
    });
    it("retains optional session analysis and both secret-key metadata shapes", async () => {
        const { client, fetch } = setup();
        fetch.mockResolvedValueOnce(
            response({
                agent_session_id: "session",
                start_ts: 1,
                status: "STOPPED",
                analysis: { status: "completed", complete_ts: 2, result: { resolved: true } },
            }),
        );
        const info = await client.v3.sessions.get({ agentSessionId: "session" });
        expect(info.analysis?.result).toEqual({ resolved: true });
        for (const keys of [["llm"], [{ key: "llm", create_ts: 1, update_ts: 2 }]]) {
            fetch.mockResolvedValueOnce(response({ name: "models", keys, create_ts: 1, update_ts: 2 }));
            expect((await client.secrets.get({ name: "models" })).keys).toEqual(keys);
        }
        fetch.mockResolvedValueOnce(response({ key: "llm", create_ts: 1, update_ts: 2 }));
        expect((await client.secrets.setKey({ name: "models", key: "llm", value: "new" })).update_ts).toBe(2);
    });
    it("reuses a generated RTC token and idempotency key after a failed first start", async () => {
        const { client, fetch } = setup(true);
        fetch.mockResolvedValueOnce(new Response(JSON.stringify({ reason: "TemporaryFailure" }), { status: 503 }));
        const session = new Agent({ client }).createEphemeralSession({
            channel: "room",
            agentUid: "1",
            remoteUids: ["2"],
            idempotencyKey: "same-request",
        });
        expect(fetch).not.toHaveBeenCalled();
        await expect(session.start()).rejects.toThrow();
        await session.start();
        expect(body(fetch, 0)).toEqual(body(fetch, 1));
        expect(new Headers(fetch.mock.calls[1][1].headers).get("idempotency-key")).toBe("same-request");
    });
    it.each([
        ["4294967295", true],
        ["4294967296", false],
        ["9007199254740993", false],
    ] as const)("preserves numeric UID %s without rounding", async (uid, generated) => {
        const { client, fetch } = setup(true);
        await new Agent({ client })
            .createEphemeralSession({ channel: "room", agentUid: uid, remoteUids: ["2"] })
            .start();
        expect(body(fetch).transport.uid).toBe(uid);
        if (generated) expect(body(fetch).transport.token).toMatch(/^007/);
        else expect(body(fetch).transport.token).toBeUndefined();
    });
    it.each([undefined, "https://gemini.example/stream?key=old"])(
        "strips Gemini query keys with a custom vendor: %s",
        async (url) => {
            const { client, fetch } = setup();
            await new Agent({ client })
                .withLlm(
                    new Gemini({ apiKey: secretRef("models", "gemini"), model: "gemini-flash", vendor: "custom", url }),
                )
                .save();
            const llm = body(fetch).pipeline.llm;
            expect(llm.vendor).toBe("custom");
            expect(llm.url).not.toContain("key=");
            expect(llm.url).not.toContain("%24secrets");
            expect(llm.credential.fields.api_key).toBe("$secrets.models.gemini");
        },
    );
    it("refreshes generated tokens for new unkeyed sessions while preserving retry payloads", async () => {
        const { client, fetch } = setup(true);
        let count = 0;
        const signing = vi.spyOn(tokenModule, "generateConvoAIToken").mockImplementation(() => `generated-${++count}`);
        try {
            const session = new Agent({ client }).createEphemeralSession({
                channel: "room",
                agentUid: "1",
                remoteUids: ["2"],
            });
            await session.start();
            await session.stop();
            fetch.mockResolvedValueOnce(new Response(JSON.stringify({ reason: "TemporaryFailure" }), { status: 503 }));
            await expect(session.start()).rejects.toThrow();
            await session.start();
            expect(body(fetch, 0).transport.token).toBe("generated-1");
            expect(body(fetch, 2).transport.token).toBe("generated-2");
            expect(body(fetch, 3).transport.token).toBe("generated-2");
        } finally {
            signing.mockRestore();
        }
    });
    it("rejects mixed RTC and phone options before replacing transport placeholders", () => {
        const { client, fetch } = setup();
        const config = new Agent({ client });
        const saved = new SavedAgent(client, { agent_id: "saved", agent_name: "Support" } as never, '"1"');
        for (const handle of [config, saved])
            for (const extra of [{ channel: "room" }, { remoteUids: ["2"] }, { expiresIn: 60 }]) {
                expect(() => handle.call({ from: "number", to: "+12025550123", ...extra } as never)).toThrow(
                    "RTC option",
                );
            }
        expect(fetch).not.toHaveBeenCalled();
    });
});
