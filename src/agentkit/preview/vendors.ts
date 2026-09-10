/**
 * Preview provider vendor classes.
 *
 * These follow the same shape as the GA vendor classes in `vendors/` —
 * camelCase constructor options in, snake_case wire config out — so they drop
 * into `agent.withStt()` unchanged. They only work against the preview
 * endpoint; AgentSession routes it automatically.
 */

import type { SttConfig, TurnDetectionLanguage } from "../types.js";
import type { SampleRate } from "../vendors/base.js";
import { BaseSTT } from "../vendors/base.js";

// =============================================================================
// Gemini 3.5 Transcribe (ASR)
// =============================================================================

/** Gemini preview transcription models. */
export const GeminiSTTModels = {
    Transcribe35Live: "gemini-3.5-transcribe-live",
} as const;

/**
 * A Gemini preview transcription model. Known model names autocomplete; any
 * string is accepted so a newly published preview model can be used before this
 * SDK is updated.
 */
export type GeminiSTTModel = (typeof GeminiSTTModels)[keyof typeof GeminiSTTModels] | (string & {});

/** Constructor options for {@link GeminiSTT}. */
export interface GeminiSTTOptions {
    /** Google API key. */
    apiKey: string;
    /** Model name. Defaults to `gemini-3.5-transcribe-live`. */
    model?: GeminiSTTModel;
    /**
     * Languages the model should transcribe, sent as `params.language_codes`.
     *
     * Omitted from the request when unset, which is how the provider spells
     * auto-detect — the SDK does not pin a language the caller never asked for.
     * Pass one code to commit to a language, several to let the model choose
     * between them, or an explicit empty array to request auto-detect
     * outright.
     *
     * This is the only language setting on this vendor. The top-level
     * `asr.language` is supplied by `Agent` from `turnDetection.language`, as
     * it is for every STT vendor.
     */
    /** @deprecated Use `languageHints` instead. */
    languageCodes?: readonly TurnDetectionLanguage[];
    languageHints?: readonly TurnDetectionLanguage[];
    /**
     * Words and phrases to bias recognition toward — product names, jargon,
     * proper nouns the model would otherwise mis-hear.
     */
    customVocabulary?: readonly string[];
    /** Audio sample rate in Hz. Defaults to 16000. */
    sampleRate?: SampleRate;
    /**
     * Emit per-word timestamps in transcription results. Omitted unless
     * explicitly set; cannot be `true` when `customVocabulary` is set.
     */
    wordTimestamp?: boolean;
    /** Additional vendor-specific parameters. */
    additionalParams?: Record<string, unknown>;
}

/**
 * Gemini 3.5 Transcribe ASR vendor (preview).
 *
 * @example
 * ```typescript
 * const agent = new Agent({ client }).withStt(new GeminiSTT({
 *   apiKey: process.env.GOOGLE_API_KEY!,
 *   languageCodes: ['en-US'],
 * }));
 * ```
 */
export class GeminiSTT extends BaseSTT {
    private readonly options: GeminiSTTOptions;

    constructor(options: GeminiSTTOptions) {
        super();
        if (!options.apiKey) {
            throw new Error("GeminiSTT requires apiKey");
        }
        this.options = options;
    }

    toConfig(): SttConfig {
        const {
            apiKey,
            model = GeminiSTTModels.Transcribe35Live,
            languageHints,
            languageCodes,
            customVocabulary,
            sampleRate = 16000,
            wordTimestamp,
            additionalParams,
        } = this.options;

        const params = {
            // additionalParams spread first so that explicit fields always win.
            ...additionalParams,
            api_key: apiKey,
            model,
            sample_rate: sampleRate,
            // Omitted unless the caller asked for it: no language_codes is
            // how the provider spells auto-detect, and seeding it from
            // `language` would pin every request to a language the caller
            // never chose.
            ...((languageHints ?? languageCodes) !== undefined && {
                language_codes: [...(languageHints ?? languageCodes)!],
            }),
            ...(customVocabulary && { custom_vocabulary: [...customVocabulary] }),
            ...(wordTimestamp !== undefined && { word_timestamp: wordTimestamp }),
        };
        if ("custom_vocabulary" in params && params.word_timestamp === true) {
            throw new Error("customVocabulary cannot be used with wordTimestamp=true");
        }

        // No top-level `language`: `Agent` sets it from `turnDetection.language`,
        // the same as every other STT vendor.
        return {
            vendor: "gemini",
            params,
        };
    }
}
