import { describe, expect, test } from "vitest";
import {
    AliyunLLM,
    BytedanceDuplexTTS,
    BytedanceLLM,
    BytedanceTTS,
    CosyVoiceTTS,
    CustomLLM,
    DeepSeekLLM,
    FengmingSTT,
    MicrosoftCNSTT,
    MicrosoftCNTTS,
    MiniMaxCNTTS,
    QwenOmni,
    SensetimeAvatar,
    SpatiusAvatar,
    StepFunTTS,
    TencentLLM,
    TencentSTT,
    TencentTTS,
    XfyunBigModelSTT,
    XfyunDialectSTT,
    XfyunSTT,
} from "../../../src/index.js";

describe("CN vendor helpers", () => {
    test("serializes inline REST tools for CN LLM vendors", () => {
        const tool = {
            type: "function" as const,
            function: {
                name: "lookup_order",
                parameters: { type: "object" as const, properties: { orderId: { type: "string" } } },
            },
            server: { method: "GET" as const, url: "https://example.com/orders/{{args.orderId}}" },
        };

        expect(
            new AliyunLLM({
                apiKey: "key",
                model: "qwen-plus",
                url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                tools: [tool],
            }).toConfig().tools,
        ).toEqual([tool]);
    });

    test("serializes CN STT vendors", () => {
        expect(new FengmingSTT().toConfig()).toMatchObject({ vendor: "fengming" });
        expect(new FengmingSTT({ keywords: ["声网", "Agora"], additionalParams: { custom: true } }).toConfig()).toEqual(
            {
                vendor: "fengming",
                keywords: ["声网", "Agora"],
                params: { custom: true },
            },
        );
        expect(() => new FengmingSTT({ additionalParams: { keywords: ["声网"] } })).toThrow(
            "use the top-level keywords option",
        );

        expect(
            new TencentSTT({
                language: "zh-CN",
                key: "key",
                appId: "app",
                secret: "secret",
                engineModelType: "16k_zh",
                voiceId: "voice-id",
            }).toConfig(),
        ).toMatchObject({
            vendor: "tencent",
            params: {
                key: "key",
                app_id: "app",
                secret: "secret",
                engine_model_type: "16k_zh",
                voice_id: "voice-id",
                language: "zh-CN",
            },
        });

        expect(
            new MicrosoftCNSTT({
                key: "ms-key",
                region: "chinaeast2",
                language: "zh-CN",
                phraseList: ["agora", "fengming"],
            }).toConfig(),
        ).toMatchObject({
            vendor: "microsoft",
            params: {
                key: "ms-key",
                region: "chinaeast2",
                language: "zh-CN",
                phrase_list: ["agora", "fengming"],
            },
        });

        expect(
            new XfyunSTT({
                apiKey: "api-key",
                appId: "app-id",
                apiSecret: "api-secret",
                language: "zh_cn",
            }).toConfig(),
        ).toMatchObject({
            vendor: "xfyun",
            params: {
                api_key: "api-key",
                app_id: "app-id",
                api_secret: "api-secret",
                language: "zh_cn",
            },
        });

        expect(
            new XfyunBigModelSTT({
                apiKey: "api-key",
                appId: "app-id",
                apiSecret: "api-secret",
                languageName: "cn",
                language: "mix",
            }).toConfig(),
        ).toMatchObject({
            vendor: "xfyun_bigmodel",
            params: {
                api_key: "api-key",
                app_id: "app-id",
                api_secret: "api-secret",
                language_name: "cn",
                language: "mix",
            },
        });

        expect(
            new XfyunDialectSTT({
                appId: "app-id",
                accessKeyId: "access-id",
                accessKeySecret: "access-secret",
                language: "zh-CN",
            }).toConfig(),
        ).toMatchObject({
            vendor: "xfyun_dialect",
            params: {
                app_id: "app-id",
                access_key_id: "access-id",
                access_key_secret: "access-secret",
                language: "zh-CN",
            },
        });
    });

    test("serializes the CN Qwen Omni MLLM vendor", () => {
        expect(
            new QwenOmni({
                apiKey: "dashscope-key",
                model: "qwen3.5-omni-plus-realtime",
                url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            }).toConfig(),
        ).toMatchObject({
            vendor: "qwen_omni",
            api_key: "dashscope-key",
            url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            params: { model: "qwen3.5-omni-plus-realtime" },
        });
    });

    test("enforces CN STT required fields from doc examples", () => {
        expect(() => new TencentSTT({} as never)).toThrow("TencentSTT requires key");
        expect(
            () =>
                new XfyunSTT({
                    apiKey: "api-key",
                    appId: "app-id",
                    apiSecret: "api-secret",
                } as never),
        ).toThrow("XfyunSTT requires language");
        expect(
            () =>
                new XfyunBigModelSTT({
                    apiKey: "api-key",
                    appId: "app-id",
                    apiSecret: "api-secret",
                    language: "mix",
                } as never),
        ).toThrow("XfyunBigModelSTT requires languageName");
        expect(
            () =>
                new XfyunDialectSTT({
                    appId: "app-id",
                    accessKeyId: "access-id",
                    accessKeySecret: "access-secret",
                } as never),
        ).toThrow("XfyunDialectSTT requires language");
    });

    test("serializes CN TTS vendors", () => {
        expect(
            new MiniMaxCNTTS({
                key: "key",
                model: "speech-01-turbo",
                voiceSetting: { voice_id: "female-shaonv", speed: 1 },
                audioSetting: { sample_rate: 16000 },
                languageBoost: "auto",
                skipPatterns: [1, 2],
                additionalParams: { custom_flag: true },
            }).toConfig(),
        ).toMatchObject({
            vendor: "minimax",
            params: {
                custom_flag: true,
                key: "key",
                model: "speech-01-turbo",
                voice_setting: { voice_id: "female-shaonv", speed: 1 },
                audio_setting: { sample_rate: 16000 },
                language_boost: "auto",
            },
            skip_patterns: [1, 2],
        });

        expect(
            new MiniMaxCNTTS({
                key: "key",
                model: "speech-01-turbo",
                timberWeights: [{ voice_id: "male-qn-qingse", weight: 1 }],
            }).toConfig(),
        ).toMatchObject({
            vendor: "minimax",
            params: {
                key: "key",
                model: "speech-01-turbo",
                timber_weights: [{ voice_id: "male-qn-qingse", weight: 1 }],
            },
        });

        expect(
            new TencentTTS({
                appId: "app-id",
                secretId: "secret-id",
                secretKey: "secret-key",
                voiceType: 601005,
                volume: 0,
                speed: 0,
                emotionCategory: "happy",
                emotionIntensity: 100,
            }).toConfig(),
        ).toMatchObject({
            vendor: "tencent",
            params: {
                app_id: "app-id",
                secret_id: "secret-id",
                secret_key: "secret-key",
                voice_type: 601005,
                volume: 0,
                speed: 0,
                emotion_category: "happy",
                emotion_intensity: 100,
            },
        });

        expect(
            new BytedanceTTS({
                token: "token",
                appId: "app-id",
                cluster: "volcano_tts",
                voiceType: "BV700_streaming",
                speedRatio: 1,
                volumeRatio: 1,
                pitchRatio: 1,
                emotion: "happy",
            }).toConfig(),
        ).toMatchObject({
            vendor: "bytedance",
            params: {
                token: "token",
                app_id: "app-id",
                cluster: "volcano_tts",
                voice_type: "BV700_streaming",
                speed_ratio: 1,
                volume_ratio: 1,
                pitch_ratio: 1,
                emotion: "happy",
            },
        });

        expect(
            new MicrosoftCNTTS({
                key: "ms-key",
                region: "chinaeast2",
                voiceName: "zh-CN-YunxiNeural",
                sampleRate: 24000,
                additionalParams: { style: "chat" },
            }).toConfig(),
        ).toMatchObject({
            vendor: "microsoft",
            params: {
                style: "chat",
                key: "ms-key",
                region: "chinaeast2",
                voice_name: "zh-CN-YunxiNeural",
                sample_rate: 24000,
            },
        });

        expect(
            new CosyVoiceTTS({
                apiKey: "api-key",
                model: "cosyvoice-v1",
                sampleRate: 16000,
                voice: "longxiaochun",
            }).toConfig(),
        ).toMatchObject({
            vendor: "cosyvoice",
            params: {
                api_key: "api-key",
                model: "cosyvoice-v1",
                sample_rate: 16000,
                voice: "longxiaochun",
            },
        });

        expect(
            new BytedanceDuplexTTS({
                appId: "app-id",
                token: "token",
                speaker: "zh_female_shuangkuaisisi_moon_bigtts",
            }).toConfig(),
        ).toMatchObject({
            vendor: "bytedance_duplex",
            params: {
                app_id: "app-id",
                token: "token",
                speaker: "zh_female_shuangkuaisisi_moon_bigtts",
            },
        });

        expect(
            new StepFunTTS({
                apiKey: "api-key",
                model: "step-tts-mini",
                voiceId: "cixingnansheng",
            }).toConfig(),
        ).toMatchObject({
            vendor: "stepfun",
            params: {
                api_key: "api-key",
                model: "step-tts-mini",
                voice_id: "cixingnansheng",
            },
        });
    });

    test("serializes CN avatar vendors", () => {
        expect(
            new SensetimeAvatar({
                agoraUid: "200",
                appId: "sensetime-app-id",
                appKey: "sensetime-app-key",
                sceneList: [{ digital_role: { face_feature_id: "face", position: { x: 0, y: 0 }, url: "https://x" } }],
            }).toConfig(),
        ).toMatchObject({
            vendor: "sensetime",
            params: {
                agora_uid: "200",
                appId: "sensetime-app-id",
                app_key: "sensetime-app-key",
            },
        });

        expect(
            new SpatiusAvatar({
                spatiusApiKey: "spatius-key",
                spatiusAppId: "spatius-app-id",
                spatiusAvatarId: "spatius-avatar-id",
                agoraUid: "201",
                region: "cn-beijing",
                sampleRate: 24000,
                sessionExpireMinutes: 30,
            }).toConfig(),
        ).toMatchObject({
            vendor: "spatius",
            params: {
                spatius_api_key: "spatius-key",
                spatius_app_id: "spatius-app-id",
                spatius_avatar_id: "spatius-avatar-id",
                agora_uid: "201",
                region: "cn-beijing",
                sample_rate: 24000,
                session_expire_minutes: 30,
            },
        });
    });

    test("MiniMaxCNTTS enforces CN voice source", () => {
        expect(
            () =>
                new MiniMaxCNTTS({
                    key: "key",
                    model: "speech-01-turbo",
                    voiceSetting: {} as never,
                }),
        ).toThrow("MiniMaxCNTTS requires voiceSetting.voice_id");

        expect(
            () =>
                new MiniMaxCNTTS({
                    key: "key",
                    model: "speech-01-turbo",
                    timberWeights: [],
                }),
        ).toThrow("MiniMaxCNTTS requires at least one timberWeight");
    });

    test("enforces CN TTS required fields from doc examples", () => {
        expect(
            () =>
                new TencentTTS({
                    appId: "app-id",
                    secretId: "secret-id",
                    secretKey: "secret-key",
                } as never),
        ).toThrow("TencentTTS requires voiceType");

        expect(
            () =>
                new BytedanceTTS({
                    token: "token",
                    appId: "app-id",
                    voiceType: "BV700_streaming",
                } as never),
        ).toThrow("BytedanceTTS requires cluster");

        expect(
            () =>
                new CosyVoiceTTS({
                    apiKey: "api-key",
                    voice: "longxiaochun",
                    sampleRate: 16000,
                } as never),
        ).toThrow("CosyVoiceTTS requires model");

        expect(
            () =>
                new StepFunTTS({
                    apiKey: "api-key",
                    model: "step-tts-mini",
                } as never),
        ).toThrow("StepFunTTS requires voiceId");
    });

    test("serializes CN LLM and avatar vendors", () => {
        const llmAssertions = [
            [
                new AliyunLLM({
                    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                    model: "qwen-plus",
                }),
                "aliyun",
            ],
            [
                new BytedanceLLM({
                    url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                    model: "doubao-seed-1-6",
                }),
                "bytedance",
            ],
            [new DeepSeekLLM({ url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" }), "deepseek"],
            [
                new TencentLLM({
                    url: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
                    model: "hunyuan-turbos-latest",
                }),
                "tencent",
            ],
            [
                new TencentLLM({
                    url: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
                    model: "hunyuan-turbos-latest",
                }),
                "tencent",
            ],
            [
                new CustomLLM({
                    apiKey: "cn-custom-key",
                    url: "https://llm.example.cn/chat/completions",
                    model: "custom-model",
                }),
                "custom",
            ],
        ] as const;

        for (const [vendor, vendorName] of llmAssertions) {
            expect(vendor.toConfig()).toMatchObject({
                url: expect.any(String),
                vendor: vendorName,
                style: "openai",
                params: { model: expect.any(String) },
            });
        }

        expect(
            new SensetimeAvatar({
                agoraUid: "1234",
                agoraToken: "agora-token",
                appId: "sensetime-app-id",
                appKey: "sensetime-app-key",
                sceneList: [
                    {
                        digital_role: {
                            face_feature_id: "face_feature_id",
                            position: { x: 0, y: 0 },
                            url: "https://example.com/avatar.zip",
                        },
                    },
                ],
            }).toConfig(),
        ).toMatchObject({
            enable: true,
            vendor: "sensetime",
            params: {
                agora_uid: "1234",
                agora_token: "agora-token",
                appId: "sensetime-app-id",
                app_key: "sensetime-app-key",
                sceneList: expect.any(Array),
            },
        });

        const withoutToken = new SensetimeAvatar({
            agoraUid: "1234",
            appId: "sensetime-app-id",
            appKey: "sensetime-app-key",
            sceneList: [
                {
                    digital_role: {
                        face_feature_id: "face_feature_id",
                        position: { x: 0, y: 0 },
                        url: "https://example.com/avatar.zip",
                    },
                },
            ],
        }).toConfig();
        expect(withoutToken.params).not.toHaveProperty("agora_token");

        const withoutSceneList = new SensetimeAvatar({
            agoraUid: "1234",
            appId: "sensetime-app-id",
            appKey: "sensetime-app-key",
        }).toConfig();
        expect(withoutSceneList.params).not.toHaveProperty("sceneList");
    });

    test("enforces CN LLM required url and model", () => {
        expect(
            () =>
                new AliyunLLM({
                    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                } as never),
        ).toThrow("AliyunLLM requires model");

        expect(
            () =>
                new CustomLLM({
                    apiKey: "cn-custom-key",
                    model: "custom-model",
                } as never),
        ).toThrow("CustomLLM requires url");
    });
});
