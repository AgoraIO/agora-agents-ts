import { describe, expect, test } from "vitest";
import { requiredPreviewFeatures } from "../../../src/agentkit/index.js";
import {
    buildGeminiPreviewConfig,
    OpenAIGPTLive as PreviewOpenAIGPTLive,
} from "../../../src/agentkit/preview/vendors.js";
import {
    GeminiLiveModels as ProductionGeminiLiveModels,
    OpenAIGPTLive as ProductionOpenAIGPTLive,
} from "../../../src/agentkit/vendors/mllm.js";
import type * as Agora from "../../../src/api/index.js";
import {
    createPreviewRoute,
    GeminiLiveModels,
    GeminiSTT,
    GeminiSTTModels,
    OpenAIGPTLive,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    previewRequestHeaders,
} from "../../../src/index.js";

describe("preview public API compatibility", () => {
    test("retains the legacy package-root exports", () => {
        expect(GeminiSTT).toBeTypeOf("function");
        expect(GeminiSTTModels.Transcribe35Live).toBe("gemini-3.5-transcribe-live");
        expect(OpenAIGPTLive).toBe(ProductionOpenAIGPTLive);
        expect(PreviewOpenAIGPTLive).toBe(ProductionOpenAIGPTLive);
        expect(GeminiLiveModels).toBe(ProductionGeminiLiveModels);
        expect(createPreviewRoute).toBeTypeOf("function");
        expect(PREVIEW_API_BASE_URL).toContain("/preview/");
        expect(PREVIEW_FEATURE_HEADER).toBe("agora-feature");
        expect(PreviewFeatures.GeminiLive).toBe("gemini-live");
        expect(previewRequestHeaders([PreviewFeatures.GeminiLive], { custom: "kept" })).toEqual({
            custom: "kept",
            "agora-feature": "gemini-live",
        });
    });

    test("does not route production Gemini through preview", () => {
        const properties = { asr: { vendor: "gemini" } } as unknown as Agora.StartAgentsRequest.Properties;
        expect(requiredPreviewFeatures(properties)).toEqual([]);
    });

    test("automatically routes legacy GPT Live configs through production", () => {
        const properties = {
            mllm: { vendor: "openai_gpt_live" },
        } as unknown as Agora.StartAgentsRequest.Properties;
        expect(requiredPreviewFeatures(properties)).toEqual([]);
    });

    test("automatically routes Gemini 3.8 configs through production", () => {
        const properties = {
            mllm: { vendor: "gemini", params: { model: GeminiLiveModels.Live38 } },
        } as unknown as Agora.StartAgentsRequest.Properties;
        expect(requiredPreviewFeatures(properties)).toEqual([]);
        expect(buildGeminiPreviewConfig({ apiKey: "key" })).toMatchObject({
            vendor: "gemini",
            params: { model: GeminiLiveModels.Live38 },
        });
    });
});
