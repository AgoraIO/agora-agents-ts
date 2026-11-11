import { createHmac } from "node:crypto";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateClientToken, generateConvoAIToken } from "../../../src/agentkit/token.js";
import * as root from "../../../src/index.js";

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

describe("ConvoAI tokens", () => {
    it.each([
        [42, "42"],
        ["agent-a", "agent-a"],
    ] as const)("sign numeric and string UIDs as the same account: %s", (uid, account) => {
        const decoded = decode(
            generateConvoAIToken({ appId, appCertificate, channelName: "room", uid, tokenExpire: 600 }),
        );
        expect(decoded.services).toEqual({
            1: { channel: "room", account, privileges: { 1: 600, 2: 600, 3: 600, 4: 600 } },
            2: { account, privileges: { 1: 600 } },
            9: { privileges: {} },
        });
    });
});

describe("client tokens", () => {
    it.each([
        [42, "42", undefined],
        ["user-a", "user-a", 120],
    ] as const)("grant RTC and RTM without ConvoAI: %s", (uid, account, privilegeExpire) => {
        const decoded = decode(
            generateClientToken({ appId, appCertificate, channelName: "room", uid, tokenExpire: 600, privilegeExpire }),
        );
        const ttl = privilegeExpire ?? 600;
        expect(decoded.expiry).toBe(600);
        expect(decoded.services).toEqual({
            1: { channel: "room", account, privileges: { 1: ttl, 2: ttl, 3: ttl, 4: ttl } },
            2: { account, privileges: { 1: 600 } },
        });
    });
    it.each([0, "0", "", "000"])("reject a UID that cannot be an RTM user ID: %j", (uid) => {
        expect(() => generateClientToken({ appId, appCertificate, channelName: "room", uid })).toThrow(
            /nonzero and nonempty/,
        );
    });
    it("names a malformed credential instead of returning an empty token", () => {
        expect(() => generateClientToken({ appId: `${appId}\n`, appCertificate, channelName: "room", uid: 1 })).toThrow(
            /appId is 33 characters/,
        );
    });
});

describe("exports", () => {
    it("exposes generateClientToken from the package root", () => {
        expect(root.generateClientToken).toBe(generateClientToken);
    });
});
