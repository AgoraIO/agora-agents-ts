/**
 * Preview provider surface.
 *
 * Preview routing stays here while provider implementations can graduate to
 * the production vendor modules independently.
 */

// The preview namespace keeps its historical names, but Gemini ASR now uses
// the production implementation and options behind those names.
export type { GeminiSTTModel, GeminiSTTOptions } from "../vendors/stt.js";
export { GeminiSTT, GeminiSTTModels, GeminiTranscriptionMode } from "../vendors/stt.js";
export type { PreviewFeature, PreviewRoute } from "./client.js";
export {
    applyPreviewShape,
    createPreviewRoute,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    previewRequestHeaders,
    requiredPreviewFeatures,
} from "./client.js";
export type {
    GeminiLiveModel,
    GeminiPreviewVoice,
    GeminiThinkingLevel,
    OpenAIGPTLiveOptions,
} from "./vendors.js";
export {
    GEMINI_MLLM_DEFAULT_MODEL,
    GEMINI_PREVIEW_MLLM_URL,
    GeminiLiveModels,
    GeminiThinkingLevels,
    OpenAIGPTLive,
} from "./vendors.js";
