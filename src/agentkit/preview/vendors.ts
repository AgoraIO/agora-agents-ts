/** Legacy preview import aliases for production MLLM implementations. */

import type { MllmConfig } from "../types.js";
import { GeminiLive, type GeminiLiveOptions } from "../vendors/mllm.js";

/** Legacy preview import aliases for the production GPT Live implementation. */
/** Gemini 3.8 names remain available from the historical preview path. */
export type {
    GeminiLiveModel,
    GeminiLiveVoice,
    GeminiPreviewVoice,
    GeminiThinkingLevel,
    OpenAIGPTLiveOptions,
} from "../vendors/mllm.js";
export {
    GEMINI_MLLM_DEFAULT_MODEL,
    GEMINI_MLLM_URL,
    GEMINI_PREVIEW_MLLM_URL,
    GeminiLiveModels,
    GeminiThinkingLevels,
    isOpenAIGPTLiveConfig,
    OPENAI_GPT_LIVE_VENDOR,
    OpenAIGPTLive,
} from "../vendors/mllm.js";

/** @deprecated Use `new GeminiLive(options).toConfig()`. */
export function buildGeminiPreviewConfig(options: GeminiLiveOptions): MllmConfig {
    return new GeminiLive(options).toConfig();
}
