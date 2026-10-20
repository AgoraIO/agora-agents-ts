import { describe, expect, test, vi } from "vitest";
import {
    GeminiTTS as LegacyGeminiTTS,
    GeminiTTSModels as LegacyModels,
} from "../../../src/agentkit/preview/gemini-tts.js";
import {
    PREVIEW_API_BASE_URL,
    GeminiTTS as PreviewGeminiTTS,
    requiredPreviewFeatures,
} from "../../../src/agentkit/preview/index.js";
import { BaseTTS } from "../../../src/agentkit/vendors/base.js";
import { GeminiTTS as ProductionGeminiTTS } from "../../../src/agentkit/vendors/tts.js";
import type * as Agora from "../../../src/api/index.js";
import { Agent, AgoraClient, Area, Gemini, GeminiSTT, GeminiTTS, GeminiTTSModels } from "../../../src/index.js";

const models = [GeminiTTSModels.Flash38, "future-tts-model"];

describe.each([Area.US, Area.EU, Area.AP])("Gemini TTS production in %s", (area) => {
    test.each(models)("preserves %s on the wire and routes the full lifecycle", async (model) => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(
                async () => new Response(JSON.stringify({ agent_id: "agent-1", data: { list: [] } }), { status: 200 }),
            );
        const client = new AgoraClient({
            area,
            appId: "0".repeat(32),
            appCertificate: "1".repeat(32),
            fetch: fetchMock,
            headers: { "x-custom": "kept" },
        });
        const productionUrl = client.getCurrentURL();
        const tts = new PreviewGeminiTTS({ apiKey: "test-key", model, voice: "Puck", style: "warm and reassuring" });
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
        await session.think("think");
        await session.update({});
        await session.getHistory();
        await session.getInfo();
        await session.getTurns();
        await session.raw.get({ appid: "0".repeat(32), agentId: "agent-1" }, { headers: { "x-request": "kept" } });
        await session.stop();
        expect(fetchMock.mock.calls).toHaveLength(10);
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).properties.tts).toEqual(expected);
        for (const [url, init] of fetchMock.mock.calls) {
            expect(String(url).startsWith(`${productionUrl}/`)).toBe(true);
            expect(new Headers(init?.headers).has("agora-feature")).toBe(false);
            expect(new Headers(init?.headers).get("x-custom")).toBe("kept");
        }
        await client.agents.list({ appid: "0".repeat(32) });
        expect(String(fetchMock.mock.calls[10]?.[0]).startsWith(`${productionUrl}/`)).toBe(true);
        expect(client.getCurrentURL()).toBe(productionUrl);
    });

    test("routes a preview-era raw config through the configured production endpoint", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockImplementation(async () => new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));
        const client = new AgoraClient({
            area,
            appId: "0".repeat(32),
            appCertificate: "1".repeat(32),
            fetch: fetchMock,
        });
        const config = {
            vendor: "gemini" as const,
            params: { api_key: "test-key", model: "future-tts-model", voice: "Puck", style: "warm" },
        };
        const tts = new (class extends BaseTTS {
            toConfig() {
                return config;
            }
        })();
        const session = new Agent({ client })
            .withLlm(new Gemini({ apiKey: "test-key", model: "gemini-3.6-flash" }))
            .withTts(tts)
            .createSession({ channel: "raw", agentUid: "1", remoteUids: ["100"] });
        await session.start();
        await session.stop();
        expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).properties.tts).toEqual(config);
        for (const [url, init] of fetchMock.mock.calls) {
            expect(String(url).startsWith(`${client.getCurrentURL()}/`)).toBe(true);
            expect(String(url).startsWith(PREVIEW_API_BASE_URL)).toBe(false);
            expect(new Headers(init?.headers).has("agora-feature")).toBe(false);
        }
    });
});

describe("Gemini TTS compatibility", () => {
    test("retains production, package-root and historical preview exports as the same objects", () => {
        expect(GeminiTTS).toBe(ProductionGeminiTTS);
        expect(PreviewGeminiTTS).toBe(ProductionGeminiTTS);
        expect(LegacyGeminiTTS).toBe(ProductionGeminiTTS);
        expect(LegacyModels).toBe(GeminiTTSModels);
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

    test("merges additional params before named options", () => {
        const additionalParams = { temperature: 0.7, style: "overridden", voice: "overridden" };
        const config = new GeminiTTS({
            apiKey: "test-key",
            style: "warm",
            additionalParams,
            skipPatterns: [1],
        }).toConfig();
        expect(config.params).toEqual({
            temperature: 0.7,
            api_key: "test-key",
            model: "gemini-3.8-flash-tts",
            voice: "Puck",
            style: "warm",
        });
        expect(config.skip_patterns).toEqual([1]);
        expect(additionalParams).toEqual({ temperature: 0.7, style: "overridden", voice: "overridden" });
    });

    test("keeps raw TTS configs and combined Gemini/GPT pipelines on production", () => {
        const features = (properties: unknown) =>
            requiredPreviewFeatures(properties as Agora.StartAgentsRequest.Properties);
        expect(features({ tts: { vendor: "gemini", params: { model: "future-model" } } })).toEqual([]);
        expect(features({ tts: { vendor: "gemini" }, mllm: { vendor: "openai_gpt_live" } })).toEqual([]);
        expect(features({ asr: { vendor: "gemini" }, tts: { vendor: "google" } })).toEqual([]);
    });
});
