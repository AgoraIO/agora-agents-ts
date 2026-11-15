import { describe, expect, test, vi } from "vitest";
import {
    Agent,
    AgoraClient,
    Area,
    ElevenLabsSTT,
    FishAudioSTT,
    MiniMaxTTS,
    OpenAI,
    QwenSTT,
} from "../../../src/index.js";

describe("engine v2.16 ASR providers", () => {
    test.each([
        { Provider: ElevenLabsSTT, vendor: "elevenlabs", area: Area.US, scope: "global" },
        { Provider: FishAudioSTT, vendor: "fishaudio", area: Area.US, scope: "global" },
        { Provider: QwenSTT, vendor: "qwen", area: Area.CN, scope: "cn" },
    ] as const)("serializes $vendor through AgentKit with $scope scope", async ({ Provider, vendor, area, scope }) => {
        const additionalParams = { api_key: "ignored", enabled: false, keywords: [] };
        const stt = new Provider({ apiKey: "asr-key", additionalParams });
        const fetchMock = vi.fn<typeof fetch>(
            async () =>
                new Response(JSON.stringify({ agent_id: "agent-1" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
        );
        const client = new AgoraClient({
            area,
            appId: "0".repeat(32),
            appCertificate: "1".repeat(32),
            fetch: fetchMock,
        });
        const agent = new Agent({ client, turnDetection: { language: "zh-CN" } })
            .withStt(stt)
            .withLlm(new OpenAI({ model: "gpt-4o-mini" }))
            .withTts(new MiniMaxTTS({ model: "speech-2.6-turbo", voiceId: "voice" }));
        const options = {
            channel: "room",
            token: "rtc-token",
            agentUid: "1",
            remoteUids: ["100"],
        };
        const expected = {
            vendor,
            language: "zh-CN",
            params: { api_key: "asr-key", enabled: false, keywords: [] },
        };
        expect(agent.toProperties(options).asr).toEqual(expected);
        await agent.createSession(options).start();
        expect(fetchMock).toHaveBeenCalledOnce();
        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(body.properties.asr).toEqual(expected);
        expect(stt.areaScope).toBe(scope);
        expect(additionalParams.api_key).toBe("ignored");
        expect(() => new Provider({ apiKey: "" })).toThrow("requires apiKey");
    });
});
