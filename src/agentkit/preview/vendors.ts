/**
 * Preview provider vendor classes.
 *
 * These follow the same shape as the GA vendor classes in `vendors/` —
 * camelCase constructor options in, snake_case wire config out — so they work
 * with the corresponding Agent builder method. AgentSession routes them to the
 * preview endpoint automatically.
 */

import type { McpServersItem, MllmConfig, MllmTurnDetectionConfig } from "../types.js";
import { BaseMLLM } from "../vendors/base.js";

// =============================================================================
// OpenAI GPT Live (MLLM)
// =============================================================================

export const OPENAI_GPT_LIVE_VENDOR = "openai_gpt_live" as const;

export function isOpenAIGPTLiveConfig(config: unknown): boolean {
    return (config as { vendor?: unknown } | null | undefined)?.vendor === OPENAI_GPT_LIVE_VENDOR;
}

function normalizeMcpServers(servers: McpServersItem[]): McpServersItem[] {
    return servers.map((server) => ({ transport: "streamable_http", ...server }));
}

/** GPT Live v3 alpha options. Not for production traffic. */
export interface OpenAIGPTLiveOptions {
    apiKey: string;
    /** Full WebSocket URL, used verbatim except OpenAI's legacy /v1/live route. */
    url?: string;
    /** @deprecated Use prompt. Serialized as prompt; an explicit prompt wins. */
    instructions?: string;
    greeting?: string;
    failureMessage?: string;
    inputModalities?: string[];
    outputModalities?: string[];
    messages?: Record<string, unknown>[];
    /** MCP servers exposed to GPT Live. Requires Agent.withTools(). */
    mcpServers?: McpServersItem[];
    /** Additional provider fields; explicit options take precedence. */
    params?: Record<string, unknown>;
    /** @deprecated Unsupported in v3; setting this raises an error. */
    inputAudioTranscription?: Record<string, unknown>;
    /** @deprecated Ignored with a warning; v3 performs endpointing internally. */
    turnDetection?: MllmTurnDetectionConfig;
    /** Defaults to gpt-live-1-diamond-alpha. */
    model?: string;
    /** Output voice; provider default marin. Custom voice objects require PR #1522; use params after rollout. */
    voice?: string;
    /** Session instructions. */
    prompt?: string;
    /** Host when url is omitted; default wss://api.openai.com. */
    baseUrl?: string;
    /** WebSocket path; default /v1/live/sessions. */
    path?: string;
    /** OpenAI-Alpha selector. Defaults to the required GPT Live v3 contract. */
    alphaSelector?: string;
    /** Extra provider request headers as a JSON string; protocol headers win. */
    headers?: string;
    /** Assistant silence boundary in ms; provider default 600. Zero disables inference. */
    outputIdleEndMs?: number;
    /** Caller silence boundary in ms; provider default 1500. */
    inputIdleEndMs?: number;
    /** Speech amplitude threshold on the 16-bit scale; provider default 50. */
    outputSilencePeak?: number;
    /** Graph PCM sample rate; provider default 24000. */
    outputSampleRate?: number;
    /** Initial audio cushion; provider default 0. Negative disables pacing. */
    outputBufferMs?: number;
    /** Mic append batching in ms. Join default 0; extension class default 100. */
    inputBatchMs?: number;
    /** Advertise graph tools; provider default false. Does not control delegate built-ins. */
    toolEnabled?: boolean;
    /** Tool delegation mode; provider default responses. Fixed for the session. */
    delegation?: "client" | "responses";
    /** Tool delegate model; provider default gpt-5.6-sol. */
    responsesModel?: string;
    /** Interrupt playback on caller speech; provider default false. */
    interruptOnUserTurn?: boolean;
    /** Unmodelled v3 session fields. Cannot override model, delegation, audio, instructions or input. */
    sessionParams?: Record<string, unknown>;
}

export class OpenAIGPTLive extends BaseMLLM {
    constructor(private readonly options: OpenAIGPTLiveOptions) {
        super();
        if (!options.apiKey) throw new Error("OpenAIGPTLive requires apiKey");
    }

    toConfig(): MllmConfig {
        const o = this.options;
        const params: Record<string, unknown> = {
            model: "gpt-live-1-diamond-alpha",
            alpha_selector: "quicksilver=v3",
            ...o.params,
            ...(o.instructions !== undefined && { prompt: o.instructions }),
            ...(o.model !== undefined && { model: o.model }),
            ...(o.voice !== undefined && { voice: o.voice }),
            ...(o.prompt !== undefined && { prompt: o.prompt }),
            ...(o.baseUrl !== undefined && { base_url: o.baseUrl }),
            ...(o.path !== undefined && { path: o.path }),
            ...(o.alphaSelector !== undefined && { alpha_selector: o.alphaSelector }),
            ...(o.headers !== undefined && { headers: o.headers }),
            ...(o.outputIdleEndMs !== undefined && { output_idle_end_ms: o.outputIdleEndMs }),
            ...(o.inputIdleEndMs !== undefined && { input_idle_end_ms: o.inputIdleEndMs }),
            ...(o.outputSilencePeak !== undefined && { output_silence_peak: o.outputSilencePeak }),
            ...(o.outputSampleRate !== undefined && { output_sample_rate: o.outputSampleRate }),
            ...(o.outputBufferMs !== undefined && { output_buffer_ms: o.outputBufferMs }),
            ...(o.inputBatchMs !== undefined && { input_batch_ms: o.inputBatchMs }),
            ...(o.toolEnabled !== undefined && { tool_enabled: o.toolEnabled }),
            ...(o.delegation !== undefined && { delegation: o.delegation }),
            ...(o.responsesModel !== undefined && { responses_model: o.responsesModel }),
            ...(o.interruptOnUserTurn !== undefined && { interrupt_on_user_turn: o.interruptOnUserTurn }),
            ...(o.sessionParams !== undefined && { session_params: o.sessionParams }),
        };
        if (o.inputAudioTranscription !== undefined || "input_audio_transcription" in params) {
            throw new Error("GPT Live v3 does not support input_audio_transcription");
        }
        if (o.turnDetection !== undefined || "turn_detection" in params) {
            console.warn("GPT Live v3 ignores turn_detection; endpointing is internal");
            delete params.turn_detection;
        }
        if (params.delegation !== undefined && params.delegation !== "client" && params.delegation !== "responses") {
            throw new Error("GPT Live delegation must be client or responses");
        }
        if (params.headers !== undefined) {
            let headers: unknown;
            try {
                headers = JSON.parse(String(params.headers));
            } catch {
                throw new Error("GPT Live headers must be a JSON object string");
            }
            if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
                throw new Error("GPT Live headers must be a JSON object string");
            }
        }
        const session = params.session_params === undefined ? {} : params.session_params;
        if (session === null || typeof session !== "object" || Array.isArray(session)) {
            throw new Error("GPT Live session_params must be an object");
        }
        for (const key of ["model", "delegation", "audio", "instructions", "input"]) {
            if (key in session) throw new Error(`GPT Live session_params cannot override ${key}`);
        }
        let url =
            o.url ||
            `${String(params.base_url ?? "wss://api.openai.com").replace(/\/+$/, "")}/${String(params.path ?? "/v1/live/sessions").replace(/^\/+/, "")}`;
        if (!/^wss?:\/\/[^/]/i.test(url)) {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        if ((parsed.protocol !== "ws:" && parsed.protocol !== "wss:") || !parsed.hostname) {
            throw new Error("GPT Live url must be a full ws:// or wss:// endpoint");
        }
        if (parsed.hostname === "api.openai.com" && parsed.pathname === "/v1/live") {
            parsed.pathname = "/v1/live/sessions";
            url = parsed.toString();
        }
        return {
            vendor: OPENAI_GPT_LIVE_VENDOR,
            api_key: o.apiKey,
            url,
            params,
            ...(o.greeting !== undefined && { greeting_message: o.greeting }),
            ...(o.failureMessage !== undefined && { failure_message: o.failureMessage }),
            ...(o.inputModalities !== undefined && { input_modalities: o.inputModalities }),
            ...(o.outputModalities !== undefined && { output_modalities: o.outputModalities }),
            ...(o.messages !== undefined && { messages: o.messages }),
            ...(o.mcpServers !== undefined && { mcp_servers: normalizeMcpServers(o.mcpServers) }),
        };
    }
}
