import type { BaseClientOptions, BaseRequestOptions } from "../BaseClient.js";
import { validatePublicAuthorization } from "../core/auth/publicAuthorization.js";
import { fetcher } from "../core/fetcher/Fetcher.js";
import { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import { toRawResponse } from "../core/fetcher/RawResponse.js";
import { isInternalHeader } from "../core/publicHeaders.js";
import {
    AgoraV3Error,
    asValidation,
    PreconditionFailedError,
    V3ConnectionError,
    V3Error,
    V3TimeoutError,
    V3ValidationError,
} from "./errors.js";

export { PreconditionFailedError, V3Error } from "./errors.js";

export interface V3Options {
    baseUrl?: string;
    headers?: Record<string, string>;
}
export function validateIdempotencyKey(value: string): void {
    if (typeof value !== "string" || !value.trim()) throw new V3ValidationError("Idempotency-Key must not be empty");
    if (!/^[\x21-\x7E]{1,256}$/.test(value))
        throw new V3ValidationError("Idempotency-Key must contain 1–256 printable ASCII characters without spaces");
}
export function segment(value: string): string {
    if (typeof value !== "string" || !value.trim())
        throw new V3ValidationError("v3 path identifiers must not be empty");
    if (value === "." || value === "..") throw new V3ValidationError("v3 path identifiers must not be dot segments");
    return encodeURIComponent(value);
}
export function omit(value: object, keys: string[]): object {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}
/** Keep an active cursor scan bound to its original project, filters and headers. */
export function snapshotPagination<T extends object>(
    request: T | undefined,
    options?: BaseRequestOptions,
): { request: T; options: BaseRequestOptions | undefined } {
    return {
        request: { ...request } as T,
        options:
            options === undefined
                ? undefined
                : {
                      ...options,
                      headers: { ...options.headers },
                      queryParams: JSON.parse(JSON.stringify(options.queryParams ?? {})) as Record<string, unknown>,
                  },
    };
}

function nonJsonBody(body: unknown): string | undefined {
    if (body === null || typeof body !== "object") return undefined;
    const { ok, error, ...rest } = body as { ok?: unknown; error?: unknown };
    if (ok !== false || Object.keys(rest).length || error === null || typeof error !== "object") return undefined;
    const { reason, rawBody } = error as { reason?: unknown; rawBody?: unknown };
    return reason === "non-json" && typeof rawBody === "string" ? rawBody : undefined;
}
export class V3Transport {
    constructor(
        private readonly options: BaseClientOptions,
        private readonly appId: string,
        private readonly baseUrl: () => string,
        private readonly authorization: () => string,
        private readonly extraHeaders: Record<string, string> | undefined,
    ) {}
    request<T>(
        method: string,
        path: string,
        appid: string = this.appId,
        body?: unknown,
        query: Record<string, unknown> = {},
        headers: Record<string, string | null | undefined> = {},
        requestOptions: BaseRequestOptions = {},
        stripWriteHeaders = false,
    ): HttpResponsePromise<T> {
        // Snapshot JSON payload and option maps before any async auth/header suppliers run.
        const capturedHeaders = [this.options.headers, this.extraHeaders, headers].map((value) => ({ ...value }));
        const capturedOptions = { ...requestOptions, headers: { ...requestOptions.headers } };
        const run = async () => {
            for (const key of Object.keys(capturedOptions)) {
                if (
                    ["customerid", "customersecret", "clientid", "clientsecret", "username", "password"].includes(
                        key.replace(/_/g, "").toLowerCase(),
                    )
                )
                    throw new V3ValidationError(
                        `${key} is not supported; configure credentials on AgoraClient or use an authorization override`,
                    );
            }
            if (body && typeof body === "object" && "idempotencyKey" in body)
                throw new V3ValidationError("idempotencyKey is not supported by this operation");
            const bodySnapshot = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
            // Reject removed preview pipelines even for JavaScript/untyped callers.
            for (const pipeline of [
                bodySnapshot?.pipeline,
                bodySnapshot?.agent?.pipeline,
                bodySnapshot?.agent?.overrides?.pipeline,
            ]) {
                if (pipeline && typeof pipeline === "object" && (pipeline.mode === "realtime" || "mllm" in pipeline))
                    throw new V3ValidationError("MLLM is not supported by the preview API");
            }
            const querySnapshot = JSON.parse(JSON.stringify({ ...query, ...capturedOptions.queryParams }));
            requestOptions = capturedOptions;
            const resolved: Record<string, string> = {};
            for (const source of [
                capturedHeaders[0],
                { Authorization: this.authorization() },
                capturedHeaders[1],
                capturedHeaders[2],
                requestOptions.headers,
                requestOptions.authorization !== undefined
                    ? { Authorization: requestOptions.authorization }
                    : undefined,
            ]) {
                for (const [name, supplier] of Object.entries(source ?? {})) {
                    const key = name.toLowerCase();
                    if (stripWriteHeaders && ["if-match", "if-none-match", "idempotency-key"].includes(key)) continue;
                    const value = await (typeof supplier === "function" ? supplier() : supplier);
                    if (value == null) continue;
                    if (isInternalHeader(key))
                        throw new V3ValidationError(`${name} is an internal header and is not supported`);
                    if (key === "authorization") asValidation(() => validatePublicAuthorization(value));
                    if (key === "idempotency-key") validateIdempotencyKey(value);
                    if (
                        key === "idempotency-key" &&
                        !(
                            method === "POST" &&
                            (["/sessions", "/sessions/ephemeral", "/campaigns"].includes(path) ||
                                /^\/campaigns\/[^/]+:(pause|resume|cancel)$/.test(path))
                        )
                    )
                        throw new V3ValidationError(
                            "Idempotency-Key is only supported for session starts and campaign creation/actions",
                        );
                    resolved[key] = value;
                }
            }
            // Observe the last attempt so failures keep their cause and late
            // failures after an HTTP response still surface as API errors.
            let attempt: { response?: Response; error?: unknown } = {};
            const baseFetch = this.options.fetch;
            const fetchFn: typeof fetch = async (input, init) => {
                attempt = {};
                try {
                    const result = await (baseFetch ?? fetch)(input, init);
                    attempt.response = result.ok ? result : result.clone();
                    return result;
                } catch (error) {
                    attempt.error = error;
                    throw error;
                }
            };
            const timeoutMs = (requestOptions.timeoutInSeconds ?? this.options.timeoutInSeconds ?? 60) * 1000;
            const response = await fetcher<T>({
                url: `${this.baseUrl().replace(/\/+$/, "")}/conversational-ai/v1/projects/${segment(appid)}${path}`,
                method,
                contentType: "application/json",
                requestType: "json",
                responseType: "json",
                body: bodySnapshot,
                queryParameters: querySnapshot,
                headers: resolved,
                timeoutMs,
                // Writes never retry automatically, including requests with explicit idempotency keys.
                maxRetries: method === "GET" ? (requestOptions.maxRetries ?? this.options.maxRetries ?? 2) : 0,
                abortSignal: requestOptions.abortSignal,
                fetchFn,
            });
            if (response.ok) {
                // The fetcher returns an undecodable 2xx body as a non-json marker
                // instead of failing; that violates the API contract.
                const marker = nonJsonBody(response.body);
                if (marker !== undefined)
                    throw new V3Error(response.rawResponse.status, marker, response.rawResponse, {
                        message: `v3 response is not valid JSON (${response.rawResponse.status})`,
                    });
                return { data: response.body, rawResponse: response.rawResponse };
            }
            const error = response.error;
            if (error.reason === "timeout")
                throw new V3TimeoutError(`v3 request timed out after ${timeoutMs}ms`, { cause: attempt.error });
            let status: number;
            let detail: unknown;
            let raw = response.rawResponse;
            if (error.reason === "status-code" || error.reason === "non-json") {
                status = error.statusCode;
                detail = error.reason === "status-code" ? error.body : error.rawBody;
            } else if (attempt.error === undefined && attempt.response !== undefined && !attempt.response.ok) {
                // The server answered, but its error body could not be decoded.
                status = attempt.response.status;
                raw = toRawResponse(attempt.response);
                detail = await attempt.response.text().catch(() => undefined);
            } else {
                // Errors raised by the SDK's own fetch wrappers keep their type.
                if (attempt.error instanceof AgoraV3Error) throw attempt.error;
                throw new V3ConnectionError(`v3 request failed: ${error.errorMessage}`, { cause: attempt.error });
            }
            if (status === 412)
                throw new PreconditionFailedError(detail, raw, () =>
                    this.request(
                        "GET",
                        path.includes("/keys/") ? path.split("/keys/")[0]! : path,
                        appid,
                        undefined,
                        {},
                        {},
                        requestOptions,
                        true,
                    ),
                );
            throw new V3Error(status, detail, raw);
        };
        return HttpResponsePromise.fromPromise(run());
    }
}
