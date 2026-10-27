// Generated from engineering.openapi.json; corrections are applied by session-lifecycle.ts.
export type AgentInput = {
    instructions?: string | null;
    messages?: Array<Message> | null;
    greeting?: (TextGreeting | AudioGreeting) | null;
    variables?: { [key: string]: VariableDefinition } | null;
    pipeline?: (SessionCascadedPipeline | SessionRealtimePipeline) | null;
    filler_words?: FillerWords | null;
};
export type AgoraVadTurnDetection = {
    type: "agora_vad";
    interrupt_duration_ms?: number | null;
    prefix_padding_ms?: number | null;
    silence_duration_ms?: number | null;
    threshold?: number | number | null;
};
export type AudioGreeting = {
    mode: "audio";
    on?: "each_join" | "first_join";
    delay_ms?: number;
    url: string;
    text: string;
    download_timeout_ms?: number;
    pcm_sample_rate?: number;
};
export type ByokCredential = { mode: "byok"; api_key?: string | null; fields?: { [key: string]: string } | null };
export type CallPolicy = {
    max_ring_duration_ms?: number | null;
    max_call_duration_seconds?: number | null;
    voicemail?: VoicemailPolicy | null;
    max_silence_duration_ms?: number | null;
    end_call?: EndCallPolicy | null;
    transfer?: TransferPolicy | null;
};
export type DataPolicy = { retention?: "30_days" | "none" };
export type DisabledInterruption = { mode: "off"; when_off?: "append" | "ignore" };
export type EndCallPolicy = {
    on_conversation_complete?: boolean;
    on_user_request?: boolean;
    on_fax?: boolean;
    on_ai_assistant?: boolean;
};
export type EphemeralSessionCreate = {
    client_reference?: string | null;
    agent: AgentInput;
    values?: { [key: string]: string | number | number | boolean } | null;
    labels?: { [key: string]: string } | null;
    transport: RtcTransport | TelephonyTransport;
    lifecycle?: Lifecycle | null;
    data_policy?: DataPolicy | null;
};
export type FillerTrigger = { mode: "fixed_time"; response_wait_ms: number };
export type FillerWords = {
    enable?: boolean | null;
    trigger?: FillerTrigger | null;
    content?: (StaticFillerContent | GeneratedFillerContent) | null;
};
export type FunctionTool = {
    type: "function";
    name: string;
    description: string;
    parameters: JSONObject;
    execution: ToolExecution;
    server: ToolServer;
};
export type GeneratedFillerContent = { mode: "generated"; instructions: string; fallback_strategy?: "static" | null };
export type GracefulStop = { enabled?: boolean; timeout_ms?: number };
export type JSONObject = { [key: string]: JsonValue };
export type JsonValue = unknown;
export type KeywordInterruption = { mode: "keywords"; keywords: Array<string> };
export type Lifecycle = { idle_timeout_ms?: number; max_duration_ms?: number; graceful_stop?: GracefulStop | null };
export type ManagedCredential = { mode: "managed" };
export type ManualTurnBoundary = { type: "manual" };
export type McpServer = {
    name: string;
    endpoint: string;
    transport: "streamable_http";
    headers?: { [key: string]: string } | null;
    allowed_tools?: Array<string> | null;
    timeout_ms?: number | null;
};
export type Message = { role: "system" | "user" | "assistant"; content: string };
export type ProviderModule = {
    credential?: (ManagedCredential | ByokCredential) | null;
    vendor?: string | null;
    model?: string | null;
    style?: string | null;
    language?: string | null;
    enabled?: boolean | null;
    params?: JSONObject | null;
    url?: string | null;
    headers?: { [key: string]: string } | null;
    input_modalities?: Array<string> | null;
    output_modalities?: Array<string> | null;
    max_history?: number | null;
    failure_message?: string | null;
    mcp_servers?: Array<McpServer> | null;
    tools?: Array<FunctionTool> | null;
    skip_patterns?: Array<string> | null;
};
export type RtcEncryption = {
    mode:
        | "aes_128_xts"
        | "aes_128_ecb"
        | "aes_256_xts"
        | "sm4_128_ecb"
        | "aes_128_gcm"
        | "aes_256_gcm"
        | "aes_128_gcm2"
        | "aes_256_gcm2";
    key: string;
    salt?: string | null;
};
export type RtcTransport = {
    type: "rtc";
    channel: string;
    token?: string | null;
    uid: string;
    subscribe_uids: Array<string>;
    encryption?: RtcEncryption | null;
    audio_scenario?: "aiserver" | "chorus";
};
export type SemanticTurnEnd = {
    type: "semantic";
    silence_duration_ms?: number | null;
    max_wait_ms?: number | null;
    pause_state_enabled?: boolean | null;
};
export type SemanticTurnStart = { type: "semantic"; speaking_interrupt_duration_ms?: number | null };
export type SemanticVadTurnDetection = { type: "semantic_vad"; eagerness?: "auto" | "low" | "medium" | "high" | null };
export type ServerVadTurnDetection = {
    type: "server_vad";
    prefix_padding_ms?: number | null;
    silence_duration_ms?: number | null;
    threshold?: number | number | null;
    idle_timeout_ms?: number | null;
    start_of_speech_sensitivity?: "START_SENSITIVITY_HIGH" | "START_SENSITIVITY_LOW" | null;
    end_of_speech_sensitivity?: "END_SENSITIVITY_HIGH" | "END_SENSITIVITY_LOW" | null;
};
export type SessionAnalysis = {
    status: "pending" | "completed" | "failed" | "skipped";
    skip_reason: "no_user_turns" | "retention_none" | null;
    complete_ts: number | null;
    result: { [key: string]: string | number | number | boolean | null } | null;
    error: string | null;
};
export type SessionCascadedPipeline = {
    mode: "cascaded";
    avatar?: ProviderModule | null;
    turn_detection?: TurnDetection | null;
    asr?: ProviderModule | null;
    tts?: ProviderModule | null;
    llm?: ProviderModule | null;
    silence_config?: SilenceConfig | null;
};
export type SessionCreate = {
    client_reference?: string | null;
    agent_id: string;
    values?: { [key: string]: string | number | number | boolean } | null;
    labels?: { [key: string]: string } | null;
    transport: RtcTransport | TelephonyTransport;
    lifecycle?: Lifecycle | null;
    data_policy?: DataPolicy | null;
};
export type SessionRealtimePipeline = {
    mode: "realtime";
    avatar?: ProviderModule | null;
    turn_detection?: (AgoraVadTurnDetection | ServerVadTurnDetection | SemanticVadTurnDetection) | null;
    mllm?: ProviderModule | null;
};
export type SessionResponse = {
    agent_session_id: string;
    start_ts: number;
    status: "IDLE" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";
    agent_name?: string;
    stop_ts?: number | null;
    message?: string | null;
    analysis?: SessionAnalysis | null;
};
export type SessionStartResponse = { agent_session_id: string; status: "starting" | "running"; created_at: number };
export type SilenceConfig = { enabled: boolean; timeout_ms: number; action: "speak" | "think"; content: string };
export type SpeechInterruption = { mode: "start_of_speech" };
export type StaticFillerContent = {
    mode: "static";
    phrases: Array<string>;
    selection_rule?: "shuffle" | "round_robin";
};
export type TelephonyTransport = { type: "telephony"; from: string; to: string; call_policy?: CallPolicy | null };
export type TextGreeting = { mode: "text"; on?: "each_join" | "first_join"; delay_ms?: number; text: string };
export type ToolExecution = { mode: "sync" };
export type ToolServer = {
    method: "GET" | "POST";
    url: string;
    headers?: { [key: string]: string } | null;
    body?: JSONObject | null;
    timeout_ms?: number | null;
};
export type TransferPolicy = { phone_number: string; description: string };
export type TurnDetection = {
    speech_threshold?: number | number | null;
    start_of_speech?: (SemanticTurnStart | VadTurnStart | ManualTurnBoundary) | null;
    end_of_speech?: (SemanticTurnEnd | VadTurnEnd | ManualTurnBoundary) | null;
    interruption?: (SpeechInterruption | KeywordInterruption | DisabledInterruption) | null;
};
export type VadTurnEnd = { type: "vad"; silence_duration_ms?: number | null };
export type VadTurnStart = {
    type: "vad";
    interrupt_duration_ms?: number | null;
    speaking_interrupt_duration_ms?: number | null;
    prefix_padding_ms?: number | null;
};
export type VariableDefinition = {
    type: "str" | "int" | "float" | "bool" | "date" | "datetime";
    required?: boolean;
    options?: Array<string | number | number | boolean> | null;
    extract?: boolean;
    description?: string | null;
};
export type VoicemailPolicy = { mode: "continue" | "hangup" };
