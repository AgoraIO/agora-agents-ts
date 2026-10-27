/** Public contract corrections from engineering's v3-open-questions-reply.md (2026-10-27).
 * Generated schema remains intact; this adapter corrects statuses, timestamps and headers.
 */
import type { BaseRequestOptions } from "../BaseClient.js";
import type { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import { HttpResponsePromise as ResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import { omit, segment, type V3Transport } from "./transport.js";
import type * as Schema from "./session-schema.js";

export type SessionGeofence = {
    area: "global" | "north_america" | "europe" | "asia" | "india" | "japan";
    exclude_area?: "north_america" | "europe" | "asia" | "india" | "japan";
};
export type SessionTransport = (Schema.RtcTransport & { geofence?: SessionGeofence }) | Schema.TelephonyTransport;
export type SessionStartOptions = Omit<Schema.SessionCreate, "agent_id" | "client_reference" | "transport"> & {
    transport: SessionTransport;
    idempotencyKey?: string;
};
export type SessionStartRequest = SessionStartOptions & { agent_id: string };
export type EphemeralSessionStartRequest = Omit<Schema.EphemeralSessionCreate, "client_reference" | "transport"> & {
    transport: SessionTransport;
    idempotencyKey?: string;
};
export interface SessionStartResponse {
    agent_session_id: string;
    status: "STARTING" | "RUNNING";
    create_ts: number;
}
export function normalizeSessionStart(value: unknown): SessionStartResponse {
    const data = value as Record<string, unknown>;
    const status = typeof data?.status === "string" ? data.status.toUpperCase() : "";
    const timestamp = data?.create_ts ?? data?.created_at;
    if (
        !data ||
        typeof data.agent_session_id !== "string" ||
        !data.agent_session_id.trim() ||
        !["STARTING", "RUNNING"].includes(status) ||
        typeof timestamp !== "number" ||
        !Number.isInteger(timestamp) ||
        timestamp < 0
    )
        throw new Error("Invalid session start response");
    return {
        agent_session_id: data.agent_session_id,
        status: status as SessionStartResponse["status"],
        create_ts: timestamp,
    };
}
function range(value: number | undefined, min: number, max: number, field: string): void {
    if (value !== undefined && (!Number.isInteger(value) || value < min || value > max))
        throw new Error(`${field} must be an integer between ${min} and ${max}`);
}
export function validateSessionStart(request: SessionStartRequest | EphemeralSessionStartRequest): void {
    if ("client_reference" in request || "clientReference" in request)
        throw new Error(
            "client_reference is being removed; use application-side correlation with the returned session ID",
        );
    if (request.idempotencyKey !== undefined && !request.idempotencyKey.trim())
        throw new Error("idempotencyKey must not be empty");
    const transport = request.transport;
    if (transport.type === "rtc") {
        if (!transport.channel || [...transport.channel].length > 256)
            throw new Error("channel must contain 1–256 characters");
        if (typeof transport.uid !== "string" || !transport.uid.trim()) throw new Error("uid must be nonempty");
        if (
            !Array.isArray(transport.subscribe_uids) ||
            transport.subscribe_uids.length !== 1 ||
            typeof transport.subscribe_uids[0] !== "string" ||
            !transport.subscribe_uids[0].trim() ||
            transport.subscribe_uids[0] === "*" ||
            /^0+$/.test(transport.subscribe_uids[0])
        )
            throw new Error("Exactly one non-wildcard subscriber UID is required");
        const numeric = (uid: string) => /^[0-9]+$/.test(uid);
        if (transport.uid !== "0" && numeric(transport.uid) !== numeric(transport.subscribe_uids[0]))
            throw new Error("Agent and subscriber must use the same UID type");
        if (transport.audio_scenario !== undefined && !["aiserver", "chorus"].includes(transport.audio_scenario))
            throw new Error("Invalid audio_scenario");
        if (transport.geofence !== undefined) {
            const areas = ["global", "north_america", "europe", "asia", "india", "japan"];
            const fence = transport.geofence;
            if (
                !areas.includes(fence.area) ||
                (fence.exclude_area !== undefined &&
                    (fence.area !== "global" || !areas.slice(1).includes(fence.exclude_area)))
            )
                throw new Error("Invalid geofence: exclude_area requires global area");
        }
        if (transport.encryption) {
            if (
                ![
                    "aes_128_xts",
                    "aes_128_ecb",
                    "aes_256_xts",
                    "sm4_128_ecb",
                    "aes_128_gcm",
                    "aes_256_gcm",
                    "aes_128_gcm2",
                    "aes_256_gcm2",
                ].includes(transport.encryption.mode) ||
                !transport.encryption.key
            )
                throw new Error("Invalid RTC encryption mode/key");
            if (transport.encryption.salt != null && !/^[A-Za-z0-9+/]{43}=$/.test(transport.encryption.salt))
                throw new Error("Invalid RTC encryption salt");
        }
    } else if (transport.type === "telephony") {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transport.from))
            throw new Error("telephony.from must be a registered number UUID");
        if (!/^\+[1-9][0-9]{1,14}$/.test(transport.to)) throw new Error("telephony.to must be E.164");
    } else throw new Error("Unsupported session transport");
    range(request.lifecycle?.idle_timeout_ms, 0, 3600000, "idle_timeout_ms");
    range(request.lifecycle?.max_duration_ms, 1000, 3600000, "max_duration_ms");
    range(request.lifecycle?.graceful_stop?.timeout_ms, 0, 120000, "graceful_stop.timeout_ms");
    if (request.data_policy?.retention !== undefined && !["none", "30_days"].includes(request.data_policy.retention))
        throw new Error("Invalid data_policy.retention");
    for (const [name, value] of Object.entries(request.values ?? {})) {
        if (
            !/^[a-z][a-z0-9_]{0,63}$/.test(name) ||
            !["string", "number", "boolean"].includes(typeof value) ||
            (typeof value === "number" && !Number.isFinite(value))
        )
            throw new Error("Invalid session variable value");
    }
}
export class SessionLifecycleResource {
    constructor(protected transport: V3Transport) {}
    private startRequest(
        path: string,
        request: { appid?: string } & (SessionStartRequest | EphemeralSessionStartRequest),
        options?: BaseRequestOptions,
    ): HttpResponsePromise<SessionStartResponse> {
        validateSessionStart(request);
        const raw = this.transport.request<unknown>(
            "POST",
            path,
            request.appid,
            omit(request, ["appid", "idempotencyKey"]),
            {},
            { "Idempotency-Key": request.idempotencyKey },
            options,
        );
        return ResponsePromise.fromPromise(
            raw.withRawResponse().then(({ data, rawResponse }) => ({ data: normalizeSessionStart(data), rawResponse })),
        );
    }
    start(
        request: { appid?: string } & SessionStartRequest,
        options?: BaseRequestOptions,
    ): HttpResponsePromise<SessionStartResponse> {
        segment(request.agent_id);
        return this.startRequest("/sessions", request, options);
    }
    startEphemeral(
        request: { appid?: string } & EphemeralSessionStartRequest,
        options?: BaseRequestOptions,
    ): HttpResponsePromise<SessionStartResponse> {
        return this.startRequest("/sessions/ephemeral", request, options);
    }
    stop(
        request: { appid?: string; agentSessionId: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<Record<string, never>> {
        return this.transport.request(
            "POST",
            `/sessions/${segment(request.agentSessionId)}/stop`,
            request.appid,
            undefined,
            {},
            {},
            options,
        );
    }
}
