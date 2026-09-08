/**
 * Clean type aliases for the Agora Conversational AI SDK.
 * These provide shorter, more intuitive names for the verbose Fern-generated types.
 */

import type {
    AgentThinkAgentManagementResponse,
    AmazonTtsParams as AmazonTtsParamsType,
    AmazonTts as AmazonTtsType,
    Asr,
    AsrLanguage,
    CartesiaTtsParams as CartesiaTtsParamsType,
    CartesiaTts as CartesiaTtsType,
    ElevenLabsTtsParams as ElevenLabsTtsParamsType,
    ElevenLabsTts as ElevenLabsTtsType,
    FishAudioTtsParams as FishAudioTtsParamsType,
    FishAudioTts as FishAudioTtsType,
    GenericHttpTtsParams as GenericTtsParamsType,
    GenericHttpTts as GenericTtsType,
    GetAgentsResponse,
    GetHistoryAgentsResponse,
    GetTurnsAgentsResponse,
    GoogleTtsParams as GoogleTtsParamsType,
    GoogleTts as GoogleTtsType,
    GradiumTtsParams as GradiumTtsParamsType,
    GradiumTts as GradiumTtsType,
    HumeAiTtsParams as HumeAiTtsParamsType,
    HumeAiTts as HumeAiTtsType,
    ListAgentsResponse,
    Llm,
    LlmToolExecution as LlmToolExecutionType,
    LlmToolFunction as LlmToolFunctionType,
    LlmToolServer as LlmToolServerType,
    LlmTool as LlmToolType,
    MicrosoftTtsParams as MicrosoftTtsParamsType,
    MicrosoftTts as MicrosoftTtsType,
    MinimaxTtsParams as MinimaxTtsParamsType,
    MinimaxTts as MinimaxTtsType,
    MistralTtsParams as MistralTtsParamsType,
    MistralTts as MistralTtsType,
    Mllm,
    MllmTurnDetection,
    MllmTurnDetection as MllmTurnDetectionNS,
    MurfTtsParams as MurfTtsParamsType,
    MurfTts as MurfTtsType,
    OpenAiTtsParams as OpenAiTtsParamsType,
    OpenAiTts as OpenAiTtsType,
    RimeTtsParams as RimeTtsParamsType,
    RimeTts as RimeTtsType,
    SarvamTtsParams as SarvamTtsParamsType,
    SarvamTts as SarvamTtsType,
    SpatiusAvatarParams as SpatiusAvatarParamsType,
    SpeakAgentsRequest,
    StartAgentsRequest,
    Tts,
    TypecastTtsParams as TypecastTtsParamsType,
    TypecastTts as TypecastTtsType,
    UpdateAgentsRequest,
    XAiAsrParams as XAiAsrParamsType,
    XAiAsr as XAiAsrType,
    XAiTtsParams as XAiTtsParamsType,
    XAiTts as XAiTtsType,
} from "../api/index.js";
import type { AgentThinkAgentManagementRequest } from "../api/resources/agentManagement/client/requests/AgentThinkAgentManagementRequest.js";
import type { PresetInput } from "./presets.js";

// =============================================================================
// Core Configuration Types
// =============================================================================

/** LLM request style (openai, gemini, anthropic, dify) */
export type LlmStyle = Llm.Style;

/**
 * STT/ASR (Speech-to-Text) configuration with vendor-specific typed parameters.
 * This discriminated union provides type safety and auto-complete for vendor params.
 * When using shorthand strings or minimal configs, the untyped variant is available.
 */
export type SttConfig =
    | {
          vendor: "fengming";
          language?: TurnDetectionLanguage;
          keywords?: string[];
          params?: Record<string, unknown>;
      }
    | { vendor: "tencent"; language?: TurnDetectionLanguage; params?: Record<string, unknown> }
    | { vendor: "xfyun"; language?: TurnDetectionLanguage; params?: Record<string, unknown> }
    | { vendor: "xfyun_bigmodel"; language?: TurnDetectionLanguage; params?: Record<string, unknown> }
    | { vendor: "xfyun_dialect"; language?: TurnDetectionLanguage; params?: Record<string, unknown> }
    | { vendor: "speechmatics"; language?: TurnDetectionLanguage; params: SpeechmaticsParams }
    | { vendor: "deepgram"; language?: TurnDetectionLanguage; params: DeepgramParams }
    | { vendor: "microsoft"; language?: TurnDetectionLanguage; params: MicrosoftAsrParams }
    | { vendor: "openai"; language?: TurnDetectionLanguage; params: OpenAiAsrParams }
    | { vendor: "google"; language?: TurnDetectionLanguage; params: GoogleAsrParams }
    | { vendor: "amazon"; language?: TurnDetectionLanguage; params: AmazonAsrParams }
    | { vendor: "assemblyai"; language?: TurnDetectionLanguage; params: AssemblyAiParams }
    | { vendor: "ares"; language?: TurnDetectionLanguage; keywords?: string[]; params?: AresParams }
    | { vendor: "sarvam"; language?: TurnDetectionLanguage; params: SarvamAsrParams }
    | { vendor: "xai"; language?: TurnDetectionLanguage; params: XAiAsrParams }
    | { vendor: "gemini"; language?: TurnDetectionLanguage; params: GeminiAsrParams }
    | Asr; // Fallback for shorthand/untyped configs

/** ASR configuration — alias for {@link SttConfig} (wire field: `asr`). */
export type AsrConfig = SttConfig;

/** Wire ASR vendor identifier (e.g. `"deepgram"`, `"fengming"`). */
export type AsrVendorName = string;

/** TTS (Text-to-Speech) configuration - discriminated union */
export type TtsConfig = Tts;

/** Inline synchronous REST tool exposed to a standard text LLM. */
export type LlmTool = LlmToolType;
export type LlmToolExecution = LlmToolExecutionType;
export type LlmToolFunction = LlmToolFunctionType;
export type LlmToolServer = LlmToolServerType;

/** MLLM (Multimodal LLM) configuration */
export type MllmConfig = Mllm;

/** MLLM wire vendor name (openai, azure, gemini, vertexai, xai, qwen_omni) */
export type MllmVendor = Mllm.Vendor;

/** Avatar configuration */
export type AvatarConfig = StartAgentsRequest.Properties.Avatar;

/** Avatar vendor (akool, liveavatar, anam, generic, deprecated heygen) */
/** Wire avatar vendor identifier (e.g. `"liveavatar"`, `"sensetime"`, `"spatius"`). */
export type AvatarWireVendor = StartAgentsRequest.Properties.Avatar.Vendor;

/** BCP-47 language tag used by `turn_detection.language`. */
export type TurnDetectionLanguage = AsrLanguage;

/** Turn detection configuration */
export type TurnDetectionConfig = Omit<StartAgentsRequest.Properties.TurnDetection, "language"> & {
    language?: TurnDetectionLanguage;
};

// --- New SOS/EOS turn detection types (preferred) ---

/** Detailed nested config for turn detection (`turn_detection.config`) */
export type TurnDetectionNestedConfig = StartAgentsRequest.Properties.TurnDetection.Config;

/** Start of Speech (SoS) detection configuration (`turn_detection.config.start_of_speech`) */
export type StartOfSpeechConfig = StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech;

/** Start of speech detection mode: `"vad"` | `"keywords"` | `"disabled"` */
export type StartOfSpeechMode = StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech.Mode;

/** VAD config for SoS detection (`start_of_speech.vad_config`) */
export type StartOfSpeechVadConfig = StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech.VadConfig;

/** Keyword trigger config for SoS detection (`start_of_speech.keywords_config`) */
export type StartOfSpeechKeywordsConfig =
    StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech.KeywordsConfig;

/** Disabled mode config for SoS detection (`start_of_speech.disabled_config`) */
export type StartOfSpeechDisabledConfig =
    StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech.DisabledConfig;

/** Voice processing strategy when SoS is disabled: `"append"` | `"ignored"` */
export type StartOfSpeechDisabledConfigStrategy =
    StartAgentsRequest.Properties.TurnDetection.Config.StartOfSpeech.DisabledConfig.Strategy;

/** End of Speech (EoS) detection configuration (`turn_detection.config.end_of_speech`) */
export type EndOfSpeechConfig = StartAgentsRequest.Properties.TurnDetection.Config.EndOfSpeech;

/** End of speech detection mode: `"vad"` | `"semantic"` */
export type EndOfSpeechMode = StartAgentsRequest.Properties.TurnDetection.Config.EndOfSpeech.Mode;

/** VAD config for EoS detection (`end_of_speech.vad_config`) */
export type EndOfSpeechVadConfig = StartAgentsRequest.Properties.TurnDetection.Config.EndOfSpeech.VadConfig;

/** Semantic config for EoS detection (`end_of_speech.semantic_config`) */
export type EndOfSpeechSemanticConfig = StartAgentsRequest.Properties.TurnDetection.Config.EndOfSpeech.SemanticConfig;

// --- Deprecated turn detection types ---

/**
 * @deprecated Use `TurnDetectionConfig` with `config.start_of_speech` and `config.end_of_speech` instead.
 * The `type` field and `agora_vad` / `server_vad` / `semantic_vad` values are being removed in a future release.
 */
export type TurnDetectionType = StartAgentsRequest.Properties.TurnDetection.Type;

/**
 * @deprecated Use `StartOfSpeechConfig` with `mode: "vad" | "keywords" | "disabled"` and the corresponding
 * `vad_config`, `keywords_config`, or `disabled_config` instead.
 */
export type InterruptMode = StartAgentsRequest.Properties.TurnDetection.InterruptMode;

/**
 * @deprecated Only applies to `server_vad` / `semantic_vad` modes with OpenAI Realtime API (MLLM).
 * Has no equivalent in the standard ASR + LLM + TTS pipeline.
 */
export type Eagerness = StartAgentsRequest.Properties.TurnDetection.Eagerness;

/** SAL (Selective Attention Locking) configuration */
export type SalConfig = StartAgentsRequest.Properties.Sal;

/** SAL mode (locking, recognition) */
export type SalMode = StartAgentsRequest.Properties.Sal.SalMode;

/** Advanced features configuration */
export type AdvancedFeatures = StartAgentsRequest.Properties.AdvancedFeatures;

/** Session parameters configuration */
export type SessionParams = StartAgentsRequest.Properties.Parameters;

/** RTC audio scenario for the session parameters object. */
export type ParametersAudioScenario = StartAgentsRequest.Properties.Parameters.AudioScenario;

/**
 * AgentKit session parameters input.
 * Allows providing `audio_scenario` through the AgentKit layer.
 */
export type SessionParamsInput = SessionParams & {
    audio_scenario?: ParametersAudioScenario;
};

/** Silence configuration */
export type SilenceConfig = StartAgentsRequest.Properties.Parameters.SilenceConfig;

/** Silence action */
export type SilenceAction = StartAgentsRequest.Properties.Parameters.SilenceConfig.Action;

/** Farewell configuration */
export type FarewellConfig = StartAgentsRequest.Properties.Parameters.FarewellConfig;

/** Agent data transmission channel (`"rtm"` | `"datastream"`) */
export type ParametersDataChannel = StartAgentsRequest.Properties.Parameters.DataChannel;

/** Interruption behavior configuration (`interruption`) */
export type InterruptionConfig = StartAgentsRequest.Properties.Interruption;

/** Interruption trigger mode: `"start_of_speech"` | `"keywords"` */
export type InterruptionMode = StartAgentsRequest.Properties.Interruption.Mode;

/** MLLM turn-detection configuration (`mllm.turn_detection`) */
export type MllmTurnDetectionConfig = MllmTurnDetection;

/** MLLM turn-detection mode (`agora_vad` | `server_vad` | `semantic_vad`) */
export type MllmTurnDetectionMode = MllmTurnDetectionNS.Mode;

/** Options for `AgentSession.think()` */
export type ThinkOnListeningAction = AgentThinkAgentManagementRequest.OnListeningAction;
export type ThinkOnThinkingAction = AgentThinkAgentManagementRequest.OnThinkingAction;
export type ThinkOnSpeakingAction = AgentThinkAgentManagementRequest.OnSpeakingAction;

export interface ThinkOptions {
    on_listening_action?: ThinkOnListeningAction;
    on_thinking_action?: ThinkOnThinkingAction;
    on_speaking_action?: ThinkOnSpeakingAction;
    interruptable?: boolean;
    metadata?: Record<string, string>;
}

/** Response type for `AgentSession.think()` */
export type ThinkResponse = AgentThinkAgentManagementResponse;

/** Options for `AgentSession.getTurns()`. */
export interface GetTurnsOptions {
    /** Page number, starting from 1. */
    page_index?: number;
    /** Number of dialogue turns returned per page. */
    page_size?: number;
}

/** Regional access restriction configuration */
export type GeofenceConfig = StartAgentsRequest.Properties.Geofence;

/** Allowed geographic region for server access */
export type GeofenceArea = StartAgentsRequest.Properties.Geofence.Area;

/** Geographic region to exclude when `area` is `"GLOBAL"` */
export type GeofenceExcludeArea = StartAgentsRequest.Properties.Geofence.ExcludeArea;

/** RTC media encryption configuration */
export type RtcConfig = StartAgentsRequest.Properties.Rtc;

/** Filler word configuration (plays filler words while waiting for LLM responses) */
export type FillerWordsConfig = StartAgentsRequest.Properties.FillerWords;

/** Filler word trigger configuration (when to play filler words) */
export type FillerWordsTrigger = StartAgentsRequest.Properties.FillerWords.Trigger;

/** Fixed-time trigger config for filler words (`trigger.fixed_time_config`) */
export type FillerWordsTriggerFixedTimeConfig = StartAgentsRequest.Properties.FillerWords.Trigger.FixedTimeConfig;

/** Filler word content configuration (source and selection of filler words) */
export type FillerWordsContent = StartAgentsRequest.Properties.FillerWords.Content;

/** Static filler word content config (`content.static_config`) */
export type FillerWordsContentStaticConfig = StartAgentsRequest.Properties.FillerWords.Content.StaticConfig;

/** Generated filler word content configuration. */
export type FillerWordsContentGeneratedConfig = StartAgentsRequest.Properties.FillerWords.Content.GeneratedConfig;

/** OpenAI-compatible provider settings for generated filler words. */
export type FillerWordsGeneratedLlmProvider =
    StartAgentsRequest.Properties.FillerWords.Content.GeneratedConfig.LlmProvider;

/** Filler word selection rule: `"shuffle"` | `"round_robin"` */
export type FillerWordsContentSelectionRule =
    StartAgentsRequest.Properties.FillerWords.Content.StaticConfig.SelectionRule;

/** Custom business labels attached to the agent (returned in notification callbacks) */
export type Labels = Record<string, string>;

// =============================================================================
// LLM Sub-types
// =============================================================================

/** LLM greeting broadcast configuration (`llm.greeting_configs`) */
export type LlmGreetingConfigs = Llm.GreetingConfigs;

/** Greeting broadcast ASR policy: `"merge_reply"` | `"context"` */
export type LlmGreetingConfigsMode = Llm.GreetingConfigs.UninterruptibleAsrPolicy;

/** MCP server config item (`llm.mcp_servers[]`) */
export type McpServersItem = Record<string, unknown>;

// =============================================================================
// Agent Configuration (combines all the above)
// =============================================================================

/** Full agent configuration (alias for StartAgentsRequest.Properties) */
export type AgentConfig = StartAgentsRequest.Properties;

/** Agent configuration update (for runtime updates) */
export type AgentConfigUpdate = UpdateAgentsRequest.Properties;

// =============================================================================
// Session Types
// =============================================================================

/** Options for creating a session via {@link Agent.createSession} */
export interface SessionOptions {
    /** Unique agent instance name sent to the Agora API. Omit to auto-generate `agent-{timestamp}`. */
    name?: string;
    /** The channel to join */
    channel: string;
    /** Authentication token for the channel. Omit to auto-generate (requires appCertificate on the session). */
    token?: string;
    /** The agent's RTC UID */
    agentUid: string;
    /** Remote user UIDs to subscribe to */
    remoteUids: string[];
    /** Idle timeout in seconds (0 = no auto-exit) */
    idleTimeout?: number;
    /** Whether to use string UIDs */
    enableStringUid?: boolean;
    /** Preset IDs to use as the base ASR/LLM/TTS configuration for this session */
    preset?: PresetInput;
    /** Published AI Studio pipeline ID to use as this session's base configuration. Overrides agent.pipelineId. */
    pipelineId?: string;
    /**
     * Token lifetime in seconds (default: 86400 = 24 hours, Agora maximum).
     * Only applies when the SDK auto-generates a token (i.e. no `token` is provided).
     * Valid range: 1–86400. Use `ExpiresIn.hours()` / `ExpiresIn.minutes()` for clarity.
     */
    expiresIn?: number;
    /** Enable debug logging of API requests */
    debug?: boolean;
    /** Optional warning logger. Defaults to console.warn. Set to a no-op to silence warnings. */
    warn?: (message: string) => void;
}

/** Session status */
export type SessionStatus = ListAgentsResponse.Data.List.Item.Status;

/** Session info (from get endpoint) */
export type SessionInfo = GetAgentsResponse;

/** Session list response */
export type SessionListResponse = ListAgentsResponse;

/** Session summary (list item) */
export type SessionSummary = ListAgentsResponse.Data.List.Item;

// =============================================================================
// Conversation Types
// =============================================================================

/** Conversation history */
export type ConversationHistory = GetHistoryAgentsResponse;

/** Conversation turn */
export type ConversationTurn = GetHistoryAgentsResponse.Contents.Item;

/** Conversation role */
export type ConversationRole = GetHistoryAgentsResponse.Contents.Item.Role;

/** Conversation turn analytics response */
export type ConversationTurns = GetTurnsAgentsResponse;

/** Conversation turn analytics item */
export type ConversationSessionTurn = GetTurnsAgentsResponse.Turns.Item;

// =============================================================================
// Say/Speak Types
// =============================================================================

/** Options for the say() method */
export interface SayOptions {
    /** Priority of the message */
    priority?: SpeakPriority;
    /** Whether the message can be interrupted */
    interruptable?: boolean;
}

/** Speak priority */
export type SpeakPriority = SpeakAgentsRequest.Priority;

// =============================================================================
// LLM Vendor-Specific Parameter Types
// =============================================================================

/**
 * OpenAI-style LLM parameters
 * Used for: OpenAI, Azure OpenAI, and OpenAI-compatible APIs
 * @see https://docs.agora.io/en/conversational-ai/models/llm/overview
 */
export interface OpenAiLlmParams {
    /** Model name (e.g., 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo') */
    model: string;
    /** Maximum number of tokens to generate */
    max_tokens?: number;
    /** Temperature for response randomness (0-2) */
    temperature?: number;
    /** Top-p nucleus sampling parameter */
    top_p?: number;
    /** Number of completions to generate */
    n?: number;
    /** Presence penalty (-2.0 to 2.0) */
    presence_penalty?: number;
    /** Frequency penalty (-2.0 to 2.0) */
    frequency_penalty?: number;
    /** Additional OpenAI-specific parameters */
    [key: string]: unknown;
}

/**
 * Gemini-style LLM parameters
 * Used for: Google Gemini and Vertex AI
 * @see https://docs.agora.io/en/conversational-ai/models/llm/overview
 */
export interface GeminiLlmParams {
    /** Model name (e.g., 'gemini-pro', 'gemini-1.5-flash') */
    model: string;
    /** Maximum number of output tokens */
    maxOutputTokens?: number;
    /** Temperature for response randomness (0-2) */
    temperature?: number;
    /** Top-p nucleus sampling parameter */
    topP?: number;
    /** Top-k sampling parameter */
    topK?: number;
    /** Google Cloud project ID (for Vertex AI) */
    project_id?: string;
    /** Google Cloud location (for Vertex AI) */
    location?: string;
    /** Additional Gemini-specific parameters */
    [key: string]: unknown;
}

/**
 * Anthropic-style LLM parameters
 * Used for: Anthropic Claude models
 * @see https://docs.agora.io/en/conversational-ai/models/llm/overview
 */
export interface AnthropicLlmParams {
    /** Model name (e.g., 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229') */
    model: string;
    /** Maximum number of tokens to generate */
    max_tokens?: number;
    /** Temperature for response randomness (0-1) */
    temperature?: number;
    /** Top-p nucleus sampling parameter */
    top_p?: number;
    /** Top-k sampling parameter */
    top_k?: number;
    /** Additional Anthropic-specific parameters */
    [key: string]: unknown;
}

/**
 * Dify-style LLM parameters
 * Used for: Dify workflow API
 * @see https://docs.agora.io/en/conversational-ai/models/llm/overview
 */
export interface DifyLlmParams {
    /** Dify user identifier */
    user?: string;
    /** Conversation ID for continuing a conversation */
    conversation_id?: string;
    /** Additional Dify-specific parameters */
    [key: string]: unknown;
}

/**
 * Common LLM configuration fields shared across all vendors
 */
interface BaseLlmConfig {
    /** The LLM callback address */
    url: string;
    /** The LLM API key */
    api_key?: string;
    /** System messages for context */
    system_messages?: Record<string, unknown>[];
    /** Maximum conversation history to cache */
    max_history?: number;
    /** Input modalities (e.g., ["text"], ["text", "image"]) */
    input_modalities?: string[];
    /** Output modalities (e.g., ["text"], ["audio"], ["text", "audio"]) */
    output_modalities?: string[];
    /** Agent greeting message */
    greeting_message?: string;
    /** Publicly accessible greeting audio URL */
    greeting_audio_url?: string;
    /** Failure message when LLM call fails */
    failure_message?: string;
    /** LLM provider (e.g., 'azure', 'custom') */
    vendor?: string;
    /** Greeting broadcast configuration for multi-user channels (`llm.greeting_configs`) */
    greeting_configs?: LlmGreetingConfigs;
    /** Key-value pairs injected into system_messages / greeting_message via `{{variable_name}}` syntax */
    template_variables?: Record<string, string>;
    /** MCP server configurations enabling the agent to call tools from external services */
    mcp_servers?: McpServersItem[];
    /** Inline synchronous REST tools exposed to the LLM for function calling */
    tools?: LlmTool[];
}

/**
 * LLM (Large Language Model) configuration with vendor-specific typed parameters.
 * This discriminated union provides type safety and auto-complete based on the style.
 */
export type LlmConfig =
    | (BaseLlmConfig & { style: "openai"; params: OpenAiLlmParams })
    | (BaseLlmConfig & { style: "gemini"; params: GeminiLlmParams })
    | (BaseLlmConfig & { style: "anthropic"; params: AnthropicLlmParams })
    | (BaseLlmConfig & { style: "dify"; params: DifyLlmParams })
    | (BaseLlmConfig & { style?: undefined; params?: Record<string, unknown> })
    | Llm; // Fallback for shorthand configs

// =============================================================================
// STT/ASR Vendor-Specific Parameter Types
// =============================================================================

/**
 * Speechmatics STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/speechmatics
 */
export interface SpeechmaticsParams {
    /** Speechmatics API key for authentication (required) */
    key: string;
    /** @deprecated The REST API expects `key`; use `key` instead. */
    api_key?: string;
    /** Language code for transcription (e.g., 'en', 'es', 'fr') (required) */
    language: string;
    /** Speechmatics streaming WebSocket URL */
    uri?: string;
    /** Additional Speechmatics-specific parameters passed directly to Speechmatics API */
    [key: string]: unknown;
}

/**
 * Deepgram STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/deepgram
 */
export interface DeepgramParams {
    /** Deepgram API key */
    key?: string;
    /** Model to use (e.g., 'nova-2', 'enhanced', 'base') */
    model?: string;
    /** Language code (e.g., 'en-US', 'es', 'fr') */
    language?: string;
    /** Enable smart formatting */
    smart_format?: boolean;
    /** Enable punctuation */
    punctuation?: boolean;
    /** Additional Deepgram-specific parameters */
    [key: string]: unknown;
}

/**
 * Microsoft Azure Speech STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/microsoft
 */
export interface MicrosoftAsrParams {
    /** Microsoft Azure subscription key (required) */
    key: string;
    /** Azure region (e.g., 'eastus', 'westus') (required) */
    region: string;
    /** Language code (e.g., 'en-US', 'es-ES') */
    language?: string;
    /** Additional Microsoft Azure Speech-specific parameters */
    [key: string]: unknown;
}

/**
 * OpenAI Whisper STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/openai
 */
export interface OpenAiAsrParams {
    /** OpenAI API key (required) */
    api_key: string;
    /** OpenAI transcription settings */
    input_audio_transcription?: {
        model?: string;
        prompt?: string;
        language?: string;
        [key: string]: unknown;
    };
    /** Additional OpenAI-specific parameters */
    [key: string]: unknown;
}

/**
 * Google Cloud Speech-to-Text parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/google
 */
export interface GoogleAsrParams {
    /** Google Cloud project ID where Speech-to-Text is enabled (required) */
    project_id: string;
    /** Google Cloud region for the recognizer (required) */
    location: string;
    /** Google service account credentials JSON string (required) */
    adc_credentials_string: string;
    /** Language code (e.g., 'en-US', 'es-ES') */
    language?: string;
    /** Recognition model to use */
    model?: string;
    /** Additional Google Speech-to-Text parameters */
    [key: string]: unknown;
}

/**
 * Amazon Transcribe STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/amazon
 */
export interface AmazonAsrParams {
    /** AWS Access Key ID (required) */
    access_key_id: string;
    /** AWS Secret Access Key (required) */
    secret_access_key: string;
    /** AWS region (e.g., 'us-east-1') (required) */
    region: string;
    /** Language code */
    language_code?: string;
    /** Additional Amazon Transcribe parameters */
    [key: string]: unknown;
}

/**
 * AssemblyAI STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/assemblyai
 */
export interface AssemblyAiParams {
    /** AssemblyAI API key (required) */
    api_key: string;
    /** Language code */
    language?: string;
    /** AssemblyAI streaming WebSocket URL */
    ws_url?: string;
    /** Additional AssemblyAI-specific parameters */
    [key: string]: unknown;
}

/**
 * Agora ARES (Adaptive Recognition Engine for Speech) parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/ares
 */
export interface AresParams {
    /** Additional ARES-specific parameters */
    [key: string]: unknown;
}

/**
 * Sarvam Speech-to-Text parameters (Beta)
 * @see https://docs.agora.io/en/conversational-ai/models/asr/sarvam
 */
export interface SarvamAsrParams {
    /** Sarvam API key */
    api_key: string;
    /** Language code (e.g., 'en', 'hi', 'ta') */
    language?: string;
    /** Additional Sarvam-specific parameters */
    [key: string]: unknown;
}

/**
 * xAI STT parameters
 * @see https://docs.agora.io/en/conversational-ai/models/asr/overview
 */
export type XAiAsr = XAiAsrType;
export type XAiAsrParams = XAiAsrParamsType;

/** Google Gemini STT parameters, including the legacy preview wire spelling. */
export interface GeminiAsrParams {
    /** Google API key. */
    api_key: string;
    /** Gemini transcription model. */
    model: string;
    /** Audio sample rate in Hz. */
    sample_rate?: number;
    /** Recognition language used by the production API. */
    language?: string;
    /** @deprecated Use `language_hints`; retained for preview API compatibility. */
    language_codes?: string[];
    /** Candidate transcription languages used by the production Gemini extension. */
    language_hints?: string[];
    /** Words and phrases used to bias recognition. */
    custom_vocabulary?: string[];
    /** Whether to include word-level timestamps. */
    word_timestamp?: boolean;
    /** Additional Gemini-specific parameters. */
    [key: string]: unknown;
}

// =============================================================================
// TTS Vendor-Specific Types (re-exports for convenience)
// =============================================================================

export type MicrosoftTts = MicrosoftTtsType;
export type MicrosoftTtsParams = MicrosoftTtsParamsType;
export type ElevenLabsTts = ElevenLabsTtsType;
export type ElevenLabsTtsParams = ElevenLabsTtsParamsType;
export type CartesiaTts = CartesiaTtsType;
export type CartesiaTtsParams = CartesiaTtsParamsType;
export type OpenAiTts = OpenAiTtsType;
export type OpenAiTtsParams = OpenAiTtsParamsType;
export type HumeAiTts = HumeAiTtsType;
export type HumeAiTtsParams = HumeAiTtsParamsType;
export type RimeTts = RimeTtsType;
export type RimeTtsParams = RimeTtsParamsType;
export type FishAudioTts = FishAudioTtsType;
export type FishAudioTtsParams = FishAudioTtsParamsType;
export type GenericTts = GenericTtsType;
export type GenericTtsParams = GenericTtsParamsType;
export type GoogleTts = GoogleTtsType;
export type GoogleTtsParams = GoogleTtsParamsType;
export type GradiumTts = GradiumTtsType;
export type GradiumTtsParams = GradiumTtsParamsType;
export type AmazonTts = AmazonTtsType;
export type AmazonTtsParams = AmazonTtsParamsType;
export type MinimaxTts = MinimaxTtsType;
export type MinimaxTtsParams = MinimaxTtsParamsType;
export type MistralTts = MistralTtsType;
export type MistralTtsParams = MistralTtsParamsType;
export type MurfTts = MurfTtsType;
export type MurfTtsParams = MurfTtsParamsType;
export type SarvamTts = SarvamTtsType;
export type SarvamTtsParams = SarvamTtsParamsType;
export type XAiTts = XAiTtsType;
export type XAiTtsParams = XAiTtsParamsType;
export type TypecastTts = TypecastTtsType;
export type TypecastTtsParams = TypecastTtsParamsType;
export type SpatiusAvatarParams = SpatiusAvatarParamsType;
