import { describe, expect, test, vi } from "vitest";
import { AgoraClient } from "../../../src/AgoraPoolClient.js";
import { Agent } from "../../../src/agentkit/Agent.js";
import {
    GeminiSTT,
    OpenAIGPTLive,
    PREVIEW_API_BASE_URL,
    requiredPreviewFeatures,
} from "../../../src/agentkit/preview/index.js";
import { Gemini, OpenAI } from "../../../src/agentkit/vendors/llm.js";
import { DeepgramSTT } from "../../../src/agentkit/vendors/stt.js";
import { GoogleTTS, MiniMaxTTS } from "../../../src/agentkit/vendors/tts.js";
import type * as Agora from "../../../src/api/index.js";
import { Area } from "../../../src/core/domain/index.js";

const API_KEY = "AIza-test-key";

function createClient(fetchFn?: typeof fetch, headers?: Record<string, string>) {
    return new AgoraClient({
        area: Area.US,
        appId: "test-app-id-0123456789abcdefghij",
        appCertificate: "test-app-certificate-01234567890",
        ...(fetchFn && { fetch: fetchFn }),
        ...(headers && { headers }),
    });
}

function sessionOptions() {
    return { name: "preview-agent", channel: "preview-channel", agentUid: "1", remoteUids: ["100"] };
}

/**
 * Completes an agent with GA Gemini ASR plus Gemini LLM and Google TTS.
 */
function withGeminiAsr(agent: Agent): Agent {
    return agent
        .withStt(new GeminiSTT({ apiKey: API_KEY, languageCodes: ["en-US"] }))
        .withLlm(new Gemini({ apiKey: API_KEY, model: "gemini-2.0-flash" }))
        .withTts(
            new GoogleTTS({
                key: API_KEY,
                voiceName: "en-US-Chirp3-HD-Charon",
                languageCode: "en-US",
            }),
        );
}

describe("Gemini 3.5 Transcribe ASR (GA)", () => {
    test("serialises to the documented asr wire shape", () => {
        const properties = withGeminiAsr(new Agent({ client: createClient() })).toProperties({
            channel: "preview-channel",
            agentUid: "1",
            remoteUids: ["100"],
            token: "test-token",
        });

        // The top-level asr.language comes from turnDetection, not the vendor.
        expect(properties.asr).toEqual({
            vendor: "gemini",
            language: "en-US",
            params: {
                api_key: API_KEY,
                model: "gemini-3.5-transcribe-live",
                sample_rate: 16000,
                language_hints: ["en-US"],
            },
        });
    });

    test("allows overriding model, sample rate, and word timestamps", () => {
        const config = new GeminiSTT({
            apiKey: API_KEY,
            model: "not-a-real-model",
            sampleRate: 24000,
            wordTimestamp: false,
            additionalParams: { hotwords: ["Agora"] },
        }).toConfig();

        expect(config).toEqual({
            vendor: "gemini",
            params: {
                hotwords: ["Agora"],
                api_key: API_KEY,
                model: "not-a-real-model",
                sample_rate: 24000,
                word_timestamp: false,
            },
        });
    });

    test("emits no top-level language of its own", () => {
        // Every STT vendor leaves asr.language to the Agent, which derives it
        // from turnDetection.language. A vendor-level copy would be a no-op the
        // builder overwrites, so this one does not offer the option at all.
        const config = new GeminiSTT({ apiKey: API_KEY }).toConfig();

        expect(config).not.toHaveProperty("language");
        expect(config.params).not.toHaveProperty("language");
        // Nor does it invent language_hints — absent means auto-detect.
        expect(config.params).not.toHaveProperty("language_hints");
    });

    test("the Agent supplies asr.language from turnDetection", () => {
        const properties = withGeminiAsr(new Agent({ client: createClient() }))
            .withStt(new GeminiSTT({ apiKey: API_KEY }))
            .withTurnDetection({ language: "ja-JP" })
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        expect((properties.asr as { language?: string }).language).toBe("ja-JP");
        expect(properties.turn_detection).toMatchObject({ language: "ja-JP" });
    });

    test("legacy languageCodes maps to GA language_hints", () => {
        const single = new GeminiSTT({ apiKey: API_KEY, languageCodes: ["es-ES"] }).toConfig();
        expect(single.params).toMatchObject({ language_hints: ["es-ES"] });

        const multiple = new GeminiSTT({
            apiKey: API_KEY,
            languageCodes: ["en-US", "es-ES"],
        }).toConfig();
        expect(multiple.params).toMatchObject({ language_hints: ["en-US", "es-ES"] });
    });

    test("an explicit empty languageCodes array still reaches the wire", () => {
        const config = new GeminiSTT({ apiKey: API_KEY, languageCodes: [] }).toConfig();

        // `[]` is the caller spelling auto-detect outright; both that and
        // omitting the field mean the same thing to the provider.
        expect(config.params).toMatchObject({ language_hints: [] });
    });

    test("customVocabulary is sent only when supplied", () => {
        const withVocab = new GeminiSTT({
            apiKey: API_KEY,
            customVocabulary: ["Agora", "Kubernetes"],
        }).toConfig();
        expect(withVocab.params).toMatchObject({ custom_vocabulary: ["Agora", "Kubernetes"] });
        expect(withVocab.params).not.toHaveProperty("word_timestamp");

        const withoutVocab = new GeminiSTT({ apiKey: API_KEY }).toConfig();
        expect(withoutVocab.params).not.toHaveProperty("custom_vocabulary");
    });

    test("wordTimestamp is sent only when explicitly supplied", () => {
        const withoutTimestamp = new GeminiSTT({ apiKey: API_KEY }).toConfig();
        expect(withoutTimestamp.params).not.toHaveProperty("word_timestamp");

        const withTimestamp = new GeminiSTT({ apiKey: API_KEY, wordTimestamp: true }).toConfig();
        expect(withTimestamp.params).toMatchObject({ word_timestamp: true });
    });

    test("rejects customVocabulary with enabled wordTimestamp", () => {
        expect(() =>
            new GeminiSTT({ apiKey: API_KEY, customVocabulary: ["Agora"], wordTimestamp: true }).toConfig(),
        ).toThrow("customVocabulary cannot be used with wordTimestamp=true");
    });

    test("allows customVocabulary with explicitly disabled wordTimestamp", () => {
        const config = new GeminiSTT({
            apiKey: API_KEY,
            customVocabulary: ["Agora"],
            wordTimestamp: false,
        }).toConfig();

        expect(config.params).toMatchObject({
            custom_vocabulary: ["Agora"],
            word_timestamp: false,
        });
    });

    test("rejects a missing api key", () => {
        expect(() => new GeminiSTT({ apiKey: "" })).toThrow("GeminiSTT requires apiKey");
    });
});

describe("session-scoped preview routing", () => {
    test("sends Gemini ASR sessions to the GA endpoint without a preview gate", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(async () => new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));

        const session = withGeminiAsr(new Agent({ client: createClient(fetchMock) })).createSession(sessionOptions());

        await session.start();

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(String(fetchMock.mock.calls[0]?.[0]).startsWith(PREVIEW_API_BASE_URL)).toBe(false);

        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("agora-feature")).toBeNull();
    });

    test("keeps the full Gemini ASR session lifecycle on the GA endpoint", async () => {
        // A fresh Response per call: a body can only be read once.
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(
            async () =>
                // Superset body: satisfies the start, history, and paginated list shapes alike.
                new Response(JSON.stringify({ agent_id: "agent-1", data: { list: [] } }), { status: 200 }),
        );
        const client = createClient(fetchMock);

        const session = withGeminiAsr(new Agent({ client })).createSession(sessionOptions());

        await session.start();
        await session.say("hello");
        await session.interrupt();
        await session.getHistory();
        await session.stop();
        await client.agents.list({ appid: "test-app-id-0123456789abcdefghij" });
        await client.stopAgent("agent-2");

        expect(fetchMock.mock.calls.length).toBe(7);
        for (const [url, init] of fetchMock.mock.calls) {
            const headers = new Headers(init?.headers);
            expect(String(url).startsWith(PREVIEW_API_BASE_URL)).toBe(false);
            expect(headers.get("agora-feature")).toBeNull();
        }
    });

    test("GA routing preserves caller-supplied headers", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(async () => new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));

        const client = createClient(fetchMock, { "agora-feature": "", "x-custom": "kept" });

        const session = withGeminiAsr(new Agent({ client })).createSession(sessionOptions());
        await session.start();
        await session.raw.get(
            { appid: "test-app-id-0123456789abcdefghij", agentId: "agent-1" },
            { headers: { "agora-feature": "" } },
        );

        for (const [, init] of fetchMock.mock.calls) {
            const headers = new Headers(init?.headers);
            expect(headers.get("agora-feature")).toBe("");
            expect(headers.get("x-custom")).toBe("kept");
        }
    });

    test("keeps GA sessions on the regional production endpoint", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));
        const client = createClient(fetchMock);
        const session = new Agent({ client })
            .withStt(new DeepgramSTT({ apiKey: "test" }))
            .withLlm(new OpenAI({ model: "gpt-5-mini" }))
            .withTts(new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "v" }))
            .createSession(sessionOptions());

        await session.start();

        const [url, init] = fetchMock.mock.calls[0] ?? [];
        expect(String(url).startsWith(PREVIEW_API_BASE_URL)).toBe(false);
        expect(new Headers(init?.headers).get("agora-feature")).toBeNull();
    });
});

describe("preview feature detection", () => {
    test("leaves the GA Gemini ASR vendor off preview routing", () => {
        expect(
            requiredPreviewFeatures({ asr: { vendor: "gemini" } } as unknown as Agora.StartAgentsRequest.Properties),
        ).toEqual([]);
    });

    test("leaves a GA pipeline alone", () => {
        expect(
            requiredPreviewFeatures({ asr: { vendor: "microsoft" } } as unknown as Agora.StartAgentsRequest.Properties),
        ).toEqual([]);
    });

    test("standard AgoraClient accepts Gemini ASR", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));
        const session = withGeminiAsr(new Agent({ client: createClient(fetchMock) })).createSession(sessionOptions());

        await expect(session.start()).resolves.toBe("agent-1");
    });
});

test("GPT Live v3 routes the full session to preview with the live-models gate", async () => {
    const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(
            async () => new Response(JSON.stringify({ agent_id: "agent-1", data: { list: [] } }), { status: 200 }),
        );
    const session = new Agent({ client: createClient(fetchMock) })
        .withMllm(new OpenAIGPTLive({ apiKey: "test", prompt: "Be brief", outputIdleEndMs: 0 }))
        .createSession(sessionOptions());
    await session.start();
    await session.say("hello");
    await session.interrupt();
    await session.getHistory();
    await session.stop();
    expect(fetchMock.mock.calls).toHaveLength(5);
    for (const [url, init] of fetchMock.mock.calls) {
        expect(String(url).startsWith(PREVIEW_API_BASE_URL)).toBe(true);
        expect(new Headers(init?.headers).get("agora-feature")).toBe("live-models");
    }
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.properties.mllm).toMatchObject({
        enable: true,
        vendor: "openai_gpt_live",
        url: "wss://api.openai.com/v1/live/sessions",
        params: { model: "gpt-live-1", prompt: "Be brief", output_idle_end_ms: 0 },
    });
});

test("GPT Live v3 warns and drops agent-level turn detection", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
        const properties = new Agent({ client: createClient() })
            .withMllm(new OpenAIGPTLive({ apiKey: "test" }))
            .withTurnDetection({ language: "en-US" })
            .toProperties({
                channel: "preview-channel",
                agentUid: "1",
                remoteUids: ["100"],
                token: "test-token",
            });
        expect(properties).not.toHaveProperty("turn_detection");
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("ignores agent-level turn_detection"));
    } finally {
        warn.mockRestore();
    }
});
