import { describe, expect, test, vi } from "vitest";
import { OpenAIGPTLive } from "../../../src/agentkit/preview/vendors.js";

describe("GPT Live v3", () => {
    test("defaults the alpha selector to v3 and normalizes MCP transport", () => {
        const servers = [{ name: "lookup", endpoint: "https://tools.example/mcp" }];
        const config = new OpenAIGPTLive({ apiKey: "test", mcpServers: servers }).toConfig();

        expect(config.params).toEqual({
            model: "gpt-live-1-diamond-alpha",
            alpha_selector: "quicksilver=v3",
        });
        expect((config as Record<string, unknown>).mcp_servers).toEqual([
            { ...servers[0], transport: "streamable_http" },
        ]);
        expect(servers[0]).not.toHaveProperty("transport");
    });

    test("preserves zero and false, explicit fields win, params are not mutated", () => {
        const original = { model: "other", prompt: "other", output_idle_end_ms: 900 };
        const config = new OpenAIGPTLive({
            apiKey: "test",
            model: "gpt-live-1-diamond-alpha",
            voice: "cedar",
            instructions: "alias",
            prompt: "Be brief",
            outputIdleEndMs: 0,
            inputIdleEndMs: 1500,
            outputSilencePeak: 0,
            outputSampleRate: 24000,
            outputBufferMs: -1,
            inputBatchMs: 0,
            toolEnabled: false,
            delegation: "client",
            alphaSelector: "custom=v4",
            responsesModel: "delegate",
            interruptOnUserTurn: false,
            headers: '{"X-Test":"yes"}',
            sessionParams: { context_management: { type: "compaction" } },
            params: original,
        }).toConfig();
        expect(config.params).toEqual({
            model: "gpt-live-1-diamond-alpha",
            voice: "cedar",
            prompt: "Be brief",
            alpha_selector: "custom=v4",
            output_idle_end_ms: 0,
            input_idle_end_ms: 1500,
            output_silence_peak: 0,
            output_sample_rate: 24000,
            output_buffer_ms: -1,
            input_batch_ms: 0,
            tool_enabled: false,
            delegation: "client",
            responses_model: "delegate",
            interrupt_on_user_turn: false,
            headers: '{"X-Test":"yes"}',
            session_params: { context_management: { type: "compaction" } },
        });
        expect(original).toEqual({ model: "other", prompt: "other", output_idle_end_ms: 900 });
    });
    test.each([
        [{}, "wss://api.openai.com/v1/live/sessions"],
        [{ baseUrl: "wss://proxy.test/", path: "custom" }, "wss://proxy.test/custom"],
        [{ url: "wss://proxy.test/v1/live?x=1", baseUrl: "wss://unused.test" }, "wss://proxy.test/v1/live?x=1"],
        [{ url: "wss://api.openai.com/v1/live?x=1" }, "wss://api.openai.com/v1/live/sessions?x=1"],
    ])("resolves endpoints %#", (options, expected) => {
        expect(new OpenAIGPTLive({ apiKey: "test", ...options }).toConfig().url).toBe(expected);
    });
    test.each(["model", "delegation", "audio", "instructions", "input"])("protects session %s", (key) => {
        expect(() =>
            new OpenAIGPTLive({ apiKey: "test", params: { session_params: { [key]: {} } } }).toConfig(),
        ).toThrow("cannot override");
    });
    test("warns and omits unsupported turn detection", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
            const config = new OpenAIGPTLive({ apiKey: "test", params: { turn_detection: {} } }).toConfig();
            expect(warn).toHaveBeenCalledOnce();
            expect(config).not.toHaveProperty("turn_detection");
            expect(config.params).not.toHaveProperty("turn_detection");
        } finally {
            warn.mockRestore();
        }
    });
    test("supports the instructions alias and opt-in pending fields", () => {
        const config = new OpenAIGPTLive({
            apiKey: "test",
            instructions: "Be brief",
            params: {
                voice: { id: "voice_123" },
                context_management: { type: "compaction" },
            },
        }).toConfig();
        expect(config.params).toMatchObject({ prompt: "Be brief", voice: { id: "voice_123" } });
        expect(config.params).not.toHaveProperty("instructions");
    });
    test.each([
        { delegation: "invalid" },
        { session_params: null },
        { input_audio_transcription: {} },
        { headers: "not-json" },
        { headers: "[]" },
    ])("rejects invalid config %#", (params) => {
        expect(() => new OpenAIGPTLive({ apiKey: "test", params }).toConfig()).toThrow();
    });
    test.each(["https://api.openai.com/v1/live/sessions", "/v1/live/sessions", "wss:///missing-host"])(
        "rejects invalid WebSocket endpoint %s",
        (url) => {
            expect(() => new OpenAIGPTLive({ apiKey: "test", url }).toConfig()).toThrow("full ws");
        },
    );
});

test("JSON headers are redacted without mutating config", async () => {
    const { redactSecrets, REDACTED } = await import("../../../src/agentkit/debug.js");
    const config = new OpenAIGPTLive({ apiKey: "test", headers: '{"Authorization":"private-value"}' }).toConfig();
    expect(redactSecrets(config)).toMatchObject({ params: { headers: REDACTED } });
    expect(config.params).toHaveProperty("headers", '{"Authorization":"private-value"}');
});
