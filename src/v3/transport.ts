import { isInternalHeader } from "../core/publicHeaders.js";
import type { BaseClientOptions, BaseRequestOptions } from "../BaseClient.js";
import { fetcher } from "../core/fetcher/Fetcher.js";
import { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import type { RawResponse } from "../core/fetcher/RawResponse.js";

export interface V3Options {
    baseUrl?: string;
    headers?: Record<string, string>;
}
export function validateIdempotencyKey(value: string): void {
    if (typeof value !== "string" || !value.trim()) throw new Error("Idempotency-Key must not be empty");
    if (!/^[\x21-\x7E]{1,256}$/.test(value))
        throw new Error("Idempotency-Key must contain 1–256 printable ASCII characters without spaces");
}
export function segment(value: string): string {
    if (typeof value !== "string" || !value.trim()) throw new Error("v3 path identifiers must not be empty");
    if (value === "." || value === "..") throw new Error("v3 path identifiers must not be dot segments");
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

export class V3Error extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly body: unknown,
        public readonly rawResponse: RawResponse,
    ) {
        super(`v3 request failed (${statusCode})`);
        this.name = "V3Error";
    }
    get requestId(): string | null {
        return this.rawResponse.headers.get("Agora-Request-Id");
    }
}
export class PreconditionFailedError extends V3Error {
    constructor(
        body: unknown,
        raw: RawResponse,
        private readonly reload: () => Promise<unknown>,
    ) {
        super(412, body, raw);
        this.name = "PreconditionFailedError";
    }
    latest(): Promise<unknown> {
        return this.reload();
    }
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
                    throw new Error(`${key} is not supported; use token authorization`);
            }
            if (body && typeof body === "object" && "idempotencyKey" in body)
                throw new Error("idempotencyKey is not supported by this operation");
            const bodySnapshot = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
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
                    if (isInternalHeader(key)) throw new Error(`${name} is an internal header and is not supported`);
                    if (key === "authorization" && !/^agora token=\S+$/i.test(value))
                        throw new Error("Only Agora token authorization is supported");
                    if (key === "idempotency-key") validateIdempotencyKey(value);
                    if (
                        key === "idempotency-key" &&
                        !(
                            method === "POST" &&
                            (["/sessions", "/sessions/ephemeral", "/campaigns"].includes(path) ||
                                /^\/campaigns\/[^/]+:(pause|resume|cancel)$/.test(path))
                        )
                    )
                        throw new Error(
                            "Idempotency-Key is only supported for session starts and campaign creation/actions",
                        );
                    resolved[key] = value;
                }
            }
            const response = await fetcher<T>({
                url: `${this.baseUrl().replace(/\/+$/, "")}/conversational-ai/v1/projects/${segment(appid)}${path}`,
                method,
                contentType: "application/json",
                requestType: "json",
                responseType: "json",
                body: bodySnapshot,
                queryParameters: querySnapshot,
                headers: resolved,
                timeoutMs: (requestOptions.timeoutInSeconds ?? this.options.timeoutInSeconds ?? 60) * 1000,
                // Writes never retry automatically, including requests with explicit idempotency keys.
                maxRetries: method === "GET" ? (requestOptions.maxRetries ?? this.options.maxRetries ?? 2) : 0,
                abortSignal: requestOptions.abortSignal,
                fetchFn: this.options.fetch,
            });
            if (response.ok) return { data: response.body, rawResponse: response.rawResponse };
            const error = response.error;
            const status = "statusCode" in error ? error.statusCode : response.rawResponse.status;
            const detail = "body" in error ? error.body : error;
            if (status === 412)
                throw new PreconditionFailedError(detail, response.rawResponse, () =>
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
            throw new V3Error(status, detail, response.rawResponse);
        };
        return HttpResponsePromise.fromPromise(run());
    }
}
