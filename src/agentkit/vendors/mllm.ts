/**
 * Type-safe MLLM (Multimodal Large Language Model) vendor classes.
 *
 * MLLM vendors handle real-time audio end-to-end, bypassing the standard
 * ASR → LLM → TTS pipeline. Calling `agent.withMllm(vendor)` automatically
 * sets `mllm.enable: true`.
 */

import type { GeminiThinkingLevel } from "../preview/vendors.js";
import { buildGeminiPreviewConfig, GeminiLiveModels, GeminiThinkingLevels } from "../preview/vendors.js";
import type { MllmConfig, MllmTurnDetectionConfig } from "../types.js";
import { BaseCNMLLM, BaseMLLM } from "./base.js";

function requireString(value: unknown, field: string, vendor: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function requireObject(value: unknown, field: string, vendor: string): asserts value is Record<string, unknown> {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

/**
 * Constructor options for OpenAI Realtime API.
 */
export interface OpenAIRealtimeOptions {
    /** OpenAI API key */
    apiKey: string;
    /** Model name (e.g., 'gpt-4o-realtime-preview') */
    model?: string;
    /** Voice identifier for audio output */
    voice?: string;
    /** System instructions that define agent behavior */
    instructions?: string;
    /** Audio transcription settings */
    inputAudioTranscription?: Record<string, unknown>;
    /** WebSocket URL. Defaults to `wss://api.openai.com/v1/realtime` when omitted or empty. */
    url?: string;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Input modalities (e.g., ['audio'], ['audio', 'text']) */
    inputModalities?: string[];
    /** Output modalities (e.g., ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Additional MLLM parameters */
    params?: Record<string, unknown>;
    /** MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection?: MllmTurnDetectionConfig;
    /** Message played on failure */
    failureMessage?: string;
}

/**
 * OpenAI Realtime API MLLM vendor.
 *
 * @example
 * ```typescript
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withMllm(new OpenAIRealtime({
 *     apiKey: process.env.OPENAI_API_KEY,
 *     greetingMessage: 'Hello! How can I help you?',
 *   }));
 * ```
 */
export class OpenAIRealtime extends BaseMLLM {
    private readonly options: OpenAIRealtimeOptions;

    constructor(options: OpenAIRealtimeOptions) {
        super();
        this.options = options;
    }

    toConfig(): MllmConfig {
        const {
            apiKey,
            model,
            voice,
            instructions,
            inputAudioTranscription,
            url,
            greetingMessage,
            inputModalities,
            outputModalities,
            messages,
            params,
            turnDetection,
        } = this.options;

        // Build params only when there is something to include.
        // Previously `...(model && { params: ... })` silently dropped the
        // entire params object when model was undefined — fixed by checking
        // either field independently.
        const mergedParams = {
            ...(model !== undefined && { model }),
            ...params,
            ...(voice !== undefined && { voice }),
            ...(instructions !== undefined && { instructions }),
            ...(inputAudioTranscription !== undefined && { input_audio_transcription: inputAudioTranscription }),
        };
        const hasParams =
            model !== undefined ||
            params !== undefined ||
            voice !== undefined ||
            instructions !== undefined ||
            inputAudioTranscription !== undefined;

        return {
            vendor: "openai",
            api_key: apiKey,
            url: url || "wss://api.openai.com/v1/realtime",
            ...(hasParams && { params: mergedParams }),
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(inputModalities && { input_modalities: inputModalities }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(messages && { messages }),
            ...(this.options.failureMessage && { failure_message: this.options.failureMessage }),
            ...(turnDetection && { turn_detection: turnDetection }),
        };
    }
}

/** Parameters accepted by Azure OpenAI Realtime. */
export interface AzureOpenAIRealtimeParams {
    /** System instructions that define agent behavior */
    instructions?: string;
    /** Model or deployment model identifier */
    model?: string;
    /** Voice identifier for audio output */
    voice?: string;
}

/** Constructor options for Azure OpenAI Realtime API. */
export interface AzureOpenAIRealtimeOptions {
    /** Azure OpenAI API key */
    apiKey: string;
    /** Azure OpenAI Realtime WebSocket URL, including deployment routing when required */
    url: string;
    /** Model or deployment model identifier */
    model?: string;
    /** Voice identifier for audio output */
    voice?: string;
    /** System instructions that define agent behavior */
    instructions?: string;
    /** Number of conversation history messages cached by the MLLM */
    maxHistory?: number;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Output modalities (e.g., ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Azure Realtime model parameters */
    params?: AzureOpenAIRealtimeParams;
    /** Required MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection: MllmTurnDetectionConfig;
}

/**
 * Azure OpenAI Realtime MLLM vendor for global deployments.
 *
 * @example
 * ```typescript
 * const agent = new Agent({ client }).withMllm(new AzureOpenAIRealtime({
 *   apiKey: process.env.AZURE_OPENAI_API_KEY,
 *   url: 'wss://example.openai.azure.com/openai/realtime',
 *   model: 'gpt-4o-realtime-preview',
 *   maxHistory: 32,
 *   turnDetection: { mode: 'server_vad' },
 * }));
 * ```
 */
export class AzureOpenAIRealtime extends BaseMLLM {
    private readonly options: AzureOpenAIRealtimeOptions;

    constructor(options: AzureOpenAIRealtimeOptions) {
        super();
        requireString(options.apiKey, "apiKey", "AzureOpenAIRealtime");
        requireString(options.url, "url", "AzureOpenAIRealtime");
        requireObject(options.turnDetection, "turnDetection", "AzureOpenAIRealtime");
        this.options = options;
    }

    toConfig(): MllmConfig {
        const {
            apiKey,
            url,
            model,
            voice,
            instructions,
            maxHistory,
            greetingMessage,
            outputModalities,
            messages,
            params,
            turnDetection,
        } = this.options;
        const mergedParams = {
            ...(params?.model !== undefined && { model: params.model }),
            ...(params?.voice !== undefined && { voice: params.voice }),
            ...(params?.instructions !== undefined && { instructions: params.instructions }),
            ...(model !== undefined && { model }),
            ...(voice !== undefined && { voice }),
            ...(instructions !== undefined && { instructions }),
        };
        const hasParams = Object.keys(mergedParams).length > 0;

        return {
            vendor: "azure",
            api_key: apiKey,
            url,
            ...(hasParams && { params: mergedParams }),
            ...(maxHistory !== undefined && { max_history: maxHistory }),
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(messages && { messages }),
            turn_detection: turnDetection,
        };
    }
}

/**
 * Constructor options for Google Gemini Live (direct API, non-Vertex AI).
 */
export interface GeminiLiveOptions {
    /** Google API key */
    apiKey: string;
    /** Model name (e.g., 'gemini-live-2.5-flash') */
    model?: string;
    /** Sent only for models/gemini-3.8-live-extended-thinking. */
    thinkingLevel?: GeminiThinkingLevel;
    /** Languages for Gemini 3.8, sent as params.language_codes. */
    languageCodes?: readonly string[];
    /** Endpoint override; Gemini 3.8 defaults to the Developer API host. */
    url?: string;
    /** System instructions for the model */
    instructions?: string;
    /** Voice name (e.g., 'Aoede', 'Charon') */
    voice?: string;
    affectiveDialog?: boolean;
    proactiveAudio?: boolean;
    transcribeAgent?: boolean;
    transcribeUser?: boolean;
    httpOptions?: Record<string, unknown>;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Input modalities (e.g., ['audio'], ['audio', 'text']) */
    inputModalities?: string[];
    /** Output modalities (e.g., ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Additional MLLM parameters passed directly to the model */
    additionalParams?: Record<string, unknown>;
    /** MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection?: MllmTurnDetectionConfig;
    /** Message played on failure */
    failureMessage?: string;
}

/**
 * Google Gemini Live MLLM vendor (direct API, non-Vertex AI).
 *
 * Uses a Google API key. For Vertex AI / ADC credentials use {@link VertexAI} instead.
 *
 * @example
 * ```typescript
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withMllm(new GeminiLive({
 *     apiKey: process.env.GOOGLE_API_KEY,
 *     model: 'gemini-live-2.5-flash',
 *     greetingMessage: 'Hello! Gemini is listening.',
 *   }));
 * ```
 */
export class GeminiLive extends BaseMLLM {
    private readonly options: GeminiLiveOptions;

    constructor(options: GeminiLiveOptions) {
        super();
        if (!options.apiKey.trim()) {
            throw new Error("GeminiLive requires apiKey");
        }
        if (options.thinkingLevel !== undefined && !GeminiThinkingLevels.includes(options.thinkingLevel)) {
            throw new Error("GeminiLive thinkingLevel must be low, medium, or high");
        }
        this.options = { ...options, apiKey: options.apiKey.trim() };
    }

    toConfig(): MllmConfig {
        const {
            apiKey,
            model,
            url,
            instructions,
            voice,
            affectiveDialog,
            proactiveAudio,
            transcribeAgent,
            transcribeUser,
            httpOptions,
            greetingMessage,
            inputModalities,
            outputModalities,
            messages,
            additionalParams,
            turnDetection,
        } = this.options;

        const selectedModel = model?.trim() || GeminiLiveModels.Live38;
        if (selectedModel === GeminiLiveModels.Live38 || selectedModel === GeminiLiveModels.Live38ExtendedThinking) {
            return buildGeminiPreviewConfig(this.options);
        }

        return {
            vendor: "gemini",
            api_key: apiKey,
            url: url ?? "",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                model: selectedModel,
                ...(instructions && { instructions }),
                ...(voice && { voice }),
                ...(affectiveDialog !== undefined && { affective_dialog: affectiveDialog }),
                ...(proactiveAudio !== undefined && { proactive_audio: proactiveAudio }),
                ...(transcribeAgent !== undefined && { transcribe_agent: transcribeAgent }),
                ...(transcribeUser !== undefined && { transcribe_user: transcribeUser }),
                ...(httpOptions && { http_options: httpOptions }),
            },
            ...(messages && { messages }),
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(inputModalities && { input_modalities: inputModalities }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(this.options.failureMessage && { failure_message: this.options.failureMessage }),
            ...(turnDetection && { turn_detection: turnDetection }),
        };
    }
}

/**
 * Constructor options for Google Gemini Live (Vertex AI).
 */
export interface VertexAIOptions {
    /** Model name (e.g., 'gemini-live-2.5-flash-preview-native-audio-09-2025') */
    model: string;
    /** WebSocket URL for real-time communication */
    url?: string;
    /** Google Cloud project ID */
    projectId: string;
    /** Google Cloud location/region */
    location: string;
    /** Application Default Credentials JSON string */
    adcCredentialsString: string;
    /** System instructions for the model */
    instructions?: string;
    /** Voice name (e.g., 'Aoede', 'Charon') */
    voice?: string;
    affectiveDialog?: boolean;
    proactiveAudio?: boolean;
    transcribeAgent?: boolean;
    transcribeUser?: boolean;
    httpOptions?: Record<string, unknown>;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Input modalities (e.g., ['audio'], ['audio', 'text']) */
    inputModalities?: string[];
    /** Output modalities (e.g., ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Additional MLLM parameters */
    additionalParams?: Record<string, unknown>;
    /** MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection?: MllmTurnDetectionConfig;
    /** Message played on failure */
    failureMessage?: string;
}

/**
 * Google Gemini Live (Vertex AI) MLLM vendor.
 *
 * @example
 * ```typescript
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withMllm(new VertexAI({
 *     model: 'gemini-live-2.5-flash-preview-native-audio-09-2025',
 *     projectId: process.env.GOOGLE_PROJECT_ID,
 *     location: 'us-central1',
 *     adcCredentialsString: process.env.GOOGLE_ADC_CREDENTIALS,
 *     instructions: 'You are a helpful voice assistant.',
 *     voice: 'Aoede',
 *     greetingMessage: 'Hello! Gemini is listening.',
 *   }));
 * ```
 */
export class VertexAI extends BaseMLLM {
    private readonly options: VertexAIOptions;

    constructor(options: VertexAIOptions) {
        super();
        this.options = options;
    }

    toConfig(): MllmConfig {
        const {
            model,
            url,
            projectId,
            location,
            adcCredentialsString,
            instructions,
            voice,
            affectiveDialog,
            proactiveAudio,
            transcribeAgent,
            transcribeUser,
            httpOptions,
            greetingMessage,
            inputModalities,
            outputModalities,
            messages,
            additionalParams,
            turnDetection,
        } = this.options;

        return {
            vendor: "vertexai",
            url: url ?? "",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                model,
                project_id: projectId,
                location,
                adc_credentials_string: adcCredentialsString,
                ...(instructions && { instructions }),
                ...(voice && { voice }),
                ...(affectiveDialog !== undefined && { affective_dialog: affectiveDialog }),
                ...(proactiveAudio !== undefined && { proactive_audio: proactiveAudio }),
                ...(transcribeAgent !== undefined && { transcribe_agent: transcribeAgent }),
                ...(transcribeUser !== undefined && { transcribe_user: transcribeUser }),
                ...(httpOptions && { http_options: httpOptions }),
            },
            ...(messages && { messages }),
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(inputModalities && { input_modalities: inputModalities }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(this.options.failureMessage && { failure_message: this.options.failureMessage }),
            ...(turnDetection && { turn_detection: turnDetection }),
        };
    }
}

/**
 * Constructor options for xAI Grok Realtime API.
 */
export interface XaiGrokOptions {
    /** xAI API key */
    apiKey: string;
    /** WebSocket URL for real-time communication (defaults to xAI Realtime API) */
    url?: string;
    /** Voice identifier (e.g., 'eve', 'rex') */
    voice?: string;
    /** Language code (e.g., 'en') */
    language?: string;
    /** Audio sample rate in Hz (e.g., 24000) */
    sampleRate?: number;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Message played on failure */
    failureMessage?: string;
    /** Input modalities (e.g., ['audio'], ['audio', 'text']) */
    inputModalities?: string[];
    /** Output modalities (e.g., ['audio'], ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Additional MLLM parameters passed directly to xAI */
    params?: Record<string, unknown>;
    /** MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection?: MllmTurnDetectionConfig;
}

/**
 * xAI Grok MLLM vendor (`mllm.vendor`: `"xai"`).
 *
 * Uses the xAI Realtime API WebSocket URL by default. Do not name future xAI ASR/TTS
 * wrappers `XaiRealtime`; use `XaiSTT` / `XaiTTS` when those pipelines are added.
 *
 * @example
 * ```typescript
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withMllm(new XaiGrok({
 *     apiKey: process.env.XAI_API_KEY,
 *     voice: 'eve',
 *     language: 'en',
 *     sampleRate: 24000,
 *     greetingMessage: 'Hello, how can I help?',
 *   }));
 * ```
 */
export class XaiGrok extends BaseMLLM {
    private readonly options: XaiGrokOptions;

    constructor(options: XaiGrokOptions) {
        super();
        this.options = options;

        if (!options.apiKey) {
            throw new Error("XaiGrok requires apiKey");
        }
    }

    toConfig(): MllmConfig {
        const {
            apiKey,
            url = "wss://api.x.ai/v1/realtime",
            voice,
            language,
            sampleRate,
            greetingMessage,
            failureMessage,
            inputModalities,
            outputModalities,
            messages,
            params,
            turnDetection,
        } = this.options;

        return {
            vendor: "xai",
            api_key: apiKey,
            url,
            ...(messages && { messages }),
            params: {
                ...params,
                ...(voice && { voice }),
                ...(language && { language }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
            },
            ...(inputModalities && { input_modalities: inputModalities }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(failureMessage && { failure_message: failureMessage }),
            ...(turnDetection && { turn_detection: turnDetection }),
        };
    }
}

/** Constructor options for Alibaba Cloud Qwen Omni Realtime. */
export interface QwenOmniOptions {
    /** Alibaba Cloud DashScope API key */
    apiKey: string;
    /** Qwen Omni model identifier */
    model: string;
    /** Qwen Omni Realtime WebSocket URL */
    url: string;
    /** Voice identifier for audio output */
    voice?: string;
    /** System instructions that define agent behavior */
    instructions?: string;
    /** Agent greeting message */
    greetingMessage?: string;
    /** Message played on failure */
    failureMessage?: string;
    /** Input modalities (e.g., ['audio'], ['audio', 'text']) */
    inputModalities?: string[];
    /** Output modalities (e.g., ['text', 'audio']) */
    outputModalities?: string[];
    /** Conversation messages for short-term memory */
    messages?: Record<string, unknown>[];
    /** Additional Qwen Omni parameters */
    params?: Record<string, unknown>;
    /** MLLM turn detection configuration. Overrides top-level turn_detection. */
    turnDetection?: MllmTurnDetectionConfig;
}

/**
 * Alibaba Cloud Qwen Omni Realtime MLLM vendor for Chinese mainland deployments.
 *
 * @example
 * ```typescript
 * const agent = new Agent({ client }).withMllm(new QwenOmni({
 *   apiKey: process.env.DASHSCOPE_API_KEY,
 *   model: 'qwen3.5-omni-plus-realtime',
 *   url: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
 *   greetingMessage: '你好，有什么可以帮你？',
 * }));
 * ```
 */
export class QwenOmni extends BaseCNMLLM {
    private readonly options: QwenOmniOptions;

    constructor(options: QwenOmniOptions) {
        super();
        requireString(options.apiKey, "apiKey", "QwenOmni");
        requireString(options.model, "model", "QwenOmni");
        requireString(options.url, "url", "QwenOmni");
        this.options = options;
    }

    toConfig(): MllmConfig {
        const {
            apiKey,
            model,
            url,
            voice,
            instructions,
            greetingMessage,
            failureMessage,
            inputModalities,
            outputModalities,
            messages,
            params,
            turnDetection,
        } = this.options;

        return {
            vendor: "qwen_omni",
            api_key: apiKey,
            url,
            params: {
                ...params,
                model,
                ...(voice !== undefined && { voice }),
                ...(instructions !== undefined && { instructions }),
            },
            ...(greetingMessage && { greeting_message: greetingMessage }),
            ...(failureMessage && { failure_message: failureMessage }),
            ...(inputModalities && { input_modalities: inputModalities }),
            ...(outputModalities && { output_modalities: outputModalities }),
            ...(messages && { messages }),
            ...(turnDetection && { turn_detection: turnDetection }),
        };
    }
}
