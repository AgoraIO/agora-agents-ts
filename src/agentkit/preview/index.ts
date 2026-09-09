/**
 * Preview provider surface.
 *
 * Self-contained on purpose: when these providers ship on the production
 * gateway, this directory is deleted and the vendor classes move into
 * `vendors/stt.ts`.
 */

export type { PreviewFeature, PreviewRoute } from "./client.js";
export {
    createPreviewRoute,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    previewRequestHeaders,
    requiredPreviewFeatures,
} from "./client.js";
// The preview namespace keeps its historical names, but Gemini ASR now uses
// the production implementation and options behind those names.
export type { GeminiSTTModel, GeminiSTTOptions } from "../vendors/stt.js";
export { GeminiSTT, GeminiSTTModels, GeminiTranscriptionMode } from "../vendors/stt.js";
