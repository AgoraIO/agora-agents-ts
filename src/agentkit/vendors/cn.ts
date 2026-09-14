import type { AvatarConfig, LlmConfig, SttConfig, TtsConfig } from "../types.js";
import { BaseCNAvatar, BaseCNLLM, BaseCNSTT, BaseCNTTS, type BaseLlmOptions } from "./base.js";

function requireString(value: unknown, field: string, vendor: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

export interface FengmingSTTOptions {
    /** Hotwords that improve recognition accuracy */
    keywords?: string[];
    /** Additional vendor-specific parameters */
    additionalParams?: Record<string, unknown>;
}

export class FengmingSTT extends BaseCNSTT {
    private readonly options: FengmingSTTOptions;

    constructor(options: FengmingSTTOptions = {}) {
        super();
        if (Object.keys(options.additionalParams ?? {}).includes("keywords")) {
            throw new Error(
                "FengmingSTT additionalParams must not contain keywords; use the top-level keywords option",
            );
        }
        this.options = options;
    }

    toConfig(): SttConfig {
        const { keywords, additionalParams } = this.options;
        const hasParams = additionalParams !== undefined && Object.keys(additionalParams).length > 0;

        return {
            vendor: "fengming",
            ...(keywords !== undefined && { keywords }),
            ...(hasParams && { params: { ...additionalParams } }),
        };
    }
}

export interface MicrosoftCNSTTOptions {
    key: string;
    region: string;
    language: string;
    phraseList?: string[];
    additionalParams?: Record<string, unknown>;
}

export class MicrosoftCNSTT extends BaseCNSTT {
    constructor(private readonly options: MicrosoftCNSTTOptions) {
        super();
        requireString(options.key, "key", "MicrosoftCNSTT");
        requireString(options.region, "region", "MicrosoftCNSTT");
        requireString(options.language, "language", "MicrosoftCNSTT");
    }

    toConfig(): SttConfig {
        const { key, region, language, phraseList, additionalParams } = this.options;
        return {
            vendor: "microsoft",
            params: {
                ...additionalParams,
                key,
                region,
                language,
                ...(phraseList && { phrase_list: phraseList }),
            },
        } as unknown as SttConfig;
    }
}

export interface TencentSTTOptions {
    language?: string;
    key: string;
    appId: string;
    secret: string;
    engineModelType: string;
    voiceId: string;
    additionalParams?: Record<string, unknown>;
}

export class TencentSTT extends BaseCNSTT {
    constructor(private readonly options: TencentSTTOptions) {
        super();
        requireString(options.key, "key", "TencentSTT");
        requireString(options.appId, "appId", "TencentSTT");
        requireString(options.secret, "secret", "TencentSTT");
        requireString(options.engineModelType, "engineModelType", "TencentSTT");
        requireString(options.voiceId, "voiceId", "TencentSTT");
    }

    toConfig(): SttConfig {
        const { language, key, appId, secret, engineModelType, voiceId, additionalParams } = this.options;
        return {
            vendor: "tencent",
            params: {
                ...additionalParams,
                ...(key && { key }),
                ...(appId && { app_id: appId }),
                ...(secret && { secret }),
                ...(engineModelType && { engine_model_type: engineModelType }),
                ...(voiceId && { voice_id: voiceId }),
                ...(language && { language }),
            },
        } as unknown as SttConfig;
    }
}

export interface XfyunSTTOptions {
    apiKey: string;
    appId: string;
    apiSecret: string;
    language: string;
    additionalParams?: Record<string, unknown>;
}

export class XfyunSTT extends BaseCNSTT {
    constructor(private readonly options: XfyunSTTOptions) {
        super();
        requireString(options.apiKey, "apiKey", "XfyunSTT");
        requireString(options.appId, "appId", "XfyunSTT");
        requireString(options.apiSecret, "apiSecret", "XfyunSTT");
        requireString(options.language, "language", "XfyunSTT");
    }

    toConfig(): SttConfig {
        const { apiKey, appId, apiSecret, language, additionalParams } = this.options;
        return {
            vendor: "xfyun",
            params: {
                ...additionalParams,
                api_key: apiKey,
                app_id: appId,
                api_secret: apiSecret,
                ...(language && { language }),
            },
        } as unknown as SttConfig;
    }
}

export interface XfyunBigModelSTTOptions {
    apiKey: string;
    appId: string;
    apiSecret: string;
    languageName: string;
    language: string;
    additionalParams?: Record<string, unknown>;
}

export class XfyunBigModelSTT extends BaseCNSTT {
    constructor(private readonly options: XfyunBigModelSTTOptions) {
        super();
        requireString(options.apiKey, "apiKey", "XfyunBigModelSTT");
        requireString(options.appId, "appId", "XfyunBigModelSTT");
        requireString(options.apiSecret, "apiSecret", "XfyunBigModelSTT");
        requireString(options.languageName, "languageName", "XfyunBigModelSTT");
        requireString(options.language, "language", "XfyunBigModelSTT");
    }

    toConfig(): SttConfig {
        const { apiKey, appId, apiSecret, languageName, language, additionalParams } = this.options;
        return {
            vendor: "xfyun_bigmodel",
            params: {
                ...additionalParams,
                api_key: apiKey,
                app_id: appId,
                api_secret: apiSecret,
                ...(languageName && { language_name: languageName }),
                ...(language && { language }),
            },
        } as unknown as SttConfig;
    }
}

export interface XfyunDialectSTTOptions {
    appId: string;
    accessKeyId: string;
    accessKeySecret: string;
    language: string;
    additionalParams?: Record<string, unknown>;
}

export class XfyunDialectSTT extends BaseCNSTT {
    constructor(private readonly options: XfyunDialectSTTOptions) {
        super();
        requireString(options.appId, "appId", "XfyunDialectSTT");
        requireString(options.accessKeyId, "accessKeyId", "XfyunDialectSTT");
        requireString(options.accessKeySecret, "accessKeySecret", "XfyunDialectSTT");
        requireString(options.language, "language", "XfyunDialectSTT");
    }

    toConfig(): SttConfig {
        const { appId, accessKeyId, accessKeySecret, language, additionalParams } = this.options;
        return {
            vendor: "xfyun_dialect",
            params: {
                ...additionalParams,
                app_id: appId,
                access_key_id: accessKeyId,
                access_key_secret: accessKeySecret,
                ...(language && { language }),
            },
        } as unknown as SttConfig;
    }
}

export interface MiniMaxCNVoiceSetting {
    voice_id: string;
    speed?: number;
    vol?: number;
    pitch?: number;
    emotion?: string;
    latex_read?: boolean;
    english_normalization?: boolean;
}

export interface MiniMaxCNAudioSetting {
    sample_rate: number;
}

export interface MiniMaxCNPronunciationDict {
    tone: string[];
}

export interface MiniMaxCNTimberWeight {
    voice_id: string;
    weight: number;
}

export interface MiniMaxCNTTSBaseOptions {
    key: string;
    model: string;
    audioSetting?: MiniMaxCNAudioSetting;
    pronunciationDict?: MiniMaxCNPronunciationDict;
    languageBoost?: string;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export type MiniMaxCNTTSOptions =
    | (MiniMaxCNTTSBaseOptions & {
          voiceSetting: MiniMaxCNVoiceSetting;
          timberWeights?: never;
      })
    | (MiniMaxCNTTSBaseOptions & {
          voiceSetting?: never;
          timberWeights: MiniMaxCNTimberWeight[];
      });

export class MiniMaxCNTTS extends BaseCNTTS {
    constructor(private readonly options: MiniMaxCNTTSOptions) {
        super();
        requireString(options.key, "key", "MiniMaxCNTTS");
        requireString(options.model, "model", "MiniMaxCNTTS");
        if (options.voiceSetting) {
            requireString(options.voiceSetting.voice_id, "voiceSetting.voice_id", "MiniMaxCNTTS");
        } else if (!options.timberWeights.length) {
            throw new Error("MiniMaxCNTTS requires at least one timberWeight when voiceSetting is omitted");
        }
    }

    toConfig(): TtsConfig {
        const {
            key,
            model,
            voiceSetting,
            audioSetting,
            pronunciationDict,
            timberWeights,
            languageBoost,
            skipPatterns,
            additionalParams,
        } = this.options;
        return {
            vendor: "minimax",
            params: {
                ...additionalParams,
                ...(key && { key }),
                ...(model && { model }),
                ...(voiceSetting && { voice_setting: voiceSetting }),
                ...(audioSetting && { audio_setting: audioSetting }),
                ...(pronunciationDict && { pronunciation_dict: pronunciationDict }),
                ...(timberWeights && { timber_weights: timberWeights }),
                ...(languageBoost && { language_boost: languageBoost }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as TtsConfig;
    }
}

export type MicrosoftCNSampleRate = 16000 | 24000 | 48000;

export interface MicrosoftCNTTSOptions<SR extends MicrosoftCNSampleRate = MicrosoftCNSampleRate> {
    key: string;
    region: string;
    voiceName: string;
    sampleRate?: SR;
    speed?: number;
    volume?: number;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class MicrosoftCNTTS<SR extends MicrosoftCNSampleRate = MicrosoftCNSampleRate> extends BaseCNTTS<SR> {
    constructor(private readonly options: MicrosoftCNTTSOptions<SR>) {
        super();
        requireString(options.key, "key", "MicrosoftCNTTS");
        requireString(options.region, "region", "MicrosoftCNTTS");
        requireString(options.voiceName, "voiceName", "MicrosoftCNTTS");
    }

    toConfig(): TtsConfig {
        const { key, region, voiceName, sampleRate, speed, volume, skipPatterns, additionalParams } = this.options;
        return {
            vendor: "microsoft",
            params: {
                ...additionalParams,
                key,
                region,
                voice_name: voiceName,
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
                ...(speed !== undefined && { speed }),
                ...(volume !== undefined && { volume }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

export interface TencentTTSOptions {
    appId: string;
    secretId: string;
    secretKey: string;
    voiceType: number;
    volume?: number;
    speed?: number;
    emotionCategory?: string;
    emotionIntensity?: number;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class TencentTTS extends BaseCNTTS {
    constructor(private readonly options: TencentTTSOptions) {
        super();
        requireString(options.appId, "appId", "TencentTTS");
        requireString(options.secretId, "secretId", "TencentTTS");
        requireString(options.secretKey, "secretKey", "TencentTTS");
        if (typeof options.voiceType !== "number" || Number.isNaN(options.voiceType)) {
            throw new Error("TencentTTS requires voiceType");
        }
    }

    toConfig(): TtsConfig {
        const {
            appId,
            secretId,
            secretKey,
            voiceType,
            volume,
            speed,
            emotionCategory,
            emotionIntensity,
            skipPatterns,
            additionalParams,
        } = this.options;
        return {
            vendor: "tencent",
            params: {
                ...additionalParams,
                app_id: appId,
                secret_id: secretId,
                secret_key: secretKey,
                ...(voiceType !== undefined && { voice_type: voiceType }),
                ...(volume !== undefined && { volume }),
                ...(speed !== undefined && { speed }),
                ...(emotionCategory && { emotion_category: emotionCategory }),
                ...(emotionIntensity !== undefined && { emotion_intensity: emotionIntensity }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

export interface BytedanceTTSOptions {
    token: string;
    appId: string;
    cluster: string;
    voiceType: string;
    speedRatio?: number;
    volumeRatio?: number;
    pitchRatio?: number;
    emotion?: string;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class BytedanceTTS extends BaseCNTTS {
    constructor(private readonly options: BytedanceTTSOptions) {
        super();
        requireString(options.token, "token", "BytedanceTTS");
        requireString(options.appId, "appId", "BytedanceTTS");
        requireString(options.cluster, "cluster", "BytedanceTTS");
        requireString(options.voiceType, "voiceType", "BytedanceTTS");
    }

    toConfig(): TtsConfig {
        const {
            token,
            appId,
            cluster,
            voiceType,
            speedRatio,
            volumeRatio,
            pitchRatio,
            emotion,
            skipPatterns,
            additionalParams,
        } = this.options;
        return {
            vendor: "bytedance",
            params: {
                ...additionalParams,
                token,
                app_id: appId,
                ...(cluster && { cluster }),
                ...(voiceType && { voice_type: voiceType }),
                ...(speedRatio !== undefined && { speed_ratio: speedRatio }),
                ...(volumeRatio !== undefined && { volume_ratio: volumeRatio }),
                ...(pitchRatio !== undefined && { pitch_ratio: pitchRatio }),
                ...(emotion && { emotion }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

export interface CosyVoiceTTSOptions {
    apiKey: string;
    model: string;
    sampleRate: number;
    voice: string;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class CosyVoiceTTS extends BaseCNTTS {
    constructor(private readonly options: CosyVoiceTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "CosyVoiceTTS");
        requireString(options.model, "model", "CosyVoiceTTS");
        if (typeof options.sampleRate !== "number" || Number.isNaN(options.sampleRate)) {
            throw new Error("CosyVoiceTTS requires sampleRate");
        }
        requireString(options.voice, "voice", "CosyVoiceTTS");
    }

    toConfig(): TtsConfig {
        const { apiKey, model, sampleRate, voice, skipPatterns, additionalParams } = this.options;
        return {
            vendor: "cosyvoice",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(model && { model }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
                ...(voice && { voice }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

export interface BytedanceDuplexTTSOptions {
    appId: string;
    token: string;
    speaker: string;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class BytedanceDuplexTTS extends BaseCNTTS {
    constructor(private readonly options: BytedanceDuplexTTSOptions) {
        super();
        requireString(options.appId, "appId", "BytedanceDuplexTTS");
        requireString(options.token, "token", "BytedanceDuplexTTS");
        requireString(options.speaker, "speaker", "BytedanceDuplexTTS");
    }

    toConfig(): TtsConfig {
        const { appId, token, speaker, skipPatterns, additionalParams } = this.options;
        return {
            vendor: "bytedance_duplex",
            params: {
                ...additionalParams,
                app_id: appId,
                token,
                speaker,
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

export interface StepFunTTSOptions {
    apiKey: string;
    model: string;
    voiceId: string;
    skipPatterns?: number[];
    additionalParams?: Record<string, unknown>;
}

export class StepFunTTS extends BaseCNTTS {
    constructor(private readonly options: StepFunTTSOptions) {
        super();
        requireString(options.apiKey, "apiKey", "StepFunTTS");
        requireString(options.model, "model", "StepFunTTS");
        requireString(options.voiceId, "voiceId", "StepFunTTS");
    }

    toConfig(): TtsConfig {
        const { apiKey, model, voiceId, skipPatterns, additionalParams } = this.options;
        return {
            vendor: "stepfun",
            params: {
                ...additionalParams,
                api_key: apiKey,
                ...(model && { model }),
                ...(voiceId && { voice_id: voiceId }),
            },
            ...(skipPatterns && { skip_patterns: skipPatterns }),
        } as unknown as TtsConfig;
    }
}

type CNLlmCommonOptions = BaseLlmOptions & {
    apiKey?: string;
    url: string;
    model: string;
    maxHistory?: number;
    systemMessages?: Record<string, unknown>[];
    greetingMessage?: string;
    failureMessage?: string;
    inputModalities?: string[];
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
};

function cnLlmConfig(options: CNLlmCommonOptions, vendor: string): LlmConfig {
    return {
        url: options.url,
        ...(options.apiKey && { api_key: options.apiKey }),
        params: {
            model: options.model,
            ...options.params,
        },
        headers: options.headers,
        max_history: options.maxHistory,
        system_messages: options.systemMessages,
        greeting_message: options.greetingMessage,
        greeting_audio_url: options.greetingAudioUrl,
        failure_message: options.failureMessage,
        input_modalities: options.inputModalities ?? ["text"],
        output_modalities: options.outputModalities,
        style: "openai",
        vendor,
        greeting_configs: options.greetingConfigs,
        template_variables: options.templateVariables,
        mcp_servers: options.mcpServers,
        tools: options.tools,
    };
}

export interface AliyunLLMOptions extends CNLlmCommonOptions {}
export class AliyunLLM extends BaseCNLLM {
    constructor(private readonly options: AliyunLLMOptions) {
        super(options);
        requireString(options.url, "url", "AliyunLLM");
        requireString(options.model, "model", "AliyunLLM");
    }
    toConfig(): LlmConfig {
        return cnLlmConfig(this.options, "aliyun");
    }
}

export interface BytedanceLLMOptions extends CNLlmCommonOptions {}
export class BytedanceLLM extends BaseCNLLM {
    constructor(private readonly options: BytedanceLLMOptions) {
        super(options);
        requireString(options.url, "url", "BytedanceLLM");
        requireString(options.model, "model", "BytedanceLLM");
    }
    toConfig(): LlmConfig {
        return cnLlmConfig(this.options, "bytedance");
    }
}

export interface DeepSeekLLMOptions extends CNLlmCommonOptions {}
export class DeepSeekLLM extends BaseCNLLM {
    constructor(private readonly options: DeepSeekLLMOptions) {
        super(options);
        requireString(options.url, "url", "DeepSeekLLM");
        requireString(options.model, "model", "DeepSeekLLM");
    }
    toConfig(): LlmConfig {
        return cnLlmConfig(this.options, "deepseek");
    }
}

export interface TencentLLMOptions extends CNLlmCommonOptions {}
export class TencentLLM extends BaseCNLLM {
    constructor(private readonly options: TencentLLMOptions) {
        super(options);
        requireString(options.url, "url", "TencentLLM");
        requireString(options.model, "model", "TencentLLM");
    }
    toConfig(): LlmConfig {
        return cnLlmConfig(this.options, "tencent");
    }
}

export interface SensetimeAvatarOptions {
    agoraUid: string;
    agoraToken?: string;
    appId: string;
    appKey: string;
    sceneList?: Record<string, unknown>[];
    enable?: boolean;
    additionalParams?: Record<string, unknown>;
}

export class SensetimeAvatar extends BaseCNAvatar<number> {
    readonly requiredSampleRate = 0 as number;

    constructor(private readonly options: SensetimeAvatarOptions) {
        super();
        requireString(options.agoraUid, "agoraUid", "SensetimeAvatar");
        requireString(options.appId, "appId", "SensetimeAvatar");
        requireString(options.appKey, "appKey", "SensetimeAvatar");
    }

    toConfig(): AvatarConfig {
        const { agoraUid, agoraToken, appId, appKey, sceneList, enable = true, additionalParams } = this.options;
        return {
            enable,
            vendor: "sensetime",
            params: {
                ...additionalParams,
                agora_uid: agoraUid,
                ...(agoraToken && { agora_token: agoraToken }),
                appId,
                app_key: appKey,
                ...(sceneList !== undefined && { sceneList }),
            },
        };
    }
}

export interface SpatiusAvatarOptions {
    spatiusApiKey: string;
    spatiusAppId: string;
    spatiusAvatarId: string;
    agoraUid: string;
    agoraToken?: string;
    region?: string;
    sampleRate?: 16000 | 24000;
    sessionExpireMinutes?: number;
    enable?: boolean;
    additionalParams?: Record<string, unknown>;
}

export class SpatiusAvatar extends BaseCNAvatar<number> {
    readonly requiredSampleRate = 0 as number;

    constructor(private readonly options: SpatiusAvatarOptions) {
        super();
        requireString(options.spatiusApiKey, "spatiusApiKey", "SpatiusAvatar");
        requireString(options.spatiusAppId, "spatiusAppId", "SpatiusAvatar");
        requireString(options.spatiusAvatarId, "spatiusAvatarId", "SpatiusAvatar");
        requireString(options.agoraUid, "agoraUid", "SpatiusAvatar");
    }

    toConfig(): AvatarConfig {
        const {
            spatiusApiKey,
            spatiusAppId,
            spatiusAvatarId,
            agoraUid,
            agoraToken,
            region,
            sampleRate,
            sessionExpireMinutes,
            enable = true,
            additionalParams,
        } = this.options;

        return {
            enable,
            vendor: "spatius",
            params: {
                ...additionalParams,
                spatius_api_key: spatiusApiKey,
                spatius_app_id: spatiusAppId,
                spatius_avatar_id: spatiusAvatarId,
                agora_uid: agoraUid,
                ...(agoraToken && { agora_token: agoraToken }),
                ...(region && { region }),
                ...(sampleRate !== undefined && { sample_rate: sampleRate }),
                ...(sessionExpireMinutes !== undefined && { session_expire_minutes: sessionExpireMinutes }),
            },
        };
    }
}
