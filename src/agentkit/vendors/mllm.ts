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
import { BaseCNMLLM, BaseMLLM, type BaseMllmOptions } from "./base.js";

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

// =============================================================================
// OpenAI GPT Live (MLLM)
// =============================================================================

export const OPENAI_GPT_LIVE_VENDOR = "openai_gpt_live" as const;

export function isOpenAIGPTLiveConfig(config: unknown): boolean {
    return (config as { vendor?: unknown } | null | undefined)?.vendor === OPENAI_GPT_LIVE_VENDOR;
}

/** GPT Live v3 options. */
export interface OpenAIGPTLiveOptions extends BaseMllmOptions {
    apiKey: string;
    /** Full WebSocket URL, used verbatim except OpenAI's legacy /v1/live route. */
    url?: string;
    /** @deprecated Use prompt. Serialized as prompt; an explicit prompt wins. */
    instructions?: string;
    greeting?: string;
    failureMessage?: string;
    inputModalities?: string[];
    outputModalities?: string[];
    messages?: Record<string, unknown>[];
    /** Additional provider fields; explicit options take precedence. */
    params?: Record<string, unknown>;
    /** @deprecated Unsupported in v3; setting this raises an error. */
    inputAudioTranscription?: Record<string, unknown>;
    /** @deprecated Ignored with a warning; v3 performs endpointing internally. */
    turnDetection?: MllmTurnDetectionConfig;
    /** Defaults to gpt-live-1. */
    model?: string;
    /** Output voice; provider default marin. Custom voice objects require PR #1522; use params after rollout. */
    voice?: string;
    /** Session instructions. */
    prompt?: string;
    /** Host when url is omitted; default wss://api.openai.com. */
    baseUrl?: string;
    /** WebSocket path; default /v1/live/sessions. */
    path?: string;
    /** Optional OpenAI-Alpha selector for preview contracts. Omitted by default. */
    alphaSelector?: string;
    /** Extra provider request headers as a JSON string; protocol headers win. */
    headers?: string;
    /** Assistant silence boundary in ms; provider default 600. Zero disables inference. */
    outputIdleEndMs?: number;
    /** Caller silence boundary in ms; provider default 1500. */
    inputIdleEndMs?: number;
    /** Speech amplitude threshold on the 16-bit scale; provider default 50. */
    outputSilencePeak?: number;
    /** Graph PCM sample rate; provider default 24000. */
    outputSampleRate?: number;
    /** Initial audio cushion; provider default 0. Negative disables pacing. */
    outputBufferMs?: number;
    /** Mic append batching in ms. Join default 0; extension class default 100. */
    inputBatchMs?: number;
    /** Advertise graph tools; provider default false. Does not control delegate built-ins. */
    toolEnabled?: boolean;
    /** Tool delegation mode; provider default responses. Fixed for the session. */
    delegation?: "client" | "responses";
    /** Tool delegate model; provider default gpt-5.6-sol. */
    responsesModel?: string;
    /** Interrupt playback on caller speech; provider default false. */
    interruptOnUserTurn?: boolean;
    /** Unmodelled v3 session fields. Cannot override model, delegation, audio, instructions or input. */
    sessionParams?: Record<string, unknown>;
}

export class OpenAIGPTLive extends BaseMLLM {
    constructor(private readonly options: OpenAIGPTLiveOptions) {
        super(options);
        if (!options.apiKey) throw new Error("OpenAIGPTLive requires apiKey");
    }

    toConfig(): MllmConfig {
        const o = this.options;
        const params: Record<string, unknown> = {
            model: "gpt-live-1",
            ...o.params,
            ...(o.instructions !== undefined && { prompt: o.instructions }),
            ...(o.model !== undefined && { model: o.model }),
            ...(o.voice !== undefined && { voice: o.voice }),
            ...(o.prompt !== undefined && { prompt: o.prompt }),
            ...(o.baseUrl !== undefined && { base_url: o.baseUrl }),
            ...(o.path !== undefined && { path: o.path }),
            ...(o.alphaSelector !== undefined && { alpha_selector: o.alphaSelector }),
            ...(o.headers !== undefined && { headers: o.headers }),
            ...(o.outputIdleEndMs !== undefined && { output_idle_end_ms: o.outputIdleEndMs }),
            ...(o.inputIdleEndMs !== undefined && { input_idle_end_ms: o.inputIdleEndMs }),
            ...(o.outputSilencePeak !== undefined && { output_silence_peak: o.outputSilencePeak }),
            ...(o.outputSampleRate !== undefined && { output_sample_rate: o.outputSampleRate }),
            ...(o.outputBufferMs !== undefined && { output_buffer_ms: o.outputBufferMs }),
            ...(o.inputBatchMs !== undefined && { input_batch_ms: o.inputBatchMs }),
            ...(o.toolEnabled !== undefined && { tool_enabled: o.toolEnabled }),
            ...(o.delegation !== undefined && { delegation: o.delegation }),
            ...(o.responsesModel !== undefined && { responses_model: o.responsesModel }),
            ...(o.interruptOnUserTurn !== undefined && { interrupt_on_user_turn: o.interruptOnUserTurn }),
            ...(o.sessionParams !== undefined && { session_params: o.sessionParams }),
        };
        if (o.inputAudioTranscription !== undefined || "input_audio_transcription" in params) {
            throw new Error("GPT Live v3 does not support input_audio_transcription");
        }
        if (o.turnDetection !== undefined || "turn_detection" in params) {
            console.warn("GPT Live v3 ignores turn_detection; endpointing is internal");
            delete params.turn_detection;
        }
        if (params.delegation !== undefined && params.delegation !== "client" && params.delegation !== "responses") {
            throw new Error("GPT Live delegation must be client or responses");
        }
        if (params.headers !== undefined) {
            let headers: unknown;
            try {
                headers = JSON.parse(String(params.headers));
            } catch {
                throw new Error("GPT Live headers must be a JSON object string");
            }
            if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
                throw new Error("GPT Live headers must be a JSON object string");
            }
        }
        const session = params.session_params === undefined ? {} : params.session_params;
        if (session === null || typeof session !== "object" || Array.isArray(session)) {
            throw new Error("GPT Live session_params must be an object");
        }
        for (const key of ["model", "delegation", "audio", "instructions", "input"]) {
            if (key in session) throw new Error(`GPT Live session_params cannot override ${key}`);
        }
        let url =
            o.url ||
            `${String(params.base_url ?? "wss://api.openai.com").replace(/\/+$/, "")}/${String(params.path ?? "/v1/live/sessions").replace(/^\/+/, "")}`;
        if (!/^wss?:\/\/[^/]/i.test(url)) {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        if ((parsed.protocol !== "ws:" && parsed.protocol !== "wss:") || !parsed.hostname) {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        if (parsed.hostname === "api.openai.com" && parsed.pathname === "/v1/live") {
            parsed.pathname = "/v1/live/sessions";
            url = parsed.toString();
        }
        return {
            vendor: OPENAI_GPT_LIVE_VENDOR,
            api_key: o.apiKey,
            url,
            params,
            ...(o.greeting !== undefined && { greeting_message: o.greeting }),
            ...(o.failureMessage !== undefined && { failure_message: o.failureMessage }),
            ...(o.inputModalities !== undefined && { input_modalities: o.inputModalities }),
            ...(o.outputModalities !== undefined && { output_modalities: o.outputModalities }),
            ...(o.messages !== undefined && { messages: o.messages }),
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}

/**
 * Constructor options for OpenAI Realtime API.
 */
export interface OpenAIRealtimeOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
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
export interface AzureOpenAIRealtimeOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}

/**
 * Constructor options for Google Gemini Live (direct API, non-Vertex AI).
 */
export interface GeminiLiveOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}

/**
 * Constructor options for Google Gemini Live (Vertex AI).
 */
export interface VertexAIOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}

/**
 * Constructor options for xAI Grok Realtime API.
 */
export interface XaiGrokOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}

/** Constructor options for Alibaba Cloud Qwen Omni Realtime. */
export interface QwenOmniOptions extends BaseMllmOptions {
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
        super(options);
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
            ...(this.mcpServers !== undefined && { mcp_servers: this.mcpServers }),
            ...(this.tools !== undefined && { tools: this.tools }),
        };
    }
}
