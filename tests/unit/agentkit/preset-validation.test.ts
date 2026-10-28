import { describe, expect, test, vi } from "vitest";
import { Agent } from "../../../src/agentkit/Agent.js";
import { OpenAI } from "../../../src/agentkit/vendors/llm.js";
import { DeepgramSTT } from "../../../src/agentkit/vendors/stt.js";
import { MiniMaxTTS, OpenAITTS } from "../../../src/agentkit/vendors/tts.js";
import type * as Agora from "../../../src/api/index.js";
import type { AgoraClient } from "../../../src/Client.js";

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

describe("Agent preset validation", () => {
    test("explicit ASR preset still requires LLM and TTS", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client });

        const session = agent.createSession({
            channel: "channel",
            token: "token",
            agentUid: "1",
            remoteUids: ["100"],
            preset: "deepgram_nova_3",
        });

        await expect(session.start()).rejects.toThrow("TTS configuration is required");
        expect(start).not.toHaveBeenCalled();
    });

    test("explicit LLM preset still requires TTS", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client });

        const session = agent.createSession({
            channel: "channel",
            token: "token",
            agentUid: "1",
            remoteUids: ["100"],
            preset: "openai_gpt_4o_mini",
        });

        await expect(session.start()).rejects.toThrow("TTS configuration is required");
        expect(start).not.toHaveBeenCalled();
    });

    test("explicit TTS preset still requires LLM", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client });

        const session = agent.createSession({
            channel: "channel",
            token: "token",
            agentUid: "1",
            remoteUids: ["100"],
            preset: "openai_tts_1",
        });

        await expect(session.start()).rejects.toThrow("LLM configuration is required");
        expect(start).not.toHaveBeenCalled();
    });

    test("infers ASR, LLM, and TTS presets without skipping unrelated validation", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new OpenAITTS({ voice: "alloy" }));

        const session = agent.createSession({
            channel: "channel",
            token: "token",
            agentUid: "1",
            remoteUids: ["100"],
        });

        await session.start();

        const request = start.mock.calls[0]?.[0];
        expect(request?.preset).toBe("deepgram_nova_3,openai_gpt_4o_mini,openai_tts_1");
        expect(request?.properties.asr?.params).toEqual({ language: "en-US" });
        expect(request?.properties.tts?.params).toEqual({ voice: "alloy" });
    });

    test("infers hyphenated MiniMax managed preset model", async () => {
        const { client, start } = createClient();
        const agent = new Agent({ client })
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "English_captivating_female1" }));

        const session = agent.createSession({
            channel: "channel",
            token: "token",
            agentUid: "1",
            remoteUids: ["100"],
        });

        await session.start();

        const request = start.mock.calls[0]?.[0];
        expect(request?.preset).toBe("openai_gpt_4o_mini,minimax_speech_2_6_turbo");
        expect(request?.properties.tts?.params).toEqual({
            voice_setting: { voice_id: "English_captivating_female1", speed: 1 },
        });
    });

    test("speech-02-turbo requires BYOK", () => {
        expect(() => new MiniMaxTTS({ model: "speech-02-turbo", voiceId: "English_captivating_female1" })).toThrow(
            "MiniMaxTTS requires key unless using a supported Agora-managed model",
        );
    });
});
