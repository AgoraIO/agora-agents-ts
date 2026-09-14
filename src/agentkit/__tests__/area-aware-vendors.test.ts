import { AgoraClient } from "../../AgoraPoolClient.js";
import { Area } from "../../core/domain/index.js";
import { Agent } from "../Agent.js";
import type {
    CNMllmVendor,
    CNTtsVendor,
    GlobalMllmVendor,
    GlobalSttVendor,
    GlobalTtsVendor,
} from "../region-vendors.js";
import { AliyunLLM, FengmingSTT, MiniMaxCNTTS } from "../vendors/cn.js";
import { OpenAI } from "../vendors/llm.js";
import type { AzureOpenAIRealtimeOptions, AzureOpenAIRealtimeParams, QwenOmniOptions } from "../vendors/mllm.js";
import { AzureOpenAIRealtime, QwenOmni } from "../vendors/mllm.js";
import { DeepgramSTT, GeminiSTT } from "../vendors/stt.js";
import { GenericTTS, MiniMaxTTS } from "../vendors/tts.js";

const client = new AgoraClient({
    area: Area.US,
    appId: "app-id",
    appCertificate: "app-certificate-0123456789abcdef",
});

new Agent({ client, turnDetection: { language: "en-US" } })
    .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
    .withLlm(new OpenAI({ model: "gpt-5-mini" }))
    .withTts(new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "English_captivating_female1" }))
    .createSession({
        name: "assistant",
        channel: "test-room",
        agentUid: "1",
        remoteUids: ["100"],
    });

// Area and provider may differ.
new Agent({ client }).withStt(new FengmingSTT());
new Agent({ client }).withLlm(
    new AliyunLLM({ url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-plus" }),
);
new Agent({ client }).withTts(
    new MiniMaxCNTTS({ key: "minimax-key", model: "speech-01-turbo", voiceSetting: { voice_id: "female-shaonv" } }),
);
const globalGenericTts: GlobalTtsVendor = new GenericTTS({ url: "https://tts.example.com/v1/audio/speech" });
new Agent({ client }).withTts(globalGenericTts);
const globalGeminiStt: GlobalSttVendor = new GeminiSTT({
    apiKey: "gemini-key",
    model: "gemini-3.7-transcribe-live",
    language: "en-US",
});
new Agent({ client }).withStt(globalGeminiStt);
const globalMllm: GlobalMllmVendor = new AzureOpenAIRealtime({
    apiKey: "azure-key",
    url: "wss://example.openai.azure.com/openai/realtime",
    turnDetection: { mode: "server_vad" },
});
new Agent({ client }).withMllm(globalMllm);

type Assert<T extends true> = T;
type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IsRequired<T, K extends keyof T> = Pick<T, K> extends Required<Pick<T, K>> ? true : false;
type _AzureOptionsExposeOnlySupportedFields = Assert<
    IsExact<
        keyof AzureOpenAIRealtimeOptions,
        | "apiKey"
        | "url"
        | "model"
        | "voice"
        | "instructions"
        | "maxHistory"
        | "greetingMessage"
        | "outputModalities"
        | "messages"
        | "params"
        | "turnDetection"
    >
>;
type _AzureParamsExposeOnlySupportedFields = Assert<
    IsExact<keyof AzureOpenAIRealtimeParams, "instructions" | "model" | "voice">
>;
type _AzureTurnDetectionIsRequired = Assert<IsRequired<AzureOpenAIRealtimeOptions, "turnDetection">>;
type _QwenUrlIsRequired = Assert<IsRequired<QwenOmniOptions, "url">>;
type _QwenTurnDetectionIsOptional = Assert<IsExact<IsRequired<QwenOmniOptions, "turnDetection">, false>>;

// @ts-expect-error Qwen Omni is a Chinese mainland MLLM vendor.
const _invalidGlobalMllm: GlobalMllmVendor = new QwenOmni({
    apiKey: "key",
    model: "qwen3.5-omni-plus-realtime",
    url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
    turnDetection: { mode: "server_vad" },
});

{
    const client = new AgoraClient({
        area: Area.CN,
        appId: "app-id",
        appCertificate: "app-certificate-0123456789abcdef",
    });

    new Agent({ client, turnDetection: { language: "zh-CN" } })
        .withStt(new FengmingSTT())
        .withLlm(
            new AliyunLLM({
                url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
                model: "qwen-plus",
            }),
        )
        .withTts(
            new MiniMaxCNTTS({
                key: "minimax-key",
                model: "speech-01-turbo",
                voiceSetting: { voice_id: "female-shaonv" },
                audioSetting: { sample_rate: 16000 },
            }),
        )
        .createSession({
            name: "assistant",
            channel: "cn-room",
            agentUid: "1",
            remoteUids: ["100"],
        });

    new Agent({ client }).withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }));
    new Agent({ client }).withLlm(new OpenAI({ model: "gpt-5-mini" }));
    new Agent({ client }).withTts(
        new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "English_captivating_female1" }),
    );
    const cnGenericTts: CNTtsVendor = new GenericTTS({ url: "https://tts.example.cn/v1/audio/speech" });
    new Agent({ client }).withTts(cnGenericTts);
    const cnMllm: CNMllmVendor = new QwenOmni({
        apiKey: "key",
        model: "qwen3.5-omni-plus-realtime",
        url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
    });
    new Agent({ client }).withMllm(cnMllm);
    // @ts-expect-error Azure OpenAI Realtime is a global MLLM vendor.
    const _invalidCnMllm: CNMllmVendor = new AzureOpenAIRealtime({
        apiKey: "azure-key",
        url: "wss://example.openai.azure.com/openai/realtime",
        turnDetection: { mode: "server_vad" },
    });
}

new Agent({ client }).withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }));
