/** Internal adapter for session identities, without mixing them with running-agent IDs. */
import type { AgoraClient } from "../AgoraPoolClient.js";
import { Area } from "../core/domain/index.js";
import { validateSessionStart } from "../v3/session-lifecycle.js";
import type { AgentCreateRequest, SessionStartOptions } from "../v3/types.js";
import type { Agent } from "./Agent.js";
import { AgentSession } from "./AgentSession.js";
import type { SessionInfo, SessionOptions } from "./types.js";

export interface SessionBackend {
    start(): Promise<{ id: string; status: "starting" | "running" }>;
    stop(id: string): Promise<void>;
    getInfo(id: string): Promise<SessionInfo>;
}
export class UnsupportedSessionOperationError extends Error {
    constructor(operation: string) {
        super(`${operation} is not supported by this session backend; only start, stop and getInfo are available`);
        this.name = "UnsupportedSessionOperationError";
    }
}
export function createStoredSession(
    client: AgoraClient,
    options: SessionOptions,
    source: { agent_id: string } | { agent: Omit<AgentCreateRequest, "agent_name"> },
    config?: Agent,
): AgentSession {
    if (client.area === Area.CN) throw new Error("Stored sessions in CN are pending backend confirmation");
    for (const key of [
        "clientReference",
        "client_reference",
        "expiresIn",
        "enableStringUid",
        "preset",
        "pipelineId",
    ] as const) {
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
            transport: {
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
    let successfullyStarted = false;
    const backend: SessionBackend = {
        async start() {
            if (payload.idempotencyKey && successfullyStarted)
                throw new Error(
                    "This idempotency key already started a session; create a new handle with a new key for another session",
                );
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
    });
}
