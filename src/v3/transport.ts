import type { BaseClientOptions, BaseRequestOptions } from "../BaseClient.js";
import { fetcher } from "../core/fetcher/Fetcher.js";
import { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import type { RawResponse } from "../core/fetcher/RawResponse.js";

export interface V3Options {
    baseUrl?: string;
    headers?: Record<string, string>;
}
export function segment(value: string): string {
    if (typeof value !== "string" || !value.trim()) throw new Error("v3 path identifiers must not be empty");
    return encodeURIComponent(value);
}
export function omit(value: object, keys: string[]): object {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
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
    ): HttpResponsePromise<T> {
        const run = async () => {
            const response = await fetcher<T>({
                url: `${this.baseUrl().replace(/\/+$/, "")}/conversational-ai/v3/projects/${segment(appid)}${path}`,
                method,
                contentType: "application/json",
                requestType: "json",
                responseType: "json",
                body,
                queryParameters: { ...query, ...requestOptions.queryParams },
                headers: {
                    ...this.options.headers,
                    Authorization: this.authorization(),
                    ...this.extraHeaders,
                    ...headers,
                    ...requestOptions.headers,
                    ...(requestOptions.authorization ? { Authorization: requestOptions.authorization } : {}),
                },
                timeoutMs: (requestOptions.timeoutInSeconds ?? this.options.timeoutInSeconds ?? 60) * 1000,
                // Creates have no reliable idempotency; conditional writes must never retry silently.
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
                    this.request("GET", path.includes("/keys/") ? path.split("/keys/")[0]! : path, appid),
                );
            throw new V3Error(status, detail, response.rawResponse);
        };
        return HttpResponsePromise.fromPromise(run());
    }
}
