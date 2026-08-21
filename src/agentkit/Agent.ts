/**
 * Agent class - A reusable agent definition.
 *
 * This class represents an agent configuration that can be used to create
 * multiple sessions. Set the unique agent instance `name` in
 * {@link Agent.createSession}, not on the Agent itself.
 */

import type { AgoraClient } from "../AgoraPoolClient.js";
import type * as Agora from "../api/index.js";
import { Area } from "../core/domain/index.js";
import { AgentSession } from "./AgentSession.js";
import type { AgoraArea } from "./area.js";
import { AudioScenario } from "./constants.js";
import type {
    AvatarVendor,
    CNMllmVendor,
    GlobalMllmVendor,
    LlmVendor,
    SttVendor,
    TtsVendor,
} from "./region-vendors.js";
import { generateConvoAIToken } from "./token.js";
import type {
    AdvancedFeatures,
    AvatarConfig,
    FillerWordsConfig,
    GeofenceConfig,
    InterruptionConfig,
    Labels,
    LlmConfig,
    LlmGreetingConfigs,
    MllmConfig,
    ParametersAudioScenario,
    RtcConfig,
    SalConfig,
    SessionOptions,
    SessionParamsInput,
    SttConfig,
    TtsConfig,
    TurnDetectionConfig,
    TurnDetectionLanguage,
} from "./types.js";

const DEFAULT_TURN_DETECTION_LANGUAGE: TurnDetectionLanguage = "en-US";

const INTERACTION_LANGUAGES = new Set<string>([
    "ar-EG",
    "ar-JO",
    "ar-SA",
    "ar-AE",
    "bn-IN",
    "zh-CN",
    "zh-HK",
    "zh-TW",
    "nl-NL",
    "en-IN",
    "en-US",
    "fil-PH",
    "fr-FR",
    "de-DE",
    "gu-IN",
    "he-IL",
    "hi-IN",
    "id-ID",
    "it-IT",
    "ja-JP",
    "kn-IN",
    "ko-KR",
    "ms-MY",
    "fa-IR",
    "pt-PT",
    "ru-RU",
    "es-ES",
    "ta-IN",
    "te-IN",
    "th-TH",
    "tr-TR",
    "vi-VN",
]);

function isTurnDetectionLanguage(value: string): value is TurnDetectionLanguage {
    return INTERACTION_LANGUAGES.has(value);
}

function assertTurnDetectionLanguage(value: string): asserts value is TurnDetectionLanguage {
    if (!isTurnDetectionLanguage(value)) {
        throw new Error(`Invalid turnDetection.language: ${value}`);
    }
}

/**
 * Configuration options for creating an Agent.
 *
 * Use the fluent builder methods (.withLlm(), .withTts(), .withStt(), .withMllm())
 * to configure vendor settings after construction.
 */
export interface AgentOptions<TArea extends AgoraArea = AgoraArea> {
    /** Agora client bound to this agent. Required for `createSession()`. */
    client: AgoraClient<TArea>;
    /**
     * Published AI Studio pipeline ID to use as this agent's base configuration.
     * Explicit Agent config such as .withLlm(), .withTts(), .withStt(),
     * advancedFeatures, and other builder options may send fields in
     * `properties` that override the saved pipeline settings.
     */
    pipelineId?: string;
    /**
     * System instructions for the agent.
     * @deprecated Configure this on the LLM vendor with `systemMessages` instead.
     */
    instructions?: string;
    /** Turn detection configuration */
    turnDetection?: TurnDetectionConfig;
    /** Unified interruption control configuration */
    interruption?: InterruptionConfig;
    /** SAL configuration */
    sal?: SalConfig;
    /** Avatar configuration */
    avatar?: AvatarConfig;
    /** Advanced features */
    advancedFeatures?: AdvancedFeatures;
    /** Session parameters */
    parameters?: SessionParamsInput;
    /**
     * Greeting message.
     * @deprecated Configure this on the LLM or MLLM vendor with `greetingMessage` instead.
     */
    greeting?: string;
    /**
     * Failure message.
     * @deprecated Configure this on the LLM or MLLM vendor with `failureMessage` instead.
     */
    failureMessage?: string;
    /**
     * Max conversation history for the standard LLM pipeline. Does not apply to MLLM.
     * @deprecated Configure this on the LLM vendor with `maxHistory` instead.
     */
    maxHistory?: number;
    /** Regional access restriction configuration */
    geofence?: GeofenceConfig;
    /** Custom key-value labels attached to the agent (returned in notification callbacks) */
    labels?: Labels;
    /** RTC media encryption configuration */
    rtc?: RtcConfig;
    /** Filler word configuration (plays filler words while waiting for LLM responses) */
    fillerWords?: FillerWordsConfig;
    /**
     * Greeting playback configuration for multi-user channels.
     * @deprecated Configure this on the LLM vendor with `greetingConfigs` instead.
     */
    greetingConfigs?: LlmGreetingConfigs;
}

/**
 * Agent class representing a reusable agent configuration.
 *
 * @template TTSSampleRate - The TTS sample rate literal type (tracked for avatar compatibility)
 *
 * @example
 * ```typescript
 * import { Agent, OpenAI, MicrosoftTTS, DeepgramSTT } from 'agora-agents';
 *
 * // Use the fluent builder pattern to configure vendors
 * const agent = new Agent({ client, instructions: 'You are helpful.' })
 *   .withLlm(new OpenAI({ apiKey: '...', model: 'gpt-4', url: 'https://api.openai.com/v1/chat/completions' }))
 *   .withTts(new ElevenLabsTTS({ key: '...', modelId: '...', voiceId: '...', baseUrl: 'wss://api.elevenlabs.io/v1', sampleRate: 24000 }))
 *   .withStt(new DeepgramSTT({ apiKey: '...', model: 'nova-2' }));
 *
 * const session = agent.createSession({
 *   name: `conversation-${Date.now()}`,
 *   channel: `demo-channel-${Date.now()}`,
 *   agentUid: '1',
 *   remoteUids: ['100'],
 * });
 * ```
 */
export class Agent<TTSSampleRate extends number = number, TArea extends AgoraArea = AgoraArea> {
    private _client: AgoraClient<TArea>;
    private _pipelineId?: string;
    private _llm?: LlmConfig;
    private _tts?: TtsConfig;
    private _stt?: SttConfig;
    private _mllm?: MllmConfig;
    private _turnDetection?: TurnDetectionConfig;
    private _interruption?: InterruptionConfig;
    private _sal?: SalConfig;
    private _avatar?: AvatarConfig;
    private _advancedFeatures?: AdvancedFeatures;
    private _parameters?: SessionParamsInput;
    private _instructions?: string;
    private _greeting?: string;
    private _failureMessage?: string;
    private _maxHistory?: number;
    private _geofence?: GeofenceConfig;
    private _labels?: Labels;
    private _rtc?: RtcConfig;
    private _fillerWords?: FillerWordsConfig;
    private _greetingConfigs?: LlmGreetingConfigs;

    constructor(options: AgentOptions<TArea>) {
        this._client = options.client;
        this._pipelineId = options.pipelineId;
        this._instructions = options.instructions;
        this._greeting = options.greeting;
        this._failureMessage = options.failureMessage;
        this._maxHistory = options.maxHistory;

        if (options.turnDetection) {
            this._turnDetection = options.turnDetection;
        }
        if (options.interruption) {
            this._interruption = options.interruption;
        }
        if (options.sal) {
            this._sal = options.sal;
        }
        if (options.avatar) {
            this._avatar = options.avatar;
        }
        if (options.advancedFeatures) {
            this._advancedFeatures = options.advancedFeatures;
        }
        if (options.parameters) {
            this._parameters = options.parameters;
        }
        if (options.geofence) {
            this._geofence = options.geofence;
        }
        if (options.labels) {
            this._labels = options.labels;
        }
        if (options.rtc) {
            this._rtc = options.rtc;
        }
        if (options.fillerWords) {
            this._fillerWords = options.fillerWords;
        }
        if (options.greetingConfigs) {
            this._greetingConfigs = options.greetingConfigs;
        }
    }

    /**
     * Returns a new Agent with the specified LLM vendor.
     *
     * @param vendor - LLM vendor instance (e.g., new OpenAI({ apiKey: '...', model: 'gpt-4', url: 'https://api.openai.com/v1/chat/completions' }))
     */
    withLlm(vendor: LlmVendor): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._llm = vendor.toConfig();
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified TTS vendor.
     *
     * The sample rate type is tracked for compile-time avatar compatibility checking.
     *
     * @template SR - Sample rate literal type
     * @param vendor - TTS vendor instance (e.g., new ElevenLabsTTS({ key: '...', modelId: '...', voiceId: '...', baseUrl: 'wss://api.elevenlabs.io/v1', sampleRate: 24000 }))
     * @returns Agent with tracked sample rate type
     */
    withTts<SR extends number>(vendor: TtsVendor<SR>): Agent<SR, TArea> {
        // Cast is intentional: _clone() preserves TTSSampleRate but withTts
        // changes the type parameter to SR (the new vendor's sample rate).
        // The cast is safe because _clone copies all fields before the reassignment.
        const newAgent = this._clone() as Agent<SR, TArea>;
        newAgent._tts = vendor.toConfig();
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified STT vendor.
     *
     * @param vendor - STT vendor instance (e.g., new SpeechmaticsSTT({ apiKey: '...', language: 'en' }))
     *
     * @example
     * ```typescript
     * import { SpeechmaticsSTT } from 'agora-agents';
     *
     * agent.withStt(new SpeechmaticsSTT({
     *   apiKey: 'your-key',
     *   language: 'en',
     * }));
     * ```
     */
    withStt(vendor: SttVendor): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._stt = vendor.toConfig();
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified MLLM vendor.
     *
     * MLLM vendors handle real-time audio end-to-end, bypassing the standard
     * ASR → LLM → TTS pipeline. Calling this method automatically sets
     * `mllm.enable: true`, so `withLlm()`, `withTts()`, and `withStt()`
     * are not needed.
     *
     * Note: avatars are not supported with MLLM. The avatar publisher requires
     * the cascading ASR + LLM + TTS pipeline. Combining `withMllm()` and
     * `withAvatar()` throws at `toProperties()` / `session.start()`.
     *
     * @param vendor - MLLM vendor instance (e.g., new VertexAI({ model: '...', projectId: '...', ... }))
     */
    withMllm(vendor: GlobalMllmVendor | CNMllmVendor): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._mllm = { ...vendor.toConfig(), enable: true };
        if (newAgent._advancedFeatures?.enable_mllm !== undefined) {
            const advancedFeatures = { ...newAgent._advancedFeatures };
            delete advancedFeatures.enable_mllm;
            newAgent._advancedFeatures = Object.keys(advancedFeatures).length > 0 ? advancedFeatures : undefined;
        }
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified Avatar vendor.
     *
     * ⚠️ IMPORTANT: avatars are only supported with the cascading
     * ASR + LLM + TTS pipeline. They are not supported with MLLM
     * (`withMllm()`); combining the two throws at `toProperties()` /
     * `session.start()`.
     *
     * Different avatar vendors require specific TTS sample rates:
     * - HeyGen / LiveAvatar: Requires 24,000 Hz (24kHz)
     * - Akool: Requires 16,000 Hz (16kHz)
     *
     * This method enforces sample rate compatibility at compile time. If you configure
     * a TTS with 16kHz and try to add a LiveAvatar avatar (which needs 24kHz), TypeScript
     * will show a compile error.
     *
     * @template RequiredSR - Required sample rate for the avatar
     * @param vendor - Avatar vendor instance (e.g., new HeyGenAvatar({ apiKey: '...', quality: 'high', ... }))
     *
     * @example
     * ```typescript
     * import { HeyGenAvatar, ElevenLabsTTS } from 'agora-agents';
     *
     * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
     * const agent = new Agent({ client })
     *   .withTts(new ElevenLabsTTS({
     *     key: '...',
     *     modelId: '...',
     *     voiceId: '...',
     *     baseUrl: 'wss://api.elevenlabs.io/v1',
     *     sampleRate: 24000, // Required for HeyGen
     *   }))
     *   .withAvatar(new HeyGenAvatar({
     *     apiKey: '...',
     *     quality: 'high',
     *     agoraUid: '12345',
     *   }));
     * ```
     */
    withAvatar<RequiredSR extends number>(
        this: Agent<RequiredSR, TArea>,
        vendor: AvatarVendor<RequiredSR>,
    ): Agent<RequiredSR, TArea> {
        // No cast needed: _clone() returns Agent<TTSSampleRate>, and since
        // `this: Agent<RequiredSR>`, TTSSampleRate = RequiredSR here.
        const newAgent = this._clone();
        newAgent._avatar = vendor.toConfig();
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified turn detection configuration.
     */
    withTurnDetection(config: TurnDetectionConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._turnDetection = config;
        return newAgent;
    }

    /**
     * Returns a new Agent with unified interruption control configured.
     */
    withInterruption(config: InterruptionConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._interruption = config;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified instructions.
     *
     * @deprecated Configure system messages on the LLM vendor instead.
     */
    withInstructions(instructions: string): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._instructions = instructions;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified greeting message.
     *
     * @deprecated Configure the greeting on the LLM or MLLM vendor instead.
     */
    withGreeting(greeting: string): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._greeting = greeting;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified greeting playback configuration.
     *
     * Serializes to `llm.greeting_configs`. Agent-level values override any
     * vendor-level `greeting_configs` configured on the LLM vendor.
     *
     * @deprecated Configure greeting playback on the LLM vendor instead.
     */
    withGreetingConfigs(configs: LlmGreetingConfigs): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._greetingConfigs = configs;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified SAL (Selective Attention Locking) configuration.
     */
    withSal(config: SalConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._sal = config;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified advanced features configuration.
     *
     * Use this to enable features like RTM and others.
     */
    withAdvancedFeatures(features: AdvancedFeatures): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._advancedFeatures = features;
        return newAgent;
    }

    /**
     * Returns a new Agent with MCP tool invocation enabled or disabled.
     */
    withTools(enabled = true): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._advancedFeatures = { ...newAgent._advancedFeatures, enable_tools: enabled };
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified session parameters.
     *
     * Use this to configure silence behaviour, graceful hang-up, data channel, and more.
     */
    withParameters(parameters: SessionParamsInput): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._parameters = parameters;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified RTC audio scenario.
     */
    withAudioScenario(audioScenario: ParametersAudioScenario): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._parameters = { ...newAgent._parameters, audio_scenario: audioScenario };
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified failure message.
     *
     * The failure message is played via TTS when the LLM call fails.
     *
     * @deprecated Configure the failure message on the LLM or MLLM vendor instead.
     */
    withFailureMessage(message: string): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._failureMessage = message;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified maximum conversation history length.
     * Applies to the standard LLM pipeline only. For Azure OpenAI Realtime MLLM,
     * configure `maxHistory` on the MLLM vendor instead.
     *
     * @deprecated Configure max history on the LLM vendor instead.
     */
    withMaxHistory(maxHistory: number): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._maxHistory = maxHistory;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified geofence configuration.
     *
     * Restricts which geographic regions the agent's backend servers may run in.
     */
    withGeofence(geofence: GeofenceConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._geofence = geofence;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified custom labels.
     *
     * Labels are key-value pairs attached to the agent and returned in notification callbacks.
     */
    withLabels(labels: Labels): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._labels = labels;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified RTC configuration.
     */
    withRtc(rtc: RtcConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._rtc = rtc;
        return newAgent;
    }

    /**
     * Returns a new Agent with the specified filler words configuration.
     *
     * Filler words are played while the agent waits for the LLM to respond.
     */
    withFillerWords(fillerWords: FillerWordsConfig): Agent<TTSSampleRate, TArea> {
        const newAgent = this._clone();
        newAgent._fillerWords = fillerWords;
        return newAgent;
    }

    /**
     * Get the AI Studio pipeline ID used as this agent's base configuration.
     */
    get pipelineId(): string | undefined {
        return this._pipelineId;
    }

    /**
     * Get the LLM configuration.
     */
    get llm(): LlmConfig | undefined {
        return this._llm;
    }

    /**
     * Get the TTS configuration.
     */
    get tts(): TtsConfig | undefined {
        return this._tts;
    }

    /**
     * Get the STT configuration.
     */
    get stt(): SttConfig | undefined {
        return this._stt;
    }

    /**
     * Get the MLLM configuration.
     */
    get mllm(): MllmConfig | undefined {
        return this._mllm;
    }

    /**
     * Get the turn detection configuration.
     */
    get turnDetection(): TurnDetectionConfig | undefined {
        return this._turnDetection;
    }

    /**
     * Get the interruption configuration.
     */
    get interruption(): InterruptionConfig | undefined {
        return this._interruption;
    }

    /**
     * Get the instructions.
     */
    get instructions(): string | undefined {
        return this._instructions;
    }

    /**
     * Get the greeting message.
     */
    get greeting(): string | undefined {
        return this._greeting;
    }

    /**
     * Get the greeting playback configuration.
     */
    get greetingConfigs(): LlmGreetingConfigs | undefined {
        return this._greetingConfigs;
    }

    /**
     * Get the failure message (played via TTS when the LLM call fails).
     */
    get failureMessage(): string | undefined {
        return this._failureMessage;
    }

    /**
     * Get the maximum conversation history length.
     */
    get maxHistory(): number | undefined {
        return this._maxHistory;
    }

    /**
     * Get the avatar configuration.
     */
    get avatar(): AvatarConfig | undefined {
        return this._avatar;
    }

    /**
     * Get the SAL (Selective Attention Locking) configuration.
     */
    get sal(): SalConfig | undefined {
        return this._sal;
    }

    /**
     * Get the advanced features configuration.
     */
    get advancedFeatures(): AdvancedFeatures | undefined {
        return this._advancedFeatures;
    }

    /**
     * Get the session parameters configuration.
     */
    get parameters(): SessionParamsInput | undefined {
        return this._parameters;
    }

    /**
     * Get the geofence configuration.
     */
    get geofence(): GeofenceConfig | undefined {
        return this._geofence;
    }

    /**
     * Get the custom labels.
     */
    get labels(): Labels | undefined {
        return this._labels;
    }

    /**
     * Get the RTC configuration.
     */
    get rtc(): RtcConfig | undefined {
        return this._rtc;
    }

    /**
     * Get the filler words configuration.
     */
    get fillerWords(): FillerWordsConfig | undefined {
        return this._fillerWords;
    }

    /**
     * Get the full agent configuration as an object.
     * This provides read-only access to the complete configuration,
     * including all vendor configs set via builder methods.
     */
    get config(): AgentOptions & {
        llm?: LlmConfig;
        tts?: TtsConfig;
        stt?: SttConfig;
        mllm?: MllmConfig;
    } {
        return {
            client: this._client,
            pipelineId: this._pipelineId,
            instructions: this._instructions,
            turnDetection: this._turnDetection,
            interruption: this._interruption,
            sal: this._sal,
            avatar: this._avatar,
            advancedFeatures: this._advancedFeatures,
            parameters: this._parameters,
            greeting: this._greeting,
            failureMessage: this._failureMessage,
            maxHistory: this._maxHistory,
            geofence: this._geofence,
            labels: this._labels,
            rtc: this._rtc,
            fillerWords: this._fillerWords,
            greetingConfigs: this._greetingConfigs,
            llm: this._llm,
            tts: this._tts,
            stt: this._stt,
            mllm: this._mllm,
        };
    }

    /**
     * Creates a new session from this agent configuration.
     *
     * @param options - Session connection options
     * @returns A new AgentSession instance ready to start
     *
     * @example
     * ```typescript
     * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
     * const agent = new Agent({ client })
     *   .withLlm(new OpenAI({ apiKey: '...', model: 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions' }))
     *   .withTts(new MiniMaxTTS({ model: 'speech_2_6_turbo', voiceId: 'English_captivating_female1' }));
     *
     * const session = agent.createSession({
     *   name: `conversation-${Date.now()}`,
     *   channel: `demo-channel-${Date.now()}`,
     *   agentUid: '1',
     *   remoteUids: ['100'],
     *   idleTimeout: 120,
     * });
     *
     * const agentId = await session.start();
     * ```
     */
    createSession(options: SessionOptions): AgentSession {
        const name = options.name ?? `agent-${Date.now()}`;
        return new AgentSession({
            client: this._client,
            agent: this,
            appId: this._client.appId,
            appCertificate: this._client.appCertificate,
            ...options,
            name,
        });
    }

    /**
     * Converts the Agent configuration to the Fern request properties format.
     *
     * Pass either a pre-built `token` OR `appId` + `appCertificate` to have
     * the SDK generate one automatically. The generated token includes both RTC
     * and RTM privileges (required for RTM-enabled sessions).
     */
    toProperties(
        opts: {
            channel: string;
            agentUid: string;
            remoteUids: string[];
            idleTimeout?: number;
            enableStringUid?: boolean;
            /**
             * @deprecated Use `skipVendorValidationCategories` and
             * `allowMissingVendorCategories` instead. This broad escape hatch will be
             * removed in a future release.
             */
            skipVendorValidation?: boolean;
            /** Skip generated request-shape validation for the listed provider categories. */
            skipVendorValidationCategories?: ReadonlySet<"asr" | "llm" | "tts">;
            /** Allow the listed provider categories to be omitted from properties. */
            allowMissingVendorCategories?: ReadonlySet<"asr" | "llm" | "tts">;
        } & (
            | { token: string; appId?: undefined; appCertificate?: undefined }
            | { token?: undefined; appId: string; appCertificate: string; expiresIn?: number }
        ),
    ): Agora.StartAgentsRequest.Properties {
        // In MLLM mode the backend handles audio end-to-end; LLM, TTS, and ASR
        // are not required.
        const isMllmMode = this._mllm?.enable === true || this._mllm !== undefined;

        // Reject incompatible combinations before any work (token generation, etc.).
        // Avatars are currently supported only with the cascading ASR/LLM/TTS pipeline;
        // the MLLM pipeline does not flow through the avatar publisher, so combining
        // them produces a backend error. Mirrors the Go and Python SDK guards.
        if (isMllmMode && this._avatar !== undefined && this._avatar.enable !== false) {
            throw new Error(
                "Avatars are only supported with the cascading ASR + LLM + TTS pipeline. " +
                    "Remove the avatar configuration when using MLLM, or switch to a cascading session.",
            );
        }

        let token: string;
        if (opts.token) {
            token = opts.token;
        } else {
            // opts is narrowed to the appId/appCertificate branch here
            const { appId, appCertificate, expiresIn } = opts as {
                appId: string;
                appCertificate: string;
                expiresIn?: number;
            };
            // Use buildTokenWithRtm (RTC + RTM) so the token works whether or not
            // the caller enables advanced_features.enable_rtm. The account string
            // works for both numeric and string UIDs.
            token = generateConvoAIToken({
                appId,
                appCertificate,
                channelName: opts.channel,
                uid: _parseNumericUid(opts.agentUid, "agentUid"),
                tokenExpire: expiresIn,
            });
        }

        // When RTM is enabled, data_channel must also be 'rtm' for the client
        // to receive transcripts and state events. Default it automatically so
        // callers only need to set advancedFeatures.enable_rtm: true.
        let resolvedParameters = this._parameters;
        if (this._advancedFeatures?.enable_rtm && !resolvedParameters?.data_channel) {
            resolvedParameters = { ...resolvedParameters, data_channel: "rtm" as const };
        }
        if (resolvedParameters?.audio_scenario === undefined) {
            resolvedParameters = { ...resolvedParameters, audio_scenario: AudioScenario.Default };
        }

        const base = {
            channel: opts.channel,
            token,
            agent_rtc_uid: opts.agentUid,
            remote_rtc_uids: opts.remoteUids,
            idle_timeout: opts.idleTimeout,
            enable_string_uid: opts.enableStringUid,
            mllm: this._mllm,
            interruption: this._interruption,
            sal: this._sal,
            avatar: this._avatar,
            advanced_features: this._advancedFeatures,
            parameters: resolvedParameters,
            geofence: this._geofence,
            labels: this._labels,
            rtc: this._rtc,
            filler_words: this._fillerWords,
        };

        if (isMllmMode) {
            const mllmConfig = this._mllm ? { ...this._mllm } : undefined;
            if (mllmConfig) {
                // Vendor config wins: only apply agent-level values when the vendor hasn't already set them.
                // Consistent with Python (setdefault) and Go (!exists) semantics.
                //
                // These are production wire spellings. A route that spells one of them
                // differently needs a rename entry in `preview/client.ts`, or the value
                // lands in a field the provider ignores and fails silently. See
                // docs/guides/preview-endpoint.md#the-vendor-class-is-not-the-whole-wire-shape.
                const c = mllmConfig as Record<"greeting_message" | "failure_message", unknown>;
                if (this._greeting !== undefined && c.greeting_message === undefined) {
                    c.greeting_message = this._greeting;
                }
                if (this._failureMessage !== undefined && c.failure_message === undefined) {
                    c.failure_message = this._failureMessage;
                }
            }
            return {
                ...base,
                mllm: mllmConfig,
                turn_detection: this._turnDetection as Agora.StartAgentsRequest.Properties.TurnDetection | undefined,
            };
        }

        const skipCategories = new Set(opts.skipVendorValidationCategories ?? []);
        const allowMissingCategories = new Set(opts.allowMissingVendorCategories ?? []);
        if (opts.skipVendorValidation) {
            for (const category of ["asr", "llm", "tts"] as const) {
                skipCategories.add(category);
                allowMissingCategories.add(category);
            }
        }

        const skipLlmValidation = skipCategories.has("llm");
        const skipTtsValidation = skipCategories.has("tts");
        const allowMissingAsr = allowMissingCategories.has("asr");
        const allowMissingLlm = allowMissingCategories.has("llm");
        const allowMissingTts = allowMissingCategories.has("tts");

        if (!this._tts && !(skipTtsValidation || allowMissingTts)) {
            throw new Error("TTS configuration is required. Use withTts() to set it.");
        }
        if (!this._llm && !(skipLlmValidation || allowMissingLlm)) {
            throw new Error("LLM configuration is required. Use withLlm() to set it.");
        }

        const llmConfig: Agora.Llm | undefined = this._llm
            ? {
                  ...this._llm,
                  system_messages:
                      this._llm.system_messages !== undefined
                          ? this._llm.system_messages
                          : this._instructions
                            ? [{ role: "system", content: this._instructions }]
                            : undefined,
                  greeting_message: this._llm.greeting_message ?? this._greeting,
                  greeting_configs: this._llm.greeting_configs ?? this._greetingConfigs,
                  failure_message: this._llm.failure_message ?? this._failureMessage,
                  max_history: this._llm.max_history ?? this._maxHistory,
              }
            : undefined;

        const turnDetectionConfig = this._resolveTurnDetectionConfig();
        const asrConfig =
            this._stt !== undefined || !allowMissingAsr
                ? (this._resolveAsrConfig(turnDetectionConfig) as Agora.Asr | undefined)
                : undefined;
        const ttsConfig = this._tts;

        return {
            ...base,
            turn_detection: turnDetectionConfig as Agora.StartAgentsRequest.Properties.TurnDetection,
            ...(llmConfig && { llm: llmConfig }),
            ...(ttsConfig && { tts: ttsConfig }),
            ...(asrConfig && { asr: asrConfig }),
        };
    }

    /**
     * Creates a shallow copy of this Agent, preserving the TTSSampleRate type
     * parameter. Builder methods that do not change the sample rate can use the
     * return value directly. `withTts()` must cast to `Agent<SR>` afterward
     * since it changes the type parameter — the cast is safe because all fields
     * are copied before the new TTS config is assigned.
     *
     * If a new private field is added to Agent, it MUST also be added here.
     */
    private _clone(): Agent<TTSSampleRate, TArea> {
        const newAgent = new Agent({ client: this._client }) as Agent<TTSSampleRate, TArea>;
        newAgent._pipelineId = this._pipelineId;
        newAgent._llm = this._llm;
        newAgent._tts = this._tts;
        newAgent._stt = this._stt;
        newAgent._mllm = this._mllm;
        newAgent._turnDetection = this._turnDetection;
        newAgent._interruption = this._interruption;
        newAgent._sal = this._sal;
        newAgent._avatar = this._avatar;
        newAgent._advancedFeatures = this._advancedFeatures;
        newAgent._parameters = this._parameters;
        newAgent._instructions = this._instructions;
        newAgent._greeting = this._greeting;
        newAgent._failureMessage = this._failureMessage;
        newAgent._maxHistory = this._maxHistory;
        newAgent._geofence = this._geofence;
        newAgent._labels = this._labels;
        newAgent._rtc = this._rtc;
        newAgent._fillerWords = this._fillerWords;
        newAgent._greetingConfigs = this._greetingConfigs;
        return newAgent;
    }

    private _resolveAsrConfig(turnDetectionConfig: TurnDetectionConfig): SttConfig | undefined {
        const asrConfig =
            this._stt !== undefined
                ? ({ ...this._stt } as SttConfig & { language?: string })
                : ({
                      vendor: this._client.area === Area.CN ? "fengming" : "ares",
                  } as SttConfig & { language?: string });
        // Unconditional: turn detection is the single source of truth for the
        // interaction language, so a vendor-level `language` would be silently
        // discarded here. Do not add one to a vendor class — see
        // docs/guides/preview-endpoint.md#the-vendor-class-is-not-the-whole-wire-shape.
        asrConfig.language = turnDetectionConfig.language;

        return Object.keys(asrConfig).length > 0 ? asrConfig : undefined;
    }

    private _resolveTurnDetectionConfig(): TurnDetectionConfig {
        const turnDetection = { ...(this._turnDetection ?? {}) } as TurnDetectionConfig & { language?: string };
        const existingTurnDetectionLanguage = turnDetection.language;
        const language = existingTurnDetectionLanguage ?? DEFAULT_TURN_DETECTION_LANGUAGE;

        assertTurnDetectionLanguage(language);
        turnDetection.language = language;

        return turnDetection;
    }
}

function _parseNumericUid(uid: string, label: string): number {
    if (!/^\d+$/.test(uid)) {
        throw new Error(`${label} must be a numeric RTC UID when auto-generating a ConvoAI token`);
    }
    return Number(uid);
}
