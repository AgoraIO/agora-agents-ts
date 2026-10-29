import { describe, expect, it, vi } from "vitest";
import { Agent, AgoraClient, Area, SavedAgent } from "../../../src/index.js";

const appId = "a".repeat(32);
const appCertificate = "b".repeat(32);
const credentials = { customerId: "customer", customerSecret: "secret:with-colon" };
const authorization = `Basic ${Buffer.from("customer:secret:with-colon").toString("base64")}`;
function setup(certificate?: string) {
    const fetch = vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
            new Response(
                JSON.stringify({
                    agent_id: "saved",
                    agent_name: "Support",
                    agent_session_id: "session",
                    create_ts: 1,
                    status: "RUNNING",
                    items: [],
                }),
                { headers: { "Content-Type": "application/json", ETag: '"1"' } },
            ),
    );
    const client = new AgoraClient({ area: Area.US, appId, ...credentials, appCertificate: certificate, fetch });
    return { fetch, client };
}
describe("Basic authentication", () => {
    it.each([
        "Basic stale",
        "Basic YTpi===",
        "Basic /zpi",
        "Basic YTpi!",
        "Basic bm9jb2xvbg==",
        `Basic ${Buffer.from(":secret").toString("base64")}`,
        `Basic ${Buffer.from("customer: ").toString("base64")}`,
        `Basic ${Buffer.from(" :secret").toString("base64")}`,
    ])("rejects malformed Basic overrides on both transports", async (value) => {
        const { client, fetch } = setup();
        await expect(client.v3.sessions.list({}, { authorization: value })).rejects.toThrow();
        await expect(
            client.agents.get(
                { appid: appId, agentId: "running" },
                { headers: { Authorization: value }, maxRetries: 0 },
            ),
        ).rejects.toThrow();
        expect(fetch).not.toHaveBeenCalled();
    });
    it("preserves valid Unicode credentials and colons in the secret", async () => {
        const { client, fetch } = setup();
        const value = `Basic ${Buffer.from("客户:秘密:second").toString("base64")}`;
        await client.v3.sessions.list({}, { authorization: value });
        expect(new Headers(fetch.mock.calls[0][1]?.headers).get("authorization")).toBe(value);
    });

    it("authenticates Platform and legacy resources without an App Certificate", async () => {
        const { client, fetch } = setup();
        expect(client.authMode).toBe("basic");
        await client.v3.sessions.list();
        await client.agents.get({ appid: appId, agentId: "running" });
        await client.stopAgent("running");
        for (const [, init] of fetch.mock.calls)
            expect(new Headers(init?.headers).get("authorization")).toBe(authorization);
    });
    it.each([undefined, appCertificate])(
        "keeps Basic REST auth for AgentKit starts with certificate %s",
        async (certificate) => {
            const { client, fetch } = setup(certificate);
            const options = {
                channel: "room",
                agentUid: "1",
                remoteUids: ["2"],
                ...(certificate ? {} : { token: "provided-rtc-token" }),
            };
            await new SavedAgent(client, { agent_id: "saved", agent_name: "Support" } as never, '"1"')
                .createSession(options)
                .start();
            await new Agent({ client }).createEphemeralSession(options).start();
            await new Agent({ client, pipelineId: "studio-agent" }).createSession(options).start();
            expect(fetch).toHaveBeenCalledTimes(3);
            for (const [, init] of fetch.mock.calls) {
                expect(new Headers(init?.headers).get("authorization")).toBe(authorization);
                const body = JSON.parse(init?.body as string);
                const token = body.transport?.token ?? body.properties?.token;
                if (certificate) expect(token).toMatch(/^007/);
                else expect(token).toBe("provided-rtc-token");
            }
        },
    );
    it.each([
        { customerId: "customer" },
        { customerSecret: "secret" },
        { customerId: "", customerSecret: "secret" },
        { customerId: "customer", customerSecret: "" },
        { customerId: "invalid:id", customerSecret: "secret" },
        { customerId: " \t", customerSecret: "secret" },
        { customerId: "customer", customerSecret: " \n" },
        { ...credentials, authToken: "token" },
    ])("rejects incomplete or ambiguous Basic credentials", (options) => {
        expect(() => new AgoraClient({ area: Area.US, appId, ...options } as never)).toThrow();
    });
    it("supports Basic request overrides through the existing public authorization option", async () => {
        const { client, fetch } = setup();
        await client.v3.sessions.list({}, { authorization });
        await client.agents.get({ appid: appId, agentId: "running" }, { headers: { Authorization: authorization } });
        for (const [, init] of fetch.mock.calls)
            expect(new Headers(init?.headers).get("authorization")).toBe(authorization);
    });
});
