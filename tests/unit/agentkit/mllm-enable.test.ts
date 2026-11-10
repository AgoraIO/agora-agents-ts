/**
 * MLLM is enabled with `advanced_features.enable_mllm`, never `mllm.enable`.
 *
 * Live A/B tests showed that when `mllm.enable` is present in the join body
 * (alone or together with `advanced_features.enable_mllm`), RTM
 * `message.metrics` never arrive. With only `advanced_features.enable_mllm`
 * they do. These tests pin the wire shape for every MLLM vendor.
 */
import { describe, expect, test, vi } from "vitest";
import { AgoraClient } from "../../../src/AgoraPoolClient.js";
import { Agent } from "../../../src/agentkit/Agent.js";
import type { MllmConfig } from "../../../src/agentkit/types.js";
import { BaseMLLM } from "../../../src/agentkit/vendors/base.js";
import { OpenAI } from "../../../src/agentkit/vendors/llm.js";
import {
    AzureOpenAIRealtime,
    GeminiLive,
    GeminiLiveModels,
    OpenAIGPTLive,
    OpenAIRealtime,
    VertexAI,
    XaiGrok,
} from "../../../src/agentkit/vendors/mllm.js";
import { DeepgramSTT } from "../../../src/agentkit/vendors/stt.js";
import { ElevenLabsTTS } from "../../../src/agentkit/vendors/tts.js";
import { Area } from "../../../src/core/domain/index.js";

const APP_ID = "0".repeat(32);
const SESSION = { name: "enable-fix", channel: "enable-fix-channel", agentUid: "1", remoteUids: ["100"] };
const SESSION_OPTS = { channel: "channel", token: "test-token", agentUid: "1", remoteUids: ["100"] };

function fakeClient() {
    const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementation(async () => new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));
    const client = new AgoraClient({ area: Area.US, appId: APP_ID, appCertificate: "1".repeat(32), fetch: fetchMock });
    return { client, fetchMock };
}

interface Captured {
    body: { properties: Record<string, unknown> & { mllm: Record<string, unknown> } };
}

/** Starts a session through a fake fetch and returns the captured join request. */
async function captureJoin(build: (agent: Agent) => Agent): Promise<Captured> {
    const { client, fetchMock } = fakeClient();
    await build(new Agent({ client })).createSession(SESSION).start();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body));
    body.properties.token = "<token>";
    return { body };
}

const MLLM_VENDORS: [string, () => BaseMLLM][] = [
    ["GeminiLive GA", () => new GeminiLive({ apiKey: "k", model: GeminiLiveModels.Live38 })],
    [
        "GeminiLive 3.8 extended thinking",
        () => new GeminiLive({ apiKey: "k", model: GeminiLiveModels.Live38ExtendedThinking }),
    ],
    ["GeminiLive legacy model", () => new GeminiLive({ apiKey: "k", model: "gemini-live-2.5-flash" })],
    ["OpenAIRealtime", () => new OpenAIRealtime({ apiKey: "k", model: "gpt-realtime" })],
    ["OpenAIGPTLive", () => new OpenAIGPTLive({ apiKey: "k" })],
    [
        "AzureOpenAIRealtime",
        () => new AzureOpenAIRealtime({ apiKey: "k", url: "wss://azure.test", turnDetection: { mode: "server_vad" } }),
    ],
    [
        "VertexAI",
        () => new VertexAI({ model: "m", projectId: "p", location: "us-central1", adcCredentialsString: "{}" }),
    ],
    ["XaiGrok", () => new XaiGrok({ apiKey: "k" })],
];

describe("MLLM is enabled through advanced_features.enable_mllm", () => {
    test.each(MLLM_VENDORS)("%s sends enable_mllm and no mllm.enable", async (_name, vendor) => {
        const { body } = await captureJoin((agent) => agent.withMllm(vendor()));
        expect(body.properties.advanced_features).toEqual({ enable_mllm: true });
        expect(body.properties.mllm).not.toHaveProperty("enable");
    });

    test("agent.config.mllm does not carry enable either", () => {
        const agent = new Agent({ client: fakeClient().client }).withMllm(
            new OpenAIRealtime({ apiKey: "k", model: "gpt-realtime" }),
        );
        expect(agent.config.mllm).not.toHaveProperty("enable");
    });

    test("merges with caller advanced_features in either builder order", () => {
        const { client } = fakeClient();
        const vendor = new GeminiLive({ apiKey: "k", model: GeminiLiveModels.Live38 });
        const before = new Agent({ client, advancedFeatures: { enable_rtm: true } })
            .withMllm(vendor)
            .withTools()
            .toProperties(SESSION_OPTS);
        const after = new Agent({ client })
            .withMllm(vendor)
            .withAdvancedFeatures({ enable_rtm: true, enable_tools: true })
            .toProperties(SESSION_OPTS);

        for (const properties of [before, after]) {
            expect(properties.advanced_features).toEqual({ enable_rtm: true, enable_tools: true, enable_mllm: true });
            expect(properties.parameters?.data_channel).toBe("rtm");
            expect(properties.mllm).not.toHaveProperty("enable");
        }
    });

    test("a caller enable_mllm: false is overridden for an MLLM session", () => {
        const properties = new Agent({ client: fakeClient().client })
            .withAdvancedFeatures({ enable_mllm: false, enable_rtm: true })
            .withMllm(new OpenAIRealtime({ apiKey: "k", model: "gpt-realtime" }))
            .toProperties(SESSION_OPTS);
        expect(properties.advanced_features).toEqual({ enable_mllm: true, enable_rtm: true });
    });

    test("mllm.enable from a raw vendor config is dropped", async () => {
        class RawMllm extends BaseMLLM {
            toConfig(): MllmConfig {
                return { enable: true, vendor: "openai", api_key: "k", params: { model: "raw" } } as MllmConfig;
            }
        }
        const { body } = await captureJoin((agent) =>
            agent.withMllm(new RawMllm()).withAdvancedFeatures({ enable_rtm: true }),
        );
        expect(body.properties.mllm).toEqual({ vendor: "openai", api_key: "k", params: { model: "raw" } });
        expect(body.properties.advanced_features).toEqual({ enable_rtm: true, enable_mllm: true });
    });

    test("the cascading path never gets enable_mllm", async () => {
        const { body } = await captureJoin((agent) =>
            agent
                .withStt(new DeepgramSTT({ apiKey: "k", language: "en" }))
                .withLlm(new OpenAI({ apiKey: "k", url: "https://api.openai.com/v1/chat/completions", model: "m" }))
                .withTts(new ElevenLabsTTS({ key: "k", voiceId: "v", modelId: "eleven_flash_v2_5" }))
                .withAdvancedFeatures({ enable_rtm: true }),
        );
        expect(body.properties.advanced_features).toEqual({ enable_rtm: true });
        expect(body.properties).not.toHaveProperty("mllm");

        const bare = new Agent({ client: fakeClient().client })
            .withStt(new DeepgramSTT({ apiKey: "k", language: "en" }))
            .withLlm(new OpenAI({ apiKey: "k", url: "https://api.openai.com/v1/chat/completions", model: "m" }))
            .withTts(new ElevenLabsTTS({ key: "k", voiceId: "v", modelId: "eleven_flash_v2_5" }))
            .toProperties(SESSION_OPTS);
        expect(bare.advanced_features).toBeUndefined();
    });
});
