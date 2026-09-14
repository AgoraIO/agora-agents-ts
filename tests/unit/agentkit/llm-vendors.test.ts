import { describe, expect, test } from "vitest";
import {
    AmazonBedrock,
    Anthropic,
    CustomLLM,
    Dify,
    Gemini,
    Groq,
    OpenAI,
    VertexAILLM,
} from "../../../src/agentkit/vendors/llm.js";

const INLINE_TOOL = {
    type: "function" as const,
    function: {
        name: "lookup_order",
        parameters: { type: "object" as const, properties: { orderId: { type: "string" } } },
    },
    server: {
        method: "GET" as const,
        url: "https://example.com/orders/{{args.orderId}}",
    },
};

describe("LLM vendor helpers", () => {
    test("Groq serializes as OpenAI-compatible without exposing style choice", () => {
        expect(
            new Groq({
                apiKey: "groq-key",
                model: "llama-3.3-70b-versatile",
                url: "https://api.groq.com/openai/v1/chat/completions",
            }).toConfig(),
        ).toMatchObject({
            url: "https://api.groq.com/openai/v1/chat/completions",
            api_key: "groq-key",
            style: "openai",
            params: { model: "llama-3.3-70b-versatile" },
        });
    });

    test("CustomLLM marks the request as custom", () => {
        expect(
            new CustomLLM({ apiKey: "key", model: "model", url: "https://llm.example.com/chat" }).toConfig(),
        ).toMatchObject({
            url: "https://llm.example.com/chat",
            api_key: "key",
            vendor: "custom",
            style: "openai",
        });
    });

    test("Anthropic serializes required Claude fields", () => {
        expect(
            new Anthropic({
                apiKey: "anthropic-key",
                model: "claude-3-5-sonnet-20241022",
                url: "https://api.anthropic.com/v1/messages",
                headers: { "anthropic-version": "2023-06-01" },
                maxTokens: 1024,
            }).toConfig(),
        ).toMatchObject({
            url: "https://api.anthropic.com/v1/messages",
            api_key: "anthropic-key",
            style: "anthropic",
            headers: { "anthropic-version": "2023-06-01" },
            params: {
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1024,
            },
        });
    });

    test("Gemini builds the official stream URL and omits top-level api_key", () => {
        const config = new Gemini({
            apiKey: "google-key",
            model: "gemini-2.0-flash",
        }).toConfig();

        expect(config).toMatchObject({
            url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=google-key",
            style: "gemini",
            params: {
                model: "gemini-2.0-flash",
            },
        });
        expect((config as Record<string, unknown>)?.api_key).toBeUndefined();
    });

    test("Gemini preserves explicit URL overrides without emitting api_key", () => {
        const config = new Gemini({
            apiKey: "google-key",
            model: "gemini-2.0-flash",
            url: "https://custom.example.com/gemini?key=override",
        }).toConfig();

        expect(config).toMatchObject({
            url: "https://custom.example.com/gemini?key=override",
            style: "gemini",
            params: {
                model: "gemini-2.0-flash",
            },
        });
        expect((config as Record<string, unknown>)?.api_key).toBeUndefined();
    });

    test("VertexAILLM builds correct URL and excludes project routing from params", () => {
        const config = new VertexAILLM({
            apiKey: "vertex-token",
            model: "gemini-2.0-flash",
            projectId: "project",
            location: "us-central1",
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1024,
        }).toConfig();
        expect(config).toMatchObject({
            api_key: "vertex-token",
            style: "gemini",
            params: {
                model: "gemini-2.0-flash",
                top_p: 0.8,
                top_k: 40,
                max_output_tokens: 1024,
            },
        });
        expect(config.url).toContain("project");
        expect(config.url).toContain("us-central1");
        expect((config.params as Record<string, unknown>)?.project_id).toBeUndefined();
        expect((config.params as Record<string, unknown>)?.location).toBeUndefined();
    });

    test("AmazonBedrock serializes as Bedrock-style with top-level AWS routing", () => {
        expect(
            new AmazonBedrock({
                accessKey: "aws-access",
                secretKey: "aws-secret",
                region: "us-east-1",
                model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
            }).toConfig(),
        ).toMatchObject({
            url: "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3-5-sonnet-20241022-v2:0/converse-stream",
            access_key: "aws-access",
            secret_key: "aws-secret",
            region: "us-east-1",
            model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
            style: "bedrock",
        });
    });

    test("Dify serializes conversation fields in Dify params", () => {
        expect(
            new Dify({
                apiKey: "dify-key",
                url: "https://api.dify.ai/v1/chat-messages",
                model: "default",
                user: "user-1",
                conversationId: "conversation-1",
            }).toConfig(),
        ).toMatchObject({
            api_key: "dify-key",
            style: "dify",
            params: { model: "default", user: "user-1", conversation_id: "conversation-1" },
        });
    });

    test("OpenAI serializes greetingAudioUrl and typed greetingConfigs", () => {
        expect(
            new OpenAI({
                apiKey: "openai-key",
                model: "gpt-4o",
                url: "https://api.openai.com/v1/chat/completions",
                greetingAudioUrl: "https://cdn.example.com/greeting.wav",
                greetingConfigs: {
                    audio_download_timeout_ms: 3000,
                    audio_pcm_sample_rate: 24000,
                    uninterruptible_asr_policy: "context",
                },
            }).toConfig(),
        ).toMatchObject({
            greeting_audio_url: "https://cdn.example.com/greeting.wav",
            greeting_configs: {
                audio_download_timeout_ms: 3000,
                audio_pcm_sample_rate: 24000,
                uninterruptible_asr_policy: "context",
            },
        });
    });

    test("serializes inline REST tools through direct and OpenAI-compatible vendors", () => {
        const openAIConfig = new OpenAI({
            apiKey: "openai-key",
            model: "gpt-4o",
            url: "https://api.openai.com/v1/chat/completions",
            tools: [INLINE_TOOL],
        }).toConfig();
        const groqConfig = new Groq({
            apiKey: "groq-key",
            model: "llama-3.3-70b-versatile",
            url: "https://api.groq.com/openai/v1/chat/completions",
            tools: [INLINE_TOOL],
        }).toConfig();

        expect(openAIConfig.tools).toEqual([INLINE_TOOL]);
        expect(groqConfig.tools).toEqual([INLINE_TOOL]);
    });

    test("rejects missing required LLM fields at runtime", () => {
        expect(() => new OpenAI({ apiKey: "openai-key", model: "gpt-4o" } as never)).toThrow("OpenAI requires url");
        expect(() => new OpenAI({ model: "gpt-4o" } as never)).toThrow(
            "OpenAI requires apiKey unless using a supported Agora-managed model",
        );
        expect(
            () => new OpenAI({ model: "gpt-5-mini", url: "https://api.openai.com/v1/chat/completions" } as never),
        ).toThrow("OpenAI Agora-managed mode does not allow url");
        expect(
            () =>
                new Anthropic({
                    apiKey: "anthropic-key",
                    url: "https://api.anthropic.com/v1/messages",
                    headers: { "anthropic-version": "2023-06-01" },
                    maxTokens: 1024,
                } as never),
        ).toThrow("Anthropic requires model");
        expect(
            () =>
                new Gemini({
                    apiKey: "google-key",
                } as never),
        ).toThrow("Gemini requires model");
        expect(() => new Gemini({ model: "gemini-2.0-flash" } as never)).toThrow("Gemini requires apiKey");
        expect(
            () => new Groq({ apiKey: "groq-key", url: "https://api.groq.com/openai/v1/chat/completions" } as never),
        ).toThrow("Groq requires model");
        expect(
            () => new VertexAILLM({ apiKey: "vertex-token", projectId: "project", location: "us-central1" } as never),
        ).toThrow("VertexAILLM requires model");
        expect(
            () => new AmazonBedrock({ accessKey: "aws-access", secretKey: "aws-secret", region: "us-east-1" } as never),
        ).toThrow("AmazonBedrock requires model");
        expect(() => new Dify({ apiKey: "dify-key", url: "https://api.dify.ai/v1/chat-messages" } as never)).toThrow(
            "Dify requires model",
        );
    });
});
