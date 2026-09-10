import { describe, expect, test, vi } from "vitest";
import { AgoraClient } from "../../../src/AgoraPoolClient.js";
import { Agent } from "../../../src/agentkit/Agent.js";
import { redactHeadersForDebug, redactSecrets } from "../../../src/agentkit/debug.js";
import { Gemini } from "../../../src/agentkit/vendors/llm.js";
import { GeminiSTT } from "../../../src/agentkit/vendors/stt.js";
import { GoogleTTS } from "../../../src/agentkit/vendors/tts.js";
import { Area } from "../../../src/core/domain/index.js";

// A fake key shaped like a real one: this test asserts the value never
// reaches the log, so it has to look like the credential being redacted.
const GOOGLE_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";

describe("redactSecrets", () => {
    test("redacts credentials at any depth", () => {
        const redacted = redactSecrets({
            appid: "81190c52971d4004b7244bdcd93e2f34",
            properties: {
                token: "007eJxTYKhsrH10",
                asr: { vendor: "gemini", params: { api_key: GOOGLE_KEY, model: "m", word_timestamp: true } },
                tts: { params: { key: "eleven-key", voice_setting: { voice_id: "v" } } },
                avatar: { params: { agora_token: "avatar-token", agora_uid: "999" } },
            },
        });

        expect(redacted).toEqual({
            appid: "[REDACTED]",
            properties: {
                token: "[REDACTED]",
                asr: { vendor: "gemini", params: { api_key: "[REDACTED]", model: "m", word_timestamp: true } },
                tts: { params: { key: "[REDACTED]", voice_setting: { voice_id: "v" } } },
                avatar: { params: { agora_token: "[REDACTED]", agora_uid: "999" } },
            },
        });
    });

    test("redacts Google TTS credentials and Gemini URL query keys", () => {
        const redacted = redactSecrets({
            llm: {
                url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GOOGLE_KEY}`,
            },
            tts: { params: { credentials: GOOGLE_KEY } },
        });

        expect(JSON.stringify(redacted)).not.toContain(GOOGLE_KEY);
    });

    test("redacts AWS and Google credential field names", () => {
        expect(
            redactSecrets({
                params: {
                    access_key_id: "AKIA123",
                    secret_access_key: "secret",
                    adc_credentials_string: '{"type":"service_account"}',
                    region: "us-east-1",
                },
            }),
        ).toEqual({
            params: {
                access_key_id: "[REDACTED]",
                secret_access_key: "[REDACTED]",
                adc_credentials_string: "[REDACTED]",
                region: "us-east-1",
            },
        });
    });

    test("leaves empty values visible so unset env vars stay diagnosable", () => {
        expect(redactSecrets({ params: { api_key: "" } })).toEqual({ params: { api_key: "" } });
    });

    test("walks arrays and preserves non-secret content", () => {
        expect(redactSecrets({ mcp_servers: [{ name: "a", headers: { authorization: "Bearer x" } }] })).toEqual({
            mcp_servers: [{ name: "a", headers: { authorization: "[REDACTED]" } }],
        });
    });

    test("does not mutate the input", () => {
        const original = { properties: { asr: { params: { api_key: GOOGLE_KEY } } } };
        redactSecrets(original);
        expect(original.properties.asr.params.api_key).toBe(GOOGLE_KEY);
    });
});

describe("redactHeadersForDebug", () => {
    test("keeps the auth scheme but drops the credential", () => {
        expect(redactHeadersForDebug({ authorization: "agora token=abc123" })).toEqual({
            authorization: "agora [REDACTED]",
        });
        expect(redactHeadersForDebug({ Authorization: "Basic dXNlcjpwYXNz" })).toEqual({
            Authorization: "Basic [REDACTED]",
        });
    });

    test("preserves non-authorization headers", () => {
        expect(redactHeadersForDebug({ "x-fern-sdk-name": "agora-agents" })).toEqual({
            "x-fern-sdk-name": "agora-agents",
        });
    });
});

describe("debug output", () => {
    test("logs headers and never prints a live credential", async () => {
        const logs: string[] = [];
        const log = vi.spyOn(console, "log").mockImplementation((...args) => {
            logs.push(args.map(String).join(" "));
        });
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "a1" }), { status: 200 }));

        try {
            await new Agent({
                client: new AgoraClient({
                    area: Area.US,
                    appId: "81190c52971d4004b7244bdcd93e2f34",
                    appCertificate: "test-app-certificate-01234567890",
                    fetch: fetchMock,
                }),
            })
                .withStt(new GeminiSTT({ apiKey: GOOGLE_KEY, model: "gemini-3.7-transcribe-live" }))
                .withLlm(new Gemini({ apiKey: GOOGLE_KEY, model: "gemini-2.0-flash" }))
                .withTts(
                    new GoogleTTS({
                        key: GOOGLE_KEY,
                        voiceName: "en-US-Chirp3-HD-Charon",
                        languageCode: "en-US",
                    }),
                )
                .createSession({ channel: "c", agentUid: "1", remoteUids: ["100"], debug: true })
                .start();
        } finally {
            log.mockRestore();
        }

        const output = logs.join("\n");
        expect(output).not.toContain(GOOGLE_KEY);
        expect(output).not.toContain("81190c52971d4004b7244bdcd93e2f34");
        expect(output).not.toContain("agora-feature");
        // The request itself still carries the real key.
        const sent = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
        expect(sent.properties.asr.params.api_key).toBe(GOOGLE_KEY);
    });
});
