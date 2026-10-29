import { createHmac } from "node:crypto";
import { inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { generateConvoAIToken, generateRtcToken } from "../../../src/agentkit/token.js";
import { Agent, AgoraClient, Area, SavedAgent } from "../../../src/index.js";

const appId = "0123456789abcdef0123456789abcdef";
const appCertificate = "fedcba9876543210fedcba9876543210";

// Decode the wire format independently of the builder. In AccessToken2,
// ConvoAI is service 9 with an empty privilege map (not an RTC privilege).
function decode(token: string) {
    expect(token.slice(0, 3)).toBe("007");
    const bytes = inflateSync(Buffer.from(token.slice(3), "base64"));
    let offset = 0;
    const u16 = () => {
        const n = bytes.readUInt16LE(offset);
        offset += 2;
        return n;
    };
    const u32 = () => {
        const n = bytes.readUInt32LE(offset);
        offset += 4;
        return n;
    };
    const string = () => {
        const n = u16();
        const b = bytes.subarray(offset, offset + n);
        offset += n;
        return b;
    };
    const signature = string();
    const signed = bytes.subarray(offset);
    const id = string().toString();
    const issued = u32(),
        expiry = u32(),
        salt = u32();
    const count = u16();
    const services: Record<number, { privileges: Record<number, number>; channel?: string; account?: string }> = {};
    for (let i = 0; i < count; i++) {
        const type = u16(),
            n = u16();
        const privileges: Record<number, number> = {};
        for (let j = 0; j < n; j++) {
            const privilege = u16();
            privileges[privilege] = u32();
        }
        const service: (typeof services)[number] = { privileges };
        if (type === 1) {
            service.channel = string().toString();
            service.account = string().toString();
        } else if (type === 2) service.account = string().toString();
        else expect(type).toBe(9);
        services[type] = service;
    }
    expect(offset).toBe(bytes.length);
    const le = (n: number) => {
        const b = Buffer.alloc(4);
        b.writeUInt32LE(n);
        return b;
    };
    const key = createHmac("sha256", le(salt))
        .update(createHmac("sha256", le(issued)).update(appCertificate).digest())
        .digest();
    expect(createHmac("sha256", key).update(signed).digest()).toEqual(signature);
    expect(id).toBe(appId);
    return { expiry, services };
}

describe("ConvoAI authorization services", () => {
    it.each([undefined, 0, 120])(
        "includes ConvoAI and preserves RTC/RTM identity and expiry: %s",
        (privilegeExpire) => {
            const decoded = decode(
                generateConvoAIToken({
                    appId,
                    appCertificate,
                    channelName: "room",
                    uid: 42,
                    tokenExpire: 600,
                    privilegeExpire,
                }),
            );
            const ttl = privilegeExpire || 600;
            expect(decoded.expiry).toBe(600);
            expect(decoded.services).toEqual({
                1: { channel: "room", account: "42", privileges: { 1: ttl, 2: ttl, 3: ttl, 4: ttl } },
                2: { account: "42", privileges: { 1: 600 } },
                9: { privileges: {} },
            });
        },
    );
    it("keeps RTC-only tokens scoped to RTC", () => {
        expect(
            Object.keys(decode(generateRtcToken({ appId, appCertificate, channel: "room", uid: 42 })).services),
        ).toEqual(["1"]);
    });
    it("uses ConvoAI authorization for listing, saved sessions, and ephemeral sessions", async () => {
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ items: [], agent_session_id: "session", status: "RUNNING", create_ts: 1 }),
                    { headers: { "Content-Type": "application/json" } },
                ),
        );
        const client = new AgoraClient({ area: Area.US, appId, appCertificate, fetch });
        await client.v3.sessions.list();
        await new SavedAgent(client, { agent_id: "saved", agent_name: "Support" } as never, '"1"')
            .createSession({ channel: "room", agentUid: "1", remoteUids: ["2"] })
            .start();
        await new Agent({ client })
            .createEphemeralSession({ channel: "room", agentUid: "1", remoteUids: ["2"] })
            .start();
        expect(fetch).toHaveBeenCalledTimes(3);
        for (const [, init] of fetch.mock.calls as unknown as [unknown, RequestInit][]) {
            const token = new Headers(init.headers).get("authorization")!.replace(/^agora token=/, "");
            expect(Object.keys(decode(token).services)).toEqual(["1", "2", "9"]);
        }
        for (const [, init] of fetch.mock.calls.slice(1) as unknown as [unknown, RequestInit][]) {
            const payload = JSON.parse(init.body as string);
            expect(Object.keys(decode(payload.transport.token).services)).toEqual(["1", "2", "9"]);
        }
    });
    it("preserves externally supplied authorization", async () => {
        const fetch = vi.fn(
            async () => new Response('{"items":[]}', { headers: { "Content-Type": "application/json" } }),
        );
        await new AgoraClient({ area: Area.US, appId, authToken: "external-token", fetch }).v3.sessions.list();
        const init = (fetch.mock.calls as unknown as [unknown, RequestInit][])[0][1];
        expect(new Headers(init.headers).get("authorization")).toBe("agora token=external-token");
    });
});
