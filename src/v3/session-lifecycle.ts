/** Session writes evidenced by the refreshed Bruno collection (2026-10-19).
 * Supplemental to the older OpenAPI snapshot; intentionally handwritten.
 */
import type { BaseRequestOptions } from "../BaseClient.js";
import type { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import { omit, segment, type V3Transport } from "./transport.js";
import type { AgentCreateRequest } from "./types.js";

export interface SessionStartOptions {
    client_reference?: string;
    labels?: Record<string, string>;
    transport: { type: "rtc"; channel: string; uid: string; subscribe_uids: string[] };
    lifecycle?: { idle_timeout_ms?: number; max_duration_ms?: number };
}
export interface SessionStartRequest extends SessionStartOptions {
    agent_id: string;
}
export interface EphemeralSessionStartRequest extends Omit<SessionStartOptions, "labels"> {
    agent: Omit<AgentCreateRequest, "agent_name">;
}
export interface SessionStartResponse {
    agent_session_id: string;
    status: string;
    created_at: unknown;
}
export class SessionLifecycleResource {
    constructor(protected transport: V3Transport) {}
    start(
        request: { appid?: string } & SessionStartRequest,
        options?: BaseRequestOptions,
    ): HttpResponsePromise<SessionStartResponse> {
        segment(request.agent_id);
        return this.transport.request("POST", "/sessions", request.appid, omit(request, ["appid"]), {}, {}, options);
    }
    startEphemeral(
        request: { appid?: string } & EphemeralSessionStartRequest,
        options?: BaseRequestOptions,
    ): HttpResponsePromise<SessionStartResponse> {
        return this.transport.request(
            "POST",
            "/sessions/ephemeral",
            request.appid,
            omit(request, ["appid"]),
            {},
            {},
            options,
        );
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
