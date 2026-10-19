/** Internal adapter for session identities, without mixing them with running-agent IDs. */
import type { AgoraClient } from "../AgoraPoolClient.js";
import { Area } from "../core/domain/index.js";
import { V3Error } from "../v3/transport.js";
import type { AgentCreateRequest, SessionStartOptions } from "../v3/types.js";
import type { Agent } from "./Agent.js";
import { AgentSession } from "./AgentSession.js";
import type { SessionInfo, SessionOptions } from "./types.js";

export interface SessionBackend {
    start(): Promise<string>;
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
    if ("agent" in source && options.labels !== undefined)
        throw new Error("labels are not confirmed for ephemeral sessions");
    if (client.area === Area.CN) throw new Error("Stored sessions in CN are pending backend confirmation");
    for (const key of ["token", "expiresIn", "enableStringUid", "preset", "pipelineId"] as const) {
        if (options[key] !== undefined) throw new Error(`${key} is not supported by this session backend`);
    }
    if (!options.channel.trim() || !options.agentUid.trim() || options.remoteUids.some((uid) => !uid.trim())) {
        throw new Error("Session channel and UIDs must not be empty");
    }
    const lifecycle: NonNullable<SessionStartOptions["lifecycle"]> = {};
    for (const [key, wire] of [
        ["idleTimeout", "idle_timeout_ms"],
        ["maxDuration", "max_duration_ms"],
    ] as const) {
        const seconds = options[key];
        if (seconds !== undefined) {
            if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(seconds * 1000)) {
                throw new Error(`${key} must be nonnegative seconds representable as integer milliseconds`);
            }
            lifecycle[wire] = seconds * 1000;
        }
    }
    const payload = JSON.parse(
        JSON.stringify({
            ...source,
            client_reference: options.clientReference ?? options.name,
            labels: options.labels,
            transport: {
                type: "rtc",
                channel: options.channel,
                uid: options.agentUid,
                subscribe_uids: options.remoteUids,
            },
            ...(Object.keys(lifecycle).length ? { lifecycle } : {}),
        }),
    );
    const backend: SessionBackend = {
        async start() {
            const result =
                "agent_id" in payload
                    ? await client.v3.sessions.start(payload)
                    : await client.v3.sessions.startEphemeral(payload);
            if (typeof result.agent_session_id !== "string" || !result.agent_session_id.trim()) {
                throw new Error("Session start response is missing agent_session_id");
            }
            return result.agent_session_id;
        },
        async stop(id) {
            try {
                await client.v3.sessions.stop({ agentSessionId: id });
            } catch (error) {
                if (
                    error instanceof V3Error &&
                    error.statusCode === 404 &&
                    (error.body as { reason?: string } | null)?.reason === "TaskNotFound"
                )
                    return;
                throw error;
            }
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
        name: options.name ?? options.clientReference ?? "session",
        ...options,
    });
}
