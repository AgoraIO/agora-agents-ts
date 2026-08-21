import { describe, expect, test, vi } from "vitest";
import { AgoraClient } from "../../../src/AgoraPoolClient.js";
import { Agent } from "../../../src/agentkit/Agent.js";
import { AudioScenario } from "../../../src/agentkit/constants.js";
import { AnamAvatar } from "../../../src/agentkit/vendors/avatar.js";
import { SpatiusAvatar } from "../../../src/agentkit/vendors/cn.js";
import {
    AmazonBedrock,
    Anthropic,
    AzureOpenAI,
    CustomLLM,
    Dify,
    Gemini,
    Groq,
    OpenAI,
    VertexAILLM,
} from "../../../src/agentkit/vendors/llm.js";
import {
    AzureOpenAIRealtime,
    GeminiLive,
    OpenAIRealtime,
    QwenOmni,
    VertexAI,
    XaiGrok,
} from "../../../src/agentkit/vendors/mllm.js";
import {
    AmazonSTT,
    AresSTT,
    AssemblyAISTT,
    DeepgramSTT,
    GoogleSTT,
    MicrosoftSTT,
    OpenAISTT,
    SarvamSTT,
    SpeechmaticsSTT,
    XAiSTT,
} from "../../../src/agentkit/vendors/stt.js";
import {
    AmazonTTS,
    CartesiaTTS,
    DeepgramTTS,
    ElevenLabsTTS,
    FishAudioTTS,
    GenericTTS,
    GoogleTTS,
    HumeAITTS,
    MicrosoftTTS,
    MiniMaxTTS,
    MurfTTS,
    OpenAITTS,
    RimeTTS,
    SarvamTTS,
    TypecastTTS,
    XAiTTS,
} from "../../../src/agentkit/vendors/tts.js";
import type * as Agora from "../../../src/api/index.js";
import { Area } from "../../../src/core/domain/index.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TEST_AGENT_CLIENT = new AgoraClient({
    area: Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate-01234567890",
});

function createClient() {
    const start = vi.fn(async (_request: Agora.StartAgentsRequest) => ({
        agent_id: "agent-id",
        create_ts: 1737111452,
        status: "RUNNING" as const,
    }));

    const client = {
        appId: "appid",
        agents: { start },
    } as unknown as AgoraClient & { readonly appId: string };

    return { client, start };
}

const STUB_LLM = new OpenAI({
    apiKey: "stub-llm-key",
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
});

const STUB_TTS = new ElevenLabsTTS({
    key: "stub-tts-key",
    voiceId: "stub-voice",
    modelId: "eleven_flash_v2_5",
    baseUrl: "wss://api.elevenlabs.io/v1",
});

const STUB_STT = new DeepgramSTT({ apiKey: "stub-asr-key", language: "en" });

const SESSION_OPTS = {
    channel: "channel",
    token: "test-token",
    agentUid: "1",
    remoteUids: ["100"],
} as const;

const ALLOW_ALL: { allowMissingVendorCategories: ReadonlySet<"asr" | "llm" | "tts"> } = {
    allowMissingVendorCategories: new Set(["asr", "llm", "tts"]),
};

// ---------------------------------------------------------------------------
// Scenario 1 — BYOK pipeline: full properties shape via toProperties
// ---------------------------------------------------------------------------

describe("Scenario 1 — BYOK pipeline properties shape", () => {
    test("OpenAI LLM + Deepgram BYOK STT + ElevenLabs TTS produces correct properties", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new DeepgramSTT({ apiKey: "dg-key", model: "nova-2", language: "en-US" }))
            .withLlm(
                new OpenAI({
                    apiKey: "openai-key",
                    url: "https://api.openai.com/v1/chat/completions",
                    model: "gpt-4o",
                }),
            )
            .withTts(
                new ElevenLabsTTS({
                    key: "el-key",
                    voiceId: "voice-id",
                    modelId: "eleven_flash_v2_5",
                    baseUrl: "wss://api.elevenlabs.io/v1",
                }),
            );

        const properties = agent.toProperties({
            channel: "channel",
            token: "test-token",
            agentUid: "1",
            remoteUids: ["100"],
        });

        // Normalize to strip undefined keys for deep equality
        const normalized = JSON.parse(JSON.stringify(properties)) as typeof properties;

        expect(normalized.asr?.vendor).toBe("deepgram");
        expect(normalized.asr?.params).toMatchObject({
            key: "dg-key",
            model: "nova-2",
            language: "en-US",
        });

        expect(normalized.llm?.api_key).toBe("openai-key");
        expect(normalized.llm?.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(normalized.llm?.style).toBe("openai");
        expect(normalized.llm?.params?.model).toBe("gpt-4o");

        expect(normalized.tts?.vendor).toBe("elevenlabs");
        expect(normalized.tts?.params?.key).toBe("el-key");
        expect((normalized.tts?.params as Record<string, unknown>)?.voice_id).toBe("voice-id");
        expect((normalized.tts?.params as Record<string, unknown>)?.model_id).toBe("eleven_flash_v2_5");
        expect((normalized.tts?.params as Record<string, unknown>)?.base_url).toBe("wss://api.elevenlabs.io/v1");
    });
});

describe("Session parameters defaults", () => {
    test("toProperties defaults audio_scenario to default when omitted", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .toProperties({ ...SESSION_OPTS });

        expect(properties.parameters?.audio_scenario).toBe(AudioScenario.Default);
    });

    test("toProperties preserves explicit audio_scenario", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .withAudioScenario(AudioScenario.Aiserver)
            .toProperties({ ...SESSION_OPTS });

        expect(properties.parameters?.audio_scenario).toBe(AudioScenario.Aiserver);
    });
});

describe("New OpenAPI high-level adapters", () => {
    test("XAiSTT serializes vendor-specific params into asr", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(
                new XAiSTT({
                    apiKey: "xai-asr-key",
                    language: "en-US",
                    baseUrl: "wss://api.x.ai/v1/stt",
                    sampleRate: 16000,
                }),
            )
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .toProperties({ ...SESSION_OPTS });

        expect(properties.asr).toMatchObject({
            vendor: "xai",
            params: {
                api_key: "xai-asr-key",
                base_url: "wss://api.x.ai/v1/stt",
                sample_rate: 16000,
                language: "en-US",
            },
        });
    });

    test("GenericTTS serializes url and headers at the top level", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(
                new GenericTTS({
                    url: "https://tts.example.com/v1/audio/speech",
                    headers: { Authorization: "Bearer tts-token" },
                    apiKey: "generic-tts-key",
                    model: "gpt-4o-mini-tts",
                    voice: "alloy",
                    responseFormat: "pcm",
                    sampleRate: 16000,
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(properties.tts).toMatchObject({
            vendor: "generic_http",
            url: "https://tts.example.com/v1/audio/speech",
            headers: { Authorization: "Bearer tts-token" },
            params: {
                api_key: "generic-tts-key",
                model: "gpt-4o-mini-tts",
                voice: "alloy",
                response_format: "pcm",
                sample_rate: 16000,
            },
        });
    });

    test("XAiTTS serializes vendor-specific params into tts", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(
                new XAiTTS({
                    apiKey: "xai-tts-key",
                    language: "en-US",
                    voiceId: "voice-1",
                    sampleRate: 24000,
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(properties.tts).toMatchObject({
            vendor: "xai",
            params: {
                api_key: "xai-tts-key",
                language: "en-US",
                voice_id: "voice-1",
                sample_rate: 24000,
            },
        });
    });

    test("SpatiusAvatar gets agora_token auto-generated at session start", async () => {
        const { client, start } = createClient();
        const typedClient = Object.assign(client, {
            appId: "a".repeat(32),
            appCertificate: "b".repeat(32),
        }) as AgoraClient;

        const agent = new Agent({ client: typedClient })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .withAvatar(
                new SpatiusAvatar({
                    spatiusApiKey: "spatius-key",
                    spatiusAppId: "spatius-app",
                    spatiusAvatarId: "avatar-id",
                    agoraUid: "200",
                    sampleRate: 24000,
                }),
            );

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.properties.avatar).toMatchObject({
            vendor: "spatius",
            params: {
                spatius_api_key: "spatius-key",
                spatius_app_id: "spatius-app",
                spatius_avatar_id: "avatar-id",
                agora_uid: "200",
                sample_rate: 24000,
            },
        });
        expect((request.properties.avatar?.params as Record<string, unknown>)?.agora_token).toEqual(expect.any(String));
    });

    test("AnamAvatar serializes avatar_id", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .withAvatar(
                new AnamAvatar({
                    apiKey: "anam-key",
                    avatarId: "avatar-id",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(properties.avatar).toMatchObject({
            vendor: "anam",
            params: {
                api_key: "anam-key",
                avatar_id: "avatar-id",
            },
        });
        expect((properties.avatar?.params as Record<string, unknown>)?.persona_id).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Preset-backed pipeline: full start request
// ---------------------------------------------------------------------------

describe("Scenario 2 — Preset-backed pipeline (managed models)", () => {
    test("Deepgram nova-3 + gpt-4o-mini + OpenAI TTS-1 infers preset and strips keys", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new OpenAITTS({ voice: "alloy" }));

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toBe("deepgram_nova_3,openai_gpt_4o_mini,openai_tts_1");

        // ASR: model key stripped in preset mode; language kept in params
        expect(request.properties.asr?.params).toEqual({ language: "en-US" });

        // LLM: api_key and url stripped in preset mode; params.model stripped
        expect(request.properties.llm?.api_key).toBeUndefined();
        expect(request.properties.llm?.url).toBeUndefined();
        expect(request.properties.llm?.params?.model).toBeUndefined();

        // TTS: vendor still present
        expect(request.properties.tts?.vendor).toBe("openai");
        // voice kept, api_key stripped
        expect((request.properties.tts?.params as Record<string, unknown>)?.voice).toBe("alloy");
        expect((request.properties.tts?.params as Record<string, unknown>)?.api_key).toBeUndefined();
    });

    test("Deepgram nova-2 managed model infers correct preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-2", language: "en-US" }))
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new OpenAITTS({ voice: "alloy" }));

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toBe("deepgram_nova_2,openai_gpt_4o_mini,openai_tts_1");
    });
});

// ---------------------------------------------------------------------------
// Scenario 3 — LLM config vendor greeting wins over agent-level greeting
// ---------------------------------------------------------------------------

describe("Scenario 3 — LLM vendor greeting wins over agent-level greeting", () => {
    test("LLM greetingMessage takes precedence over agent-level greeting", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT, greeting: "agent-level greeting" }).withLlm(
            new OpenAI({
                apiKey: "openai-key",
                url: "https://api.openai.com/v1/chat/completions",
                model: "gpt-4o",
                greetingMessage: "vendor greeting",
            }),
        );

        const properties = agent.toProperties({
            ...SESSION_OPTS,
            ...ALLOW_ALL,
        });

        // Vendor greeting wins — agent-level should not override
        expect(properties.llm?.greeting_message).toBe("vendor greeting");
    });

    test("agent-level greeting fills in when LLM has no greetingMessage", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT, greeting: "agent greeting" }).withLlm(
            new OpenAI({
                apiKey: "openai-key",
                url: "https://api.openai.com/v1/chat/completions",
                model: "gpt-4o",
            }),
        );

        const properties = agent.toProperties({
            ...SESSION_OPTS,
            ...ALLOW_ALL,
        });

        expect(properties.llm?.greeting_message).toBe("agent greeting");
    });
});

// ---------------------------------------------------------------------------
// Scenario 4 — VertexAI URL construction
// ---------------------------------------------------------------------------

describe("Scenario 4 — VertexAILLM URL construction", () => {
    test("VertexAILLM builds correct URL from projectId and location", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT }).withLlm(
            new VertexAILLM({
                apiKey: "vertex-key",
                model: "gemini-pro",
                projectId: "my-project",
                location: "us-central1",
            }),
        );

        const properties = agent.toProperties({
            ...SESSION_OPTS,
            ...ALLOW_ALL,
        });

        const expectedUrl =
            "https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1/publishers/google/models/gemini-pro:streamGenerateContent?alt=sse";
        expect(properties.llm?.url).toBe(expectedUrl);
        expect(properties.llm?.style).toBe("gemini");
        expect(properties.llm?.params?.model).toBe("gemini-pro");
        expect((properties.llm?.params as Record<string, unknown>)?.project_id).toBeUndefined();
        expect((properties.llm?.params as Record<string, unknown>)?.location).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Scenario 5 — OpenAISTT variants
// ---------------------------------------------------------------------------

describe("Scenario 5 — OpenAISTT parameter shape", () => {
    const llmAndTtsAllowed = { allowMissingVendorCategories: new Set(["llm", "tts"]) } as const;

    test("5a: OpenAISTT with all fields serializes correctly", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT }).withStt(
            new OpenAISTT({
                apiKey: "openai-stt-key",
                model: "gpt-4o-mini-transcribe",
                language: "en",
                prompt: "Transcribe English speech",
            }),
        );

        const properties = agent.toProperties({
            ...SESSION_OPTS,
            ...llmAndTtsAllowed,
        });

        expect(properties.asr?.vendor).toBe("openai");
        expect((properties.asr?.params as Record<string, unknown>)?.api_key).toBe("openai-stt-key");
        expect(
            ((properties.asr?.params as Record<string, unknown>)?.input_audio_transcription as Record<string, unknown>)
                ?.model,
        ).toBe("gpt-4o-mini-transcribe");
        expect(
            ((properties.asr?.params as Record<string, unknown>)?.input_audio_transcription as Record<string, unknown>)
                ?.language,
        ).toBe("en");
        expect(
            ((properties.asr?.params as Record<string, unknown>)?.input_audio_transcription as Record<string, unknown>)
                ?.prompt,
        ).toBe("Transcribe English speech");
    });

    test("5b: OpenAISTT missing prompt throws error", () => {
        expect(() =>
            new OpenAISTT({
                apiKey: "openai-stt-key",
                model: "gpt-4o-mini-transcribe",
                language: "en",
            }).toConfig(),
        ).toThrow("OpenAISTT: inputAudioTranscription.prompt is required");
    });

    test("5c: OpenAISTT missing language throws error", () => {
        expect(() =>
            new OpenAISTT({
                apiKey: "openai-stt-key",
                model: "gpt-4o-mini-transcribe",
                prompt: "Transcribe speech",
            }).toConfig(),
        ).toThrow("OpenAISTT: inputAudioTranscription.language is required");
    });

    test("5d: OpenAISTT uses default model when none given", () => {
        const config = new OpenAISTT({
            apiKey: "openai-stt-key",
            language: "en",
            prompt: "Transcribe speech",
        }).toConfig();

        expect(
            (config.params as Record<string, unknown>)?.input_audio_transcription as Record<string, unknown>,
        ).toMatchObject({ model: "gpt-4o-mini-transcribe" });
    });
});

// ---------------------------------------------------------------------------
// Scenario 6 — Mixed preset + BYOK
// ---------------------------------------------------------------------------

describe("Scenario 6 — Mixed preset + BYOK", () => {
    test("6a: Deepgram BYOK with nova-2 model + managed LLM + managed TTS — deepgram preset is NOT inferred (BYOK key field present)", async () => {
        // inferAsrPreset checks `asr.params?.key`; when set, BYOK is detected and no preset is inferred.
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ apiKey: "byok-dg-key", model: "nova-2", language: "en-US" }))
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new OpenAITTS({ voice: "alloy" }));

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        // No ASR preset inferred — BYOK key is present
        expect(request.preset).toBe("openai_gpt_4o_mini,openai_tts_1");

        // All ASR params retained (nothing stripped for BYOK path)
        expect(request.properties.asr?.vendor).toBe("deepgram");
        expect(request.properties.asr?.params?.key).toBe("byok-dg-key");
        expect(request.properties.asr?.params?.model).toBe("nova-2");
        expect(request.properties.asr?.params?.language).toBe("en-US");
    });

    test("6b: managed STT + BYOK LLM + managed TTS — preset covers STT and TTS only", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
            .withLlm(
                new OpenAI({
                    apiKey: "byok-llm-key",
                    url: "https://api.openai.com/v1/chat/completions",
                    model: "gpt-4o",
                }),
            )
            .withTts(new OpenAITTS({ voice: "nova" }));

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        // BYOK LLM (has api_key) => no LLM preset; managed STT and TTS
        expect(request.preset).toBe("deepgram_nova_3,openai_tts_1");

        // LLM should carry BYOK key
        expect(request.properties.llm?.api_key).toBe("byok-llm-key");
        expect(request.properties.llm?.params?.model).toBe("gpt-4o");
    });
});

// ---------------------------------------------------------------------------
// Scenario 7 — Pipeline ID (7b and 7c only; 7a is in pipeline-id.test.ts)
// ---------------------------------------------------------------------------

describe("Scenario 7 — Pipeline ID supplementary", () => {
    test("7b: session-level pipelineId takes precedence over agent-level", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client, pipelineId: "agent-pipeline-id" });

        const session = agent.createSession({
            ...SESSION_OPTS,
            pipelineId: "session-pipeline-id",
        });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.pipeline_id).toBe("session-pipeline-id");
    });

    test("7c: pipeline_id is not sent inside properties when set at session level", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client });

        const session = agent.createSession({
            ...SESSION_OPTS,
            pipelineId: "studio-id",
        });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.pipeline_id).toBe("studio-id");
        expect(request.properties).not.toHaveProperty("pipeline_id");
    });
});

// ---------------------------------------------------------------------------
// Scenario 8 — MLLM mode
// ---------------------------------------------------------------------------

describe("Scenario 8 — MLLM mode", () => {
    test("8a: OpenAIRealtime produces mllm.enable=true and correct shape", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client }).withMllm(
            new OpenAIRealtime({
                apiKey: "openai-rt-key",
                model: "gpt-4o-realtime-preview",
                voice: "alloy",
                greetingMessage: "Hello!",
            }),
        );

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.properties.mllm?.vendor).toBe("openai");
        expect(request.properties.mllm?.enable).toBe(true);
        expect((request.properties.mllm as Record<string, unknown>)?.api_key).toBe("openai-rt-key");
        expect((request.properties.mllm as Record<string, unknown>)?.url).toBe("wss://api.openai.com/v1/realtime");
        expect((request.properties.mllm as Record<string, unknown>)?.params).toMatchObject({
            model: "gpt-4o-realtime-preview",
            voice: "alloy",
        });
        expect((request.properties.mllm as Record<string, unknown>)?.greeting_message).toBe("Hello!");
    });

    test("8b: GeminiLive toProperties has correct vendor and params", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT }).withMllm(
            new GeminiLive({
                apiKey: "gemini-key",
                model: "gemini-live-2.5-flash",
                voice: "Aoede",
                instructions: "Be helpful",
            }),
        );

        const properties = agent.toProperties({ ...SESSION_OPTS });
        expect(properties.mllm?.vendor).toBe("gemini");
        expect(properties.mllm?.enable).toBe(true);
        expect((properties.mllm as Record<string, unknown>)?.api_key).toBe("gemini-key");
        expect((properties.mllm as Record<string, unknown>)?.url).toBe("");
        expect((properties.mllm as Record<string, unknown>)?.params).toMatchObject({
            model: "gemini-live-2.5-flash",
            voice: "Aoede",
            instructions: "Be helpful",
        });
    });

    test("8c: VertexAI MLLM toProperties places project_id, location, adc_credentials_string in params", () => {
        const agent = new Agent({ client: TEST_AGENT_CLIENT }).withMllm(
            new VertexAI({
                model: "gemini-live-2.5-flash-preview-native-audio-09-2025",
                projectId: "my-project",
                location: "us-central1",
                adcCredentialsString: '{"type":"service_account"}',
                voice: "Aoede",
            }),
        );

        const properties = agent.toProperties({ ...SESSION_OPTS });
        expect(properties.mllm?.vendor).toBe("vertexai");
        expect(properties.mllm?.enable).toBe(true);
        expect((properties.mllm as Record<string, unknown>)?.url).toBe("");
        expect((properties.mllm as Record<string, unknown>)?.params).toMatchObject({
            model: "gemini-live-2.5-flash-preview-native-audio-09-2025",
            project_id: "my-project",
            location: "us-central1",
            adc_credentials_string: '{"type":"service_account"}',
            voice: "Aoede",
        });
    });
});

// ---------------------------------------------------------------------------
// BYOK Vendor Coverage Matrix — ASR
// ---------------------------------------------------------------------------

describe("ASR vendor coverage", () => {
    test("DeepgramSTT BYOK serializes key and model in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new DeepgramSTT({ apiKey: "dg-key", model: "nova-2", language: "en-US" }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("deepgram");
        expect(p.asr?.params?.key).toBe("dg-key");
        expect(p.asr?.params?.model).toBe("nova-2");
        expect(p.asr?.params?.language).toBe("en-US");
    });

    test("DeepgramSTT apiKey → wire key; keyterm passes through unchanged", () => {
        // apiKey is renamed to "key" in the wire; keyterm stays as "keyterm"
        const config = new DeepgramSTT({
            apiKey: "dg-key",
            model: "nova-3",
            language: "en",
            keyterm: "term",
        }).toConfig();
        expect((config.params as Record<string, unknown>)?.key).toBe("dg-key");
        expect((config.params as Record<string, unknown>)?.model).toBe("nova-3");
        expect((config.params as Record<string, unknown>)?.language).toBe("en");
        expect((config.params as Record<string, unknown>)?.keyterm).toBe("term");
    });

    test("MicrosoftSTT serializes key, region, language in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new MicrosoftSTT({ key: "ms-key", region: "eastus", language: "en-US" }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("microsoft");
        expect(p.asr?.params?.key).toBe("ms-key");
        expect((p.asr?.params as Record<string, unknown>)?.region).toBe("eastus");
    });

    test("GoogleSTT serializes project_id, location, adc_credentials_string, language, model", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(
                new GoogleSTT({
                    projectId: "proj",
                    location: "global",
                    adcCredentialsString: "{}",
                    language: "en-US",
                    model: "long",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("google");
        expect((p.asr?.params as Record<string, unknown>)?.project_id).toBe("proj");
        expect((p.asr?.params as Record<string, unknown>)?.location).toBe("global");
        expect((p.asr?.params as Record<string, unknown>)?.adc_credentials_string).toBe("{}");
        expect((p.asr?.params as Record<string, unknown>)?.language).toBe("en-US");
        expect((p.asr?.params as Record<string, unknown>)?.model).toBe("long");
    });

    test("AmazonSTT serializes access_key_id, secret_access_key, region, language_code", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(
                new AmazonSTT({
                    accessKey: "access",
                    secretKey: "secret",
                    region: "us-east-1",
                    language: "en-US",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("amazon");
        expect((p.asr?.params as Record<string, unknown>)?.access_key_id).toBe("access");
        expect((p.asr?.params as Record<string, unknown>)?.secret_access_key).toBe("secret");
        expect((p.asr?.params as Record<string, unknown>)?.region).toBe("us-east-1");
        expect((p.asr?.params as Record<string, unknown>)?.language_code).toBe("en-US");
    });

    test("AssemblyAISTT serializes api_key and language in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new AssemblyAISTT({ apiKey: "assembly-key", language: "en-US" }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("assemblyai");
        expect((p.asr?.params as Record<string, unknown>)?.api_key).toBe("assembly-key");
        expect((p.asr?.params as Record<string, unknown>)?.language).toBe("en-US");
    });

    test("AresSTT produces no params key", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new AresSTT())
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("ares");
        expect(p.asr?.params).toBeUndefined();
    });

    test("AresSTT serializes keywords with passthrough params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new AresSTT({ keywords: ["Agora", "Shengwang"], additionalParams: { custom: true } }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.params).toMatchObject({
            custom: true,
            keywords: ["Agora", "Shengwang"],
        });
    });

    test("SpeechmaticsSTT serializes api_key and language in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new SpeechmaticsSTT({ apiKey: "sm-key", language: "en" }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("speechmatics");
        expect((p.asr?.params as Record<string, unknown>)?.api_key).toBe("sm-key");
        expect((p.asr?.params as Record<string, unknown>)?.language).toBe("en");
    });

    test("SarvamSTT serializes api_key in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withStt(new SarvamSTT({ apiKey: "sarvam-key", language: "en" }))
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.asr?.vendor).toBe("sarvam");
        expect((p.asr?.params as Record<string, unknown>)?.api_key).toBe("sarvam-key");
    });

    test("ASR defaults to ares outside CN when no STT is set", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS)
            .toProperties({ ...SESSION_OPTS });

        expect(p.asr).toEqual({ vendor: "ares", language: "en-US" });
    });

    test("session start sends fengming by default for CN clients when no STT is set", async () => {
        const { client, start } = createClient();
        const cnClient = Object.assign(client, {
            area: Area.CN,
        }) as AgoraClient;

        const agent = new Agent({ client: cnClient, turnDetection: { language: "zh-CN" } })
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS);

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.properties.asr).toEqual({ vendor: "fengming", language: "zh-CN" });
    });
});

// ---------------------------------------------------------------------------
// BYOK Vendor Coverage Matrix — LLM
// ---------------------------------------------------------------------------

describe("LLM vendor coverage", () => {
    test("OpenAI BYOK serializes api_key, url, style=openai, model in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new OpenAI({
                    apiKey: "openai-key",
                    url: "https://api.openai.com/v1/chat/completions",
                    model: "gpt-4o",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("openai-key");
        expect(p.llm?.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(p.llm?.style).toBe("openai");
        expect(p.llm?.params?.model).toBe("gpt-4o");
    });

    test("AzureOpenAI serializes api_key, url constructed from resourceName, style=openai", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new AzureOpenAI({
                    apiKey: "azure-key",
                    model: "gpt-4",
                    resourceName: "my-resource",
                    deploymentName: "gpt-4-deploy",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("azure-key");
        expect(p.llm?.url).toContain("my-resource.openai.azure.com");
        expect(p.llm?.url).toContain("gpt-4-deploy");
        expect(p.llm?.style).toBe("openai");
        expect((p.llm as Record<string, unknown>)?.vendor).toBe("azure");
    });

    test("Anthropic serializes api_key, url, style=anthropic, max_tokens, anthropic-version header", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new Anthropic({
                    apiKey: "anthropic-key",
                    model: "claude-3-5-sonnet-20241022",
                    url: "https://api.anthropic.com/v1/messages",
                    headers: { "anthropic-version": "2023-06-01" },
                    maxTokens: 1024,
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("anthropic-key");
        expect(p.llm?.url).toBe("https://api.anthropic.com/v1/messages");
        expect(p.llm?.style).toBe("anthropic");
        expect(p.llm?.params?.model).toBe("claude-3-5-sonnet-20241022");
        expect((p.llm?.params as Record<string, unknown>)?.max_tokens).toBe(1024);
        expect((p.llm?.headers as Record<string, string>)?.["anthropic-version"]).toBe("2023-06-01");
    });

    test("Gemini serializes full url, style=gemini, and model in params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new Gemini({
                    apiKey: "gemini-key",
                    model: "gemini-pro",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBeUndefined();
        expect(p.llm?.url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent?alt=sse&key=gemini-key",
        );
        expect(p.llm?.style).toBe("gemini");
        expect(p.llm?.params?.model).toBe("gemini-pro");
    });

    test("Groq serializes api_key, url, style=openai", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new Groq({
                    apiKey: "groq-key",
                    model: "llama3-8b-8192",
                    url: "https://api.groq.com/openai/v1/chat/completions",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("groq-key");
        expect(p.llm?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
        expect(p.llm?.style).toBe("openai");
        expect(p.llm?.params?.model).toBe("llama3-8b-8192");
    });

    test("CustomLLM serializes api_key, url, style=openai, vendor=custom", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new CustomLLM({
                    apiKey: "custom-key",
                    model: "custom-model",
                    url: "https://custom.api/v1/chat",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("custom-key");
        expect(p.llm?.style).toBe("openai");
        expect((p.llm as Record<string, unknown>)?.vendor).toBe("custom");
    });

    test("VertexAILLM serializes style=gemini and constructed URL", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new VertexAILLM({
                    apiKey: "vertex-key",
                    model: "gemini-pro",
                    projectId: "proj",
                    location: "us-central1",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.style).toBe("gemini");
        expect(p.llm?.url).toContain("us-central1-aiplatform.googleapis.com");
        expect(p.llm?.url).toContain("proj");
        expect(p.llm?.url).toContain("gemini-pro");
    });

    test("AmazonBedrock serializes style=bedrock and correct URL", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new AmazonBedrock({
                    accessKey: "access",
                    secretKey: "secret",
                    region: "us-east-1",
                    model: "anthropic.claude-3-sonnet-20240229-v1:0",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.style).toBe("bedrock");
        expect(p.llm?.url).toContain("us-east-1");
        expect(p.llm?.url).toContain("anthropic.claude-3-sonnet-20240229-v1:0");
        expect((p.llm as Record<string, unknown>)?.access_key).toBe("access");
        expect((p.llm as Record<string, unknown>)?.secret_key).toBe("secret");
    });

    test("Dify serializes api_key, url, style=dify", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(
                new Dify({
                    apiKey: "dify-key",
                    url: "https://api.dify.ai/v1",
                    model: "gpt-4o",
                }),
            )
            .toProperties({ ...SESSION_OPTS, ...ALLOW_ALL });

        expect(p.llm?.api_key).toBe("dify-key");
        expect(p.llm?.url).toBe("https://api.dify.ai/v1");
        expect(p.llm?.style).toBe("dify");
    });
});

// ---------------------------------------------------------------------------
// BYOK Vendor Coverage Matrix — TTS
// ---------------------------------------------------------------------------

describe("TTS vendor coverage", () => {
    test("ElevenLabsTTS serializes key, model_id, voice_id, base_url", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new ElevenLabsTTS({
                    key: "el-key",
                    voiceId: "voice-abc",
                    modelId: "eleven_flash_v2_5",
                    baseUrl: "wss://api.elevenlabs.io/v1",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("elevenlabs");
        expect(p.tts?.params?.key).toBe("el-key");
        expect((p.tts?.params as Record<string, unknown>)?.voice_id).toBe("voice-abc");
        expect((p.tts?.params as Record<string, unknown>)?.model_id).toBe("eleven_flash_v2_5");
        expect((p.tts?.params as Record<string, unknown>)?.base_url).toBe("wss://api.elevenlabs.io/v1");
    });

    test("MicrosoftTTS serializes key, region, voice_name", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new MicrosoftTTS({
                    key: "ms-key",
                    region: "eastus",
                    voiceName: "en-US-JennyNeural",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("microsoft");
        expect(p.tts?.params?.key).toBe("ms-key");
        expect((p.tts?.params as Record<string, unknown>)?.region).toBe("eastus");
        expect((p.tts?.params as Record<string, unknown>)?.voice_name).toBe("en-US-JennyNeural");
    });

    test("OpenAITTS BYOK serializes api_key, model, voice, base_url", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new OpenAITTS({
                    apiKey: "openai-tts-key",
                    model: "tts-1-hd",
                    voice: "nova",
                    baseUrl: "https://api.openai.com/v1",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("openai");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("openai-tts-key");
        expect((p.tts?.params as Record<string, unknown>)?.model).toBe("tts-1-hd");
        expect((p.tts?.params as Record<string, unknown>)?.voice).toBe("nova");
        expect((p.tts?.params as Record<string, unknown>)?.base_url).toBe("https://api.openai.com/v1");
    });

    test("CartesiaTTS serializes api_key and voice object", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new CartesiaTTS({
                    apiKey: "cartesia-key",
                    voiceId: "voice-xyz",
                    modelId: "sonic-english",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("cartesia");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("cartesia-key");
        expect((p.tts?.params as Record<string, unknown>)?.voice).toEqual({ mode: "id", id: "voice-xyz" });
    });

    test("GoogleTTS serializes credentials and VoiceSelectionParams", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new GoogleTTS({
                    key: "google-tts-key",
                    voiceName: "en-US-Wavenet-D",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("google");
        expect((p.tts?.params as Record<string, unknown>)?.credentials).toBe("google-tts-key");
        expect(
            ((p.tts?.params as Record<string, unknown>)?.VoiceSelectionParams as Record<string, unknown>)?.name,
        ).toBe("en-US-Wavenet-D");
    });

    test("AmazonTTS serializes aws_access_key_id, aws_secret_access_key, region_name, voice", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new AmazonTTS({
                    accessKey: "aws-access",
                    secretKey: "aws-secret",
                    region: "us-east-1",
                    voiceId: "Joanna",
                    engine: "neural",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("amazon");
        expect((p.tts?.params as Record<string, unknown>)?.aws_access_key_id).toBe("aws-access");
        expect((p.tts?.params as Record<string, unknown>)?.aws_secret_access_key).toBe("aws-secret");
        expect((p.tts?.params as Record<string, unknown>)?.region_name).toBe("us-east-1");
        expect((p.tts?.params as Record<string, unknown>)?.voice).toBe("Joanna");
    });

    test("DeepgramTTS serializes api_key and model", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new DeepgramTTS({
                    apiKey: "dg-tts-key",
                    model: "aura-2-thalia-en",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("deepgram");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("dg-tts-key");
        expect((p.tts?.params as Record<string, unknown>)?.model).toBe("aura-2-thalia-en");
    });

    test("HumeAITTS serializes key, voice_id, provider", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new HumeAITTS({
                    key: "hume-key",
                    voiceId: "hume-voice-id",
                    provider: "HUME_AI",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("humeai");
        expect(p.tts?.params?.key).toBe("hume-key");
        expect((p.tts?.params as Record<string, unknown>)?.voice_id).toBe("hume-voice-id");
        expect((p.tts?.params as Record<string, unknown>)?.provider).toBe("HUME_AI");
    });

    test("RimeTTS serializes api_key, speaker, modelId", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new RimeTTS({
                    key: "rime-key",
                    speaker: "speaker-id",
                    modelId: "mist",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("rime");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("rime-key");
        expect((p.tts?.params as Record<string, unknown>)?.speaker).toBe("speaker-id");
        expect((p.tts?.params as Record<string, unknown>)?.modelId).toBe("mist");
    });

    test("FishAudioTTS serializes api_key, reference_id, backend", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new FishAudioTTS({
                    key: "fish-key",
                    referenceId: "ref-id",
                    backend: "speech-1.5",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("fishaudio");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("fish-key");
        expect((p.tts?.params as Record<string, unknown>)?.reference_id).toBe("ref-id");
        expect((p.tts?.params as Record<string, unknown>)?.backend).toBe("speech-1.5");
    });

    test("MiniMaxTTS BYOK serializes key, group_id, model, url, voice_setting", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new MiniMaxTTS({
                    key: "mm-key",
                    groupId: "mm-group",
                    model: "speech-02-turbo",
                    voiceId: "English_captivating_female1",
                    url: "wss://api-uw.minimax.io/ws/v1/t2a_v2",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("minimax");
        expect(p.tts?.params?.key).toBe("mm-key");
        expect((p.tts?.params as Record<string, unknown>)?.group_id).toBe("mm-group");
        expect((p.tts?.params as Record<string, unknown>)?.model).toBe("speech-02-turbo");
        expect((p.tts?.params as Record<string, unknown>)?.url).toBe("wss://api-uw.minimax.io/ws/v1/t2a_v2");
        expect((p.tts?.params as Record<string, unknown>)?.voice_setting).toEqual({
            voice_id: "English_captivating_female1",
        });
    });

    test("SarvamTTS serializes api_subscription_key, speaker, target_language_code", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new SarvamTTS({
                    key: "sarvam-tts-key",
                    speaker: "anushka",
                    targetLanguageCode: "en-IN",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("sarvam");
        expect((p.tts?.params as Record<string, unknown>)?.api_subscription_key).toBe("sarvam-tts-key");
        expect((p.tts?.params as Record<string, unknown>)?.speaker).toBe("anushka");
        expect((p.tts?.params as Record<string, unknown>)?.target_language_code).toBe("en-IN");
    });

    test("MurfTTS serializes api_key", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new MurfTTS({
                    key: "murf-key",
                    voiceId: "Ariana",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("murf");
        expect((p.tts?.params as Record<string, unknown>)?.api_key).toBe("murf-key");
    });

    test("TypecastTTS serializes generated Typecast params", () => {
        const p = new Agent({ client: TEST_AGENT_CLIENT })
            .withLlm(STUB_LLM)
            .withTts(
                new TypecastTTS({
                    apiKey: "typecast-key",
                    voiceId: "tc_60e5426de8b95f1d3000d7b5",
                    model: "ssfm-v30",
                    skipPatterns: [1, 2],
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(p.tts?.vendor).toBe("typecast");
        expect(p.tts?.params).toMatchObject({
            api_key: "typecast-key",
            voice_id: "tc_60e5426de8b95f1d3000d7b5",
            model: "ssfm-v30",
        });
        expect(p.tts?.skip_patterns).toEqual([1, 2]);
    });
});

// ---------------------------------------------------------------------------
// MLLM vendor coverage
// ---------------------------------------------------------------------------

describe("MLLM vendor coverage", () => {
    test("OpenAIRealtime toConfig has vendor=openai, api_key, and default url", () => {
        const config = new OpenAIRealtime({
            apiKey: "rt-key",
            model: "gpt-4o-realtime-preview",
            voice: "alloy",
        }).toConfig();

        expect(config.vendor).toBe("openai");
        expect((config as Record<string, unknown>)?.api_key).toBe("rt-key");
        expect((config as Record<string, unknown>)?.url).toBe("wss://api.openai.com/v1/realtime");
        expect((config as Record<string, unknown>)?.params).toMatchObject({
            model: "gpt-4o-realtime-preview",
            voice: "alloy",
        });
    });

    test("OpenAIRealtime toConfig preserves a custom url", () => {
        const config = new OpenAIRealtime({
            apiKey: "rt-key",
            url: "wss://openai.example.com/v1/realtime",
        }).toConfig();

        expect((config as Record<string, unknown>)?.url).toBe("wss://openai.example.com/v1/realtime");
    });

    test("OpenAIRealtime toConfig uses the default url for an empty string", () => {
        const config = new OpenAIRealtime({
            apiKey: "rt-key",
            url: "",
        }).toConfig();

        expect((config as Record<string, unknown>)?.url).toBe("wss://api.openai.com/v1/realtime");
    });

    test("AzureOpenAIRealtime serializes only the supported Azure fields", () => {
        const properties = new Agent({ client: TEST_AGENT_CLIENT })
            .withMllm(
                new AzureOpenAIRealtime({
                    apiKey: "APIKEY",
                    url: "AZURE_URL",
                    messages: [{ role: "user", content: "can you please count to 3 after greeting。" }],
                    params: {
                        instructions: "You are a Conversational AI Agent, developed by Agora.",
                        model: "gpt-realtime-2",
                        voice: "alloy",
                    },
                    outputModalities: ["audio"],
                    maxHistory: 20,
                    greetingMessage: "Hey There Sir",
                    turnDetection: { mode: "server_vad" },
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(properties.mllm).toEqual({
            enable: true,
            url: "AZURE_URL",
            api_key: "APIKEY",
            messages: [{ role: "user", content: "can you please count to 3 after greeting。" }],
            params: {
                instructions: "You are a Conversational AI Agent, developed by Agora.",
                model: "gpt-realtime-2",
                voice: "alloy",
            },
            output_modalities: ["audio"],
            max_history: 20,
            greeting_message: "Hey There Sir",
            vendor: "azure",
            turn_detection: { mode: "server_vad" },
        });
        const paramsWithUnsupportedField = {
            model: "params-model",
            voice: "params-voice",
            instructions: "params-instructions",
            unsupported: true,
        };
        expect(
            new AzureOpenAIRealtime({
                apiKey: "key",
                url: "wss://example.com",
                params: paramsWithUnsupportedField,
                model: "option-model",
                voice: "option-voice",
                instructions: "option-instructions",
                turnDetection: { mode: "server_vad" },
            }).toConfig().params,
        ).toEqual({ model: "option-model", voice: "option-voice", instructions: "option-instructions" });
        expect(
            new AzureOpenAIRealtime({
                apiKey: "key",
                url: "wss://example.com",
                turnDetection: { mode: "server_vad" },
            }).areaScope,
        ).toBe("global");
        expect(() => new AzureOpenAIRealtime({ apiKey: "key", url: "wss://example.com" } as never)).toThrow(
            "AzureOpenAIRealtime requires turnDetection",
        );
    });

    test("GeminiLive toConfig has vendor=gemini and api_key", () => {
        const config = new GeminiLive({
            apiKey: "gemini-key",
            model: "gemini-live-2.5-flash",
        }).toConfig();

        expect(config.vendor).toBe("gemini");
        expect((config as Record<string, unknown>)?.api_key).toBe("gemini-key");
        expect((config as Record<string, unknown>)?.url).toBe("");
        expect((config as Record<string, unknown>)?.params).toMatchObject({ model: "gemini-live-2.5-flash" });
    });

    test("VertexAI toConfig has vendor=vertexai with project_id, location, adc_credentials_string in params", () => {
        const config = new VertexAI({
            model: "gemini-live-2.5-flash-preview-native-audio-09-2025",
            projectId: "my-proj",
            location: "us-central1",
            adcCredentialsString: "{}",
        }).toConfig();

        expect(config.vendor).toBe("vertexai");
        expect((config as Record<string, unknown>)?.url).toBe("");
        expect((config.params as Record<string, unknown>)?.project_id).toBe("my-proj");
        expect((config.params as Record<string, unknown>)?.location).toBe("us-central1");
        expect((config.params as Record<string, unknown>)?.adc_credentials_string).toBe("{}");
    });

    test("XaiGrok toConfig has vendor=xai, api_key, and default url", () => {
        const config = new XaiGrok({
            apiKey: "xai-key",
            voice: "eve",
        }).toConfig();

        expect(config.vendor).toBe("xai");
        expect((config as Record<string, unknown>)?.api_key).toBe("xai-key");
        expect((config as Record<string, unknown>)?.url).toBe("wss://api.x.ai/v1/realtime");
        expect((config as Record<string, unknown>)?.params).toMatchObject({ voice: "eve" });
    });

    test("QwenOmni serializes the complete CN qwen_omni payload", () => {
        const qwenClient = new AgoraClient({
            area: Area.CN,
            appId: "test-app-id",
            appCertificate: "test-app-certificate-01234567890",
        });
        const properties = new Agent({ client: qwenClient })
            .withMllm(
                new QwenOmni({
                    apiKey: "xxxxxxxx",
                    model: "qwen3.5-omni-plus-realtime",
                    url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
                }),
            )
            .toProperties({ ...SESSION_OPTS });

        expect(properties.mllm).toEqual({
            enable: true,
            vendor: "qwen_omni",
            url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            api_key: "xxxxxxxx",
            params: {
                model: "qwen3.5-omni-plus-realtime",
            },
        });
        expect(
            new QwenOmni({
                apiKey: "key",
                model: "qwen3.5-omni-plus-realtime",
                url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
                turnDetection: { mode: "server_vad" },
            }).toConfig().turn_detection,
        ).toEqual({ mode: "server_vad" });
        expect(
            new QwenOmni({
                apiKey: "key",
                model: "qwen3.5-omni-plus-realtime",
                url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
            }).areaScope,
        ).toBe("cn");
        expect(() => new QwenOmni({ apiKey: "key", model: "qwen3.5-omni-plus-realtime" } as never)).toThrow(
            "QwenOmni requires url",
        );
    });
});

// ---------------------------------------------------------------------------
// Preset coverage matrix
// ---------------------------------------------------------------------------

describe("Preset coverage matrix", () => {
    test("gpt-4o-mini managed LLM infers openai_gpt_4o_mini preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(STUB_STT)
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(STUB_TTS);

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("openai_gpt_4o_mini");
    });

    test("openai_tts_1 managed TTS infers openai_tts_1 preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(new OpenAITTS({ voice: "alloy" }));

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("openai_tts_1");
    });

    test("MiniMax speech-2.6-turbo infers minimax_speech_2_6_turbo preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(
                new MiniMaxTTS({
                    model: "speech-2.6-turbo",
                    voiceId: "English_captivating_female1",
                }),
            );

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("minimax_speech_2_6_turbo");
    });

    test("MiniMax speech-2.8-turbo infers minimax_speech_2_8_turbo preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(
                new MiniMaxTTS({
                    model: "speech-2.8-turbo",
                    voiceId: "English_captivating_female1",
                }),
            );

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("minimax_speech_2_8_turbo");
    });

    test("explicit MiniMax preset strips _minimaxPresetModel hint from wire", async () => {
        // When the caller supplies the MiniMax TTS preset explicitly (not inferred),
        // the internal _minimaxPresetModel hint set by MiniMaxTTS must still be removed.
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(STUB_STT)
            .withLlm(STUB_LLM)
            .withTts(new MiniMaxTTS({ model: "speech-2.8-turbo", voiceId: "English_captivating_female1" }));

        const session = agent.createSession({
            ...SESSION_OPTS,
            preset: "minimax_speech_2_8_turbo",
        });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("minimax_speech_2_8_turbo");
        expect(request.properties?.tts).not.toHaveProperty("_minimaxPresetModel");
    });

    test("deepgram_nova_2 managed STT infers deepgram_nova_2 preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-2", language: "en-US" }))
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS);

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("deepgram_nova_2");
    });

    test("deepgram_nova_3 managed STT infers deepgram_nova_3 preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
            .withLlm(STUB_LLM)
            .withTts(STUB_TTS);

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        expect(request.preset).toContain("deepgram_nova_3");
    });

    test("BYOK vendors produce no preset", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client }).withStt(STUB_STT).withLlm(STUB_LLM).withTts(STUB_TTS);

        const session = agent.createSession({ ...SESSION_OPTS });
        await session.start();

        const request = start.mock.calls[0]?.[0] as Agora.StartAgentsRequest;
        // STUB_STT has apiKey so no ASR preset; STUB_LLM has apiKey so no LLM preset; STUB_TTS is ElevenLabs BYOK so no TTS preset
        expect(request.preset).toBeUndefined();
    });
});
