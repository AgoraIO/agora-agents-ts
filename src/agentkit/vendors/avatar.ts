/**
 * Type-safe Avatar vendor classes.
 *
 * Avatar vendors provide visual representation for voice agents.
 * Different vendors have specific audio sample rate requirements.
 */

import type { AvatarConfig } from "../types.js";
import type { AkoolSampleRate, HeyGenSampleRate, LiveAvatarSampleRate } from "./base.js";
import { BaseAvatar } from "./base.js";

/**
 * Constructor options for HeyGen Avatar.
/**
 * Constructor options for LiveAvatar.
 */
export interface LiveAvatarAvatarOptions {
    /** LiveAvatar API key */
    apiKey: string;
    /** Video quality: "low" (360p), "medium" (480p), or "high" (720p) */
    quality: "low" | "medium" | "high";
    /** RTC UID for the avatar (must be unique in the channel) */
    agoraUid: string;
    /** Avatar ConvoAI token. Omit to auto-generate at session start. */
    agoraToken?: string;
    /** HeyGen avatar ID */
    avatarId?: string;
    /** Whether to disable idle timeout (default: false) */
    disableIdleTimeout?: boolean;
    /** Idle timeout in seconds (default: 120, only applies if disableIdleTimeout is false) */
    activityIdleTimeout?: number;
    /** Enable avatar (default: true) */
    enable?: boolean;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Constructor options for Akool Avatar.
 */
export interface AkoolAvatarOptions {
    /** Akool API key */
    apiKey: string;
    /** Akool avatar ID */
    avatarId?: string;
    /** Enable avatar (default: true) */
    enable?: boolean;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Akool Avatar vendor.
 *
 * ⚠️ IMPORTANT: Akool avatars ONLY support audio with a sample rate of 16,000 Hz.
 * You must configure your TTS with a 16kHz sample rate or the request will fail.
 *
 * @example
 * ```typescript
 * import { Agent, AkoolAvatar, ElevenLabsTTS } from 'agora-agents';
 *
 * const avatar = new AkoolAvatar({
 *   apiKey: process.env.AKOOL_API_KEY,
 *   avatarId: 'avatar-id',
 * });
 *
 * // TTS must declare sampleRate: 16000 so withAvatar() enforces the match at compile time.
 * const tts = new ElevenLabsTTS({
 *   key: process.env.ELEVENLABS_API_KEY,
 *   modelId: 'eleven_flash_v2_5',
 *   voiceId: 'voice-id',
 *   baseUrl: 'wss://api.elevenlabs.io/v1',
 *   sampleRate: 16000, // Required for Akool
 * });
 *
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withTts(tts)
 *   .withAvatar(avatar);
 * ```
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/akool
 */
export class AkoolAvatar extends BaseAvatar<AkoolSampleRate> {
    private readonly options: AkoolAvatarOptions;

    /**
     * Akool avatars require TTS sample rate of 16,000 Hz.
     */
    readonly requiredSampleRate = 16000 as const;

    constructor(options: AkoolAvatarOptions) {
        super();
        this.options = options;

        // Defense-in-depth check for JavaScript callers that bypass TypeScript types.
        // See HeyGenAvatar constructor for the two-layer validation rationale.
        if (!options.apiKey) {
            throw new Error("Akool avatar requires apiKey");
        }
    }

    toConfig(): AvatarConfig {
        const { apiKey, avatarId, enable = true, additionalParams } = this.options;

        return {
            enable,
            vendor: "akool",
            params: {
                // additionalParams spread first so that explicit fields always win.
                ...additionalParams,
                api_key: apiKey,
                ...(avatarId && { avatar_id: avatarId }),
            },
        };
    }
}

// =============================================================================
// LiveAvatar (formerly HeyGen)
// =============================================================================

/**
 * LiveAvatar avatar vendor (formerly HeyGen).
 *
 * ⚠️ IMPORTANT: LiveAvatar ONLY supports audio with a sample rate of 24,000 Hz.
 * You must configure your TTS with a 24kHz sample rate or the request will fail.
 *
 * @example
 * ```typescript
 * import { Agent, LiveAvatarAvatar, ElevenLabsTTS } from 'agora-agents';
 *
 * const avatar = new LiveAvatarAvatar({
 *   apiKey: process.env.LIVEAVATAR_API_KEY,
 *   quality: 'high',
 *   agoraUid: '12345',
 *   avatarId: 'avatar-id',
 * });
 *
 * const tts = new ElevenLabsTTS({
 *   key: process.env.ELEVENLABS_API_KEY,
 *   modelId: 'eleven_flash_v2_5',
 *   voiceId: 'voice-id',
 *   baseUrl: 'wss://api.elevenlabs.io/v1',
 *   sampleRate: 24000, // Required for LiveAvatar
 * });
 *
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withTts(tts)
 *   .withAvatar(avatar);
 * ```
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/overview
 */
export class LiveAvatarAvatar extends BaseAvatar<LiveAvatarSampleRate> {
    private readonly options: LiveAvatarAvatarOptions;

    /**
     * LiveAvatar requires TTS sample rate of 24,000 Hz.
     */
    readonly requiredSampleRate = 24000 as const;

    constructor(options: LiveAvatarAvatarOptions) {
        super();
        this.options = options;

        if (!options.apiKey) {
            throw new Error("LiveAvatar requires apiKey");
        }
        if (!options.agoraUid) {
            throw new Error("LiveAvatar requires agoraUid");
        }
    }

    toConfig(): AvatarConfig {
        const {
            apiKey,
            quality,
            agoraUid,
            agoraToken,
            avatarId,
            disableIdleTimeout,
            activityIdleTimeout,
            enable = true,
            additionalParams,
        } = this.options;

        return {
            enable,
            vendor: "liveavatar",
            params: {
                ...additionalParams,
                api_key: apiKey,
                quality,
                agora_uid: agoraUid,
                ...(agoraToken && { agora_token: agoraToken }),
                ...(avatarId && { avatar_id: avatarId }),
                ...(disableIdleTimeout !== undefined && {
                    disable_idle_timeout: disableIdleTimeout,
                }),
                ...(activityIdleTimeout !== undefined && {
                    activity_idle_timeout: activityIdleTimeout,
                }),
            },
        };
    }
}

/**
 * @deprecated HeyGen has been renamed to LiveAvatar. Use {@link LiveAvatarAvatarOptions} instead.
 */
export type HeyGenAvatarOptions = LiveAvatarAvatarOptions;

/**
 * HeyGen Avatar vendor.
 *
 * @deprecated HeyGen has been renamed to LiveAvatar. Use {@link LiveAvatarAvatar} instead.
 * This class emits `vendor: "heygen"` for backward compatibility. New deployments
 * should use `LiveAvatarAvatar` which emits `vendor: "liveavatar"`.
 */
export class HeyGenAvatar extends BaseAvatar<HeyGenSampleRate> {
    private readonly options: HeyGenAvatarOptions;

    readonly requiredSampleRate = 24000 as const;

    constructor(options: HeyGenAvatarOptions) {
        super();
        this.options = options;
        if (!options.apiKey) {
            throw new Error("HeyGen avatar requires apiKey");
        }
        if (!options.agoraUid) {
            throw new Error("HeyGen avatar requires agoraUid");
        }
    }

    toConfig(): AvatarConfig {
        const {
            apiKey,
            quality,
            agoraUid,
            agoraToken,
            avatarId,
            disableIdleTimeout,
            activityIdleTimeout,
            enable = true,
            additionalParams,
        } = this.options;

        return {
            enable,
            vendor: "heygen",
            params: {
                ...additionalParams,
                api_key: apiKey,
                quality,
                agora_uid: agoraUid,
                ...(agoraToken && { agora_token: agoraToken }),
                ...(avatarId && { avatar_id: avatarId }),
                ...(disableIdleTimeout !== undefined && {
                    disable_idle_timeout: disableIdleTimeout,
                }),
                ...(activityIdleTimeout !== undefined && {
                    activity_idle_timeout: activityIdleTimeout,
                }),
            },
        };
    }
}

// =============================================================================
// Anam
// =============================================================================

/**
 * Constructor options for Anam Avatar.
 */
export interface AnamAvatarOptions {
    /** Anam API key */
    apiKey: string;
    /** Anam avatar ID */
    avatarId?: string;
    /** Enable avatar (default: true) */
    enable?: boolean;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Anam Avatar vendor (Beta).
 *
 * @example
 * ```typescript
 * import { Agent, AnamAvatar } from 'agora-agents';
 *
 * const avatar = new AnamAvatar({
 *   apiKey: process.env.ANAM_API_KEY,
 *   avatarId: 'avatar-id',
 * });
 *
 * const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
 * const agent = new Agent({ client })
 *   .withAvatar(avatar);
 * ```
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/overview
 */
export class AnamAvatar extends BaseAvatar<number> {
    private readonly options: AnamAvatarOptions;

    /**
     * Anam does not enforce a specific TTS sample rate. Consult Anam documentation
     * for the sample rate supported by your chosen persona.
     */
    readonly requiredSampleRate = 0 as number;

    constructor(options: AnamAvatarOptions) {
        super();
        this.options = options;

        if (!options.apiKey) {
            throw new Error("Anam avatar requires apiKey");
        }
    }

    toConfig(): AvatarConfig {
        const { apiKey, avatarId, enable = true, additionalParams } = this.options;

        return {
            enable,
            vendor: "anam",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(avatarId && { avatar_id: avatarId }),
            },
        };
    }
}

// =============================================================================
// Generic
// =============================================================================

/**
 * Constructor options for Generic Avatar.
 */
export interface GenericAvatarOptions {
    /** Avatar provider API key */
    apiKey: string;
    /** Avatar provider API base URL */
    apiBaseUrl: string;
    /** Avatar ID */
    avatarId: string;
    /** RTC UID for the avatar video publisher (must be unique in the channel) */
    agoraUid: string;
    /** Agora App ID. Omit to use the session app ID at start. */
    agoraAppId?: string;
    /** Agora channel. Omit to use the session channel at start. */
    agoraChannel?: string;
    /** Avatar ConvoAI token. Omit to auto-generate at session start. */
    agoraToken?: string;
    /** Enable avatar (default: true) */
    enable?: boolean;
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

/**
 * Generic Avatar vendor (Beta).
 *
 * Generic avatars use a custom avatar provider while still publishing video
 * into the Agora channel. AgentKit fills `agora_appid`, `agora_channel`, and
 * `agora_token` at session start when they are omitted.
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/generic
 */
export class GenericAvatar extends BaseAvatar<number> {
    private readonly options: GenericAvatarOptions;

    /**
     * Generic avatars do not enforce a specific TTS sample rate.
     */
    readonly requiredSampleRate = 0 as number;

    constructor(options: GenericAvatarOptions) {
        super();
        this.options = options;

        if (!options.apiKey) {
            throw new Error("Generic avatar requires apiKey");
        }
        if (!options.apiBaseUrl) {
            throw new Error("Generic avatar requires apiBaseUrl");
        }
        if (!options.avatarId) {
            throw new Error("Generic avatar requires avatarId");
        }
        if (!options.agoraUid) {
            throw new Error("Generic avatar requires agoraUid");
        }
    }

    toConfig(): AvatarConfig {
        const {
            apiKey,
            apiBaseUrl,
            avatarId,
            agoraUid,
            agoraAppId,
            agoraChannel,
            agoraToken,
            enable = true,
            additionalParams,
        } = this.options;

        return {
            enable,
            vendor: "generic",
            params: {
                ...additionalParams,
                api_key: apiKey,
                api_base_url: apiBaseUrl,
                avatar_id: avatarId,
                agora_uid: agoraUid,
                ...(agoraAppId && { agora_appid: agoraAppId }),
                ...(agoraChannel && { agora_channel: agoraChannel }),
                ...(agoraToken && { agora_token: agoraToken }),
            },
        };
    }
}

/** Tavus options with an optional provider endpoint override. */
export type TavusOptions = Omit<GenericAvatarOptions, "apiBaseUrl"> & { apiBaseUrl?: string };
/** Protoface options with an optional provider endpoint override. */
export type ProtofaceOptions = TavusOptions;

export class Tavus extends GenericAvatar {
    constructor(options: TavusOptions) {
        super({ ...options, apiBaseUrl: options.apiBaseUrl ?? "https://tavusapi.com/v2/conversations/agora" });
    }
}

export class Protoface extends GenericAvatar {
    constructor(options: ProtofaceOptions) {
        super({ ...options, apiBaseUrl: options.apiBaseUrl ?? "https://api.protoface.com/v1/agora" });
    }
}

export interface LemonSliceOptions extends Omit<TavusOptions, "avatarId"> {
    /** Provider-recommended fixed ID is lemonslice. Explicit overrides remain supported. */
    avatarId?: string;
    agentImageUrl?: string;
    agentId?: string;
    agentImageBase64?: string;
    /** Omit to use the provider default of 2x3. */
    aspectRatio?: "2x3" | "9x16" | "1x1";
}

export class LemonSlice extends GenericAvatar {
    constructor(options: LemonSliceOptions) {
        const params = { ...options.additionalParams };
        for (const [key, value] of [
            ["agent_image_url", options.agentImageUrl],
            ["agent_id", options.agentId],
            ["agent_image_base64", options.agentImageBase64],
            ["aspect_ratio", options.aspectRatio],
        ] as const) {
            if (value !== undefined) params[key] = value;
        }
        let selectors = 0;
        for (const key of ["agent_id", "agent_image_url", "agent_image_base64"]) {
            if (Object.keys(params).includes(key)) {
                const value = params[key];
                if (typeof value !== "string" || !value.trim()) {
                    throw new Error(`LemonSlice ${key} must be a nonempty string`);
                }
                selectors++;
            }
        }
        if (selectors !== 1) {
            throw new Error("LemonSlice requires exactly one of agent_id, agent_image_url, agent_image_base64");
        }
        if (
            Object.keys(params).includes("aspect_ratio") &&
            !["2x3", "9x16", "1x1"].includes(params.aspect_ratio as string)
        ) {
            throw new Error("LemonSlice aspect_ratio must be 2x3, 9x16, or 1x1");
        }
        super({
            ...options,
            apiBaseUrl: options.apiBaseUrl ?? "https://lemonslice.com/api/liveai/agora",
            avatarId: options.avatarId ?? "lemonslice",
            additionalParams: params,
        });
    }
}
