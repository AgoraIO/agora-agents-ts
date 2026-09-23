import { describe, expect, test, vi } from "vitest";
import { PREVIEW_API_BASE_URL, requiredPreviewFeatures } from "../../../src/agentkit/preview/index.js";
import type * as Agora from "../../../src/api/index.js";
import { Agent, AgoraClient, Area, Gemini, GeminiSTT, GeminiTTS, GeminiTTSModels } from "../../../src/index.js";

const models = [GeminiTTSModels.Flash38];

describe("Gemini TTS preview", () => {
    test.each(models)("preserves %s on the wire and routes the full lifecycle", async (model) => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(
                async () => new Response(JSON.stringify({ agent_id: "agent-1", data: { list: [] } }), { status: 200 }),
            );
        const client = new AgoraClient({
            area: Area.US,
            appId: "0".repeat(32),
            appCertificate: "1".repeat(32),
            fetch: fetchMock,
            headers: { "agora-feature": "", "x-custom": "kept" },
        });
        const tts = new GeminiTTS({ apiKey: "test-key", model, voice: "Puck", style: "warm and reassuring" });
        const expected = {
            vendor: "gemini",
            params: { api_key: "test-key", model, voice: "Puck", style: "warm and reassuring" },
        };
        expect(tts.toConfig()).toEqual(expected);
        const session = new Agent({ client })
            .withStt(new GeminiSTT({ apiKey: "test-key" }))
            .withLlm(new Gemini({ apiKey: "test-key", model: "gemini-3.6-flash" }))
            .withTts(tts)
            .createSession({ name: "test", channel: "test", agentUid: "1", remoteUids: ["100"] });
        await session.start();
        await session.say("hello");
        await session.interrupt();
        await session.getHistory();
        await session.raw.get({ appid: "0".repeat(32), agentId: "agent-1" }, { headers: { "agora-feature": "" } });
        await session.stop();
        expect(fetchMock.mock.calls).toHaveLength(6);
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).properties.tts).toEqual(expected);
        for (const [url, init] of fetchMock.mock.calls) {
            expect(String(url).startsWith(PREVIEW_API_BASE_URL)).toBe(true);
            expect(new Headers(init?.headers).get("agora-feature")).toBe("gemini-live");
            expect(new Headers(init?.headers).get("x-custom")).toBe("kept");
        }
        await client.agents.list({ appid: "0".repeat(32) });
        expect(String(fetchMock.mock.calls[6]?.[0]).startsWith(PREVIEW_API_BASE_URL)).toBe(false);
    });

    test("defaults to Flash 3.8 and Puck without inventing optional parameters", () => {
        expect(new GeminiTTS({ apiKey: "test-key" }).toConfig()).toEqual({
            vendor: "gemini",
            params: { api_key: "test-key", model: "gemini-3.8-flash-tts", voice: "Puck" },
        });
    });

    test.each(["apiKey", "model", "voice"] as const)("rejects blank %s", (field) => {
        expect(() => new GeminiTTS({ apiKey: "test-key", [field]: "  " })).toThrow();
    });

    test("rejects non-string style from JavaScript callers", () => {
        // @ts-expect-error Exercise runtime validation for untyped callers.
        expect(() => new GeminiTTS({ apiKey: "test-key", style: 42 })).toThrow("style must be a string");
    });

    test("detects raw TTS configs and combines gates without changing GA Gemini ASR", () => {
        const features = (properties: unknown) =>
            requiredPreviewFeatures(properties as Agora.StartAgentsRequest.Properties);
        expect(features({ tts: { vendor: "gemini", params: { model: "future-model" } } })).toEqual(["gemini-live"]);
        expect(features({ tts: { vendor: "gemini" }, mllm: { vendor: "openai_gpt_live" } })).toEqual(["gemini-live"]);
        expect(features({ asr: { vendor: "gemini" }, tts: { vendor: "google" } })).toEqual([]);
    });
});
