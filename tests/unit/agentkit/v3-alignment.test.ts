import { describe, it, expect, vi } from "vitest";
import {
    Agent,
    AgoraClient,
    Area,
    OpenAI,
    OpenAIRealtime,
    secretRef,
    SavedAgent,
    SensetimeAvatar,
    SpatiusAvatar,
} from "../../../src/index.js";
const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ETag: '"1"', "Idempotent-Replayed": "true" },
    });
function setup(replies: Response[] = []) {
    const fetch = vi.fn(async () => replies.shift() ?? reply({}));
    const client = new AgoraClient({ area: Area.US, appId: "app", appCertificate: "cert", authToken: "token", fetch });
    return { client, fetch };
}
const req = (fetch: ReturnType<typeof vi.fn>, i = 0) => ({
    url: String(fetch.mock.calls[i][0]),
    init: fetch.mock.calls[i][1] as RequestInit,
});
const body = (fetch: ReturnType<typeof vi.fn>, i = 0) => JSON.parse(req(fetch, i).init.body as string);
const opts = { channel: "room", agentUid: "1", remoteUids: ["2"] };
const stored = { agent_id: "saved", agent_name: "Support" };
const start = { agent_session_id: "session", create_ts: 123, status: "STARTING" };
describe("engineering public contract", () => {
    it.each([
        "customerId",
        "customerSecret",
        "clientId",
        "clientSecret",
        "CustomerId",
        "ClientSecret",
        "username",
        "password",
    ])("rejects removed credential %s", (key) => {
        expect(
            () => new AgoraClient({ area: Area.US, appId: "a", appCertificate: "b", [key]: "secret" } as any),
        ).toThrow("not supported");
    });
    it.each([
        { authorization: "Basic c2VjcmV0" },
        { headers: { Authorization: () => Promise.resolve("Basic c2VjcmV0") } },
        { headers: { "x-studio-region": "us" } },
        { headers: { "X-Studio-V2-Gateway-Secret": "secret" } },
        { headers: { "X-Consumer-Username": "company" } },
    ])("rejects unauthorized request overrides before fetch", async (options) => {
        const { client, fetch } = setup();
        await expect(client.v3.agents.get({ id: "a" }, options)).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
    it("prevents Basic overrides on inherited legacy resources too", async () => {
        const { client, fetch } = setup();
        for (const options of [{ headers: { Authorization: "Basic c2VjcmV0" }, maxRetries: 0 }]) {
            await expect(client.agents.get({ appid: "app", agentId: "running" }, options)).rejects.toThrow();
        }
        expect(fetch).not.toHaveBeenCalled();
    });
    it("uses the public default with generated token authentication", async () => {
        const fetch = vi.fn(async () => reply({}));
        const client = new AgoraClient({ area: Area.US, appId: "a".repeat(32), appCertificate: "b".repeat(32), fetch });
        await client.v3.agents.get({ id: "a" });
        expect(req(fetch).url).toBe(
            `https://preview.ai.agora.io/conversational-ai/v1/projects/${"a".repeat(32)}/agents/a`,
        );
        expect(new Headers(req(fetch).init.headers).get("authorization")).toMatch(/^agora token=.+/);
    });
    it.each(["secrets", "numbers"] as const)("rejects obsolete %s create idempotency arguments", async (resource) => {
        const { client, fetch } = setup();
        const data =
            resource === "secrets"
                ? { name: "a", secrets: { k: "v" } }
                : { number: "+123", sip_trunk: { hostname: "sip.example" } };
        await expect((client[resource].create as any)({ ...data, idempotencyKey: "old" })).rejects.toThrow(
            "idempotencyKey",
        );
        await expect((client[resource].create as any)(data, { headers: { "Idempotency-Key": "old" } })).rejects.toThrow(
            "Idempotency-Key",
        );
        expect(fetch).not.toHaveBeenCalled();
    });
    it("omits managed endpoints while preserving BYOK URLs", async () => {
        const { client, fetch } = setup([reply(stored), reply(stored)]);
        await new Agent({ client })
            .withLlm({
                toConfig: () => ({
                    vendor: "openai",
                    url: "https://managed.invalid",
                    params: { model: "gpt-4o-mini", url: "https://nested.invalid" },
                }),
            } as any)
            .save();
        expect(body(fetch).pipeline.llm).not.toHaveProperty("url");
        expect(body(fetch).pipeline.llm.params ?? {}).not.toHaveProperty("url");
        await new Agent({ client })
            .withLlm(new OpenAI({ apiKey: "key", model: "gpt-4o-mini", url: "https://byok.example" }))
            .save();
        expect(body(fetch, 1).pipeline.llm.url).toBe("https://byok.example");
    });
    it("maps supported SenseTime and Spatius credentials", async () => {
        const { client, fetch } = setup([reply(stored), reply(stored)]);
        const avatars = [
            new SensetimeAvatar({ agoraUid: "3", appId: "provider", appKey: secretRef("avatars", "sense") }),
            new SpatiusAvatar({
                agoraUid: "3",
                spatiusApiKey: secretRef("avatars", "spatius"),
                spatiusAppId: "provider",
                spatiusAvatarId: "avatar",
            }),
        ];
        for (const avatar of avatars) await new Agent({ client, avatar: avatar.toConfig() }).save();
        expect(body(fetch).pipeline.avatar.credential).toEqual({ mode: "byok", api_key: "$secrets.avatars.sense" });
        expect(body(fetch).pipeline.avatar.params).not.toHaveProperty("app_key");
        expect(body(fetch, 1).pipeline.avatar.credential.api_key).toBe("$secrets.avatars.spatius");
        expect(body(fetch, 1).pipeline.avatar.params).not.toHaveProperty("spatius_api_key");
    });
    it("sends values, ephemeral labels, token, policy and idempotency; progresses STARTING via getInfo", async () => {
        const { client, fetch } = setup([
            reply(start),
            reply({ agent_session_id: "session", start_ts: 123, status: "RUNNING" }),
            reply({}),
        ]);
        const session = new Agent({ client })
            .withMllm(new OpenAIRealtime({ apiKey: secretRef("set", "key"), model: "gpt-realtime" }))
            .createSession({
                ...opts,
                values: { customer: "Ada", count: 1, ok: true },
                labels: { team: "support" },
                token: "rtc",
                idempotencyKey: "stable",
                encryption: { mode: "aes_128_gcm", key: "secret" },
                audioScenario: "chorus",
                gracefulStop: { enabled: true, timeout_ms: 1000 },
                dataPolicy: { retention: "none" },
                maxDuration: 120,
            });
        expect(await session.start()).toBe("session");
        expect(session.status).toBe("starting");
        expect(body(fetch)).not.toHaveProperty("client_reference");
        expect(body(fetch)).toMatchObject({
            values: { customer: "Ada", count: 1, ok: true },
            labels: { team: "support" },
            transport: { token: "rtc", encryption: { mode: "aes_128_gcm", key: "secret" }, audio_scenario: "chorus" },
            data_policy: { retention: "none" },
            lifecycle: { max_duration_ms: 120000, graceful_stop: { enabled: true, timeout_ms: 1000 } },
        });
        expect(new Headers(req(fetch).init.headers).get("Idempotency-Key")).toBe("stable");
        expect(body(fetch)).not.toHaveProperty("idempotencyKey");
        await session.getInfo();
        expect(session.status).toBe("running");
        await session.stop();
        expect(req(fetch, 2).init.body).toBeUndefined();
    });
    it("maps existing opt-out and farewell settings only when selecting ephemeral startup", async () => {
        const { client, fetch } = setup([reply({ ...start, status: "RUNNING" })]);
        const config = new Agent({
            client,
            parameters: { opt_out: true, farewell_config: { graceful_enabled: true, graceful_timeout_seconds: 2 } },
        }).withVariable("x", { type: "str" });
        await config.createSession(opts).start();
        expect(body(fetch).data_policy).toEqual({ retention: "none" });
        expect(body(fetch).lifecycle.graceful_stop).toEqual({ enabled: true, timeout_ms: 2000 });
        expect(body(fetch).agent).not.toHaveProperty("parameters");
        expect(config.config.parameters?.opt_out).toBe(true);
    });
    it("does not replay a completed keyed session when start is called again", async () => {
        const { client, fetch } = setup([reply({ ...start, status: "RUNNING" }), reply({})]);
        const session = new Agent({ client }).createSession({ ...opts, idempotencyKey: "one-session" });
        await session.start();
        await session.stop();
        await expect(session.start()).rejects.toThrow("new handle");
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("normalizes rollout responses and keeps raw headers", async () => {
        const { client } = setup([reply({ agent_session_id: "s", created_at: 42, status: "running" }, 201)]);
        const result = await client.v3.sessions
            .start({ agent_id: "saved", transport: { type: "rtc", channel: "r", uid: "1", subscribe_uids: ["2"] } })
            .withRawResponse();
        expect(result.data).toEqual({ agent_session_id: "s", create_ts: 42, status: "RUNNING" });
        expect(result.rawResponse.status).toBe(201);
        expect(result.rawResponse.headers.get("Idempotent-Replayed")).toBe("true");
    });
    it.each([
        [404, "TaskNotFound", "error"],
        [409, "TaskConflict", "stopping"],
        [409, "TaskNotRunning", "stopped"],
        [409, "Other", "error"],
    ] as const)("propagates stop errors %s even from STARTING", async (status, reason, expected) => {
        const { client } = setup([reply(stored), reply(start), reply({ reason }, status)]);
        const session = (await SavedAgent.get(client, "saved")).createSession(opts);
        await session.start();
        await expect(session.stop()).rejects.toMatchObject({ statusCode: status });
        expect(session.status).toBe(expected);
    });
    it.each([
        ["agent", "user"],
        ["0", "user"],
        ["0", "2"],
        ["1", "2"],
    ])("accepts matching or auto-selected UID types", async (agentUid, subscriber) => {
        const { client, fetch } = setup([reply(start)]);
        const session = new Agent({ client })
            .withVariable("x", { type: "str" })
            .createSession({ ...opts, agentUid, remoteUids: [subscriber] });
        await session.start();
        expect(body(fetch).transport.uid).toBe(agentUid);
    });
    it.each([
        "https://stage.example?route=old",
        "https://stage.example#frag",
        "https://user:pass@stage.example",
        "https://stage.example/path",
        "ftp://stage.example",
    ])("rejects invalid preview origin %s", (baseUrl) => {
        const fetch = vi.fn();
        expect(
            () => new AgoraClient({ area: Area.US, appId: "app", authToken: "token", v3: { baseUrl }, fetch }),
        ).toThrow("origin");
        expect(fetch).not.toHaveBeenCalled();
    });
    it.each([
        { remoteUids: ["*"] },
        { agentUid: "agent", remoteUids: ["2"] },
        { agentUid: "1", remoteUids: ["user"] },
        { remoteUids: [] },
        { remoteUids: ["2", "3"] },
        { maxDuration: 0 },
        { maxDuration: 3601 },
        { idleTimeout: 3601 },
        { gracefulStop: { timeout_ms: 120001 } },
        { clientReference: "old" },
    ])("rejects unsupported/invalid session options", (extra) => {
        const { client, fetch } = setup();
        expect(() =>
            new Agent({ client }).withVariable("x", { type: "str" }).createSession({ ...opts, ...extra } as any),
        ).toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
});
describe("campaign resource", () => {
    const campaign = { id: "c", status: "running" };
    it("exposes eight operations with exact paths, conditional/idempotency headers and empty action bodies", async () => {
        const { client, fetch } = setup();
        expect(client.campaigns).toBe(client.v3.campaigns);
        await client.campaigns.create({
            name: "Campaign",
            agent_id: "saved",
            contacts: [{ phone: "+12025550123", values: { name: "Ada" } }],
            transport: { type: "telephony", from: "number-id" },
            schedule: { mode: "immediate" },
            idempotencyKey: "create",
        });
        await client.campaigns.list({ status: "running", limit: 5 });
        await client.campaigns.get({ id: "a/b" });
        await client.campaigns.update({ id: "c", ifMatch: '"tag"', pacing: { max_concurrent: 1 } });
        await client.campaigns.delete({ id: "c" });
        for (const action of ["pause", "resume", "cancel"] as const)
            await client.campaigns[action]({ id: "c", idempotencyKey: action });
        expect(fetch).toHaveBeenCalledTimes(8);
        expect(fetch.mock.calls.map((_, i) => req(fetch, i).init.method)).toEqual([
            "POST",
            "GET",
            "GET",
            "PATCH",
            "DELETE",
            "POST",
            "POST",
            "POST",
        ]);
        expect(req(fetch, 2).url).toContain("/campaigns/a%2Fb");
        expect(body(fetch)).not.toHaveProperty("idempotencyKey");
        expect(new Headers(req(fetch).init.headers).get("Idempotency-Key")).toBe("create");
        expect(new Headers(req(fetch, 3).init.headers).get("If-Match")).toBe('"tag"');
        for (const [i, action] of ["pause", "resume", "cancel"].entries()) {
            expect(req(fetch, i + 5).url).toContain(`/campaigns/c:${action}`);
            expect(req(fetch, i + 5).init.body).toBeUndefined();
        }
    });
    it("snapshots a campaign body/key before async header resolution", async () => {
        const { client, fetch } = setup();
        let release!: (value: string) => void;
        const header = new Promise<string>((resolve) => (release = resolve));
        const input = {
            name: "Original",
            agent_id: "saved",
            contacts: [{ phone: "+12025550123" }],
            transport: { type: "telephony" as const, from: "number" },
            schedule: { mode: "immediate" as const },
            idempotencyKey: "original",
        };
        const pending = client.campaigns.create(input, { headers: { "X-Context": () => header } });
        input.name = "Changed";
        input.contacts[0]!.phone = "+19999999999";
        input.idempotencyKey = "changed";
        release("context");
        await pending;
        expect(body(fetch).name).toBe("Original");
        expect(body(fetch).contacts[0].phone).toBe("+12025550123");
        expect(new Headers(req(fetch).init.headers).get("Idempotency-Key")).toBe("original");
    });
    it("paginates and propagates campaign conflicts without write retries", async () => {
        const page = (items: unknown[], cursor: string | null) => ({
            data: { count: items.length, list: items },
            has_more: !!cursor,
            next_cursor: cursor,
        });
        const { client, fetch } = setup([
            reply(page([campaign], "next")),
            reply(page([{ ...campaign, id: "d" }], null)),
            reply({ reason: "CampaignInvalidState" }, 409),
        ]);
        const results = [];
        for await (const c of client.campaigns.listAll()) results.push(c);
        expect(results).toHaveLength(2);
        expect(req(fetch, 1).url).toContain("cursor=next");
        await expect(client.campaigns.pause({ id: "c" }, { maxRetries: 3 })).rejects.toMatchObject({
            statusCode: 409,
            body: { reason: "CampaignInvalidState" },
        });
        expect(fetch).toHaveBeenCalledTimes(3);
    });
});
