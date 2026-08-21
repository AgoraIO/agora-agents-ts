import { describe, expect, test } from "vitest";
import { Agent, AgoraClient, Area, DeepgramSTT, MiniMaxTTS, OpenAI } from "../../../src/index.js";

describe("AgoraClient + Agent API", () => {
    test("Agent binds client and creates sessions without re-passing client", () => {
        const client = new AgoraClient({
            area: Area.US,
            appId: "app-id",
            appCertificate: "app-certificate-0123456789abcdef",
        });

        const agent = new Agent({
            client,
            turnDetection: { language: "en-US" },
        })
            .withStt(new DeepgramSTT({ model: "nova-3", language: "en-US" }))
            .withLlm(new OpenAI({ model: "gpt-5-mini" }))
            .withTts(
                new MiniMaxTTS({
                    model: "speech-2.6-turbo",
                    voiceId: "English_captivating_female1",
                }),
            );

        const session = agent.createSession({
            name: "assistant",
            channel: "test-room",
            agentUid: "1",
            remoteUids: ["100"],
        });

        expect(session.appId).toBe("app-id");
    });
});
