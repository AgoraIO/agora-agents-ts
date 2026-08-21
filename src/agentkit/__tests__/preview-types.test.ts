/**
 * Compile-time type checks for the preview providers.
 *
 * This file is type-checked by `tsc` (it is under `src`), not executed by
 * vitest. A regression here fails `pnpm build`.
 */

import { Area } from "../../core/domain/index.js";
import { Agent } from "../Agent.js";
import { AgoraPreviewClient, GeminiCleverChatter, GeminiWalkieTalkie } from "../preview/index.js";
import type { MllmConfig } from "../types.js";

const PREVIEW_CLIENT = new AgoraPreviewClient({
    area: Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate-01234567890",
});

// ============================================
// ✅ VALID CONFIGURATIONS
// ============================================

function _validWalkieTalkie(): Agent {
    return new Agent({ client: PREVIEW_CLIENT }).withMllm(
        new GeminiWalkieTalkie({ apiKey: "test", voice: "Puck", languageCodes: ["en-US"] }),
    );
}

function _validCleverChatter(): Agent {
    return new Agent({ client: PREVIEW_CLIENT }).withMllm(
        new GeminiCleverChatter({ apiKey: "test", voice: "Puck", thinkingLevel: "medium" }),
    );
}

/** The preview MLLM shape is part of `MllmConfig`, so hand-written configs type-check too. */
const _handWrittenMllm: MllmConfig = {
    vendor: "gemini",
    api_key: "test",
    url: "https://generativelanguage.googleapis.com",
    params: {
        api_key: "test",
        model: "walkie-talkie",
        voice: "Puck",
        language_codes: ["en-US"],
    },
    greeting: "Hello",
};

// ============================================
// ❌ INVALID CONFIGURATIONS
// ============================================

/** `thinkingLevel` is a clever-chatter capability; walkie-talkie must reject it. */
function _walkieTalkieRejectsThinkingLevel(): GeminiWalkieTalkie {
    return new GeminiWalkieTalkie({
        apiKey: "test",
        // @ts-expect-error - thinkingLevel is not supported by walkie-talkie
        thinkingLevel: "medium",
    });
}

/** `thinking_level` is a closed set. */
function _cleverChatterRejectsUnknownThinkingLevel(): GeminiCleverChatter {
    return new GeminiCleverChatter({
        apiKey: "test",
        // @ts-expect-error - "extreme" is not a valid thinking level
        thinkingLevel: "extreme",
    });
}

/** The API key is required — it is the only credential these providers accept. */
function _walkieTalkieRequiresApiKey(): GeminiWalkieTalkie {
    // @ts-expect-error - apiKey is required
    return new GeminiWalkieTalkie({ voice: "Puck" });
}
