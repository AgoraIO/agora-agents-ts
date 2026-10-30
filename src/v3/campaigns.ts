/** Campaign resource operations; no client-side scheduling/retry orchestration. */
import type { BaseRequestOptions } from "../BaseClient.js";
import type { HttpResponsePromise } from "../core/fetcher/HttpResponsePromise.js";
import type * as T from "./campaign-schema.js";
import { omit, segment, snapshotPagination, type V3Transport } from "./transport.js";
export class CampaignsResource {
    constructor(private transport: V3Transport) {}
    create(
        request: T.CampaignCreate & { appid?: string; idempotencyKey?: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.transport.request(
            "POST",
            "/campaigns",
            request.appid,
            omit(request, ["appid", "idempotencyKey"]),
            {},
            { "Idempotency-Key": request.idempotencyKey },
            options,
        );
    }
    list(
        request: {
            appid?: string;
            status?: "scheduled" | "running" | "paused" | "completed" | "canceled" | "failed";
            limit?: number;
            cursor?: string | null;
            order?: "create_ts.asc" | "create_ts.desc";
        } = {},
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignListResponse> {
        return this.transport.request(
            "GET",
            "/campaigns",
            request.appid,
            undefined,
            omit(request, ["appid"]) as Record<string, unknown>,
            {},
            options,
        );
    }
    async *listAll(
        request: Parameters<CampaignsResource["list"]>[0] = {},
        options?: BaseRequestOptions,
    ): AsyncGenerator<T.CampaignResponse> {
        const snapshot = snapshotPagination(request, options);
        request = snapshot.request;
        options = snapshot.options;
        const seen = new Set<string>();
        let cursor = request?.cursor;
        while (true) {
            const page = await this.list({ ...request, cursor }, options);
            yield* page.data.list;
            if (!page.has_more) return;
            if (!page.next_cursor || seen.has(page.next_cursor))
                throw new Error("Invalid repeated or missing pagination cursor");
            cursor = page.next_cursor;
            seen.add(cursor);
        }
    }
    get(
        request: { appid?: string; id: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.transport.request(
            "GET",
            `/campaigns/${segment(request.id)}`,
            request.appid,
            undefined,
            {},
            {},
            options,
        );
    }
    update(
        request: T.CampaignPatch & { appid?: string; id: string; ifMatch: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.transport.request(
            "PATCH",
            `/campaigns/${segment(request.id)}`,
            request.appid,
            omit(request, ["appid", "id", "ifMatch"]),
            {},
            { "If-Match": request.ifMatch },
            options,
        );
    }
    delete(
        request: { appid?: string; id: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignDeleteResponse> {
        return this.transport.request(
            "DELETE",
            `/campaigns/${segment(request.id)}`,
            request.appid,
            undefined,
            {},
            {},
            options,
        );
    }
    pause(
        request: { appid?: string; id: string; idempotencyKey?: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.action("pause", request, options);
    }
    resume(
        request: { appid?: string; id: string; idempotencyKey?: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.action("resume", request, options);
    }
    cancel(
        request: { appid?: string; id: string; idempotencyKey?: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.action("cancel", request, options);
    }
    private action(
        action: "pause" | "resume" | "cancel",
        request: { appid?: string; id: string; idempotencyKey?: string },
        options?: BaseRequestOptions,
    ): HttpResponsePromise<T.CampaignResponse> {
        return this.transport.request(
            "POST",
            `/campaigns/${segment(request.id)}:${action}`,
            request.appid,
            undefined,
            {},
            { "Idempotency-Key": request.idempotencyKey },
            options,
        );
    }
}
