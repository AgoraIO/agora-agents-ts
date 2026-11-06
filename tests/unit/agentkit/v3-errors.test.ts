import { describe, expect, it, vi } from "vitest";
import {
    Agent,
    AgentSession,
    AgoraClient,
    AgoraError,
    AgoraV3Error,
    Area,
    NumberNotFoundError,
    OpenAIRealtime,
    PreconditionFailedError,
    SavedAgent,
    SecretRefNotSupportedError,
    secretRef,
    UnsupportedFieldError,
    UnsupportedSessionOperationError,
    V3ConfigurationError,
    V3ConnectionError,
    V3Error,
    V3TimeoutError,
    V3ValidationError,
} from "../../../src/index.js";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ETag: '"v1"', "Agora-Request-Id": "req-1", ...headers },
    });

function setup(fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    const mock = vi.fn(fetch);
    const client = new AgoraClient({
        area: Area.US,
        appId: "app",
        authToken: "secret-token",
        fetch: mock,
        v3: { baseUrl: "https://staging.test" },
    });
    return { client, fetch: mock };
}

const settle = async (run: () => unknown): Promise<unknown> => {
    try {
        await run();
    } catch (error) {
        return error;
    }
    throw new Error("expected the operation to fail");
};

describe("v3 error taxonomy", () => {
    it("rejects invalid input locally with V3ValidationError before any request", async () => {
        const { client, fetch } = setup(async () => json({}));
        const cases: Array<() => unknown> = [
            () => client.v3.agents.get({ id: " " }),
            () => client.v3.agents.get({ id: ".." }),
            () =>
                client.v3.sessions.start({
                    agent_id: "a",
                    transport: { type: "rtc", channel: "", subscribe_uids: ["1"] },
                }),
            () =>
                client.v3.sessions.start({
                    agent_id: "a",
                    idempotencyKey: "has space",
                    transport: { type: "rtc", channel: "c", subscribe_uids: ["1"] },
                }),
            () => client.v3.agents.list({}, { headers: { "X-Studio-Project": "1" } }),
            () => client.v3.agents.list({}, { headers: { "Idempotency-Key": "k" } }),
            () => client.v3.agents.list({}, { customerSecret: "x" } as never),
        ];
        for (const run of cases) {
            const error = await settle(run);
            expect(error).toBeInstanceOf(V3ValidationError);
            expect(error).toBeInstanceOf(AgoraV3Error);
            expect(error).toBeInstanceOf(Error);
            expect(error).not.toBeInstanceOf(V3Error);
            expect((error as V3ValidationError).category).toBe("validation");
            expect((error as Error).name).toBe("V3ValidationError");
        }
        expect(fetch).not.toHaveBeenCalled();
    });

    it("wraps invalid authorization overrides with the original error as cause and no secret in the message", async () => {
        const { client, fetch } = setup(async () => json({}));
        const error = (await settle(() =>
            client.v3.agents.list({}, { headers: { Authorization: "Bearer leaked-value" } }),
        )) as V3ValidationError;
        expect(error).toBeInstanceOf(V3ValidationError);
        expect(error.cause).toBeInstanceOf(Error);
        expect(error.cause).not.toBeInstanceOf(AgoraV3Error);
        expect(error.message).not.toContain("leaked-value");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("reports client misconfiguration as V3ConfigurationError", () => {
        const make = (options: Record<string, unknown>) => () =>
            new AgoraClient({ area: Area.US, appId: "app", authToken: "t", ...options } as never);
        const bad = [
            make({ v3: { baseUrl: "not a url" } }),
            make({ v3: { baseUrl: "https://host.test/path" } }),
            make({ customerId: "id", customerSecret: "secret" }),
            make({ authToken: undefined }),
            make({ authToken: undefined, customerId: "a:b", customerSecret: "secret" }),
            make({ clientSecret: "x" }),
        ];
        for (const run of bad) {
            let error: unknown;
            try {
                run();
            } catch (e) {
                error = e;
            }
            expect(error).toBeInstanceOf(V3ConfigurationError);
            expect(error).toBeInstanceOf(AgoraV3Error);
            expect(error).not.toBeInstanceOf(V3ValidationError);
            expect((error as V3ConfigurationError).category).toBe("configuration");
            expect((error as Error).name).toBe("V3ConfigurationError");
            expect((error as Error).message).not.toContain("secret");
        }
        let parse: V3ConfigurationError | undefined;
        try {
            make({ v3: { baseUrl: "not a url" } })();
        } catch (e) {
            parse = e as V3ConfigurationError;
        }
        expect(parse?.message).toBe("v3.baseUrl must be an HTTP(S) origin");
        expect(parse?.cause).toBeInstanceOf(TypeError);
    });

    it("surfaces network failures as V3ConnectionError with the cause chain, never as V3Error", async () => {
        const root = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:443"), { code: "ECONNREFUSED" });
        const failure = new TypeError("fetch failed", { cause: root } as never);
        const { client, fetch } = setup(async () => {
            throw failure;
        });
        const error = (await settle(() => client.v3.agents.get({ id: "a" }, { maxRetries: 0 }))) as V3ConnectionError;
        expect(error).toBeInstanceOf(V3ConnectionError);
        expect(error).toBeInstanceOf(AgoraV3Error);
        expect(error).not.toBeInstanceOf(V3TimeoutError);
        expect(error).not.toBeInstanceOf(V3Error);
        expect(error).not.toHaveProperty("statusCode");
        expect(error.category).toBe("connection");
        expect(error.name).toBe("V3ConnectionError");
        expect(error.message).toBe("v3 request failed: fetch failed");
        expect(error.message).not.toContain("secret-token");
        expect(error.cause).toBe(failure);
        expect((error.cause as Error).cause).toBe(root);
        expect(Object.keys(error)).not.toContain("cause");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("surfaces timeouts as V3TimeoutError, a V3ConnectionError", async () => {
        const { client } = setup(
            (_input, init) =>
                new Promise((_resolve, reject) =>
                    init?.signal?.addEventListener("abort", () =>
                        reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })),
                    ),
                ),
        );
        const error = (await settle(() =>
            client.v3.agents.create({ agent_name: "A" }, { timeoutInSeconds: 0.01 }),
        )) as V3TimeoutError;
        expect(error).toBeInstanceOf(V3TimeoutError);
        expect(error).toBeInstanceOf(V3ConnectionError);
        expect(error).toBeInstanceOf(AgoraV3Error);
        expect(error).not.toBeInstanceOf(V3Error);
        expect(error.category).toBe("connection");
        expect(error.name).toBe("V3TimeoutError");
        expect(error.message).toBe("v3 request timed out after 10ms");
        expect((error.cause as Error).name).toBe("AbortError");
    });

    it("treats a caller abort as a connection failure, not a timeout", async () => {
        const aborted = () => Object.assign(new Error("aborted"), { name: "AbortError" });
        const { client } = setup(
            (_input, init) =>
                new Promise((_resolve, reject) => {
                    if (init?.signal?.aborted) reject(aborted());
                    init?.signal?.addEventListener("abort", () => reject(aborted()));
                }),
        );
        const controller = new AbortController();
        const pending = settle(() => client.v3.agents.create({ agent_name: "A" }, { abortSignal: controller.signal }));
        controller.abort();
        const error = (await pending) as V3ConnectionError;
        expect(error).toBeInstanceOf(V3ConnectionError);
        expect(error).not.toBeInstanceOf(V3TimeoutError);
        expect(error.message).toBe("v3 request failed: The user aborted a request");
        expect((error.cause as Error).name).toBe("AbortError");
    });

    it("exposes status, headers, body, detail, reason and request ID on API errors", async () => {
        const { client } = setup(async () =>
            json({ detail: "Agent agent-9 was not found", reason: "AgentNotFound" }, 404, { "X-Extra": "1" }),
        );
        const error = (await settle(() => client.v3.agents.get({ id: "agent-9" }, { maxRetries: 0 }))) as V3Error;
        expect(error).toBeInstanceOf(V3Error);
        expect(error).toBeInstanceOf(AgoraV3Error);
        expect(error).not.toBeInstanceOf(PreconditionFailedError);
        expect(error).not.toBeInstanceOf(AgoraError);
        expect(error.category).toBe("api");
        expect(error.name).toBe("V3Error");
        expect(error.message).toBe("v3 request failed (404)");
        expect(error.statusCode).toBe(404);
        expect(error.rawResponse.status).toBe(404);
        expect(error.headers.get("x-extra")).toBe("1");
        expect(error.body).toEqual({ detail: "Agent agent-9 was not found", reason: "AgentNotFound" });
        expect(error.detail).toBe("Agent agent-9 was not found");
        expect(error.reason).toBe("AgentNotFound");
        expect(error.requestId).toBe("req-1");
    });

    it("keeps non-JSON and undecodable error bodies as text on API errors", async () => {
        const html = setup(
            async () =>
                new Response("<html>bad gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
        );
        const textError = (await settle(() => html.client.v3.agents.create({ agent_name: "A" }))) as V3Error;
        expect(textError).toBeInstanceOf(V3Error);
        expect(textError.statusCode).toBe(502);
        expect(textError.body).toBe("<html>bad gateway</html>");
        expect(textError.detail).toBeUndefined();
        expect(textError.reason).toBeUndefined();
        expect(textError.requestId).toBeNull();

        const broken = setup(
            async () =>
                new Response("{not json", {
                    status: 503,
                    headers: { "Content-Type": "application/json", "Agora-Request-Id": "req-2" },
                }),
        );
        const decodeError = (await settle(() => broken.client.v3.agents.create({ agent_name: "A" }))) as V3Error;
        expect(decodeError).toBeInstanceOf(V3Error);
        expect(decodeError).not.toBeInstanceOf(V3ConnectionError);
        expect(decodeError.statusCode).toBe(503);
        expect(decodeError.body).toBe("{not json");
        expect(decodeError.requestId).toBe("req-2");
    });

    it("keeps PreconditionFailedError a V3Error with latest()", async () => {
        const replies = [
            json({ detail: "stale", reason: "PreconditionFailed" }, 412),
            json({ agent_id: "a", agent_name: "A" }),
        ];
        const { client } = setup(async () => replies.shift() ?? json({}));
        const error = (await settle(() =>
            client.v3.agents.update({ id: "a", ifMatch: '"old"' }),
        )) as PreconditionFailedError;
        expect(error).toBeInstanceOf(PreconditionFailedError);
        expect(error).toBeInstanceOf(V3Error);
        expect(error).toBeInstanceOf(AgoraV3Error);
        expect(error.category).toBe("api");
        expect(error.name).toBe("PreconditionFailedError");
        expect(error.statusCode).toBe(412);
        expect(error.reason).toBe("PreconditionFailed");
        expect(error.detail).toBe("stale");
        expect(await error.latest()).toMatchObject({ agent_id: "a" });
    });

    it("reports unusable success responses as API errors carrying the response", async () => {
        const noTag = setup(
            async () =>
                new Response(JSON.stringify({ agent_id: "a", agent_name: "A" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", "Agora-Request-Id": "req-3" },
                }),
        );
        const missing = (await settle(() => SavedAgent.get(noTag.client, "a"))) as V3Error;
        expect(missing).toBeInstanceOf(V3Error);
        expect(missing.message).toBe("v3 response is missing ETag");
        expect(missing.statusCode).toBe(200);
        expect(missing.requestId).toBe("req-3");

        const page = { data: { count: 0, list: [] }, has_more: true, next_cursor: "same" };
        const loop = setup(async () => json(page));
        const cursor = await settle(async () => {
            for await (const _ of loop.client.v3.agents.listAll()) {
            }
        });
        expect(cursor).toBeInstanceOf(V3Error);
        expect((cursor as V3Error).message).toBe("Invalid repeated or missing pagination cursor");

        const start = setup(async () => json({ status: "RUNNING" }, 201));
        const invalid = await settle(() =>
            start.client.v3.sessions.start({
                agent_id: "a",
                transport: { type: "rtc", channel: "c", subscribe_uids: ["1"] },
            }),
        );
        expect(invalid).toBeInstanceOf(V3Error);
        expect((invalid as V3Error).statusCode).toBe(201);
    });

    it("rejects a non-empty 2xx body that is not JSON as an API error, but accepts empty bodies", async () => {
        const { client } = setup(
            async () =>
                new Response("<html>proxy page</html>", {
                    status: 200,
                    headers: { "Content-Type": "text/html", "Agora-Request-Id": "req-4" },
                }),
        );
        const error = (await settle(() => client.v3.agents.get({ id: "a" }))) as V3Error;
        expect(error).toBeInstanceOf(V3Error);
        expect(error).not.toBeInstanceOf(V3ConnectionError);
        expect(error.category).toBe("api");
        expect(error.statusCode).toBe(200);
        expect(error.body).toBe("<html>proxy page</html>");
        expect(error.requestId).toBe("req-4");
        expect(error.message).toBe("v3 response is not valid JSON (200)");

        const empty = setup(async () => new Response(null, { status: 204 }));
        await expect(empty.client.v3.sessions.stop({ agentSessionId: "s" })).resolves.toBeUndefined();
        const blank = setup(async () => new Response("", { status: 200 }));
        await expect(blank.client.v3.sessions.stop({ agentSessionId: "s" })).resolves.toBeUndefined();
    });

    it("folds the AgentKit v3 errors into V3ValidationError without renaming them", async () => {
        const { client } = setup(async () => json({ data: { count: 0, list: [] }, has_more: false }));
        const unsupported = new UnsupportedFieldError(["sal"]);
        const errors: Array<[unknown, string]> = [
            [unsupported, "UnsupportedFieldError"],
            [new SecretRefNotSupportedError(), "SecretRefNotSupportedError"],
            [new UnsupportedSessionOperationError("say"), "UnsupportedSessionOperationError"],
            [
                await settle(() =>
                    new SavedAgent(client, { agent_id: "a", agent_name: "A" } as never, '"1"').assignNumber(
                        "+12025550123",
                    ),
                ),
                "NumberNotFoundError",
            ],
            [await settle(() => secretRef("bad name", "k")), "V3ValidationError"],
            [
                await settle(() => new Agent({ client }).withMllm(new OpenAIRealtime({ apiKey: "k" } as never)).save()),
                "UnsupportedFieldError",
            ],
        ];
        for (const [error, name] of errors) {
            expect(error).toBeInstanceOf(V3ValidationError);
            expect(error).toBeInstanceOf(AgoraV3Error);
            expect((error as V3ValidationError).category).toBe("validation");
            expect((error as Error).name).toBe(name);
        }
        expect(errors[3]?.[0]).toBeInstanceOf(NumberNotFoundError);
        expect(unsupported.fields).toEqual(["sal"]);
        const session = new AgentSession({ client, backend: {} as never, appId: "app", name: "s" } as never);
        expect(() => session.raw).toThrow(UnsupportedSessionOperationError);
    });

    it("sets cause only when given, as a non-enumerable own property", () => {
        const plain = new V3ValidationError("bad");
        expect("cause" in plain).toBe(false);
        const withUndefined = new V3ConnectionError("x", { cause: undefined });
        expect(Object.hasOwn(withUndefined, "cause")).toBe(true);
        const inner = new Error("inner");
        const outer = new V3ConfigurationError("outer", { cause: inner });
        expect(outer.cause).toBe(inner);
        expect(Object.getOwnPropertyDescriptor(outer, "cause")?.enumerable).toBe(false);
        expect(outer.stack).toContain("V3ConfigurationError: outer");
    });

    it("keeps instanceof working across separately loaded copies of the package", async () => {
        vi.resetModules();
        const other = await import("../../../src/index.js");
        expect(other.V3Error).not.toBe(V3Error);
        const theirs = new other.PreconditionFailedError({}, new Response(null, { status: 412 }), async () => null);
        expect(theirs).toBeInstanceOf(PreconditionFailedError);
        expect(theirs).toBeInstanceOf(V3Error);
        expect(theirs).toBeInstanceOf(AgoraV3Error);
        expect(theirs).not.toBeInstanceOf(V3ValidationError);
        const timeout = new other.V3TimeoutError("t");
        expect(timeout).toBeInstanceOf(V3TimeoutError);
        expect(timeout).toBeInstanceOf(V3ConnectionError);
        expect(timeout).not.toBeInstanceOf(V3Error);
        const field = new other.UnsupportedFieldError(["x"]);
        expect(field).toBeInstanceOf(UnsupportedFieldError);
        expect(field).toBeInstanceOf(V3ValidationError);
        expect(field).not.toBeInstanceOf(SecretRefNotSupportedError);
        expect(new V3ValidationError("ours")).toBeInstanceOf(other.V3ValidationError);
        expect(new Error("plain")).not.toBeInstanceOf(AgoraV3Error);
        expect({ message: "duck" }).not.toBeInstanceOf(AgoraV3Error);
        class AppError extends V3ValidationError {}
        expect(new AppError("x")).toBeInstanceOf(AppError);
        expect(new V3ValidationError("x")).not.toBeInstanceOf(AppError);
    });

    it("leaves v2 (Fern) error behavior unchanged", async () => {
        const client = new AgoraClient({
            area: Area.US,
            appId: "app",
            authToken: "t",
            fetch: async () => {
                throw new TypeError("fetch failed");
            },
        });
        const error = await settle(() => client.agents.stop({ appid: "app", agentId: "x" }, { maxRetries: 0 }));
        expect(error).toBeInstanceOf(AgoraError);
        expect(error).not.toBeInstanceOf(AgoraV3Error);
    });
});
