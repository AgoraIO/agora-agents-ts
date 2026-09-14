/**
 * Type-safe LLM (Large Language Model) vendor classes.
 */

import { type OpenAIPresetModel, OpenAIPresetModels } from "../presets.js";
import type { LlmConfig } from "../types.js";
import { BaseLLM, type BaseLlmOptions } from "./base.js";

function requireString(value: unknown, field: string, vendor: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function requireNumber(value: unknown, field: string, vendor: string): asserts value is number {
    if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function requireRecord(value: unknown, field: string, vendor: string): asserts value is Record<string, string> {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${vendor} requires ${field}`);
    }
}

function isOpenAIManagedModel(model: string): model is OpenAIPresetModel {
    return OpenAIPresetModels.includes(model.trim().toLowerCase() as OpenAIPresetModel);
}

/**
 * Constructor options for OpenAI LLM.
 */
type OpenAICommonOptions = BaseLlmOptions & {
    /** OpenAI API key. Optional only for AgentKit-supported Agora-managed models. */
    apiKey?: string;
    /** Model name (e.g., 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo') */
    model: string;
    /** API endpoint URL */
    url?: string;
    /** Maximum number of conversation history messages to cache */
    maxHistory?: number;
    /** Sampling temperature (0.0–2.0) */
    temperature?: number;
    /** Nucleus sampling (0.0–1.0) */
    topP?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** System messages for the LLM */
    systemMessages?: Record<string, unknown>[];
    /** Greeting message for the agent */
    greetingMessage?: string;
    /** Failure message when LLM call fails */
    failureMessage?: string;
    /** Input modalities (defaults to ["text"]) */
    inputModalities?: string[];
    /** Additional LLM parameters */
    params?: Record<string, unknown>;
    /** Custom headers forwarded to the LLM provider */
    headers?: Record<string, string>;
};

export type OpenAIOptions =
    | (OpenAICommonOptions & {
          apiKey: string;
          url: string;
      })
    | (Omit<OpenAICommonOptions, "model" | "url" | "vendor"> & {
          apiKey?: undefined;
          model: OpenAIPresetModel;
          url?: undefined;
          vendor?: undefined;
      });

/**
 * OpenAI LLM vendor (and OpenAI-compatible APIs).
 *
 * @example
 * ```typescript
 * const llm = new OpenAI({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4o',
 *   url: 'https://api.openai.com/v1/chat/completions',
 * });
 * ```
 */
export class OpenAI extends BaseLLM {
    private readonly options: OpenAIOptions;

    constructor(options: OpenAIOptions) {
        super(options);
        requireString(options.model, "model", "OpenAI");
        if (options.apiKey) {
            requireString(options.url, "url", "OpenAI");
        } else {
            if (!isOpenAIManagedModel(options.model)) {
                throw new Error("OpenAI requires apiKey unless using a supported Agora-managed model");
            }
            if (options.url) {
                throw new Error("OpenAI Agora-managed mode does not allow url");
            }
            if (options.vendor) {
                throw new Error("OpenAI Agora-managed mode does not allow vendor");
            }
        }
        this.options = options;
    }

    toConfig(): LlmConfig {
        const {
            apiKey,
            model,
            url,
            maxHistory,
            temperature,
            topP,
            maxTokens,
            systemMessages,
            greetingMessage,
            failureMessage,
            inputModalities,
            params,
            headers,
        } = this.options;

        return {
            url: url ?? "https://api.openai.com/v1/chat/completions",
            ...(apiKey && { api_key: apiKey }),
            // model is the default; params entries extend it; named fields win.
            params: {
                model,
                ...params,
                ...(temperature !== undefined && { temperature }),
                ...(topP !== undefined && { top_p: topP }),
                ...(maxTokens !== undefined && { max_tokens: maxTokens }),
            },
            headers,
            max_history: maxHistory,
            system_messages: systemMessages,
            greeting_message: greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: failureMessage,
            input_modalities: inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "openai",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}

/**
 * Constructor options for Azure OpenAI LLM.
 */
export interface AzureOpenAIOptions extends BaseLlmOptions {
    /** Azure OpenAI API key */
    apiKey: string;
    /** Model/deployment name */
    model: string;
    /** Azure resource name (e.g., 'my-resource'). Required when endpoint is not set. */
    resourceName?: string;
    /** Full Azure base URL (e.g., for sovereign clouds or private endpoints). Takes precedence over resourceName. */
    endpoint?: string;
    /** Deployment name in Azure */
    deploymentName: string;
    /** Azure API version (defaults to '2024-08-01-preview') */
    apiVersion?: string;
    /** Maximum number of conversation history messages to cache */
    maxHistory?: number;
    /** Sampling temperature (0.0–2.0) */
    temperature?: number;
    /** Nucleus sampling (0.0–1.0) */
    topP?: number;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** System messages for the LLM */
    systemMessages?: Record<string, unknown>[];
    /** Greeting message for the agent */
    greetingMessage?: string;
    /** Failure message when LLM call fails */
    failureMessage?: string;
    /** Input modalities (defaults to ["text"]) */
    inputModalities?: string[];
    /** Additional LLM parameters */
    params?: Record<string, unknown>;
    /** Custom headers forwarded to the LLM provider */
    headers?: Record<string, string>;
}

/**
 * Azure OpenAI LLM vendor.
 *
 * @example
 * ```typescript
 * const llm = new AzureOpenAI({
 *   apiKey: process.env.AZURE_OPENAI_API_KEY,
 *   model: 'gpt-4',
 *   resourceName: 'my-azure-resource',
 *   deploymentName: 'gpt-4-deployment',
 * });
 * ```
 */
export class AzureOpenAI extends BaseLLM {
    private readonly options: AzureOpenAIOptions;

    constructor(options: AzureOpenAIOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "AzureOpenAI");
        requireString(options.model, "model", "AzureOpenAI");
        if (!options.resourceName && !options.endpoint) {
            throw new Error("AzureOpenAI requires either resourceName or endpoint");
        }
        requireString(options.deploymentName, "deploymentName", "AzureOpenAI");
        this.options = options;
    }

    toConfig(): LlmConfig {
        const {
            apiKey,
            model,
            resourceName,
            endpoint,
            deploymentName,
            apiVersion = "2024-08-01-preview",
            maxHistory,
            temperature,
            topP,
            maxTokens,
            systemMessages,
            greetingMessage,
            failureMessage,
            inputModalities,
            params,
            headers,
        } = this.options;

        const rawBase = endpoint ?? `https://${resourceName}.openai.azure.com`;
        const baseUrl = rawBase.replace(/\/$/, "");

        return {
            url: `${baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
            api_key: apiKey,
            // "azure" is required by Agora for Azure OpenAI; user-supplied vendor overrides if needed.
            vendor: this.vendor ?? "azure",
            // model is the default; params entries extend it; named fields win.
            params: {
                model,
                ...params,
                ...(temperature !== undefined && { temperature }),
                ...(topP !== undefined && { top_p: topP }),
                ...(maxTokens !== undefined && { max_tokens: maxTokens }),
            },
            headers,
            max_history: maxHistory,
            system_messages: systemMessages,
            greeting_message: greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: failureMessage,
            input_modalities: inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "openai",
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}

/**
 * Constructor options for Anthropic Claude LLM.
 */
export interface AnthropicOptions extends BaseLlmOptions {
    /** Anthropic API key */
    apiKey: string;
    /** Model name (e.g., 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229') */
    model: string;
    /** API endpoint URL */
    url: string;
    /** Maximum number of conversation history messages to cache */
    maxHistory?: number;
    /** Maximum tokens to generate */
    maxTokens: number;
    /** Sampling temperature (0.0–1.0) */
    temperature?: number;
    /** Nucleus sampling (0.0–1.0) */
    topP?: number;
    /** System messages for the LLM */
    systemMessages?: Record<string, unknown>[];
    /** Greeting message for the agent */
    greetingMessage?: string;
    /** Failure message when LLM call fails */
    failureMessage?: string;
    /** Input modalities (defaults to ["text"]) */
    inputModalities?: string[];
    /** Additional LLM parameters */
    params?: Record<string, unknown>;
    /** Custom headers forwarded to the LLM provider */
    headers?: Record<string, string>;
}

/**
 * Anthropic Claude LLM vendor.
 *
 * @example
 * ```typescript
 * const llm = new Anthropic({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 *   model: 'claude-3-5-sonnet-20241022',
 *   url: 'https://api.anthropic.com/v1/messages',
 *   headers: { 'anthropic-version': '2023-06-01' },
 *   maxTokens: 1024,
 * });
 * ```
 */
export class Anthropic extends BaseLLM {
    private readonly options: AnthropicOptions;

    constructor(options: AnthropicOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "Anthropic");
        requireString(options.model, "model", "Anthropic");
        requireString(options.url, "url", "Anthropic");
        requireRecord(options.headers, "headers", "Anthropic");
        requireNumber(options.maxTokens, "maxTokens", "Anthropic");
        this.options = options;
    }

    toConfig(): LlmConfig {
        const {
            apiKey,
            model,
            url,
            maxHistory,
            maxTokens,
            temperature,
            topP,
            systemMessages,
            greetingMessage,
            failureMessage,
            inputModalities,
            params,
            headers,
        } = this.options;

        return {
            url,
            api_key: apiKey,
            // model is the default; params entries extend it; named fields win.
            params: {
                model,
                ...params,
                ...(maxTokens !== undefined && { max_tokens: maxTokens }),
                ...(temperature !== undefined && { temperature }),
                ...(topP !== undefined && { top_p: topP }),
            },
            headers,
            max_history: maxHistory,
            system_messages: systemMessages,
            greeting_message: greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: failureMessage,
            input_modalities: inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "anthropic",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}
/**
 * Constructor options for Google Gemini LLM.
 */
export interface GeminiOptions extends BaseLlmOptions {
    /** Google API key */
    apiKey: string;
    /** Model name (e.g., 'gemini-pro', 'gemini-pro-vision') */
    model: string;
    /** Optional full API endpoint URL override. When omitted, AgentKit builds the official Gemini stream URL. */
    url?: string;
    /** Maximum number of conversation history messages to cache */
    maxHistory?: number;
    /** Sampling temperature (0.0–2.0) */
    temperature?: number;
    /** Nucleus sampling (0.0–1.0) */
    topP?: number;
    /** Top-k sampling */
    topK?: number;
    /** Maximum output tokens to generate */
    maxOutputTokens?: number;
    /** System messages for the LLM */
    systemMessages?: Record<string, unknown>[];
    /** Greeting message for the agent */
    greetingMessage?: string;
    /** Failure message when LLM call fails */
    failureMessage?: string;
    /** Input modalities (defaults to ["text"]) */
    inputModalities?: string[];
    /** Additional LLM parameters */
    params?: Record<string, unknown>;
    /** Custom headers forwarded to the LLM provider */
    headers?: Record<string, string>;
}

/**
 * Google Gemini LLM vendor.
 *
 * @example
 * ```typescript
 * const llm = new Gemini({
 *   apiKey: process.env.GOOGLE_API_KEY,
 *   model: 'gemini-pro',
 * });
 * ```
 */
export class Gemini extends BaseLLM {
    private readonly options: GeminiOptions;

    constructor(options: GeminiOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "Gemini");
        requireString(options.model, "model", "Gemini");
        if (options.url !== undefined) {
            requireString(options.url, "url", "Gemini");
        }
        this.options = options;
    }

    toConfig(): LlmConfig {
        const {
            apiKey,
            model,
            url,
            maxHistory,
            temperature,
            topP,
            topK,
            maxOutputTokens,
            systemMessages,
            greetingMessage,
            failureMessage,
            inputModalities,
            params,
            headers,
        } = this.options;

        const defaultUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

        return {
            url: url ?? defaultUrl,
            // model is the default; params entries extend it; named fields win.
            params: {
                model,
                ...params,
                ...(temperature !== undefined && { temperature }),
                ...(topP !== undefined && { top_p: topP }),
                ...(topK !== undefined && { top_k: topK }),
                ...(maxOutputTokens !== undefined && { max_output_tokens: maxOutputTokens }),
            },
            headers,
            max_history: maxHistory,
            system_messages: systemMessages,
            greeting_message: greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: failureMessage,
            input_modalities: inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "gemini",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}

type OpenAIStyleOptions = BaseLlmOptions & {
    apiKey: string;
    model: string;
    url: string;
    maxHistory?: number;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    systemMessages?: Record<string, unknown>[];
    greetingMessage?: string;
    failureMessage?: string;
    inputModalities?: string[];
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
};

function openAIStyleConfig(options: OpenAIStyleOptions, vendor?: string): LlmConfig {
    return {
        url: options.url,
        api_key: options.apiKey,
        params: {
            model: options.model,
            ...options.params,
            ...(options.temperature !== undefined && { temperature: options.temperature }),
            ...(options.topP !== undefined && { top_p: options.topP }),
            ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
        },
        headers: options.headers,
        max_history: options.maxHistory,
        system_messages: options.systemMessages,
        greeting_message: options.greetingMessage,
        greeting_audio_url: options.greetingAudioUrl,
        failure_message: options.failureMessage,
        input_modalities: options.inputModalities ?? ["text"],
        output_modalities: options.outputModalities,
        style: "openai",
        vendor: options.vendor ?? vendor,
        greeting_configs: options.greetingConfigs,
        template_variables: options.templateVariables,
        mcp_servers: options.mcpServers,
        tools: options.tools,
    };
}

export type GroqOptions = OpenAIStyleOptions;

export class Groq extends BaseLLM {
    constructor(private readonly options: GroqOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "Groq");
        requireString(options.model, "model", "Groq");
        requireString(options.url, "url", "Groq");
    }

    toConfig(): LlmConfig {
        return openAIStyleConfig(this.options);
    }
}

export type CustomLLMOptions = OpenAIStyleOptions;

export class CustomLLM extends BaseLLM {
    constructor(private readonly options: CustomLLMOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "CustomLLM");
        requireString(options.model, "model", "CustomLLM");
        requireString(options.url, "url", "CustomLLM");
    }

    toConfig(): LlmConfig {
        return openAIStyleConfig(this.options, "custom");
    }
}

export interface VertexAILLMOptions extends BaseLlmOptions {
    apiKey: string;
    model: string;
    projectId: string;
    location: string;
    url?: string;
    maxHistory?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    systemMessages?: Record<string, unknown>[];
    greetingMessage?: string;
    failureMessage?: string;
    inputModalities?: string[];
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
}

export class VertexAILLM extends BaseLLM {
    constructor(private readonly options: VertexAILLMOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "VertexAILLM");
        requireString(options.model, "model", "VertexAILLM");
        requireString(options.projectId, "projectId", "VertexAILLM");
        requireString(options.location, "location", "VertexAILLM");
    }

    toConfig(): LlmConfig {
        const o = this.options;
        const defaultUrl = `https://${o.location}-aiplatform.googleapis.com/v1/projects/${o.projectId}/locations/${o.location}/publishers/google/models/${o.model}:streamGenerateContent?alt=sse`;
        return {
            url: o.url ?? defaultUrl,
            api_key: o.apiKey,
            params: {
                model: o.model,
                ...o.params,
                ...(o.temperature !== undefined && { temperature: o.temperature }),
                ...(o.topP !== undefined && { top_p: o.topP }),
                ...(o.topK !== undefined && { top_k: o.topK }),
                ...(o.maxOutputTokens !== undefined && { max_output_tokens: o.maxOutputTokens }),
            },
            headers: o.headers,
            max_history: o.maxHistory,
            system_messages: o.systemMessages,
            greeting_message: o.greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: o.failureMessage,
            input_modalities: o.inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "gemini",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}

export interface AmazonBedrockOptions extends BaseLlmOptions {
    /** AWS access key ID. */
    accessKey: string;
    /** AWS secret access key. */
    secretKey: string;
    /** AWS region. */
    region: string;
    model: string;
    maxHistory?: number;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    systemMessages?: Record<string, unknown>[];
    greetingMessage?: string;
    failureMessage?: string;
    inputModalities?: string[];
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
}

export class AmazonBedrock extends BaseLLM {
    constructor(private readonly options: AmazonBedrockOptions) {
        super(options);
        requireString(options.accessKey, "accessKey", "AmazonBedrock");
        requireString(options.secretKey, "secretKey", "AmazonBedrock");
        requireString(options.region, "region", "AmazonBedrock");
        requireString(options.model, "model", "AmazonBedrock");
    }

    toConfig(): LlmConfig {
        const o = this.options;
        return {
            url: `https://bedrock-runtime.${o.region}.amazonaws.com/model/${o.model}/converse-stream`,
            access_key: o.accessKey,
            secret_key: o.secretKey,
            region: o.region,
            model: o.model,
            params: {
                ...o.params,
                ...(o.maxTokens !== undefined && { max_tokens: o.maxTokens }),
                ...(o.temperature !== undefined && { temperature: o.temperature }),
                ...(o.topP !== undefined && { top_p: o.topP }),
                ...(o.topK !== undefined && { top_k: o.topK }),
            },
            headers: o.headers,
            max_history: o.maxHistory,
            system_messages: o.systemMessages,
            greeting_message: o.greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: o.failureMessage,
            input_modalities: o.inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "bedrock",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}

export interface DifyOptions extends BaseLlmOptions {
    apiKey: string;
    url: string;
    model: string;
    user?: string;
    conversationId?: string;
    maxHistory?: number;
    systemMessages?: Record<string, unknown>[];
    greetingMessage?: string;
    failureMessage?: string;
    inputModalities?: string[];
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
}

export class Dify extends BaseLLM {
    constructor(private readonly options: DifyOptions) {
        super(options);
        requireString(options.apiKey, "apiKey", "Dify");
        requireString(options.url, "url", "Dify");
        requireString(options.model, "model", "Dify");
    }

    toConfig(): LlmConfig {
        const o = this.options;
        return {
            url: o.url,
            api_key: o.apiKey,
            params: {
                model: o.model,
                ...o.params,
                ...(o.user !== undefined && { user: o.user }),
                ...(o.conversationId !== undefined && { conversation_id: o.conversationId }),
            },
            headers: o.headers,
            max_history: o.maxHistory,
            system_messages: o.systemMessages,
            greeting_message: o.greetingMessage,
            greeting_audio_url: this.greetingAudioUrl,
            failure_message: o.failureMessage,
            input_modalities: o.inputModalities ?? ["text"],
            output_modalities: this.outputModalities,
            style: "dify",
            vendor: this.vendor,
            greeting_configs: this.greetingConfigs,
            template_variables: this.templateVariables,
            mcp_servers: this.mcpServers,
            tools: this.tools,
        };
    }
}
