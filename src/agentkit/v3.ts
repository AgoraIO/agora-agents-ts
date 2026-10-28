import type { AgoraClient } from "../AgoraPoolClient.js";
import { Area } from "../core/domain/index.js";
import type { WithRawResponse } from "../core/fetcher/RawResponse.js";
import { contract } from "../v3/contract.js";
import { PreconditionFailedError } from "../v3/transport.js";
import type * as V3 from "../v3/types.js";
import type { Agent, AgentOptions } from "./Agent.js";
import type { AgentSession } from "./AgentSession.js";
import { createStoredSession } from "./session-backend.js";
import type { CallOptions, LlmConfig, MllmConfig, SessionOptions, SttConfig, TtsConfig } from "./types.js";

export type SecretRef = string & { readonly __secretRef: unique symbol };
export function secretRef(set: string, key: string): SecretRef {
    if (![set, key].every((v) => /^[A-Za-z0-9_]{1,64}$/.test(v)))
        throw new Error("Secret names and keys must be 1–64 letters, digits or underscores");
    return `$secrets.${set}.${key}` as SecretRef;
}
export class SecretRefNotSupportedError extends Error {
    constructor() {
        super("secretRef requires save()");
        this.name = "SecretRefNotSupportedError";
    }
}
export class UnsupportedFieldError extends Error {
    constructor(public readonly fields: string[]) {
        super(`Unsupported v3 fields: ${fields.join(", ")}`);
        this.name = "UnsupportedFieldError";
    }
}
export class NumberNotFoundError extends Error {
    constructor(number: string, appid: string) {
        super(`Number ${number} not found in project ${appid}; create it first with client.v3.numbers.create()`);
        this.name = "NumberNotFoundError";
    }
}
export function assertNoSecretRefs(value: unknown): void {
    if (typeof value === "string" && value.startsWith("$secrets.")) throw new SecretRefNotSupportedError();
    if (value && typeof value === "object") for (const item of Object.values(value)) assertNoSecretRefs(item);
}
export type VariableDefinition = V3.Contract_VariableDefinition;
export function validateVariable(name: string, def: VariableDefinition): void {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(name)) throw new Error("Invalid v3 variable name");
    if (!["str", "int", "float", "bool", "date", "datetime"].includes(def.type))
        throw new Error("Invalid v3 variable type");
    if (def.options && new Set(def.options.map((value) => JSON.stringify(value))).size !== def.options.length)
        throw new Error("Variable options must be unique");
    if (def.extract && !def.description?.trim()) throw new Error("Extracted variables require a description");
    if (validateContract(def, contract.AgentRequest_VariableDefinition, `variables.${name}`).length)
        throw new Error("Invalid v3 variable definition");
}
type Config = AgentOptions & { llm?: LlmConfig; tts?: TtsConfig; stt?: SttConfig; mllm?: MllmConfig };
// Mapping operates on the serialized v2 vendor configs, never on private vendor state.
type Map = Record<string, any>;
const clean = (value: Map): Map => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
function leftovers(value: Map, allowed: string[], path: string, errors: string[]): void {
    for (const [key, val] of Object.entries(value))
        if (val !== undefined && !allowed.includes(key)) errors.push(`${path}.${key}`);
}
const moved = [
    "system_messages",
    "messages",
    "greeting_message",
    "greeting_audio_url",
    "greeting_configs",
    "template_variables",
    "turn_detection",
];
export function toV3Module(config: object, kind: "asr" | "llm" | "tts" | "avatar", errors: string[] = []): Map {
    const c = { ...config } as Map,
        params = { ...c.params };
    const path = `pipeline.${kind}`;
    if (kind === "avatar" && c.vendor === "heygen") c.vendor = "liveavatar";
    if (kind === "asr" && c.keywords !== undefined) {
        params.keywords = c.keywords;
        delete c.keywords;
    }
    if (kind === "asr") {
        c.language ??= params.language ?? (c.vendor === "ares" ? "en-US" : undefined);
        delete params.language;
    }
    if (kind === "llm" && c.vendor === "gemini" && c.url) {
        // Legacy Gemini uses a query key; Platform credentials must never live in URLs.
        const url = new URL(c.url);
        const key = url.searchParams.get("key");
        if (key !== null) {
            c.api_key ??= key;
            url.searchParams.delete("key");
            c.url = url.toString();
        }
    }
    if (kind === "llm" && c.style === "bedrock") {
        c.vendor ??= "amazon";
        for (const key of ["access_key", "secret_key", "region"]) {
            if (c[key] !== undefined) {
                if (params[key] !== undefined && params[key] !== c[key]) errors.push(`${path}.params.${key}`);
                params[key] = c[key];
                delete c[key];
            }
        }
    }
    const allowed = {
        asr: ["vendor", "url", "language", "model"],
        llm: [
            "vendor",
            "url",
            "style",
            "model",
            "input_modalities",
            "output_modalities",
            "max_history",
            "failure_message",
            "mcp_servers",
            "tools",
            "headers",
        ],
        tts: ["vendor", "url", "headers", "skip_patterns"],
        avatar: ["vendor"],
    }[kind];
    leftovers(c, [...allowed, ...moved, "api_key", "params", "enable", "_minimaxPresetModel"], path, errors);
    // Credential aliases are normalized to the selected provider's public fields.
    const fields: Map = {};
    const aliases: Record<string, string[]> =
        c.vendor === "amazon" && kind === "asr"
            ? {
                  access_key_id: ["access_key_id", "aws_access_key_id"],
                  secret_access_key: ["secret_access_key", "aws_secret_access_key"],
              }
            : c.vendor === "amazon" && kind === "tts"
              ? {
                    aws_access_key_id: ["aws_access_key_id", "access_key_id"],
                    aws_secret_access_key: ["aws_secret_access_key", "secret_access_key"],
                }
              : c.vendor === "amazon" &&
                  kind === "llm" &&
                  (params.access_key !== undefined || params.secret_key !== undefined)
                ? { access_key: ["access_key"], secret_key: ["secret_key"] }
                : c.vendor === "google" && kind === "asr"
                  ? { adc_credentials_string: ["adc_credentials_string", "api_key"] }
                  : c.vendor === "google" && kind === "tts"
                    ? { credentials: ["credentials", "adc_credentials_string", "api_key"] }
                    : c.vendor === "sarvam" && kind === "tts"
                      ? { api_subscription_key: ["api_subscription_key", "api_key"] }
                      : (kind === "asr" && ["microsoft", "speechmatics"].includes(c.vendor)) ||
                          (kind === "tts" && ["elevenlabs", "humeai", "microsoft", "minimax"].includes(c.vendor))
                        ? { key: ["key", "api_key"] }
                        : kind === "avatar" && c.vendor === "sensetime"
                          ? { app_key: ["app_key", "api_key"] }
                          : kind === "avatar" && c.vendor === "spatius"
                            ? { spatius_api_key: ["spatius_api_key", "api_key"] }
                            : { api_key: ["api_key", "key"] };
    if (Object.keys(aliases).length > 1 && c.api_key !== undefined) errors.push(`${path}.credential`);
    for (const [field, keys] of Object.entries(aliases)) {
        const values = keys.map((key) => params[key]).filter((value) => value !== undefined);
        if (Object.keys(aliases).length === 1 && c.api_key !== undefined) values.push(c.api_key);
        if (new Set(values).size > 1) errors.push(`${path}.credential.fields.${field}`);
        if (values.length) fields[field] = values[0];
        for (const key of keys) delete params[key];
    }
    for (const key of [
        "api_key",
        "key",
        "api_subscription_key",
        "aws_access_key_id",
        "aws_secret_access_key",
        "access_key",
        "secret_key",
        "access_key_id",
        "secret_access_key",
        "adc_credentials_string",
        "credentials",
    ]) {
        if (params[key] !== undefined) errors.push(`${path}.params.${key}`);
    }
    const endpointAlias =
        kind === "asr"
            ? c.vendor === "assemblyai"
                ? "ws_url"
                : c.vendor === "speechmatics"
                  ? "uri"
                  : undefined
            : undefined;
    const url =
        kind === "avatar"
            ? undefined
            : (c.url ??
              (endpointAlias ? params[endpointAlias] : undefined) ??
              params.url ??
              params.base_url ??
              params.api_base_url);
    if (kind !== "avatar") {
        delete params.url;
        delete params.base_url;
        delete params.api_base_url;
        if (endpointAlias) delete params[endpointAlias];
    }
    const result = clean(Object.fromEntries(allowed.map((key) => [key, c[key]])));
    if (url !== undefined) result.url = url;
    if ((kind === "llm" || kind === "asr") && params.model !== undefined) {
        result.model = c.model ?? params.model;
        delete params.model;
    }
    if (kind === "tts" && c._minimaxPresetModel !== undefined) params.model = c._minimaxPresetModel;
    if (kind === "avatar") {
        if (!["akool", "liveavatar", "anam", "generic", "sensetime", "spatius"].includes(c.vendor))
            errors.push(`${path}.vendor`);
        result.enabled = c.enable ?? true;
    } else if (c.enable === false) errors.push(`${path}.enable`);
    if (kind === "tts" && c.skip_patterns) {
        // The v2 numeric enum has no published mapping to the v3 names.
        errors.push(`${path}.skip_patterns`);
    }
    result.credential = Object.keys(fields).length ? { mode: "byok", fields } : { mode: "managed" };
    if (!Object.keys(fields).length) delete result.url;
    if (Object.keys(params).length) result.params = params;
    return result;
}
function interruption(c: Map): Map {
    if (c.enable === false || c.mode === "disabled")
        return clean({ mode: "off", when_off: c.disabled_config?.strategy });
    if (c.mode === "keywords")
        return {
            mode: "keywords",
            keywords: c.keywords_config?.trigger_keywords ?? c.keywords_config?.triggered_keywords ?? [],
        };
    return { mode: "start_of_speech" };
}
function turns(c: Map, errors: string[]): Map {
    leftovers(c, ["mode", "config", "language"], "turnDetection", errors);
    const config = c.config ?? {},
        result: Map = clean({ speech_threshold: config.speech_threshold });
    leftovers(config, ["speech_threshold", "start_of_speech", "end_of_speech"], "turnDetection.config", errors);
    for (const key of ["start_of_speech", "end_of_speech"]) {
        const boundary = config[key];
        if (!boundary) continue;
        if (["keywords", "disabled"].includes(boundary.mode)) {
            result.interruption = interruption(boundary);
            continue;
        }
        const settings = boundary[`${boundary.mode}_config`] ?? {};
        if (settings.max_wait_ms !== undefined && settings.max_wait_ms < 500)
            errors.push(`turnDetection.config.${key}.max_wait_ms`);
        result[key] = { type: boundary.mode ?? "semantic", ...settings };
    }
    return result;
}
function validateContract(value: any, schema: any, path: string): string[] {
    if (schema === true) return [];
    if (schema === false) return [path];
    if (schema.type === "null") return value === null ? [] : [path];
    if (schema.allOf) {
        const errors = schema.allOf.flatMap((branch: Map) => validateContract(value, branch, path));
        if (errors.length) return errors;
    }
    if (schema.not && validateContract(value, schema.not, path).length === 0) return [path];
    if (schema.if) {
        const branch = validateContract(value, schema.if, path).length === 0 ? schema.then : schema.else;
        if (branch) {
            const errors = validateContract(value, branch, path);
            if (errors.length) return errors;
        }
    }
    if (object(value) && schema.required?.some((key: string) => !(key in value))) return [path];
    if (schema.$ref) return validateContract(value, contract[schema.$ref.split("/").pop()], path);
    for (const union of ["oneOf", "anyOf"])
        if (schema[union]) {
            const variants = schema[union].map((branch: Map) => validateContract(value, branch, path));
            if (variants.some((errors: string[]) => errors.length === 0)) return [];
            return variants.sort((a: string[], b: string[]) => a.length - b.length)[0];
        }
    if (schema.const !== undefined && value !== schema.const) return [path];
    if (schema.enum && !schema.enum.includes(value)) return [path];
    if (Array.isArray(schema.type)) {
        return schema.type.some((type: string) => validateContract(value, { ...schema, type }, path).length === 0)
            ? []
            : [path];
    }
    if (schema.type === "string") {
        if (
            typeof value !== "string" ||
            (schema.minLength !== undefined && [...value].length < schema.minLength) ||
            (schema.maxLength !== undefined && [...value].length > schema.maxLength) ||
            (schema.pattern && !new RegExp(schema.pattern).test(value))
        )
            return [path];
    }
    if (schema.type === "boolean" && typeof value !== "boolean") return [path];
    if (
        ["number", "integer"].includes(schema.type) &&
        (typeof value !== "number" ||
            !Number.isFinite(value) ||
            (schema.type === "integer" && !Number.isInteger(value)))
    )
        return [path];
    if (
        (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) ||
        (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum)
    )
        return [path];
    if (
        (schema.minimum !== undefined && value < schema.minimum) ||
        (schema.maximum !== undefined && value > schema.maximum)
    )
        return [path];
    if (schema.type === "array") {
        if (!Array.isArray(value)) return [path];
        if (
            (schema.minItems !== undefined && value.length < schema.minItems) ||
            (schema.maxItems !== undefined && value.length > schema.maxItems)
        )
            return [path];
        if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) return [path];
        return value.flatMap((v: unknown, i: number) => validateContract(v, schema.items ?? {}, `${path}[${i}]`));
    }
    if (schema.type === "object" || schema.properties) {
        if (!object(value)) return [path];
        const errors = (schema.required ?? [])
            .filter((k: string) => value[k] === undefined)
            .map((k: string) => `${path}.${k}`);
        for (const [key, v] of Object.entries(value)) {
            const child =
                schema.properties?.[key] ??
                Object.entries(schema.patternProperties ?? {}).find(([pattern]) => new RegExp(pattern).test(key))?.[1];
            if (child) errors.push(...validateContract(v, child as Map, `${path}.${key}`));
            else if (schema.additionalProperties === false) errors.push(`${path}.${key}`);
            else if (object(schema.additionalProperties))
                errors.push(...validateContract(v, schema.additionalProperties, `${path}.${key}`));
        }
        return errors;
    }
    return [];
}
export function buildV3Agent(
    config: Config,
    variables: Record<string, VariableDefinition>,
    name: string,
): V3.AgentCreateRequest {
    const errors: string[] = [];
    for (const key of ["sal", "advancedFeatures", "geofence", "labels", "rtc", "pipelineId"] as const)
        if (config[key] !== undefined) errors.push(key);
    if (config.parameters) leftovers(config.parameters, ["silence_config"], "parameters", errors);
    if (config.mllm !== undefined)
        throw new UnsupportedFieldError(["mllm (not available for saved or ephemeral preview sessions)"]);
    const pipeline: Map = { mode: "cascaded" };
    for (const [key, kind] of [
        ["stt", "asr"],
        ["llm", "llm"],
        ["tts", "tts"],
        ["avatar", "avatar"],
    ] as const)
        if (config[key]) pipeline[kind] = toV3Module(config[key]!, kind, errors);
    if (config.turnDetection?.language !== undefined) {
        // Language controls the interaction ASR, while provider-specific language
        // settings remain in params. Keep direct mapper callers lossless too.
        pipeline.asr ??= toV3Module({ vendor: config.client.area === Area.CN ? "fengming" : "ares" }, "asr", errors);
        pipeline.asr.language = config.turnDetection.language;
    }
    const vendor: Map = config.llm ?? {};
    const body: Map = { agent_name: name, pipeline };
    const messages = vendor.system_messages ?? vendor.messages;
    if (messages !== undefined) {
        const system: string[] = [],
            other: Map[] = [];
        for (const message of messages) {
            if (message.role === "system" && typeof message.content === "string") system.push(message.content);
            else other.push(message);
        }
        if (system.length) body.instructions = system.join("\n");
        if (other.length) body.messages = other;
    }
    if (body.instructions === undefined) {
        if (config.instructions !== undefined) body.instructions = config.instructions;
    }
    const vars: Map = {};
    if (vendor.template_variables && Object.keys(vendor.template_variables).length)
        errors.push("llm.template_variables (v3 has no variable defaults)");
    Object.assign(vars, variables);
    for (const [key, value] of Object.entries(vars)) validateVariable(key, value as VariableDefinition);
    if (Object.keys(vars).length) body.variables = vars;
    const text = vendor.greeting_message ?? config.greeting;
    const gc = vendor.greeting_configs ?? config.greetingConfigs ?? {};
    leftovers(
        gc,
        ["on", "mode", "delay_ms", "audio_download_timeout_ms", "audio_pcm_sample_rate"],
        "greetingConfigs",
        errors,
    );
    if (text !== undefined || vendor.greeting_audio_url !== undefined)
        body.greeting = clean({
            mode: vendor.greeting_audio_url ? "audio" : "text",
            text,
            url: vendor.greeting_audio_url,
            on:
                gc.on ??
                (gc.mode === "single_every" ? "each_join" : gc.mode === "single_first" ? "first_join" : gc.mode),
            delay_ms: gc.delay_ms,
            download_timeout_ms: gc.audio_download_timeout_ms ?? undefined,
            pcm_sample_rate: gc.audio_pcm_sample_rate ?? undefined,
        });
    if (pipeline.llm) {
        if (pipeline.llm.failure_message === undefined && config.failureMessage !== undefined)
            pipeline.llm.failure_message = config.failureMessage;
        if (pipeline.llm.max_history === undefined && config.maxHistory !== undefined)
            pipeline.llm.max_history = config.maxHistory;
    } else {
        if (config.failureMessage !== undefined) errors.push("failureMessage");
        if (config.maxHistory !== undefined) errors.push("maxHistory");
    }
    const td = vendor.turn_detection ?? config.turnDetection;
    if (td) pipeline.turn_detection = turns(td, errors);
    if (config.interruption) {
        pipeline.turn_detection = { ...pipeline.turn_detection, interruption: interruption(config.interruption) };
    }
    if (config.parameters?.silence_config) {
        pipeline.silence_config = { enabled: true, ...config.parameters.silence_config };
    }
    if (config.fillerWords) {
        const f = config.fillerWords;
        body.filler_words = clean({
            enable: f.enable,
            trigger: f.trigger && { mode: f.trigger.mode, ...f.trigger.fixed_time_config },
            content:
                f.content &&
                (f.content.mode === "static"
                    ? { mode: "static", ...f.content.static_config }
                    : clean({
                          mode: "generated",
                          instructions: f.content.generated_config?.prompt,
                          fallback_strategy: f.content.generated_config?.fallback_strategy,
                      })),
        });
    }
    const { agent_name: _agentName, ...inline } = body;
    errors.push(...validateContract(inline, { $ref: "#/components/schemas/PublicAgentInput" }, "agent"));
    if (errors.length) throw new UnsupportedFieldError([...new Set(errors)]);
    return body as V3.AgentCreateRequest;
}
const mutable = ["agent_name", "instructions", "messages", "greeting", "variables", "pipeline", "filler_words"];
function object(v: unknown): v is Map {
    return !!v && typeof v === "object" && !Array.isArray(v);
}
function credentialFieldNames(kind: string, vendor?: string): string[] {
    if (kind === "asr" && vendor === "amazon") return ["access_key_id", "secret_access_key"];
    if (kind === "tts" && vendor === "amazon") return ["aws_access_key_id", "aws_secret_access_key"];
    if (kind === "llm" && vendor === "amazon") return ["api_key", "access_key", "secret_key"];
    if (kind === "asr" && vendor === "google") return ["adc_credentials_string"];
    if (kind === "tts" && vendor === "google") return ["credentials"];
    if (kind === "tts" && vendor === "sarvam") return ["api_subscription_key"];
    if (
        (kind === "asr" && ["microsoft", "speechmatics"].includes(vendor ?? "")) ||
        (kind === "tts" && ["elevenlabs", "humeai", "microsoft", "minimax"].includes(vendor ?? ""))
    )
        return ["key"];
    if (kind === "avatar" && vendor === "sensetime") return ["app_key"];
    if (kind === "avatar" && vendor === "spatius") return ["spatius_api_key"];
    return ["api_key"];
}
/** Explicitly clear readable stale keys under standard JSON merge-patch semantics. */
export function redeployPatch(previous: V3.AgentResponse, desired: V3.AgentCreateRequest): V3.AgentPatchRequest {
    const merge = (old: Map, next: Map, path = ""): Map => {
        const module = /^pipeline\.(asr|llm|tts|avatar)$/.test(path);
        const result: Map = { ...next };
        for (const [key, value] of Object.entries(old)) {
            // Resolved credentials contain read-only metadata; never echo or diff it.
            if (key === "credential" && module) continue;
            if (!(key in next)) result[key] = null;
            else if (object(value) && object(next[key]))
                result[key] = merge(value, next[key], path ? `${path}.${key}` : key);
        }
        if (module && object(next.credential))
            result.credential = {
                ...next.credential,
                ...(next.credential.mode === "managed"
                    ? { fields: null }
                    : {
                          fields: {
                              ...Object.fromEntries(
                                  credentialFieldNames(path.split(".")[1]!, old.vendor)
                                      .filter((key) => !(key in next.credential.fields))
                                      .map((key) => [key, null]),
                              ),
                              ...next.credential.fields,
                          },
                      }),
            };
        return result;
    };
    return merge(Object.fromEntries(Object.entries(previous).filter(([key]) => mutable.includes(key))), desired);
}
function etag(response: WithRawResponse<unknown>): string {
    const tag = response.rawResponse.headers.get("ETag");
    if (!tag) throw new Error("v3 response is missing ETag");
    return tag;
}
export interface SaveOptions {
    name?: string;
    agentId?: string;
}
/** Compatibility name for save options. */
export type DeployOptions = SaveOptions;
export async function deployAgent(
    client: AgoraClient,
    body: V3.AgentCreateRequest,
    options: DeployOptions,
): Promise<SavedAgent> {
    const invalid = validateContract(body, contract.AgentRequest_AgentCreateInput, "agent");
    if (invalid.length) throw new UnsupportedFieldError(invalid);
    for (const [kind, module] of Object.entries(body.pipeline ?? {})) {
        if (object(module) && "credential" in module && module.credential?.mode === "byok") {
            for (const value of Object.values(module.credential.fields ?? {}))
                if (typeof value !== "string" || !/^\$secrets\.[A-Za-z0-9_]{1,64}\.[A-Za-z0-9_]{1,64}$/.test(value))
                    throw new Error(
                        `Saved ${kind} credentials require secretRef(); use an ephemeral session for inline credentials`,
                    );
        }
    }
    const agentId = options.agentId;
    let response: WithRawResponse<V3.AgentResponse>;
    if (agentId !== undefined) {
        const current = await client.v3.agents.get({ id: agentId }).withRawResponse();
        response = await client.v3.agents
            .update({ ...redeployPatch(current.data, body), id: agentId, ifMatch: etag(current) })
            .withRawResponse();
    } else response = await client.v3.agents.create(body).withRawResponse();
    return new SavedAgent(client, response.data, etag(response));
}
export interface AssignNumberOptions {
    maxCallDurationSeconds?: number;
    maxSilenceDurationMs?: number;
    /** Full inbound policy, including end_call. Named duration options take precedence. */
    callPolicy?: V3.InboundCallPolicy;
}
export class SavedAgent {
    readonly id: string;
    readonly name: string;
    readonly raw: AgoraClient["v3"]["agents"];
    constructor(
        private readonly client: AgoraClient,
        data: V3.AgentResponse,
        public readonly etag: string,
    ) {
        this.id = data.agent_id;
        this.name = data.agent_name;
        this.raw = client.v3.agents;
    }
    static async get(client: AgoraClient, agentId: string): Promise<SavedAgent> {
        const response = await client.v3.agents.get({ id: agentId }).withRawResponse();
        return new SavedAgent(client, response.data, etag(response));
    }
    createSession(options: SessionOptions): AgentSession {
        return createStoredSession(this.client, options, { agent_id: this.id });
    }
    /** Create an outbound phone-call session using this saved agent. */
    call(options: CallOptions): AgentSession {
        return createStoredSession(
            this.client,
            { ...options, channel: "", remoteUids: [] },
            { agent_id: this.id },
            undefined,
            { type: "telephony", from: options.from, to: options.to, call_policy: options.callPolicy },
        );
    }
    /** Save a revised configuration to this stored identity, preserving its name by default. */
    update(config: Agent, options: { name?: string } = {}): Promise<SavedAgent> {
        if (config.config.client !== this.client) {
            throw new Error("SavedAgent.update requires a configuration bound to the same client");
        }
        return config.save({ agentId: this.id, name: options.name ?? this.name });
    }
    async delete(): Promise<void> {
        await this.raw.delete({ id: this.id });
    }
    /** Scan project number pages and return numbers assigned to this stored agent. */
    async listNumbers(): Promise<V3.NumberResponse[]> {
        const assigned: V3.NumberResponse[] = [];
        for await (const number of this.client.v3.numbers.listAll({ limit: 100 })) {
            if (number.inbound?.agent === this.id) assigned.push(number);
        }
        return assigned;
    }
    assignNumber(number: string | V3.NumberResponse, options: AssignNumberOptions = {}): Promise<V3.NumberResponse> {
        return this.setNumber(number, this.id, options);
    }
    unassignNumber(number: string | V3.NumberResponse): Promise<V3.NumberResponse> {
        return this.setNumber(number, null);
    }
    private async setNumber(
        number: string | V3.NumberResponse,
        agent: string | null,
        options: AssignNumberOptions = {},
    ): Promise<V3.NumberResponse> {
        const policy = clean({
            ...options.callPolicy,
            max_call_duration_seconds: options.maxCallDurationSeconds ?? options.callPolicy?.max_call_duration_seconds,
            max_silence_duration_ms: options.maxSilenceDurationMs ?? options.callPolicy?.max_silence_duration_ms,
        });
        let id: string;
        if (typeof number === "object") id = number.number_id;
        else if (number.startsWith("+")) {
            const normalize = (v: string) => v.replace(/[\s().-]/g, "");
            let found: V3.NumberResponse | undefined;
            for await (const candidate of this.client.v3.numbers.listAll({ limit: 100 }))
                if (normalize(candidate.number) === normalize(number)) {
                    found = candidate;
                    break;
                }
            if (!found) throw new NumberNotFoundError(number, this.client.appId);
            id = found.number_id;
        } else id = number;
        for (let attempt = 0; ; attempt++) {
            const current = await this.client.v3.numbers.get({ id }).withRawResponse();
            try {
                return await this.client.v3.numbers.update({
                    id,
                    ifMatch: etag(current),
                    inbound: {
                        agent,
                        ...(options.callPolicy !== undefined || Object.keys(policy).length
                            ? { call_policy: policy }
                            : {}),
                    },
                });
            } catch (error) {
                if (!(error instanceof PreconditionFailedError) || attempt >= 1) throw error;
            }
        }
    }
}

/** Compatibility alias; save() and deploy() return the same handle type. */
export { SavedAgent as DeployedAgent };
