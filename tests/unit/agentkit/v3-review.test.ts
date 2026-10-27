import { describe, expect, it, vi } from "vitest";
import * as tokenHelpers from "../../../src/agentkit/token.js";
import { Agent, AgoraClient, Area, SavedAgent, SensetimeAvatar, secretRef } from "../../../src/index.js";

const reply = (body: unknown, status = 200, etag = '"1"') =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ETag: etag } });
const options = { channel: "room", agentUid: "1", remoteUids: ["2"] };
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}
function clientFor(fetch: typeof globalThis.fetch, appId = "project") {
    return new AgoraClient({ area: Area.US, appId, authToken: "token", fetch });
}
function inline(client: AgoraClient) {
    return new Agent({ client }).withVariable("customer", { type: "str" });
}

describe("preview review regressions", () => {
    it("captures number assignment policy before reads and keeps it through a conflict retry", async () => {
        const readStarted = deferred<void>();
        const releaseRead = deferred<void>();
        const policy = { maxCallDurationSeconds: 60, maxSilenceDurationMs: 5000 };
        const patches: Record<string, unknown>[] = [];
        let reads = 0;
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith("/agents/agent")) return reply({ agent_id: "agent", agent_name: "Support" });
            if (init?.method === "GET") {
                ++reads;
                if (reads === 1) {
                    readStarted.resolve();
                    await releaseRead.promise;
                }
                return reply({ number_id: "number", number: "+12025550123", create_ts: 1 }, 200, `"${reads}"`);
            }
            patches.push(JSON.parse(init!.body as string));
            policy.maxCallDurationSeconds = 2;
            policy.maxSilenceDurationMs = 3;
            return patches.length === 1 ? reply({ reason: "PreconditionFailed" }, 412) : reply({ number_id: "number" });
        });
        const client = clientFor(fetch);
        const saved = await SavedAgent.get(client, "agent");
        const assignment = saved.assignNumber("number", policy);
        await readStarted.promise;
        policy.maxCallDurationSeconds = 1;
        policy.maxSilenceDurationMs = 1;
        releaseRead.resolve();
        await assignment;
        expect(reads).toBe(2);
        expect(patches).toEqual(
            [1, 2].map(() => ({
                inbound: {
                    agent: "agent",
                    call_policy: { max_call_duration_seconds: 60, max_silence_duration_ms: 5000 },
                },
            })),
        );
    });

    it.each([false, true])("ignores a stale read after stop or a new start (restart=%s)", async (restart) => {
        const readStarted = deferred<void>();
        const releaseRead = deferred<void>();
        let starts = 0;
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method === "GET") {
                readStarted.resolve();
                await releaseRead.promise;
                return reply({ agent_session_id: "session-1", status: restart ? "FAILED" : "RUNNING", start_ts: 1 });
            }
            if (String(input).endsWith("/stop")) return reply({});
            return reply({ agent_session_id: `session-${++starts}`, status: "RUNNING", create_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        const read = session.getInfo();
        await readStarted.promise;
        await session.stop();
        if (restart) await session.start();
        releaseRead.resolve();
        await read;
        expect(session.status).toBe(restart ? "running" : "stopped");
        expect(session.id).toBe(restart ? "session-2" : "session-1");
    });

    it("does not let a read issued during stop resurrect a running state", async () => {
        const stopStarted = deferred<void>();
        const releaseStop = deferred<void>();
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith("/stop")) {
                stopStarted.resolve();
                await releaseStop.promise;
                return reply({});
            }
            if (init?.method === "GET") return reply({ agent_session_id: "session", status: "RUNNING", start_ts: 1 });
            return reply({ agent_session_id: "session", status: "RUNNING", create_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        const stop = session.stop();
        await stopStarted.promise;
        await session.getInfo();
        const duringStop = session.status;
        releaseStop.resolve();
        await stop;
        expect(duringStop).toBe("stopping");
        expect(session.status).toBe("stopped");
    });

    it("ignores a read issued during stop that resolves after stop completes", async () => {
        const stopStarted = deferred<void>();
        const readStarted = deferred<void>();
        const releaseStop = deferred<void>();
        const releaseRead = deferred<void>();
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith("/stop")) {
                stopStarted.resolve();
                await releaseStop.promise;
                return reply({});
            }
            if (init?.method === "GET") {
                readStarted.resolve();
                await releaseRead.promise;
                return reply({ agent_session_id: "session", status: "RUNNING", start_ts: 1 });
            }
            return reply({ agent_session_id: "session", status: "RUNNING", create_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        const stop = session.stop();
        await stopStarted.promise;
        const read = session.getInfo();
        await readStarted.promise;
        releaseStop.resolve();
        await stop;
        releaseRead.resolve();
        await read;
        expect(session.status).toBe("stopped");
    });

    it("allows status refresh after a finished stop request returns TaskConflict", async () => {
        const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith("/stop")) return reply({ reason: "TaskConflict" }, 409);
            if (init?.method === "GET") return reply({ agent_session_id: "session", status: "STOPPED", start_ts: 1 });
            return reply({ agent_session_id: "session", status: "RUNNING", create_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        await expect(session.stop()).rejects.toMatchObject({ statusCode: 409 });
        expect(session.status).toBe("stopping");
        await session.getInfo();
        expect(session.status).toBe("stopped");
    });

    it("applies only the most recently issued concurrent status read", async () => {
        const firstStarted = deferred<void>();
        const releaseFirst = deferred<void>();
        let reads = 0;
        const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method !== "GET") return reply({ agent_session_id: "session", status: "RUNNING", create_ts: 1 });
            if (++reads === 1) {
                firstStarted.resolve();
                await releaseFirst.promise;
                return reply({ agent_session_id: "session", status: "RUNNING", start_ts: 1 });
            }
            return reply({ agent_session_id: "session", status: "STOPPED", start_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        const first = session.getInfo();
        await firstStarted.promise;
        await session.getInfo();
        releaseFirst.resolve();
        await first;
        expect(session.status).toBe("stopped");
    });

    it("cannot control a previous session ID while a new start is pending", async () => {
        const restartStarted = deferred<void>();
        const releaseRestart = deferred<void>();
        let starts = 0;
        let stops = 0;
        const fetch = vi.fn(async (input: RequestInfo | URL) => {
            if (String(input).endsWith("/stop")) {
                ++stops;
                return reply({});
            }
            if (++starts === 2) {
                restartStarted.resolve();
                await releaseRestart.promise;
            }
            return reply({ agent_session_id: `session-${starts}`, status: "RUNNING", create_ts: 1 });
        });
        const session = inline(clientFor(fetch)).createSession(options);
        await session.start();
        await session.stop();
        const restart = session.start();
        await restartStarted.promise;
        expect(session.id).toBeNull();
        await expect(session.stop()).rejects.toThrow("No agent ID");
        await expect(session.getInfo()).rejects.toThrow("No agent ID");
        releaseRestart.resolve();
        expect(await restart).toBe("session-2");
        expect(stops).toBe(1);
    });

    it("routes secret references in public avatar configs through ephemeral startup", async () => {
        const fetch = vi.fn(async () => reply({ agent_session_id: "avatar-session", status: "RUNNING", create_ts: 1 }));
        const config = new Agent({ client: clientFor(fetch) }).withAvatar(
            new SensetimeAvatar({ agoraUid: "3", appId: "provider", appKey: secretRef("avatars", "key") }),
        );
        await config.createSession(options).start();
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toMatch(/\/sessions\/ephemeral$/);
        const body = JSON.parse(init.body as string);
        expect(body.agent.pipeline.avatar.credential).toEqual({ mode: "byok", api_key: "$secrets.avatars.key" });
        expect(body.agent.pipeline.avatar.params).not.toHaveProperty("app_key");
    });

    it.each([".", ".."])("rejects dot-only resource and project identifiers (%s)", async (id) => {
        const fetch = vi.fn(async () => reply({}));
        const client = clientFor(fetch);
        expect(() => client.v3.agents.get({ id })).toThrow("dot segments");
        expect(() => client.campaigns.delete({ id })).toThrow("dot segments");
        await expect(clientFor(fetch, id).v3.agents.list()).rejects.toThrow("dot segments");
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each(["X-Studio-Region-Override", "x-StUdIo-private-gateway"])(
        "rejects the reserved internal namespace at preview and legacy boundaries (%s)",
        async (name) => {
            const fetch = vi.fn(async () => reply({}));
            const client = clientFor(fetch);
            await expect(client.v3.agents.get({ id: "agent" }, { headers: { [name]: "internal" } })).rejects.toThrow(
                "internal header",
            );
            await expect(
                client.agents.get(
                    { appid: "project", agentId: "session" },
                    { headers: { [name]: "internal" }, maxRetries: 0 },
                ),
            ).rejects.toThrow();
            expect(fetch).not.toHaveBeenCalled();
        },
    );
    it.each(["agents", "secrets", "numbers", "sessions", "campaigns"] as const)(
        "keeps an active %s cursor scan bound to its original project and options",
        async (resource) => {
            let pages = 0;
            const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
                ++pages;
                return reply({
                    data: {
                        count: 1,
                        list: [
                            { agent_id: "a", name: "keys", number_id: "n", agent_session_id: "s", campaign_id: "c" },
                        ],
                    },
                    has_more: pages === 1,
                    next_cursor: pages === 1 ? "next" : null,
                });
            });
            const client = clientFor(fetch);
            const request = { appid: "original-project", limit: 2 };
            const scanOptions = { queryParams: { limit: 1 }, headers: { "X-Scan": "original" } };
            const scan = client.v3[resource].listAll(request, scanOptions);
            await scan.next();
            request.appid = "other-project";
            request.limit = 99;
            scanOptions.queryParams.limit = 99;
            scanOptions.headers["X-Scan"] = "changed";
            await scan.next();
            const [url, init] = fetch.mock.calls[1];
            expect(new URL(String(url)).pathname).toContain("/projects/original-project/");
            expect(new URL(String(url)).searchParams.get("cursor")).toBe("next");
            expect(new URL(String(url)).searchParams.get("limit")).toBe("1");
            expect(new Headers(init?.headers).get("X-Scan")).toBe("original");
        },
    );
    it("keeps REST signing credentials bound to the original project when constructor options are reused", async () => {
        const sign = vi
            .spyOn(tokenHelpers, "generateConvoAIToken")
            .mockImplementation((params) => `signed-for-${params.appId}`);
        try {
            const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => reply({}));
            const original = { area: Area.US, appId: "first-project", appCertificate: "first-certificate", fetch };
            const first = new AgoraClient(original);
            original.appId = "second-project";
            original.appCertificate = "second-certificate";
            const second = new AgoraClient(original);
            await first.v3.agents.list();
            await second.v3.agents.list();
            await first.agents.get({ appid: "first-project", agentId: "legacy-session" });
            expect(sign.mock.calls.map(([params]) => [params.appId, params.appCertificate])).toEqual([
                ["first-project", "first-certificate"],
                ["second-project", "second-certificate"],
                ["first-project", "first-certificate"],
            ]);
            expect(String(fetch.mock.calls[0][0])).toContain("/projects/first-project/");
            expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe(
                "agora token=signed-for-first-project",
            );
        } finally {
            sign.mockRestore();
        }
    });
});
