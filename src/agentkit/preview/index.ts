/**
 * Preview provider surface.
 *
 * Self-contained on purpose: when these providers ship on the production
 * gateway, this directory is deleted and the vendor classes move into
 * `vendors/mllm.ts`.
 */

export type { PreviewClientOptions, PreviewFeature } from "./client.js";
export {
    AgoraPreviewClient,
    applyPreviewShape,
    assertPreviewSupport,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    requiredPreviewFeatures,
} from "./client.js";
export type {
    GeminiCleverChatterOptions,
    GeminiPreviewMllmModel,
    GeminiPreviewMllmOptions,
    GeminiPreviewVoice,
    GeminiThinkingLevel,
    GeminiWalkieTalkieOptions,
} from "./vendors.js";
export {
    GEMINI_PREVIEW_MLLM_DEFAULTS,
    GEMINI_PREVIEW_MLLM_URL,
    GeminiCleverChatter,
    GeminiPreviewMllmModels,
    GeminiThinkingLevels,
    GeminiWalkieTalkie,
} from "./vendors.js";
