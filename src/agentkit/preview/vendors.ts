/** Preview provider vendor helpers and legacy production aliases. */

import type { MllmConfig } from "../types.js";
import type { GeminiLiveOptions } from "../vendors/mllm.js";

/** Legacy preview import aliases for the production GPT Live implementation. */
export type { OpenAIGPTLiveOptions } from "../vendors/mllm.js";
export { isOpenAIGPTLiveConfig, OPENAI_GPT_LIVE_VENDOR, OpenAIGPTLive } from "../vendors/mllm.js";

// Google preview MLLMs use a separate feature gate from GPT Live.
export const GeminiLiveModels = {
    /** Public ID for the low-latency voice model. */
    Live38: "models/gemini-3.8-live",
    /** Public ID for the reasoning voice model. */
    Live38ExtendedThinking: "models/gemini-3.8-live-extended-thinking",
} as const;

/**
 * The model name the Gemini MLLM sends by default.
 *
 * Low-latency Gemini voice is the default.
 */
export const GEMINI_MLLM_DEFAULT_MODEL: string = GeminiLiveModels.Live38;

/**
 * A preview Gemini MLLM model. Any string is accepted for launch flexibility;
 * the `models/` prefix on the 3.8 IDs is preserved on the wire.
 */
export type GeminiLiveModel = (typeof GeminiLiveModels)[keyof typeof GeminiLiveModels] | (string & {});

/** Reasoning budget for Gemini extended thinking. */
export const GeminiThinkingLevels = ["low", "medium", "high"] as const;

/** Reasoning budget: `"low"` | `"medium"` | `"high"`. */
export type GeminiThinkingLevel = (typeof GeminiThinkingLevels)[number];

/**
 * A Gemini output voice. Known voices autocomplete; any string is accepted so a
 * newly published voice can be used before this SDK is updated.
 */
export type GeminiPreviewVoice =
    | "Puck"
    | "Charon"
    | "Kore"
    | "Fenrir"
    | "Aoede"
    | "Leda"
    | "Orus"
    | "Zephyr"
    | (string & {});

/** Default endpoint for the preview Gemini MLLMs. */
export const GEMINI_PREVIEW_MLLM_URL = "https://generativelanguage.googleapis.com";

/** Builds the 3.8 preview wire config from the existing GeminiLive options. */
export function buildGeminiPreviewConfig(options: GeminiLiveOptions): MllmConfig {
    const {
        model: requestedModel,
        apiKey,
        thinkingLevel,
        voice = "Puck",
        languageCodes,
        url = GEMINI_PREVIEW_MLLM_URL,
        instructions,
        transcribeAgent,
        transcribeUser,
        affectiveDialog,
        proactiveAudio,
        httpOptions,
        greetingMessage,
        failureMessage,
        inputModalities,
        outputModalities,
        messages,
        additionalParams,
        turnDetection,
    } = options;

    const model = requestedModel?.trim() || GEMINI_MLLM_DEFAULT_MODEL;
    const reasoningModel = model === GeminiLiveModels.Live38ExtendedThinking;
    const params: Record<string, unknown> = {
        ...additionalParams,
        model,
        voice,
        ...(reasoningModel && thinkingLevel !== undefined && { thinking_level: thinkingLevel }),
        ...(languageCodes && { language_codes: [...languageCodes] }),
        ...(instructions && { instructions }),
        ...(transcribeAgent !== undefined && { transcribe_agent: transcribeAgent }),
        ...(transcribeUser !== undefined && { transcribe_user: transcribeUser }),
        ...(affectiveDialog !== undefined && { affective_dialog: affectiveDialog }),
        ...(proactiveAudio !== undefined && { proactive_audio: proactiveAudio }),
        ...(httpOptions && { http_options: httpOptions }),
    };
    if (!reasoningModel) {
        delete params.thinking_level;
    }
    delete params.api_key;

    return {
        vendor: "gemini",
        api_key: apiKey,
        url,
        params,
        ...(messages && { messages }),
        // Preview Gemini reads `greeting`, not the production spelling.
        ...(greetingMessage && { greeting: greetingMessage }),
        ...(failureMessage && { failure_message: failureMessage }),
        ...(inputModalities && { input_modalities: inputModalities }),
        ...(outputModalities && { output_modalities: outputModalities }),
        ...(turnDetection && { turn_detection: turnDetection }),
    };
}
