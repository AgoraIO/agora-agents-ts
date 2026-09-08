/**
 * Type-safe STT (Speech-to-Text) vendor classes.
 */

import { type DeepgramPresetModel, DeepgramPresetModels } from "../presets.js";
import type { SttConfig, TurnDetectionLanguage } from "../types.js";
import { BaseSTT, type SampleRate } from "./base.js";

function _requireString(value: unknown, field: string, vendor: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function isDeepgramManagedModel(model: string | undefined): model is DeepgramPresetModel {
    return model !== undefined && DeepgramPresetModels.includes(model.trim().toLowerCase() as DeepgramPresetModel);
}

/** Gemini transcription models. */
export const GeminiSTTModels = {
    Transcribe35Live: "gemini-3.5-transcribe-live",
} as const;

/** A Gemini transcription model. Known models autocomplete while newer model names remain accepted. */
export type GeminiSTTModel = (typeof GeminiSTTModels)[keyof typeof GeminiSTTModels] | (string & {});

/** Constructor options for Google Gemini STT. */
export interface GeminiSTTOptions {
    /** Google Gemini API key. */
    apiKey: string;
    /** Gemini transcription model. Defaults to `gemini-3.5-transcribe-live`. */
    model?: GeminiSTTModel;
    /** Language code for speech recognition (for example, `en-US`). */
    language?: string;
    /** Candidate transcription languages, serialized as `params.language_hints`. */
    languageHints?: readonly TurnDetectionLanguage[];
    /** @deprecated Use `languageHints` instead. */
    languageCodes?: readonly TurnDetectionLanguage[];
    /** Words and phrases used to bias recognition. */
    customVocabulary?: readonly string[];
    /** Audio sample rate in Hz. Defaults to 16000. */
    sampleRate?: SampleRate;
    /** Whether to include word-level timestamps. Cannot be true when custom vocabulary is present. */
    wordTimestamp?: boolean;
    /** Additional vendor-specific parameters. Explicit options take precedence. */
    additionalParams?: Record<string, unknown>;
}

/** Google Gemini STT vendor. */
export class GeminiSTT extends BaseSTT {
    private readonly options: GeminiSTTOptions;

    constructor(options: GeminiSTTOptions) {
        super();
        _requireString(options.apiKey, "apiKey", "GeminiSTT");
        this.options = options;
    }

    toConfig(): SttConfig {
        const {
            apiKey,
            model,
            language,
            languageHints,
            languageCodes,
            customVocabulary,
            sampleRate,
            wordTimestamp,
            additionalParams,
        } = this.options;
        const params = {
            ...additionalParams,
            api_key: apiKey,
            model: model === undefined ? GeminiSTTModels.Transcribe35Live : model,
            sample_rate: sampleRate === undefined ? 16000 : sampleRate,
            ...(language !== undefined && { language }),
            ...((languageHints ?? languageCodes) !== undefined && {
                language_hints: [...(languageHints ?? languageCodes)!],
            }),
            ...(customVocabulary !== undefined && { custom_vocabulary: [...customVocabulary] }),
            ...(wordTimestamp !== undefined && { word_timestamp: wordTimestamp }),
        };

        if ("custom_vocabulary" in params && params.word_timestamp === true) {
            throw new Error("customVocabulary cannot be used with wordTimestamp=true");
        }

        return {
            vendor: "gemini",
            params,
        };
    }
}

/**
 * Constructor options for Speechmatics STT.
 */
interface SpeechmaticsSTTCommonOptions {
    /** Language code (e.g., 'en', 'es', 'fr') */
    language: string;
    /** Model name */
    model?: string;
    /** Speechmatics streaming WebSocket URL (for example, wss://eu2.rt.speechmatics.com/v2) */
    uri?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

export type SpeechmaticsSTTOptions = SpeechmaticsSTTCommonOptions &
    (
        | {
              /** Speechmatics API key */
              key: string;
              /** @deprecated Use `key` instead. This alias is normalized to the REST API's `key` field. */
              apiKey?: string;
          }
        | {
              key?: undefined;
              /** @deprecated Use `key` instead. This alias is normalized to the REST API's `key` field. */
              apiKey: string;
          }
    );

/**
 * Speechmatics STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new SpeechmaticsSTT({
 *   key: process.env.SPEECHMATICS_API_KEY,
 *   language: 'en',
 * });
 * ```
 */
export class SpeechmaticsSTT extends BaseSTT {
    private readonly options: SpeechmaticsSTTOptions;

    constructor(options: SpeechmaticsSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { key, apiKey, language, model, uri, additionalParams } = this.options;
        const wireKey = key ?? apiKey;
        _requireString(wireKey, "key", "SpeechmaticsSTT");
        const params = {
            ...additionalParams,
            key: wireKey,
            language,
            ...(model !== undefined && { model }),
            ...(uri !== undefined && { uri }),
        };
        delete (params as Record<string, unknown>).api_key;

        return {
            vendor: "speechmatics",
            params,
        };
    }
}

/**
 * Constructor options for Deepgram STT.
 */
type DeepgramSTTCommonOptions = {
    /** Deepgram API key. Optional only for the Agora-managed `nova-2` and `nova-3` path. */
    apiKey?: string;
    /** Model to use (e.g., 'nova-2', 'enhanced', 'base') */
    model?: string;

    /** Language code (e.g., 'en-US', 'es', 'fr') */
    language?: string;
    /** Enable smart formatting */
    smartFormat?: boolean;
    /** Enable punctuation */
    punctuation?: boolean;
    /** Boost specialized terms and brands for Deepgram */
    keyterm?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
};

export type DeepgramSTTOptions =
    | (DeepgramSTTCommonOptions & {
          apiKey: string;
      })
    | (Omit<DeepgramSTTCommonOptions, "model"> & {
          apiKey?: undefined;
          model: DeepgramPresetModel;
      });

/**
 * Deepgram STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new DeepgramSTT({
 *   apiKey: process.env.DEEPGRAM_API_KEY,
 *   model: 'nova-2',
 *   smartFormat: true,
 * });
 * ```
 */
export class DeepgramSTT extends BaseSTT {
    private readonly options: DeepgramSTTCommonOptions;

    constructor(options?: DeepgramSTTOptions) {
        super();
        if (!options?.apiKey && !isDeepgramManagedModel(options?.model)) {
            throw new Error("DeepgramSTT requires apiKey unless using a supported Agora-managed model");
        }
        this.options = options ?? {};
    }

    toConfig(): SttConfig {
        const { apiKey, model, language, smartFormat, punctuation, keyterm, additionalParams } = this.options;

        return {
            vendor: "deepgram",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                ...(apiKey && { key: apiKey }),
                ...(model && { model }),
                ...(language && { language }),
                ...(smartFormat !== undefined && { smart_format: smartFormat }),
                ...(punctuation !== undefined && { punctuation }),
                ...(keyterm && { keyterm }),
            },
        };
    }
}

/**
 * Constructor options for Microsoft Azure Speech STT.
 */
export interface MicrosoftSTTOptions {
    /** Microsoft Azure subscription key */
    key: string;
    /** Azure region (e.g., 'eastus', 'westus') */
    region: string;
    /** Language code (e.g., 'en-US', 'es-ES') */
    language: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Microsoft Azure Speech STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new MicrosoftSTT({
 *   key: process.env.AZURE_SPEECH_KEY,
 *   region: 'eastus',
 *   language: 'en-US',
 * });
 * ```
 */
export class MicrosoftSTT extends BaseSTT {
    private readonly options: MicrosoftSTTOptions;

    constructor(options: MicrosoftSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { key, region, language, additionalParams } = this.options;

        return {
            vendor: "microsoft",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                key,
                region,
                ...(language && { language }),
            },
        };
    }
}

/**
 * Constructor options for OpenAI Whisper STT.
 */
export interface OpenAISTTOptions {
    /** OpenAI API key */
    apiKey: string;
    /** Model to use (default: 'whisper-1') */
    model?: string;
    /** Language code */
    language?: string;
    /** Prompt that guides OpenAI transcription */
    prompt?: string;
    /** Full OpenAI input_audio_transcription override */
    inputAudioTranscription?: Record<string, unknown>;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * OpenAI Whisper STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new OpenAISTT({
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * ```
 */
export class OpenAISTT extends BaseSTT {
    private readonly options: OpenAISTTOptions;

    constructor(options: OpenAISTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { apiKey, model, language, prompt, inputAudioTranscription, additionalParams } = this.options;
        const transcription: Record<string, unknown> = {
            model: "gpt-4o-mini-transcribe",
            ...inputAudioTranscription,
            ...(model && { model }),
            ...(prompt && { prompt }),
            ...(language && { language }),
        };
        if (!transcription.model) throw new Error("OpenAISTT: inputAudioTranscription.model is required");
        if (!transcription.prompt) throw new Error("OpenAISTT: inputAudioTranscription.prompt is required");
        if (!transcription.language) throw new Error("OpenAISTT: inputAudioTranscription.language is required");

        return {
            vendor: "openai",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                api_key: apiKey,
                input_audio_transcription: transcription,
            },
        };
    }
}

/**
 * Constructor options for Google Cloud Speech-to-Text STT.
 */
export interface GoogleSTTOptions {
    /** Google Cloud project ID where Speech-to-Text is enabled */
    projectId: string;
    /** Google Cloud region for the recognizer (for example, global) */
    location: string;
    /** Google service account credentials JSON string */
    adcCredentialsString: string;
    /** Language code (e.g., 'en-US', 'es-ES') */
    language: string;
    /** Recognition model to use */
    model?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Google Cloud Speech-to-Text STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new GoogleSTT({
 *   projectId: process.env.GOOGLE_ASR_PROJECT_ID,
 *   location: 'global',
 *   adcCredentialsString: process.env.GOOGLE_APPLICATION_CREDENTIALS_STRING,
 *   language: 'en-US',
 * });
 * ```
 */
export class GoogleSTT extends BaseSTT {
    private readonly options: GoogleSTTOptions;

    constructor(options: GoogleSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { projectId, location, adcCredentialsString, language, model, additionalParams } = this.options;

        return {
            vendor: "google",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                project_id: projectId,
                location,
                adc_credentials_string: adcCredentialsString,
                ...(language && { language }),
                ...(model && { model }),
            },
        };
    }
}

/**
 * Constructor options for Amazon Transcribe STT.
 */
export interface AmazonSTTOptions {
    /** AWS Access Key ID */
    accessKey: string;
    /** AWS Secret Access Key */
    secretKey: string;
    /** AWS region (e.g., 'us-east-1') */
    region: string;
    /** Language code */
    language: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Amazon Transcribe STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new AmazonSTT({
 *   accessKey: process.env.AWS_ACCESS_KEY_ID,
 *   secretKey: process.env.AWS_SECRET_ACCESS_KEY,
 *   region: 'us-east-1',
 *   language: 'en-US',
 * });
 * ```
 */
export class AmazonSTT extends BaseSTT {
    private readonly options: AmazonSTTOptions;

    constructor(options: AmazonSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { accessKey, secretKey, region, language, additionalParams } = this.options;

        return {
            vendor: "amazon",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                access_key_id: accessKey,
                secret_access_key: secretKey,
                region,
                ...(language && { language_code: language }),
            },
        };
    }
}

/**
 * Constructor options for AssemblyAI STT.
 */
export interface AssemblyAISTTOptions {
    /** AssemblyAI API key */
    apiKey: string;
    /** Language code */
    language: string;
    /** AssemblyAI streaming WebSocket URL */
    ws_url?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * AssemblyAI STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new AssemblyAISTT({
 *   apiKey: process.env.ASSEMBLYAI_API_KEY,
 *   language: 'en-US',
 * });
 * ```
 */
export class AssemblyAISTT extends BaseSTT {
    private readonly options: AssemblyAISTTOptions;

    constructor(options: AssemblyAISTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { apiKey, language, ws_url, additionalParams } = this.options;

        return {
            vendor: "assemblyai",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                api_key: apiKey,
                ...(language && { language }),
                ...(ws_url && { ws_url }),
            },
        };
    }
}

/**
 * Constructor options for Agora ARES STT.
 */
export interface AresSTTOptions {
    /** Hotwords that improve recognition accuracy */
    keywords?: string[];
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Agora ARES (Adaptive Recognition Engine for Speech) STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new AresSTT();
 * ```
 */
export class AresSTT extends BaseSTT {
    private readonly options: AresSTTOptions;

    constructor(options: AresSTTOptions = {}) {
        super();
        if (Object.keys(options.additionalParams ?? {}).includes("keywords")) {
            throw new Error("AresSTT additionalParams must not contain keywords; use the top-level keywords option");
        }
        this.options = options;
    }

    toConfig(): SttConfig {
        const { keywords, additionalParams } = this.options;
        const hasParams = additionalParams !== undefined && Object.keys(additionalParams).length > 0;

        return {
            vendor: "ares",
            ...(keywords !== undefined && { keywords }),
            ...(hasParams && { params: { ...additionalParams } }),
        };
    }
}

/**
 * Constructor options for Sarvam STT.
 */
export interface SarvamSTTOptions {
    /** Sarvam API key */
    apiKey: string;
    /** Language code (e.g., 'en', 'hi', 'ta') */
    language: string;
    /** Model name */
    model?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Sarvam STT vendor (Beta).
 *
 * @example
 * ```typescript
 * const stt = new SarvamSTT({
 *   apiKey: process.env.SARVAM_API_KEY,
 *   language: 'en',
 * });
 * ```
 */
export class SarvamSTT extends BaseSTT {
    private readonly options: SarvamSTTOptions;

    constructor(options: SarvamSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { apiKey, language, model, additionalParams } = this.options;

        return {
            vendor: "sarvam",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                api_key: apiKey,
                language,
                ...(model !== undefined && { model }),
            },
        };
    }
}

/**
 * Constructor options for xAI STT.
 */
export interface XAiSTTOptions {
    /** xAI API key */
    apiKey: string;
    /** Language code for speech recognition */
    language?: string;
    /** WebSocket endpoint URL for the xAI streaming STT API */
    baseUrl?: string;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * xAI STT vendor.
 *
 * @example
 * ```typescript
 * const stt = new XAiSTT({
 *   apiKey: process.env.XAI_API_KEY,
 *   language: 'en',
 * });
 * ```
 */
export class XAiSTT extends BaseSTT {
    private readonly options: XAiSTTOptions;

    constructor(options: XAiSTTOptions) {
        super();
        this.options = options;
    }

    toConfig(): SttConfig {
        const { apiKey, language, baseUrl, sampleRate, additionalParams } = this.options;

        return {
            vendor: "xai",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(baseUrl !== undefined && { base_url: baseUrl }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
                ...(language !== undefined && { language }),
            },
        };
    }
}
