/**
 * Vendor-specific Avatar configuration types with strict type constraints.
 *
 * This provides type safety for vendor-specific parameters like sample rates,
 * ensuring that invalid combinations are caught at compile time.
 */

import type { SensetimeAvatarParams } from "../api/types/SensetimeAvatarParams.js";
import type { SpatiusAvatarParams } from "../api/types/SpatiusAvatarParams.js";
import type { AvatarConfig as BaseAvatarConfig } from "./types.js";

/**
 * HeyGen-specific avatar configuration (legacy wire vendor `heygen`).
 *
 * @deprecated HeyGen has been renamed to LiveAvatar. Use {@link LiveAvatarAvatarConfig} instead.
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/heygen
 */
export interface HeyGenAvatarConfig {
    enable?: boolean;
    vendor: "heygen";
    params: {
        /** API key for HeyGen authentication (required) */
        api_key: string;
        /** Video quality: "high" (720p), "medium" (480p), or "low" (360p) (required) */
        quality: "low" | "medium" | "high";
        /** RTC UID for the avatar (must be unique in the channel) (required) */
        agora_uid: string;
        /** Avatar ConvoAI token for avatar authentication (optional) */
        agora_token?: string;
        /** HeyGen avatar ID (optional) */
        avatar_id?: string;
        /** Whether to disable idle timeout (default: false) */
        disable_idle_timeout?: boolean;
        /** Idle timeout in seconds (default: 120, only applies if disable_idle_timeout is false) */
        activity_idle_timeout?: number;
        [key: string]: unknown;
    };
}

/**
 * LiveAvatar-specific avatar configuration (formerly HeyGen).
 *
 * ⚠️ IMPORTANT: LiveAvatar ONLY supports audio with a sample rate of 24,000 Hz.
 * You must configure your TTS with a 24kHz sample rate or the request will fail.
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/overview
 */
export interface LiveAvatarAvatarConfig {
    enable?: boolean;
    vendor: "liveavatar";
    params: {
        /** API key for LiveAvatar authentication (required) */
        api_key: string;
        /** Video quality: "high" (720p), "medium" (480p), or "low" (360p) (required) */
        quality: "low" | "medium" | "high";
        /** RTC UID for the avatar (must be unique in the channel) (required) */
        agora_uid: string;
        /** Avatar ConvoAI token for avatar authentication (optional) */
        agora_token?: string;
        /** Avatar ID (optional) */
        avatar_id?: string;
        /** Whether to disable idle timeout (default: false) */
        disable_idle_timeout?: boolean;
        /** Idle timeout in seconds (default: 120, only applies if disable_idle_timeout is false) */
        activity_idle_timeout?: number;
        [key: string]: unknown;
    };
}

/**
 * Anam-specific avatar configuration (Beta).
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/overview
 */
export interface AnamAvatarConfig {
    enable?: boolean;
    vendor: "anam";
    params: {
        /** API key for Anam authentication (required) */
        api_key: string;
        /** Anam avatar ID (optional) */
        avatar_id?: string;
        /** Anam avatar model, such as `cara_mk4` for Cara 4 portrait mode */
        avatar_model?: string;
        /** Output video width in pixels; set together with `video_height` */
        video_width?: number;
        /** Output video height in pixels; set together with `video_width` */
        video_height?: number;
        [key: string]: unknown;
    };
}

/**
 * Akool-specific avatar configuration.
 *
 * ⚠️ IMPORTANT: Akool avatars ONLY support audio with a sample rate of 16,000 Hz.
 * You must configure your TTS with a 16kHz sample rate or the request will fail.
 *
 * @see https://docs.agora.io/en/conversational-ai/models/avatar/akool
 */
export interface AkoolAvatarConfig {
    enable?: boolean;
    vendor: "akool";
    params: {
        /** API key for Akool authentication (required) */
        api_key: string;
        /** Akool avatar ID (optional) */
        avatar_id?: string;
        /** Additional vendor-specific parameters */
        [key: string]: unknown;
    };
}

/**
 * Generic avatar configuration.
 * Use this when integrating a custom avatar provider.
 */
export interface GenericAvatarConfig {
    enable?: boolean;
    vendor: "generic";
    params: {
        /** Avatar provider API key (required) */
        api_key: string;
        /** Avatar provider API base URL (required) */
        api_base_url: string;
        /** Avatar ID (required) */
        avatar_id: string;
        /** Agora App ID (filled by AgentKit at session start when omitted) */
        agora_appid?: string;
        /** Agora channel (filled by AgentKit at session start when omitted) */
        agora_channel?: string;
        /** RTC UID for the avatar video publisher (required) */
        agora_uid: string;
        /** Avatar ConvoAI token (filled by AgentKit at session start when omitted) */
        agora_token?: string;
        [key: string]: unknown;
    };
}

/**
 * SenseTime-specific avatar configuration (CN).
 */
export interface SensetimeAvatarConfig {
    enable?: boolean;
    vendor: "sensetime";
    params: {
        /** RTC UID for the avatar video publisher (required) */
        agora_uid: string;
        /** Avatar ConvoAI token (filled by AgentKit at session start when omitted) */
        agora_token?: string;
        /** SenseTime application ID (required) */
        appId: string;
        /** SenseTime application key (required) */
        app_key: string;
        /** SenseTime scene configuration list (optional) */
        sceneList?: SensetimeAvatarParams.SceneList.Item[];
        [key: string]: unknown;
    };
}

/**
 * Spatius-specific avatar configuration.
 */
export interface SpatiusAvatarConfig {
    enable?: boolean;
    vendor: "spatius";
    params: SpatiusAvatarParams;
}

/**
 * Discriminated union of all avatar configurations.
 * TypeScript will enforce vendor-specific constraints based on the vendor field.
 */
export type StrictAvatarConfig =
    | HeyGenAvatarConfig
    | LiveAvatarAvatarConfig
    | AkoolAvatarConfig
    | AnamAvatarConfig
    | GenericAvatarConfig
    | SensetimeAvatarConfig
    | SpatiusAvatarConfig;

/**
 * Helper type guard to check if an avatar config uses the legacy HeyGen wire vendor.
 */
export function isHeyGenAvatar(config: StrictAvatarConfig): config is HeyGenAvatarConfig {
    return config.vendor === "heygen";
}

/**
 * Helper type guard to check if an avatar config is for LiveAvatar (formerly HeyGen).
 */
export function isLiveAvatarAvatar(config: StrictAvatarConfig): config is LiveAvatarAvatarConfig {
    return config.vendor === "liveavatar";
}

/**
 * Helper type guard to check if an avatar config is for Akool.
 */
export function isAkoolAvatar(config: StrictAvatarConfig): config is AkoolAvatarConfig {
    return config.vendor === "akool";
}

/**
 * Helper type guard to check if an avatar config is for Anam.
 */
export function isAnamAvatar(config: StrictAvatarConfig): config is AnamAvatarConfig {
    return config.vendor === "anam";
}

/**
 * Helper type guard to check if an avatar config is for Generic Avatar.
 */
export function isGenericAvatar(config: StrictAvatarConfig): config is GenericAvatarConfig {
    return config.vendor === "generic";
}

/**
 * Helper type guard to check if an avatar config is for SenseTime (CN).
 */
export function isSensetimeAvatar(config: StrictAvatarConfig): config is SensetimeAvatarConfig {
    return config.vendor === "sensetime";
}

/**
 * Helper type guard to check if an avatar config is for Spatius.
 */
export function isSpatiusAvatar(config: StrictAvatarConfig): config is SpatiusAvatarConfig {
    return config.vendor === "spatius";
}

/**
 * Returns true when AgentKit manages the avatar's RTC publisher identity
 * (i.e. fills `agora_token`, validates uniqueness against the agent UID).
 *
 * Mirrors the Go and Python SDK gate so all language SDKs behave identically.
 */
export function isAvatarTokenManaged(config: StrictAvatarConfig): boolean {
    return (
        isHeyGenAvatar(config) ||
        isLiveAvatarAvatar(config) ||
        isGenericAvatar(config) ||
        isSensetimeAvatar(config) ||
        isSpatiusAvatar(config)
    );
}

/**
 * Validates avatar configuration at runtime.
 * TypeScript catches most issues, but this provides runtime validation
 * for cases where types are bypassed or data comes from external sources.
 *
 * @param options.requireSessionFields - When true, require fields AgentKit
 * fills during `AgentSession.start()` for Generic avatars (`agora_appid`,
 * `agora_channel`, `agora_token`).
 * @throws {Error} If the configuration is invalid
 */
export function validateAvatarConfig(
    config: StrictAvatarConfig,
    options: { requireSessionFields?: boolean } = {},
): void {
    const validQualities = ["low", "medium", "high"];

    if (isHeyGenAvatar(config) || isLiveAvatarAvatar(config)) {
        const label = isHeyGenAvatar(config) ? "HeyGen" : "LiveAvatar";
        if (!config.params.api_key) {
            throw new Error(`${label} avatar requires api_key`);
        }
        if (!config.params.quality) {
            throw new Error(`${label} avatar requires quality (low, medium, or high)`);
        }
        if (!config.params.agora_uid) {
            throw new Error(`${label} avatar requires agora_uid`);
        }
        if (!validQualities.includes(config.params.quality)) {
            throw new Error(
                `Invalid quality for ${label}: ${config.params.quality}. ` +
                    `Must be one of: ${validQualities.join(", ")}`,
            );
        }
    } else if (isAkoolAvatar(config)) {
        if (!config.params.api_key) {
            throw new Error("Akool avatar requires api_key");
        }
    } else if (isAnamAvatar(config)) {
        if (!config.params.api_key) {
            throw new Error("Anam avatar requires api_key");
        }
    } else if (isGenericAvatar(config)) {
        if (!config.params.api_key) {
            throw new Error("Generic avatar requires api_key");
        }
        if (!config.params.api_base_url) {
            throw new Error("Generic avatar requires api_base_url");
        }
        if (!config.params.avatar_id) {
            throw new Error("Generic avatar requires avatar_id");
        }
        if (!config.params.agora_uid) {
            throw new Error("Generic avatar requires agora_uid");
        }
        if (options.requireSessionFields) {
            if (!config.params.agora_appid) {
                throw new Error("Generic avatar requires agora_appid after session enrichment");
            }
            if (!config.params.agora_channel) {
                throw new Error("Generic avatar requires agora_channel after session enrichment");
            }
            if (!config.params.agora_token) {
                throw new Error("Generic avatar requires agora_token after session enrichment");
            }
        }
    } else if (isSensetimeAvatar(config)) {
        if (!config.params.agora_uid) {
            throw new Error("SenseTime avatar requires agora_uid");
        }
        if (!config.params.appId) {
            throw new Error("SenseTime avatar requires appId");
        }
        if (!config.params.app_key) {
            throw new Error("SenseTime avatar requires app_key");
        }
        if (config.params.sceneList !== undefined && !Array.isArray(config.params.sceneList)) {
            throw new Error("SenseTime avatar sceneList must be an array when provided");
        }
    } else if (isSpatiusAvatar(config)) {
        if (!config.params.agora_uid) {
            throw new Error("Spatius avatar requires agora_uid");
        }
        if (!config.params.spatius_api_key) {
            throw new Error("Spatius avatar requires spatius_api_key");
        }
        if (!config.params.spatius_app_id) {
            throw new Error("Spatius avatar requires spatius_app_id");
        }
        if (!config.params.spatius_avatar_id) {
            throw new Error("Spatius avatar requires spatius_avatar_id");
        }
        if (options.requireSessionFields && !config.params.agora_token) {
            throw new Error("Spatius avatar requires agora_token after session enrichment");
        }
    }
}

/**
 * Validates that TTS sample rate is compatible with the avatar vendor.
 *
 * Different avatar vendors have specific sample rate requirements:
 * - ⚠️ HeyGen: ONLY supports 24,000 Hz
 * - ⚠️ Akool: ONLY supports 16,000 Hz
 *
 * This function helps catch TTS/Avatar misconfigurations at runtime.
 *
 * @param avatarConfig - The avatar configuration
 * @param ttsSampleRate - The sample rate from your TTS configuration (in Hz)
 * @throws {Error} If TTS sample rate is incompatible with the avatar vendor
 *
 * @example
 * ```typescript
 * // HeyGen example
 * const heygenAvatar: HeyGenAvatarConfig = { vendor: 'heygen', ... };
 * validateTtsSampleRate(heygenAvatar, 24000); // ✅ Passes
 * validateTtsSampleRate(heygenAvatar, 16000); // ❌ Throws error
 *
 * // Akool example
 * const akoolAvatar: AkoolAvatarConfig = { vendor: 'akool', ... };
 * validateTtsSampleRate(akoolAvatar, 16000); // ✅ Passes
 * validateTtsSampleRate(akoolAvatar, 24000); // ❌ Throws error
 * ```
 */
export function validateTtsSampleRate(avatarConfig: StrictAvatarConfig, ttsSampleRate: number): void {
    if (isHeyGenAvatar(avatarConfig) || isLiveAvatarAvatar(avatarConfig)) {
        if (ttsSampleRate !== 24000) {
            const label = isHeyGenAvatar(avatarConfig) ? "HeyGen" : "LiveAvatar";
            throw new Error(
                `${label} avatars ONLY support 24,000 Hz sample rate. ` +
                    `Your TTS is configured with ${ttsSampleRate} Hz. ` +
                    `Please update your TTS configuration to use 24kHz sample rate. ` +
                    `See: https://docs.agora.io/en/conversational-ai/models/avatar/overview`,
            );
        }
    } else if (isAkoolAvatar(avatarConfig)) {
        if (ttsSampleRate !== 16000) {
            throw new Error(
                `Akool avatars ONLY support 16,000 Hz sample rate. ` +
                    `Your TTS is configured with ${ttsSampleRate} Hz. ` +
                    `Please update your TTS configuration to use 16kHz sample rate. ` +
                    `See: https://docs.agora.io/en/conversational-ai/models/avatar/akool`,
            );
        }
    }
}

/**
 * Converts strict avatar config to base avatar config for API calls.
 * This bridges the gap between our type-safe agentkit and Fern's generated types.
 */
export function toBaseAvatarConfig(config: StrictAvatarConfig): BaseAvatarConfig {
    return config as unknown as BaseAvatarConfig;
}
