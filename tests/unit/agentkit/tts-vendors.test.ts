import { describe, expect, test } from "vitest";
import {
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
    SmallestAITTS,
} from "../../../src/agentkit/vendors/tts.js";
import { CredentialMode, type CredentialMode as CredentialModeType } from "../../../src/index.js";

describe("TTS vendor helpers", () => {
    test("serializes provider params using the generated core shapes", () => {
        expect(
            new AmazonTTS({
                accessKey: "access",
                secretKey: "secret",
                region: "us-east-1",
                voiceId: "Joanna",
                engine: "neural",
            }).toConfig().params,
        ).toMatchObject({
            aws_access_key_id: "access",
            aws_secret_access_key: "secret",
            region_name: "us-east-1",
            voice: "Joanna",
            engine: "neural",
        });

        expect(
            new GoogleTTS({
                key: "{}",
                voiceName: "en-US-JennyNeural",
                languageCode: "en-US",
                sampleRate: 24000,
            }).toConfig().params,
        ).toMatchObject({
            credentials: "{}",
            VoiceSelectionParams: { name: "en-US-JennyNeural", language_code: "en-US" },
            AudioConfig: { sample_rate_hertz: 24000 },
        });

        expect(
            new CartesiaTTS({
                apiKey: "cartesia-key",
                voiceId: "voice",
                modelId: "sonic-2",
                sampleRate: 24000,
            }).toConfig().params,
        ).toMatchObject({
            api_key: "cartesia-key",
            model_id: "sonic-2",
            voice: { mode: "id", id: "voice" },
            output_format: { container: "raw", sample_rate: 24000 },
        });

        expect(new RimeTTS({ key: "rime-key", speaker: "speaker", modelId: "mist" }).toConfig().params).toMatchObject({
            api_key: "rime-key",
            speaker: "speaker",
            modelId: "mist",
        });

        expect(
            new FishAudioTTS({ key: "fish-key", referenceId: "ref", backend: "speech-1.5" }).toConfig().params,
        ).toMatchObject({
            api_key: "fish-key",
            reference_id: "ref",
            backend: "speech-1.5",
        });

        expect(
            new ElevenLabsTTS({
                key: "eleven-key",
                modelId: "eleven_flash_v2_5",
                voiceId: "voice",
                baseUrl: "wss://api.elevenlabs.io/v1",
            }).toConfig().params,
        ).toMatchObject({
            key: "eleven-key",
            base_url: "wss://api.elevenlabs.io/v1",
            model_id: "eleven_flash_v2_5",
            voice_id: "voice",
        });

        expect(
            new DeepgramTTS({
                apiKey: "deepgram-key",
                model: "aura-2-thalia-en",
                baseUrl: "wss://api.deepgram.com/v1/speak",
                sampleRate: 24000,
                additionalParams: { encoding: "linear16" },
            }).toConfig().params,
        ).toMatchObject({
            api_key: "deepgram-key",
            model: "aura-2-thalia-en",
            base_url: "wss://api.deepgram.com/v1/speak",
            sample_rate: 24000,
            encoding: "linear16",
        });

        expect(
            new GradiumTTS({
                apiKey: "gradium-key",
                url: "wss://api.gradium.ai/api/speech/tts",
                modelName: "default",
                voiceId: "voice",
                sampleRate: 24000,
                additionalParams: { output_format: "pcm" },
                skipPatterns: [1, 2],
            }).toConfig(),
        ).toEqual({
            vendor: "gradium",
            params: {
                output_format: "pcm",
                api_key: "gradium-key",
                url: "wss://api.gradium.ai/api/speech/tts",
                model_name: "default",
                voice_id: "voice",
                sample_rate: 24000,
            },
            skip_patterns: [1, 2],
        });

        expect(
            new MistralTTS({
                apiKey: "mistral-key",
                model: "voxtral-mini-tts-2603",
                voice: "voice",
                additionalParams: { response_format: "pcm" },
                skipPatterns: [1],
            }).toConfig(),
        ).toEqual({
            vendor: "mistral",
            params: {
                response_format: "pcm",
                api_key: "mistral-key",
                model: "voxtral-mini-tts-2603",
                voice: "voice",
            },
            skip_patterns: [1],
        });

        expect(
            new OpenAITTS({
                apiKey: "openai-key",
                voice: "coral",
                model: "gpt-4o-mini-tts",
                baseUrl: "https://api.openai.com/v1",
                instructions: "speak clearly",
            }).toConfig().params,
        ).toMatchObject({
            api_key: "openai-key",
            base_url: "https://api.openai.com/v1",
            model: "gpt-4o-mini-tts",
            voice: "coral",
            instructions: "speak clearly",
        });

        expect(new OpenAITTS({ voice: "coral" }).toConfig().params).toEqual({
            voice: "coral",
        });

        expect(
            new HumeAITTS({ key: "hume-key", voiceId: "voice", provider: "CUSTOM_VOICE" }).toConfig().params,
        ).toMatchObject({
            key: "hume-key",
            voice_id: "voice",
            provider: "CUSTOM_VOICE",
        });

        expect(
            new MiniMaxTTS({
                key: "minimax-key",
                groupId: "group",
                model: "speech-02-turbo",
                voiceId: "voice",
                url: "wss://api-uw.minimax.io/ws/v1/t2a_v2",
            }).toConfig().params,
        ).toMatchObject({
            key: "minimax-key",
            group_id: "group",
            model: "speech-02-turbo",
            voice_setting: { voice_id: "voice" },
            url: "wss://api-uw.minimax.io/ws/v1/t2a_v2",
        });

        expect(
            new MicrosoftTTS({ key: "ms-key", region: "eastus", voiceName: "en-US-JennyNeural" }).toConfig().params,
        ).toMatchObject({
            key: "ms-key",
            region: "eastus",
            voice_name: "en-US-JennyNeural",
        });

        expect(
            new SarvamTTS({
                key: "sarvam-key",
                speaker: "anushka",
                targetLanguageCode: "en-IN",
                sampleRate: 24000,
                enablePreprocessing: true,
                model: "bulbul:v3",
                additionalParams: { model: "ignored-model", custom_flag: "custom-value" },
            }).toConfig().params,
        ).toMatchObject({
            api_subscription_key: "sarvam-key",
            speaker: "anushka",
            target_language_code: "en-IN",
            speech_sample_rate: 24000,
            enable_preprocessing: true,
            model: "bulbul:v3",
            custom_flag: "custom-value",
        });

        expect(
            new MurfTTS({
                key: "murf-key",
                voiceId: "Ariana",
                baseUrl: "wss://murf.example/ws",
                locale: "en-US",
                rate: 0,
                pitch: 0,
                model: "FALCON",
                sampleRate: 24000,
            }).toConfig().params,
        ).toMatchObject({
            api_key: "murf-key",
            base_url: "wss://murf.example/ws",
            voiceId: "Ariana",
            locale: "en-US",
            rate: 0,
            pitch: 0,
            model: "FALCON",
            sample_rate: 24000,
        });

        expect(new MurfTTS({ key: "murf-key" }).toConfig().params).toEqual({
            api_key: "murf-key",
        });
    });

    test("routes GenericTTS HTTP URLs and rejects unsupported protocols", () => {
        expect(new GenericTTS({ url: "https://tts.example.com/v1/audio/speech" }).toConfig()).toEqual({
            vendor: "generic_http",
            url: "https://tts.example.com/v1/audio/speech",
            params: {},
        });

        expect(() => new GenericTTS({ url: "wss://tts.example.com/v1/audio/speech" })).toThrow(
            "GenericTTS does not support the wss: protocol",
        );
        expect(() => new GenericTTS({ url: "tts.example.com/v1/audio/speech" })).toThrow(
            "GenericTTS requires url to be a valid absolute URL",
        );
    });

    test("rejects invalid managed and BYOK TTS shapes at runtime", () => {
        expect(() => new GradiumTTS({ apiKey: "" })).toThrow("GradiumTTS requires apiKey");
        expect(() => new MistralTTS({ apiKey: "" })).toThrow("MistralTTS requires apiKey");
        expect(() => new OpenAITTS({ voice: "alloy", model: "tts-1-hd" } as never)).toThrow(
            "OpenAITTS requires apiKey unless using the Agora-managed tts-1 model",
        );
        expect(() => new OpenAITTS({ apiKey: "openai-key", voice: "alloy", model: "tts-1-hd" } as never)).toThrow(
            "OpenAITTS requires baseUrl",
        );
        expect(() => new MiniMaxTTS({ model: "unsupported-model" } as never)).toThrow(
            "MiniMaxTTS requires key unless using a supported Agora-managed model",
        );
        expect(
            () =>
                new MiniMaxTTS({
                    key: "minimax-key",
                    groupId: "group",
                    model: "speech-02-turbo",
                    voiceId: "voice",
                } as never),
        ).toThrow("MiniMaxTTS requires url");
        expect(
            () =>
                new RimeTTS({
                    credentialMode: CredentialMode.Managed,
                    baseUrl: "wss://users.rime.ai/ws",
                } as never),
        ).toThrow("RimeTTS requires modelId");
        expect(() => new RimeTTS({ credentialMode: CredentialMode.Managed, modelId: "mist" } as never)).toThrow(
            "RimeTTS requires baseUrl",
        );
        expect(() => new RimeTTS({ key: "rime-key", speaker: "speaker" } as never)).toThrow("RimeTTS requires modelId");
        expect(() => new RimeTTS({ modelId: "mist" } as never)).toThrow("RimeTTS requires key");
        expect(() => new RimeTTS({ key: "rime-key", modelId: "mist" } as never)).toThrow("RimeTTS requires speaker");
    });

    test("serializes Rime credential modes", () => {
        const managedMode: CredentialModeType = CredentialMode.Managed;

        expect(
            new RimeTTS({
                credentialMode: managedMode,
                modelId: "mist",
                baseUrl: "wss://users.rime.ai/ws",
            }).toConfig(),
        ).toEqual({
            vendor: "rime",
            credential_mode: "managed",
            params: { modelId: "mist", base_url: "wss://users.rime.ai/ws" },
        });

        expect(
            new RimeTTS({
                credentialMode: CredentialMode.Byok,
                key: "rime-key",
                speaker: "speaker",
                modelId: "mist",
            }).toConfig(),
        ).toEqual({
            vendor: "rime",
            credential_mode: "byok",
            params: { api_key: "rime-key", speaker: "speaker", modelId: "mist" },
        });
    });

    test("serializes Smallest AI provider params", () => {
        expect(
            new SmallestAITTS({
                apiKey: "smallest-key",
                model: "lightning-v2",
                voiceId: "emily",
                sampleRate: 24000,
                speed: 1.1,
                language: "en",
                mathNotation: true,
                pronunciationDicts: ["products"],
                skipPatterns: [1, 2],
            }).toConfig(),
        ).toEqual({
            vendor: "smallestai",
            params: {
                api_key: "smallest-key",
                model: "lightning-v2",
                voice_id: "emily",
                sample_rate: 24000,
                speed: 1.1,
                language: "en",
                math_notation: true,
                pronunciation_dicts: ["products"],
            },
            skip_patterns: [1, 2],
        });
        expect(() => new SmallestAITTS({ apiKey: "" })).toThrow("SmallestAITTS requires apiKey");
    });
});
