/** Internal adapter for session identities, without mixing them with running-agent IDs. */
import type { AgoraClient } from "../AgoraPoolClient.js";
import { validateSessionStart } from "../v3/session-lifecycle.js";
import type { AgentCreateRequest, SessionStartOptions, TelephonyTransport } from "../v3/types.js";
import type { Agent } from "./Agent.js";
import { AgentSession } from "./AgentSession.js";
import { ExpiresIn, generateConvoAIToken, generateRtcTokenWithAccount } from "./token.js";
import type { AgentConfigUpdate, CallOptions, SessionInfo, SessionOptions } from "./types.js";

export interface SessionBackend {
    start(): Promise<{ id: string; status: "starting" | "running" }>;
    stop(id: string): Promise<void>;
    update(id: string, config: AgentConfigUpdate): Promise<void>;
    getInfo(id: string): Promise<SessionInfo>;
}
export class UnsupportedSessionOperationError extends Error {
    constructor(operation: string) {
        super(`${operation} is not supported by this session backend; start, stop, getInfo and update are available`);
        this.name = "UnsupportedSessionOperationError";
    }
}
/** Validate mixed transports before replacing internal RTC placeholders. */
export function callSessionOptions(options: CallOptions): SessionOptions {
    for (const key of [
        "channel",
        "remoteUids",
        "agentUid",
        "token",
        "encryption",
        "audioScenario",
        "geofence",
        "enableStringUid",
        "expiresIn",
    ] as const) {
        if ((options as unknown as Record<string, unknown>)[key] !== undefined)
            throw new Error(`Phone calls do not accept RTC option ${key}`);
    }
    return { ...options, channel: "", remoteUids: [] };
}

export function createStoredSession(
    client: AgoraClient,
    options: SessionOptions,
    source: { agent_id: string } | { agent: Omit<AgentCreateRequest, "agent_name"> },
    config?: Agent,
    telephony?: TelephonyTransport,
): AgentSession {
    for (const key of ["clientReference", "client_reference", "enableStringUid", "preset", "pipelineId"] as const) {
        if (key in options && (options as unknown as Record<string, unknown>)[key] !== undefined)
            throw new Error(`${key} is not supported by this session backend`);
    }
    const lifecycle: NonNullable<SessionStartOptions["lifecycle"]> = {};
    for (const [key, wire] of [
        ["idleTimeout", "idle_timeout_ms"],
        ["maxDuration", "max_duration_ms"],
    ] as const) {
        if (options[key] !== undefined) lifecycle[wire] = options[key]! * 1000;
    }
    if (options.gracefulStop !== undefined) lifecycle.graceful_stop = options.gracefulStop;
    const payload = JSON.parse(
        JSON.stringify({
            ...source,
            values: options.values,
            idempotencyKey: options.idempotencyKey,
            data_policy: options.dataPolicy,
            labels: options.labels,
            transport: telephony ?? {
                type: "rtc",
                channel: options.channel,
                uid: options.agentUid,
                subscribe_uids: options.remoteUids,
                token: options.token,
                encryption: options.encryption,
                audio_scenario: options.audioScenario,
                geofence: options.geofence,
            },
            ...(Object.keys(lifecycle).length ? { lifecycle } : {}),
        }),
    );
    validateSessionStart(payload);
    if (
        options.expiresIn !== undefined &&
        (!Number.isInteger(options.expiresIn) || !Number.isFinite(options.expiresIn))
    )
        throw new Error("expiresIn must be a whole number of seconds");
    if (
        telephony &&
        [options.agentUid, options.token, options.encryption, options.audioScenario, options.geofence].some(
            (value) => value !== undefined,
        )
    )
        throw new Error("RTC options are not supported for phone calls");
    const expiry = options.expiresIn === undefined ? undefined : ExpiresIn.seconds(options.expiresIn);
    const signing =
        !telephony &&
        options.token === undefined &&
        client.appCertificate &&
        options.agentUid !== undefined &&
        !/^0+$/.test(options.agentUid)
            ? {
                  appId: client.appId,
                  appCertificate: client.appCertificate,
                  channel: options.channel,
                  uid: options.agentUid,
              }
            : undefined;
    let successfullyStarted = false;
    const backend: SessionBackend = {
        async start() {
            if (payload.idempotencyKey && successfullyStarted)
                throw new Error(
                    "This idempotency key already started a session; create a new handle with a new key for another session",
                );
            if (successfullyStarted && !payload.idempotencyKey) {
                // A new unkeyed session needs a fresh token. Failed starts retain
                // their request snapshot, and keyed starts cannot be reused.
                if (signing) delete payload.transport.token;
                successfullyStarted = false;
            }
            if (
                signing &&
                payload.transport.token === undefined &&
                (!/^\d+$/.test(signing.uid) ||
                    (Number.isSafeInteger(Number(signing.uid)) && Number(signing.uid) <= 4294967295))
            ) {
                // Larger numeric identities remain opaque; the service provisions
                // their token instead of coercing them through the local signer.
                payload.transport.token = /^\d+$/.test(signing.uid)
                    ? generateConvoAIToken({
                          appId: signing.appId,
                          appCertificate: signing.appCertificate,
                          channelName: signing.channel,
                          uid: Number(signing.uid),
                          tokenExpire: expiry,
                      })
                    : generateRtcTokenWithAccount({
                          appId: signing.appId,
                          appCertificate: signing.appCertificate,
                          channel: signing.channel,
                          account: signing.uid,
                          expirySeconds: expiry,
                      });
            }
            const result =
                "agent_id" in payload
                    ? await client.v3.sessions.start(payload)
                    : await client.v3.sessions.startEphemeral(payload);
            if (typeof result.agent_session_id !== "string" || !result.agent_session_id.trim()) {
                throw new Error("Session start response is missing agent_session_id");
            }
            successfullyStarted = true;
            return { id: result.agent_session_id, status: result.status === "STARTING" ? "starting" : "running" };
        },
        async stop(id) {
            await client.v3.sessions.stop({ agentSessionId: id });
        },
        async update(id, config) {
            const input = config as Record<string, any>;
            if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid session update");
            for (const key of Object.keys(input))
                if (!["token", "messages", "llm"].includes(key))
                    throw new Error(`Unsupported session update field: ${key}`);
            if (input.messages !== undefined && input.llm?.system_messages !== undefined)
                throw new Error("Provide messages or llm.system_messages, not both");
            const patch: Record<string, any> = {};
            if (input.token !== undefined) {
                if (typeof input.token !== "string" || !input.token) throw new Error("token must be a string");
                patch.transport = { token: input.token };
            }
            const overrides: Record<string, any> = {};
            const messages = input.messages ?? input.llm?.system_messages;
            if (messages !== undefined) {
                if (
                    !Array.isArray(messages) ||
                    messages.some(
                        (message: any) =>
                            !message ||
                            !["system", "user", "assistant"].includes(message.role) ||
                            typeof message.content !== "string" ||
                            Object.keys(message).some((key) => !["role", "content"].includes(key)),
                    )
                )
                    throw new Error("Invalid session messages");
                overrides.messages = messages;
            }
            for (const kind of ["llm"])
                if (input[kind] !== undefined) {
                    const module = input[kind];
                    if (
                        !module ||
                        typeof module !== "object" ||
                        Array.isArray(module) ||
                        Object.keys(module).some(
                            (key) => !["params", ...(kind === "llm" ? ["system_messages"] : [])].includes(key),
                        )
                    )
                        throw new Error(`Invalid ${kind} update`);
                    if (module.params !== undefined) {
                        if (!module.params || typeof module.params !== "object" || Array.isArray(module.params))
                            throw new Error("params must be an object");
                        if (
                            Object.keys(module.params).some((key) =>
                                ["url", "base_url", "api_base_url", "endpoint"].includes(key.toLowerCase()),
                            )
                        )
                            throw new Error("Runtime endpoint aliases are not mutable");
                        overrides.pipeline = { [kind]: { params: module.params } };
                    }
                }
            if (Object.keys(overrides).length) patch.agent = { overrides };
            await client.v3.sessions.update({ agentSessionId: id, ...patch });
        },
        async getInfo(id) {
            const info = await client.v3.sessions.get({ agentSessionId: id });
            return { ...info, message: info.message ?? undefined, stop_ts: info.stop_ts ?? undefined };
        },
    };
    return new AgentSession({
        client,
        agent: config,
        backend,
        appId: client.appId,
        name: options.name ?? "session",
        ...options,
        agentUid: options.agentUid ?? "0",
    });
}
