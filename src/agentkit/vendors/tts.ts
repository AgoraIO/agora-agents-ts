/**
 * Type-safe TTS (Text-to-Speech) vendor classes.
 */

import { CredentialMode } from "../constants.js";
import {
    type MiniMaxPresetModel,
    MiniMaxPresetModels,
    type OpenAITtsPresetModel,
    OpenAITtsPresetModels,
} from "../presets.js";
import type { TtsConfig } from "../types.js";
import type { CartesiaSampleRate, ElevenLabsSampleRate, GoogleTTSSampleRate, MicrosoftSampleRate } from "./base.js";
import { BaseTTS } from "./base.js";

function requireString(value: unknown, field: string, vendor: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function _requireRecord(value: unknown, field: string, vendor: string): asserts value is Record<string, string> {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function isOpenAITtsManagedModel(model: string | undefined): boolean {
    return model === undefined || OpenAITtsPresetModels.includes(model.trim().toLowerCase() as OpenAITtsPresetModel);
}

function isMiniMaxManagedModel(model: string | undefined): model is MiniMaxPresetModel {
    return model !== undefined && MiniMaxPresetModels.includes(model.trim().toLowerCase() as MiniMaxPresetModel);
}

/**
 * Constructor options for ElevenLabs TTS.
 */
export interface ElevenLabsTTSOptions<SR extends ElevenLabsSampleRate = ElevenLabsSampleRate> {
    /** ElevenLabs API key */
    key: string;
    /** Model ID (e.g., 'eleven_flash_v2_5', 'eleven_monolingual_v1') */
    modelId: string;
    /** Voice ID */
    voiceId: string;
    /** WebSocket base URL */
    baseUrl: string;
    /**
     * Audio sample rate in Hz.
     * - 16000 Hz: Required for Akool avatars
     * - 24000 Hz: Required for HeyGen avatars
     * - 22050, 44100 Hz: High quality, no avatar support
     */
    sampleRate?: SR;
    /** Optimize streaming latency (0-4, higher = lower latency but lower quality) */
    optimizeStreamingLatency?: number;
    /** Voice stability (0.0-1.0) */
    stability?: number;
    /** Voice similarity boost (0.0-1.0) */
    similarityBoost?: number;
    /** Voice style (0.0-1.0) */
    style?: number;
    /** Enable speaker boost */
    useSpeakerBoost?: boolean;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * ElevenLabs TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new ElevenLabsTTS({
 *   key: process.env.ELEVENLABS_API_KEY,
 *   modelId: 'eleven_flash_v2_5',
 *   voiceId: 'pNInz6obpgDQGcFmaJgB',
 *   baseUrl: 'wss://api.elevenlabs.io/v1',
 *   sampleRate: 24000, // For HeyGen avatar
 * });
 * ```
 */
export class ElevenLabsTTS<SR extends ElevenLabsSampleRate = ElevenLabsSampleRate> extends BaseTTS<SR> {
    private readonly options: ElevenLabsTTSOptions<SR>;

    constructor(options: ElevenLabsTTSOptions<SR>) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const {
            key,
            modelId,
            voiceId,
            baseUrl,
            sampleRate,
            optimizeStreamingLatency,
            stability,
            similarityBoost,
            style,
            useSpeakerBoost,
            skipPatterns,
        } = this.options;

        return {
            vendor: "elevenlabs",
            params: {
                key,
                base_url: baseUrl,
                model_id: modelId,
                voice_id: voiceId,
                ...(sampleRate && { sample_rate: sampleRate }),
                ...(optimizeStreamingLatency !== undefined && { optimize_streaming_latency: optimizeStreamingLatency }),
                ...(stability !== undefined && { stability }),
                ...(similarityBoost !== undefined && { similarity_boost: similarityBoost }),
                ...(style !== undefined && { style }),
                ...(useSpeakerBoost !== undefined && { use_speaker_boost: useSpeakerBoost }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Microsoft Azure TTS.
 */
export interface MicrosoftTTSOptions<SR extends MicrosoftSampleRate = MicrosoftSampleRate> {
    /** Microsoft Azure API key */
    key: string;
    /** Azure region (e.g., 'eastus', 'westus') */
    region: string;
    /** Voice name (e.g., 'en-US-AndrewMultilingualNeural') */
    voiceName: string;
    /**
     * Audio sample rate in Hz.
     * Supported values: 16000, 24000, 48000
     */
    sampleRate?: SR;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
    /** Speaking rate multiplier. Values between 0.5 and 2.0. */
    speed?: number;
    /** Audio volume. Values between 0.0 and 100.0. */
    volume?: number;
}

/**
 * Microsoft Azure TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new MicrosoftTTS({
 *   key: process.env.AZURE_SPEECH_KEY,
 *   region: 'eastus',
 *   voiceName: 'en-US-JennyNeural',
 *   sampleRate: 24000,
 * });
 * ```
 */
export class MicrosoftTTS<SR extends MicrosoftSampleRate = MicrosoftSampleRate> extends BaseTTS<SR> {
    private readonly options: MicrosoftTTSOptions<SR>;

    constructor(options: MicrosoftTTSOptions<SR>) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, region, voiceName, sampleRate, skipPatterns, speed, volume } = this.options;

        return {
            vendor: "microsoft",
            params: {
                key,
                region,
                voice_name: voiceName,
                ...(sampleRate && { sample_rate: sampleRate }),
                ...(speed !== undefined && { speed }),
                ...(volume !== undefined && { volume }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for OpenAI TTS.
 */
type OpenAITTSCommonOptions = {
    /** OpenAI API key. Optional only for the Agora-managed `tts-1` path. */
    apiKey?: string;
    /** Voice name (e.g., 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer') */
    voice: string;
    /** Model name (e.g., 'tts-1', 'tts-1-hd') */
    model?: string;
    /** Endpoint URL for the OpenAI TTS service */
    baseUrl?: string;
    /** Custom instructions for voice style, accent, pace, and tone */
    instructions?: string;
    /** Speech speed multiplier */
    speed?: number;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
};

export type OpenAITTSOptions =
    | (OpenAITTSCommonOptions & {
          apiKey: string;
          model: string;
          baseUrl: string;
      })
    | (Omit<OpenAITTSCommonOptions, "model" | "baseUrl"> & {
          apiKey?: undefined;
          model?: OpenAITtsPresetModel;
          baseUrl?: undefined;
      });

/**
 * OpenAI TTS vendor.
 *
 * Note: OpenAI TTS is fixed at 24kHz and does not support changing the sample rate.
 *
 * @example
 * ```typescript
 * const tts = new OpenAITTS({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4o-mini-tts',
 *   baseUrl: 'https://api.openai.com/v1',
 *   voice: 'alloy',
 * });
 * ```
 */
export class OpenAITTS extends BaseTTS<24000> {
    private readonly options: OpenAITTSOptions;

    constructor(options: OpenAITTSOptions) {
        super();
        requireString(options.voice, "voice", "OpenAITTS");
        if (options.apiKey) {
            requireString(options.model, "model", "OpenAITTS");
            requireString(options.baseUrl, "baseUrl", "OpenAITTS");
        } else {
            if (!isOpenAITtsManagedModel(options.model)) {
                throw new Error("OpenAITTS requires apiKey unless using the Agora-managed tts-1 model");
            }
            if (options.baseUrl) {
                throw new Error("OpenAITTS baseUrl is only valid when apiKey is set");
            }
        }
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, voice, model, baseUrl, instructions, speed, skipPatterns } = this.options;

        return {
            vendor: "openai",
            params: {
                ...(apiKey && { api_key: apiKey }),
                ...(apiKey && { base_url: baseUrl }),
                voice,
                ...(model && { model }),
                ...(instructions && { instructions }),
                ...(speed !== undefined && { speed }),
            } as unknown as import("../types.js").OpenAiTtsParams,
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}

/**
 * Constructor options for Cartesia TTS.
 */
export interface CartesiaTTSOptions<SR extends CartesiaSampleRate = CartesiaSampleRate> {
    /** Cartesia API key */
    apiKey: string;
    /** Voice ID */
    voiceId: string;
    /** Model ID */
    modelId: string;
    /** WebSocket URL for the Cartesia streaming API */
    baseUrl?: string;
    /** Target language for speech synthesis */
    language?: string;
    /**
     * Audio sample rate in Hz.
     * Supported values: 8000, 16000, 22050, 24000, 44100, 48000
     */
    sampleRate?: SR;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Cartesia TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new CartesiaTTS({
 *   apiKey: process.env.CARTESIA_API_KEY,
 *   voiceId: 'voice-id-here',
 *   sampleRate: 24000,
 * });
 * ```
 */
export class CartesiaTTS<SR extends CartesiaSampleRate = CartesiaSampleRate> extends BaseTTS<SR> {
    private readonly options: CartesiaTTSOptions<SR>;

    constructor(options: CartesiaTTSOptions<SR>) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, voiceId, modelId, baseUrl, language, sampleRate, skipPatterns } = this.options;

        return {
            vendor: "cartesia",
            params: {
                api_key: apiKey,
                voice: { mode: "id", id: voiceId },
                model_id: modelId,
                ...(baseUrl && { base_url: baseUrl }),
                ...(sampleRate && { output_format: { container: "raw", sample_rate: sampleRate } }),
                ...(language && { language }),
            } as unknown as import("../types.js").CartesiaTtsParams,
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}

/**
 * Constructor options for Google TTS.
 */
export interface GoogleTTSOptions<SR extends GoogleTTSSampleRate = GoogleTTSSampleRate> {
    /** Google Cloud service account credentials JSON string */
    key: string;
    /** Voice name */
    voiceName: string;
    /** Language code (e.g., 'en-US') */
    languageCode?: string;
    /**
     * Audio sample rate in Hz.
     * Supported values: 8000, 16000, 22050, 24000, 44100, 48000
     */
    sampleRate?: SR;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Google TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new GoogleTTS({
 *   key: process.env.GOOGLE_API_KEY,
 *   voiceName: 'en-US-Wavenet-D',
 *   sampleRate: 24000,
 * });
 * ```
 */
export class GoogleTTS<SR extends GoogleTTSSampleRate = GoogleTTSSampleRate> extends BaseTTS<SR> {
    private readonly options: GoogleTTSOptions<SR>;

    constructor(options: GoogleTTSOptions<SR>) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, voiceName, languageCode, sampleRate, skipPatterns } = this.options;

        return {
            vendor: "google",
            params: {
                credentials: key,
                VoiceSelectionParams: {
                    name: voiceName,
                    ...(languageCode && { language_code: languageCode }),
                },
                ...(sampleRate && { AudioConfig: { sample_rate_hertz: sampleRate } }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Amazon Polly TTS.
 */
export interface AmazonTTSOptions {
    /** AWS access key */
    accessKey: string;
    /** AWS secret key */
    secretKey: string;
    /** AWS region (e.g., 'us-east-1') */
    region: string;
    /** Amazon Polly voice ID */
    voiceId: string;
    /** Amazon Polly engine type */
    engine: "standard" | "neural" | "long-form" | "generative";
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Amazon Polly TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new AmazonTTS({
 *   accessKey: process.env.AWS_ACCESS_KEY_ID,
 *   secretKey: process.env.AWS_SECRET_ACCESS_KEY,
 *   region: 'us-east-1',
 *   voiceId: 'Joanna',
 *   engine: 'neural',
 * });
 * ```
 */
export class AmazonTTS extends BaseTTS {
    private readonly options: AmazonTTSOptions;

    constructor(options: AmazonTTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { accessKey, secretKey, region, voiceId, engine, skipPatterns } = this.options;

        return {
            vendor: "amazon",
            params: {
                aws_access_key_id: accessKey,
                aws_secret_access_key: secretKey,
                region_name: region,
                voice: voiceId,
                ...(engine && { engine }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Deepgram TTS (Beta).
 */
export interface DeepgramTTSOptions {
    /** Deepgram API key */
    apiKey: string;
    /** Deepgram TTS model (e.g., 'aura-2-thalia-en') */
    model: string;
    /** WebSocket endpoint (defaults server-side to Deepgram's speak endpoint) */
    baseUrl?: string;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Additional Deepgram TTS parameters, flattened into tts.params */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Deepgram TTS vendor (Beta).
 */
export class DeepgramTTS extends BaseTTS {
    private readonly options: DeepgramTTSOptions;

    constructor(options: DeepgramTTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, model, baseUrl, sampleRate, additionalParams, skipPatterns } = this.options;

        return {
            vendor: "deepgram",
            params: {
                api_key: apiKey,
                model,
                ...additionalParams,
                ...(baseUrl && { base_url: baseUrl }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

/** Constructor options for Gradium TTS. */
export interface GradiumTTSOptions {
    /** Gradium API key */
    apiKey: string;
    /** WebSocket endpoint for streaming TTS output */
    url?: string;
    /** Gradium TTS model name (e.g., 'default') */
    modelName?: string;
    /** Gradium voice identifier */
    voiceId?: string;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/** Gradium TTS vendor. */
export class GradiumTTS extends BaseTTS {
    private readonly options: GradiumTTSOptions;

    constructor(options: GradiumTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "GradiumTTS");
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, url, modelName, voiceId, sampleRate, additionalParams, skipPatterns } = this.options;

        return {
            vendor: "gradium",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(url !== undefined && { url }),
                ...(modelName !== undefined && { model_name: modelName }),
                ...(voiceId !== undefined && { voice_id: voiceId }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/** Constructor options for Mistral TTS. */
export interface MistralTTSOptions {
    /** Mistral API key */
    apiKey: string;
    /** Mistral TTS model name (e.g., 'voxtral-mini-tts-2603') */
    model?: string;
    /** Mistral voice identifier */
    voice?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/** Mistral TTS vendor. */
export class MistralTTS extends BaseTTS {
    private readonly options: MistralTTSOptions;

    constructor(options: MistralTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "MistralTTS");
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, model, voice, additionalParams, skipPatterns } = this.options;

        return {
            vendor: "mistral",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(model !== undefined && { model }),
                ...(voice !== undefined && { voice }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/** Constructor options for Typecast TTS. */
export interface TypecastTTSOptions {
    /** Typecast API key */
    apiKey: string;
    /** Typecast voice identifier */
    voiceId: string;
    /** Typecast TTS model name (e.g., 'ssfm-v30') */
    model: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/** Typecast TTS vendor. */
export class TypecastTTS extends BaseTTS {
    private readonly options: TypecastTTSOptions;

    constructor(options: TypecastTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "TypecastTTS");
        requireString(options.voiceId, "voiceId", "TypecastTTS");
        requireString(options.model, "model", "TypecastTTS");
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, voiceId, model, additionalParams, skipPatterns } = this.options;

        return {
            vendor: "typecast",
            params: {
                ...additionalParams,
                api_key: apiKey,
                voice_id: voiceId,
                model,
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Hume AI TTS.
 */
export interface HumeAITTSOptions {
    /** Hume AI API key */
    key: string;
    /** Configuration ID */
    configId?: string;
    /** Hume AI voice ID */
    voiceId: string;
    /** Base URL for the Hume AI API */
    baseUrl?: string;
    /** Voice provider type */
    provider: "HUME_AI" | "CUSTOM_VOICE";
    /** Playback speed of the generated speech */
    speed?: number;
    /** Duration of silence in seconds to add at the end of each utterance */
    trailingSilence?: number;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Hume AI TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new HumeAITTS({
 *   key: process.env.HUME_API_KEY,
 *   voiceId: 'voice-id',
 *   provider: 'CUSTOM_VOICE',
 * });
 * ```
 */
export class HumeAITTS extends BaseTTS {
    private readonly options: HumeAITTSOptions;

    constructor(options: HumeAITTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, configId, voiceId, baseUrl, provider, speed, trailingSilence, skipPatterns } = this.options;

        return {
            vendor: "humeai",
            params: {
                key,
                voice_id: voiceId,
                ...(baseUrl && { base_url: baseUrl }),
                provider,
                ...(speed !== undefined && { speed }),
                ...(trailingSilence !== undefined && { trailing_silence: trailingSilence }),
                ...(configId && { config_id: configId }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Rime TTS.
 *
 * - `credentialMode: CredentialMode.Managed` requires `baseUrl` and `modelId`
 * - omitted / `CredentialMode.Byok` requires `key`, `speaker`, and `modelId`
 */
type RimeTTSCommonOptions = {
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
};

export type RimeTTSOptions =
    | (RimeTTSCommonOptions & {
          /** Use Agora-managed Rime credentials */
          credentialMode: typeof CredentialMode.Managed;
          /** Model ID */
          modelId: string;
          /** WebSocket URL for the Rime streaming API */
          baseUrl: string;
          /** Rime API key (optional for managed credentials) */
          key?: string;
          /** Speaker ID (optional for managed credentials) */
          speaker?: string;
      })
    | (RimeTTSCommonOptions & {
          /** Bring-your-own Rime credentials (default when omitted) */
          credentialMode?: typeof CredentialMode.Byok;
          /** Rime API key */
          key: string;
          /** Speaker ID */
          speaker: string;
          /** Model ID */
          modelId: string;
          /** WebSocket URL for the Rime streaming API */
          baseUrl?: string;
      });

/**
 * Rime TTS vendor.
 *
 * @example
 * Agora-managed credentials:
 * ```typescript
 * const managedTts = new RimeTTS({
 *   credentialMode: CredentialMode.Managed,
 *   baseUrl: 'wss://users.rime.ai/ws',
 *   modelId: 'mist',
 * });
 * ```
 *
 * @example
 * Bring your own credentials (the default mode):
 * ```typescript
 * const byokTts = new RimeTTS({
 *   key: process.env.RIME_API_KEY,
 *   speaker: 'speaker-id',
 *   modelId: 'mist',
 * });
 * ```
 */
export class RimeTTS extends BaseTTS {
    private readonly options: RimeTTSOptions;

    constructor(options: RimeTTSOptions) {
        super();
        requireString(options.modelId, "modelId", "RimeTTS");
        if (options.credentialMode === CredentialMode.Managed) {
            requireString(options.baseUrl, "baseUrl", "RimeTTS");
        } else {
            requireString(options.key, "key", "RimeTTS");
            requireString(options.speaker, "speaker", "RimeTTS");
        }
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, speaker, modelId, baseUrl, skipPatterns, credentialMode } = this.options;

        if (credentialMode === CredentialMode.Managed) {
            return {
                vendor: "rime",
                credential_mode: CredentialMode.Managed,
                params: {
                    modelId,
                    base_url: baseUrl,
                    ...(key !== undefined && { api_key: key }),
                    ...(speaker !== undefined && { speaker }),
                },
                ...(skipPatterns && { skip_patterns: skipPatterns }),
            };
        }

        return {
            vendor: "rime",
            ...(credentialMode !== undefined && { credential_mode: credentialMode }),
            params: {
                api_key: key,
                speaker,
                modelId,
                ...(baseUrl && { base_url: baseUrl }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Fish Audio TTS.
 */
export interface FishAudioTTSOptions {
    /** Fish Audio API key */
    key: string;
    /** Reference ID */
    referenceId: string;
    /** Backend used by Fish Audio */
    backend: string;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Fish Audio TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new FishAudioTTS({
 *   key: process.env.FISH_AUDIO_API_KEY,
 *   referenceId: 'reference-id',
 *   backend: 'speech-1.5',
 * });
 * ```
 */
export class FishAudioTTS extends BaseTTS {
    private readonly options: FishAudioTTSOptions;

    constructor(options: FishAudioTTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, referenceId, backend, skipPatterns } = this.options;

        return {
            vendor: "fishaudio",
            params: {
                api_key: key,
                reference_id: referenceId,
                backend,
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for MiniMax TTS.
 */
type MiniMaxTTSCommonOptions = {
    /** MiniMax API key. Optional only for AgentKit-supported Agora-managed models. */
    key?: string;
    /** MiniMax group identifier */
    groupId?: string;

    /** TTS model (e.g., 'speech-02-turbo') */
    model: string;
    /** Voice style identifier (e.g., 'English_captivating_female1') */
    voiceId?: string;
    /** WebSocket endpoint (e.g., 'wss://api-uw.minimax.io/ws/v1/t2a_v2') */
    url?: string;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
};

export type MiniMaxTTSOptions =
    | (MiniMaxTTSCommonOptions & {
          key: string;
      })
    | (Omit<MiniMaxTTSCommonOptions, "model" | "groupId" | "voiceId" | "url"> & {
          key?: undefined;
          model: MiniMaxPresetModel;
          groupId?: string;
          voiceId?: string;
          url?: string;
      });

/**
 * MiniMax TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new MiniMaxTTS({
 *   key: process.env.MINIMAX_API_KEY,
 *   groupId: 'your-group-id',
 *   model: 'speech-02-turbo',
 *   voiceId: 'English_captivating_female1',
 *   url: 'wss://api-uw.minimax.io/ws/v1/t2a_v2',
 * });
 * ```
 */
export class MiniMaxTTS extends BaseTTS {
    private readonly options: MiniMaxTTSOptions;

    constructor(options: MiniMaxTTSOptions) {
        super();
        if (options.key) {
            requireString(options.groupId, "groupId", "MiniMaxTTS");
            requireString(options.model, "model", "MiniMaxTTS");
            requireString(options.voiceId, "voiceId", "MiniMaxTTS");
            requireString(options.url, "url", "MiniMaxTTS");
        } else if (!isMiniMaxManagedModel(options.model)) {
            throw new Error("MiniMaxTTS requires key unless using a supported Agora-managed model");
        }
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, groupId, model, voiceId, url, skipPatterns } = this.options;

        return {
            vendor: "minimax",
            params: {
                ...(key && { key }),
                ...(key && groupId && { group_id: groupId }),
                ...(key && { model }),
                ...(voiceId && { voice_setting: { voice_id: voiceId } }),
                ...(key && url && { url }),
            } as unknown as import("../types.js").MinimaxTtsParams,
            // Preset path: model not in params; stored as top-level hint for preset
            // inference. Stripped by stripInferredPresetFields before the POST body.
            ...(!key && { _minimaxPresetModel: model }),
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Sarvam TTS (Beta).
 */
export interface SarvamTTSOptions {
    /** Sarvam API subscription key */
    key: string;
    /** Speaker/voice ID (e.g., 'anushka', 'abhilash', 'karun', 'hitesh', 'manisha', 'vidya', 'arya') */
    speaker: string;
    /** Target language code (e.g., 'en-IN', 'hi-IN', 'ta-IN') */
    targetLanguageCode: import("../types.js").SarvamTtsParams["target_language_code"];
    /** Pitch adjustment for the voice */
    pitch?: number;
    /** Speed of speech */
    pace?: number;
    /** Volume level of the speech */
    loudness?: number;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Sarvam TTS vendor (Beta).
 *
 * @example
 * ```typescript
 * const tts = new SarvamTTS({
 *   key: process.env.SARVAM_API_KEY,
 *   speaker: 'anushka',
 *   targetLanguageCode: 'en-IN',
 * });
 * ```
 */
export class SarvamTTS extends BaseTTS {
    private readonly options: SarvamTTSOptions;

    constructor(options: SarvamTTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, speaker, targetLanguageCode, pitch, pace, loudness, sampleRate, skipPatterns } = this.options;

        return {
            vendor: "sarvam",
            params: {
                api_subscription_key: key,
                speaker,
                target_language_code: targetLanguageCode,
                ...(pitch !== undefined && { pitch }),
                ...(pace !== undefined && { pace }),
                ...(loudness !== undefined && { loudness }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        };
    }
}

/**
 * Constructor options for Murf TTS.
 */
export interface MurfTTSOptions {
    /** Murf API key */
    key: string;
    /** Voice ID (e.g., 'Ariana', 'Natalie', 'Ken') */
    voiceId?: string;
    /** WebSocket endpoint for streaming TTS output */
    baseUrl?: string;
    /** Locale for the selected voice */
    locale?: string;
    /** Speech rate adjustment */
    rate?: number;
    /** Pitch adjustment */
    pitch?: number;
    /** TTS model to use */
    model?: string;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Murf TTS vendor.
 *
 * @example
 * ```typescript
 * const tts = new MurfTTS({
 *   key: process.env.MURF_API_KEY,
 *   voiceId: 'Ariana',
 * });
 * ```
 */
export class MurfTTS extends BaseTTS {
    private readonly options: MurfTTSOptions;

    constructor(options: MurfTTSOptions) {
        super();
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { key, voiceId, baseUrl, locale, rate, pitch, model, sampleRate, skipPatterns } = this.options;

        return {
            vendor: "murf",
            params: {
                api_key: key,
                ...(baseUrl && { base_url: baseUrl }),
                ...(voiceId && { voiceId }),
                ...(locale && { locale }),
                ...(rate !== undefined && { rate }),
                ...(pitch !== undefined && { pitch }),
                ...(model && { model }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            } as unknown as import("../types.js").MurfTtsParams,
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}

function requireGenericTtsHttpUrl(url: unknown): asserts url is string {
    requireString(url, "url", "GenericTTS");

    let protocol: string;
    try {
        protocol = new URL(url).protocol;
    } catch {
        throw new Error("GenericTTS requires url to be a valid absolute URL");
    }

    if (protocol === "http:" || protocol === "https:") {
        return;
    }

    throw new Error(`GenericTTS does not support the ${protocol} protocol`);
}

/**
 * Constructor options for Generic OpenAI-compatible TTS.
 */
export interface GenericTTSOptions {
    /** HTTP(S) endpoint of the generic TTS service */
    url: string;
    /** Custom headers to include in requests to the generic TTS service */
    headers?: Record<string, string>;
    /** API key for the generic TTS service */
    apiKey?: string;
    /** TTS model name */
    model?: string;
    /** Voice name */
    voice?: string;
    /** Speech rate */
    speed?: number;
    /** Output audio sample rate in Hz */
    sampleRate?: number;
    /** Output audio format. ConvoAI currently supports `pcm` only. */
    responseFormat?: "pcm";
    /** Additional voice style control instruction */
    instruction?: string;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * Generic OpenAI-compatible TTS vendor.
 */
export class GenericTTS extends BaseTTS {
    private readonly options: GenericTTSOptions;

    constructor(options: GenericTTSOptions) {
        super();
        requireGenericTtsHttpUrl(options.url);
        this.options = options;
    }

    toConfig(): TtsConfig {
        const {
            url,
            headers,
            apiKey,
            model,
            voice,
            speed,
            sampleRate,
            responseFormat,
            instruction,
            additionalParams,
            skipPatterns,
        } = this.options;

        return {
            vendor: "generic_http",
            url,
            ...(headers && { headers }),
            params: {
                ...additionalParams,
                ...(apiKey !== undefined && { api_key: apiKey }),
                ...(model !== undefined && { model }),
                ...(voice !== undefined && { voice }),
                ...(speed !== undefined && { speed }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
                ...(responseFormat !== undefined && { response_format: responseFormat }),
                ...(instruction !== undefined && { instruction }),
            } as unknown as import("../types.js").GenericTtsParams,
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}

/**
 * Constructor options for xAI TTS.
 */
export interface XAiTTSOptions {
    /** xAI API key */
    apiKey: string;
    /** BCP-47 language code for speech synthesis */
    language: string;
    /** xAI voice identifier */
    voiceId?: string;
    /** Audio sample rate in Hz */
    sampleRate?: number;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
    /** Skip patterns for bracketed content */
    skipPatterns?: number[];
}

/**
 * xAI TTS vendor.
 */
export class XAiTTS extends BaseTTS {
    private readonly options: XAiTTSOptions;

    constructor(options: XAiTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "XAiTTS");
        requireString(options.language, "language", "XAiTTS");
        this.options = options;
    }

    toConfig(): TtsConfig {
        const { apiKey, language, voiceId, sampleRate, additionalParams, skipPatterns } = this.options;

        return {
            vendor: "xai",
            params: {
                ...additionalParams,
                api_key: apiKey,
                language,
                ...(voiceId !== undefined && { voice_id: voiceId }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            } as unknown as import("../types.js").XAiTtsParams,
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}
