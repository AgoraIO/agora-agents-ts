/**
 * Base classes for type-safe vendor configurations.
 *
 * Each vendor class extends a base class and implements a `toConfig()` method
 * that converts TypeScript-friendly constructor params (camelCase) into the
 * Agora API format (snake_case).
 */

import type {
    AvatarConfig,
    LlmConfig,
    LlmGreetingConfigs,
    LlmTool,
    McpServersItem,
    MllmConfig,
    SttConfig,
    TtsConfig,
} from "../types.js";

/**
 * Common options shared by all LLM vendor classes.
 * These map directly to top-level fields on `LlmConfig` that are not
 * vendor-specific and therefore belong here rather than on individual vendors.
 */
export interface BaseLlmOptions {
    /**
     * LLM output modalities.
     * - `["text"]` (default): Output text is converted to speech by TTS and published to RTC.
     * - `["audio"]`: Voice only — audio published directly to RTC (no TTS step).
     * - `["text", "audio"]`: Both text and audio; handle the output with custom logic.
     */
    outputModalities?: string[];
    /**
     * Greeting broadcast mode for multi-user channels.
     * - `"single_every"`: Broadcasts a greeting every time a user joins.
     * - `"single_first"`: Broadcasts a greeting only once to the first user.
     */
    greetingConfigs?: LlmGreetingConfigs;
    /** Publicly accessible greeting audio URL played when the session starts. */
    greetingAudioUrl?: string;
    /**
     * Key-value pairs injected into `system_messages`, `greeting_message`, and
     * `failure_message` via `{{variable_name}}` syntax. Useful for per-session
     * personalisation (e.g. injecting the caller's name into the system prompt).
     * Variable values cannot reference other variables.
     */
    templateVariables?: Record<string, string>;
    /**
     * LLM provider hint.
     * - `"custom"`: Adds `turn_id` and `timestamp` fields to every LLM request —
     *   useful for custom LLM backends that need per-turn tracking.
     * - `"azure"`: Required for Azure OpenAI (set automatically by `AzureOpenAI`).
     * Omit for standard OpenAI / Anthropic / Gemini endpoints.
     */
    vendor?: string;
    /** MCP server configurations enabling the agent to call tools from external services. Requires `withTools(true)`. */
    mcpServers?: McpServersItem[];
    /** Inline synchronous REST tools exposed to the LLM for function calling. Requires `withTools(true)`. */
    tools?: LlmTool[];
}

type VendorScope = "global" | "cn";

/**
 * Standard audio sample rates supported by Agora platform.
 * Different vendors support different subsets of these rates.
 */
export type SampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

/**
 * Sample rates supported by ElevenLabs TTS.
 * - 16000 Hz: Required for Akool avatars
 * - 24000 Hz: Required for HeyGen avatars
 * - 22050, 44100 Hz: High quality, no avatar support
 */
export type ElevenLabsSampleRate = 16000 | 22050 | 24000 | 44100;

/**
 * Sample rates supported by Microsoft Azure TTS.
 */
export type MicrosoftSampleRate = 16000 | 24000 | 48000;

/**
 * Sample rates supported by Cartesia TTS.
 */
export type CartesiaSampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

/**
 * Sample rates supported by Google Cloud TTS.
 */
export type GoogleTTSSampleRate = 8000 | 16000 | 22050 | 24000 | 44100 | 48000;

/**
 * Sample rate required by LiveAvatar avatars (24kHz only). Formerly HeyGen.
 */
export type LiveAvatarSampleRate = 24000;

/**
 * @deprecated HeyGen has been renamed to LiveAvatar. Use {@link LiveAvatarSampleRate} instead.
 */
export type HeyGenSampleRate = LiveAvatarSampleRate;

/**
 * Sample rate required by Akool avatars (16kHz only).
 */
export type AkoolSampleRate = 16000;

/**
 * Base class for LLM (Large Language Model) vendors.
 */
abstract class ScopedBaseLLM<TScope extends VendorScope> {
    readonly areaScope: TScope;
    private readonly _outputModalities?: string[];
    private readonly _greetingConfigs?: LlmGreetingConfigs;
    private readonly _greetingAudioUrl?: string;
    private readonly _templateVariables?: Record<string, string>;
    private readonly _vendor?: string;
    private readonly _mcpServers?: McpServersItem[];
    private readonly _tools?: LlmTool[];

    constructor(areaScope: TScope, options?: BaseLlmOptions) {
        this.areaScope = areaScope;
        this._outputModalities = options?.outputModalities;
        this._greetingConfigs = options?.greetingConfigs;
        this._greetingAudioUrl = options?.greetingAudioUrl;
        this._templateVariables = options?.templateVariables;
        this._vendor = options?.vendor;
        this._mcpServers = options?.mcpServers;
        this._tools = options?.tools;
    }

    protected get outputModalities(): string[] | undefined {
        return this._outputModalities;
    }
    protected get greetingConfigs(): LlmGreetingConfigs | undefined {
        return this._greetingConfigs;
    }
    protected get greetingAudioUrl(): string | undefined {
        return this._greetingAudioUrl;
    }
    protected get templateVariables(): Record<string, string> | undefined {
        return this._templateVariables;
    }
    protected get vendor(): string | undefined {
        return this._vendor;
    }
    /** MCP servers with transport defaulted to streamable_http (API requires it; only option). */
    protected get mcpServers(): McpServersItem[] | undefined {
        if (!this._mcpServers?.length) return this._mcpServers;
        return this._mcpServers.map((s) => (s.transport ? s : { ...s, transport: "streamable_http" as const }));
    }
    protected get tools(): LlmTool[] | undefined {
        return this._tools;
    }

    /**
     * Converts the vendor configuration to the Agora API format.
     */
    abstract toConfig(): LlmConfig;
}

export abstract class BaseLLM extends ScopedBaseLLM<"global"> {
    constructor(options?: BaseLlmOptions) {
        super("global", options);
    }
}

export abstract class BaseCNLLM extends ScopedBaseLLM<"cn"> {
    constructor(options?: BaseLlmOptions) {
        super("cn", options);
    }
}

/**
 * Base class for TTS (Text-to-Speech) vendors with sample rate tracking.
 *
 * `SR` is a phantom type — it is never used at runtime and does not appear in
 * the `toConfig()` return type. Its sole purpose is to thread the sample rate
 * literal through `Agent<TTSSampleRate>` so that `withAvatar()` can enforce
 * TTS/avatar compatibility at compile time.
 *
 * This means TypeScript cannot verify that a concrete subclass actually emits
 * the sample rate it declares — e.g., `class MyTTS extends BaseTTS<24000>`
 * could emit `sample_rate: 16000` in its config without a type error. The
 * guarantee is therefore "the vendor class declares what it supports", not
 * "the config it produces is verified". Runtime validation in AgentSession
 * provides a second layer of safety for known avatar vendors.
 *
 * @template SR - Sample rate literal type (e.g., 24000, 16000)
 */
abstract class ScopedBaseTTS<TScope extends VendorScope, _SR extends number = number> {
    readonly areaScope: TScope;

    constructor(areaScope: TScope) {
        this.areaScope = areaScope;
    }

    /**
     * Converts the vendor configuration to the Agora API format.
     */
    abstract toConfig(): TtsConfig;
}

export abstract class BaseTTS<_SR extends number = number> extends ScopedBaseTTS<"global", _SR> {
    constructor() {
        super("global");
    }
}

export abstract class BaseCNTTS<_SR extends number = number> extends ScopedBaseTTS<"cn", _SR> {
    constructor() {
        super("cn");
    }
}

/**
 * Base class for STT (Speech-to-Text) vendors.
 */
abstract class ScopedBaseSTT<TScope extends VendorScope> {
    readonly areaScope: TScope;

    constructor(areaScope: TScope) {
        this.areaScope = areaScope;
    }

    /**
     * Converts the vendor configuration to the Agora API format.
     */
    abstract toConfig(): SttConfig;
}

export abstract class BaseSTT extends ScopedBaseSTT<"global"> {
    constructor() {
        super("global");
    }
}

export abstract class BaseCNSTT extends ScopedBaseSTT<"cn"> {
    constructor() {
        super("cn");
    }
}

/**
 * Base class for MLLM (Multimodal Large Language Model) vendors.
 */
abstract class ScopedBaseMLLM<TScope extends VendorScope> {
    readonly areaScope: TScope;

    constructor(areaScope: TScope) {
        this.areaScope = areaScope;
    }

    /**
     * Converts the vendor configuration to the Agora API format.
     */
    abstract toConfig(): MllmConfig;
}

/** Base class for global MLLM vendors. */
export abstract class BaseMLLM extends ScopedBaseMLLM<"global"> {
    constructor() {
        super("global");
    }
}

/** Base class for Chinese mainland MLLM vendors. */
export abstract class BaseCNMLLM extends ScopedBaseMLLM<"cn"> {
    constructor() {
        super("cn");
    }
}

/**
 * Base class for Avatar vendors with required sample rate.
 * @template RequiredSR - Required sample rate literal type
 */
abstract class ScopedBaseAvatar<TScope extends VendorScope, RequiredSR extends number = number> {
    readonly areaScope: TScope;

    constructor(areaScope: TScope) {
        this.areaScope = areaScope;
    }

    /**
     * Converts the vendor configuration to the Agora API format.
     */
    abstract toConfig(): AvatarConfig;

    /**
     * The TTS sample rate required by this avatar vendor.
     */
    abstract readonly requiredSampleRate: RequiredSR;
}

export abstract class BaseAvatar<RequiredSR extends number = number> extends ScopedBaseAvatar<"global", RequiredSR> {
    constructor() {
        super("global");
    }
}

export abstract class BaseCNAvatar<RequiredSR extends number = number> extends ScopedBaseAvatar<"cn", RequiredSR> {
    constructor() {
        super("cn");
    }
}
