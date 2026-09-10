/**
 * Agentkit layer for the Agora Conversational AI SDK.
 *
 * This module provides a cleaner, more ergonomic API on top of the
 * Fern-generated SDK types and methods.
 *
 * ## Maintenance Notes
 *
 * This agentkit is designed to minimize maintenance burden:
 *
 * 1. **Type aliases** (in types.ts) re-export Fern types directly.
 *    When Fern adds new fields, they're automatically available.
 *
 * 2. **The `raw` property** on AgentSession exposes the underlying
 *    Fern-generated AgentsClient. When Fern adds new endpoints,
 *    they're immediately available via `session.raw.newEndpoint()`.
 *
 * 3. **Convenience methods** (say, stop, interrupt, etc.) are the only
 *    parts that need manual updates when adding new sugar.
 */

// Re-export the underlying client type for advanced usage
export type { AgentsClient } from "../api/resources/agents/client/Client.js";
export type { AgentOptions } from "./Agent.js";
// Core classes
export { Agent } from "./Agent.js";
export type {
    AgentSessionEvent,
    AgentSessionEventHandler,
    AgentSessionOptions,
} from "./AgentSession.js";
export { AgentSession } from "./AgentSession.js";
// Vendor-specific avatar types with strict constraints
export type {
    AkoolAvatarConfig,
    AnamAvatarConfig,
    GenericAvatarConfig,
    HeyGenAvatarConfig,
    LiveAvatarAvatarConfig,
    SensetimeAvatarConfig,
    SpatiusAvatarConfig,
    StrictAvatarConfig,
} from "./avatar-types.js";
export {
    isAkoolAvatar,
    isAnamAvatar,
    isAvatarTokenManaged,
    isGenericAvatar,
    isHeyGenAvatar,
    isLiveAvatarAvatar,
    isSensetimeAvatar,
    isSpatiusAvatar,
    toBaseAvatarConfig,
    validateAvatarConfig,
    validateTtsSampleRate,
} from "./avatar-types.js";
// Type-safe constants
export {
    AudioScenario,
    CredentialMode,
    DataChannel,
    FillerWordsSelectionRule,
    Geofence,
    InterruptionDisabledStrategy,
    InterruptionDisabledStrategyAppend,
    InterruptionDisabledStrategyIgnore,
    InterruptionModeKeywords,
    InterruptionModeStartOfSpeech,
    InterruptionModeValues,
    MllmTurnDetectionModeAgoraVad,
    MllmTurnDetectionModeSemanticVad,
    MllmTurnDetectionModeServerVad,
    MllmTurnDetectionModeValues,
    SalModeValues,
    SilenceActionValues,
    SpeakPriorityAppend,
    SpeakPriorityIgnore,
    SpeakPriorityInterrupt,
    SpeakPriorityValues,
    ThinkOnListeningActionIgnore,
    ThinkOnListeningActionInject,
    ThinkOnListeningActionInterrupt,
    ThinkOnSpeakingActionIgnore,
    ThinkOnSpeakingActionInterrupt,
    ThinkOnThinkingActionIgnore,
    ThinkOnThinkingActionInterrupt,
    TurnDetectionTypeValues,
} from "./constants.js";
export { REDACTED, redactHeadersForDebug, redactSecrets } from "./debug.js";
export type {
    AgentPreset,
    AsrPreset,
    DeepgramPresetModel,
    LlmPreset,
    MiniMaxPresetModel,
    OpenAIPresetModel,
    OpenAITtsPresetModel,
    PresetCategory,
    PresetInput,
    TtsPreset,
} from "./presets.js";
export { AgentPresets, normalizePresetInput } from "./presets.js";
// Preview endpoint: session routing, providers, and feature gating.
// Temporary surface — removed when these providers ship on the production gateway.
export type { PreviewFeature, PreviewRoute } from "./preview/client.js";
export {
    createPreviewRoute,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    PreviewFeatures,
    previewRequestHeaders,
    requiredPreviewFeatures,
} from "./preview/client.js";
export type { OpenAIGPTLiveOptions } from "./preview/vendors.js";
export { OpenAIGPTLive } from "./preview/vendors.js";
export type {
    AvatarVendor,
    CNAvatarVendor,
    CNLlmVendor,
    CNMllmVendor,
    CNSttVendor,
    CNTtsVendor,
    GlobalAvatarVendor,
    GlobalLlmVendor,
    GlobalMllmVendor,
    GlobalSttVendor,
    GlobalTtsVendor,
    LlmVendor,
    SttVendor,
    TtsVendor,
} from "./region-vendors.js";
export type {
    GenerateConvoAITokenOptions,
    GenerateTokenOptions,
} from "./token.js";
// Token generation
export {
    ExpiresIn,
    generateConvoAIToken,
    generateRtcToken,
    MAX_EXPIRY_SECONDS,
} from "./token.js";
// Clean type aliases
export type {
    AdvancedFeatures,
    // Agent configuration
    AgentConfig,
    AgentConfigUpdate,
    AmazonTts,
    AmazonTtsParams,
    AsrConfig,
    AsrVendorName,
    AvatarConfig,
    AvatarWireVendor,
    CartesiaTts,
    CartesiaTtsParams,
    // Conversation types
    ConversationHistory,
    ConversationRole,
    ConversationSessionTurn,
    ConversationTurn,
    ConversationTurns,
    Eagerness,
    ElevenLabsTts,
    ElevenLabsTtsParams,
    EndOfSpeechConfig,
    EndOfSpeechMode,
    EndOfSpeechSemanticConfig,
    EndOfSpeechVadConfig,
    FarewellConfig,
    FillerWordsConfig,
    FillerWordsContent,
    FillerWordsContentGeneratedConfig,
    FillerWordsContentSelectionRule,
    FillerWordsContentStaticConfig,
    FillerWordsGeneratedLlmProvider,
    FillerWordsTrigger,
    FillerWordsTriggerFixedTimeConfig,
    FishAudioTts,
    FishAudioTtsParams,
    GeminiAsrParams,
    GenericTts,
    GenericTtsParams,
    GeofenceArea,
    GeofenceConfig,
    GeofenceExcludeArea,
    GetTurnsOptions,
    GoogleTts,
    GoogleTtsParams,
    GradiumTts,
    GradiumTtsParams,
    HumeAiTts,
    HumeAiTtsParams,
    InterruptionConfig,
    InterruptionMode,
    InterruptMode,
    Labels,
    // Core configuration types
    LlmConfig,
    LlmGreetingConfigs,
    LlmGreetingConfigsMode,
    LlmStyle,
    LlmTool,
    LlmToolExecution,
    LlmToolFunction,
    LlmToolServer,
    McpServersItem,
    // TTS vendor-specific types
    MicrosoftTts,
    MicrosoftTtsParams,
    MinimaxTts,
    MinimaxTtsParams,
    MistralTts,
    MistralTtsParams,
    MllmConfig,
    MllmTurnDetectionConfig,
    MllmTurnDetectionMode,
    MllmVendor,
    MurfTts,
    MurfTtsParams,
    OpenAiTts,
    OpenAiTtsParams,
    ParametersAudioScenario,
    ParametersDataChannel,
    RimeTts,
    RimeTtsParams,
    RtcConfig,
    SalConfig,
    SalMode,
    SarvamTts,
    SarvamTtsParams,
    // Say/Speak types
    SayOptions,
    SessionInfo,
    SessionListResponse,
    // Session types
    SessionOptions,
    SessionParams,
    SessionParamsInput,
    SessionStatus,
    SessionSummary,
    SilenceAction,
    SilenceConfig,
    SpatiusAvatarParams,
    SpeakPriority,
    StartOfSpeechConfig,
    StartOfSpeechDisabledConfig,
    StartOfSpeechDisabledConfigStrategy,
    StartOfSpeechKeywordsConfig,
    StartOfSpeechMode,
    StartOfSpeechVadConfig,
    SttConfig,
    ThinkOnListeningAction,
    ThinkOnSpeakingAction,
    ThinkOnThinkingAction,
    ThinkOptions,
    ThinkResponse,
    TtsConfig,
    TurnDetectionConfig,
    TurnDetectionLanguage,
    TurnDetectionNestedConfig,
    TurnDetectionType,
    TypecastTts,
    TypecastTtsParams,
    XAiAsr,
    XAiAsrParams,
    XAiTts,
    XAiTtsParams,
} from "./types.js";
export type {
    AkoolAvatarOptions,
    AnamAvatarOptions,
    GenericAvatarOptions,
    HeyGenAvatarOptions,
    LiveAvatarAvatarOptions,
} from "./vendors/avatar.js";
// Avatar vendor classes
export {
    AkoolAvatar,
    AnamAvatar,
    GenericAvatar,
    HeyGenAvatar,
    LiveAvatarAvatar,
} from "./vendors/avatar.js";
// Sample rate types
export type {
    AkoolSampleRate,
    CartesiaSampleRate,
    ElevenLabsSampleRate,
    HeyGenSampleRate,
    LiveAvatarSampleRate,
    MicrosoftSampleRate,
    SampleRate,
} from "./vendors/base.js";
// Base vendor classes
export {
    BaseAvatar,
    BaseCNAvatar,
    BaseCNLLM,
    BaseCNMLLM,
    BaseCNSTT,
    BaseCNTTS,
    BaseLLM,
    type BaseLlmOptions,
    BaseMLLM,
    BaseSTT,
    BaseTTS,
    type GoogleTTSSampleRate,
} from "./vendors/base.js";
export type {
    AliyunLLMOptions,
    BytedanceDuplexTTSOptions,
    BytedanceLLMOptions,
    BytedanceTTSOptions,
    CosyVoiceTTSOptions,
    DeepSeekLLMOptions,
    FengmingSTTOptions,
    MicrosoftCNSampleRate,
    MicrosoftCNSTTOptions,
    MicrosoftCNTTSOptions,
    MiniMaxCNTTSOptions,
    SensetimeAvatarOptions,
    SpatiusAvatarOptions,
    StepFunTTSOptions,
    TencentLLMOptions,
    TencentSTTOptions,
    TencentTTSOptions,
    XfyunBigModelSTTOptions,
    XfyunDialectSTTOptions,
    XfyunSTTOptions,
} from "./vendors/cn.js";
export {
    AliyunLLM,
    BytedanceDuplexTTS,
    BytedanceLLM,
    BytedanceTTS,
    CosyVoiceTTS,
    DeepSeekLLM,
    FengmingSTT,
    MicrosoftCNSTT,
    MicrosoftCNTTS,
    MiniMaxCNTTS,
    SensetimeAvatar,
    SpatiusAvatar,
    StepFunTTS,
    TencentLLM,
    TencentSTT,
    TencentTTS,
    XfyunBigModelSTT,
    XfyunDialectSTT,
    XfyunSTT,
} from "./vendors/cn.js";
export type {
    AmazonBedrockOptions,
    AnthropicOptions,
    AzureOpenAIOptions,
    CustomLLMOptions,
    DifyOptions,
    GeminiOptions,
    GroqOptions,
    OpenAIOptions,
    VertexAILLMOptions,
} from "./vendors/llm.js";
// LLM vendor classes
export {
    AmazonBedrock,
    Anthropic,
    AzureOpenAI,
    CustomLLM,
    Dify,
    Gemini,
    Groq,
    OpenAI,
    VertexAILLM,
} from "./vendors/llm.js";
export type {
    AzureOpenAIRealtimeOptions,
    AzureOpenAIRealtimeParams,
    GeminiLiveOptions,
    OpenAIRealtimeOptions,
    QwenOmniOptions,
    VertexAIOptions,
    XaiGrokOptions,
} from "./vendors/mllm.js";
// MLLM vendor classes
export {
    AzureOpenAIRealtime,
    GeminiLive,
    OpenAIRealtime,
    QwenOmni,
    VertexAI,
    XaiGrok,
} from "./vendors/mllm.js";
export type {
    AmazonSTTOptions,
    AresSTTOptions,
    AssemblyAISTTOptions,
    DeepgramSTTOptions,
    GeminiSTTModel,
    GeminiSTTOptions,
    GoogleSTTOptions,
    MicrosoftSTTOptions,
    OpenAISTTOptions,
    SarvamSTTOptions,
    SpeechmaticsSTTOptions,
    XAiSTTOptions,
} from "./vendors/stt.js";
// STT vendor classes
export {
    AmazonSTT,
    AresSTT,
    AssemblyAISTT,
    DeepgramSTT,
    GeminiSTT,
    GeminiSTTModels,
    GeminiTranscriptionMode,
    GoogleSTT,
    MicrosoftSTT,
    OpenAISTT,
    SarvamSTT,
    SpeechmaticsSTT,
    XAiSTT,
} from "./vendors/stt.js";
export type {
    AmazonTTSOptions,
    CartesiaTTSOptions,
    DeepgramTTSOptions,
    ElevenLabsTTSOptions,
    FishAudioTTSOptions,
    GenericTTSOptions,
    GoogleTTSOptions,
    GradiumTTSOptions,
    HumeAITTSOptions,
    MicrosoftTTSOptions,
    MiniMaxTTSOptions,
    MistralTTSOptions,
    MurfTTSOptions,
    OpenAITTSOptions,
    RimeTTSOptions,
    SarvamTTSOptions,
    TypecastTTSOptions,
    XAiTTSOptions,
} from "./vendors/tts.js";
// TTS vendor classes
export {
    AmazonTTS,
    CartesiaTTS,
    DeepgramTTS,
    ElevenLabsTTS,
    FishAudioTTS,
    GenericTTS,
    GoogleTTS,
    GradiumTTS,
    HumeAITTS,
    MicrosoftTTS,
    MiniMaxTTS,
    MistralTTS,
    MurfTTS,
    OpenAITTS,
    RimeTTS,
    SarvamTTS,
    TypecastTTS,
    XAiTTS,
} from "./vendors/tts.js";
