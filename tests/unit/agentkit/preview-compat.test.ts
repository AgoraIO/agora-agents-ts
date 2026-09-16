import { describe, expect, test } from "vitest";
import { requiredPreviewFeatures } from "../../../src/agentkit/index.js";
import type * as Agora from "../../../src/api/index.js";
import {
    createPreviewRoute,
    GeminiSTT,
    GeminiSTTModels,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    previewRequestHeaders,
} from "../../../src/index.js";

describe("preview public API compatibility", () => {
    test("retains the legacy package-root exports", () => {
        expect(GeminiSTT).toBeTypeOf("function");
        expect(GeminiSTTModels.Transcribe35Live).toBe("gemini-3.5-transcribe-live");
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
});
