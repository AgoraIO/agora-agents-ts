import { describe, expect, test } from "vitest";
import { generateConvoAIToken, generateRtcToken, generateRtcTokenWithAccount } from "../../../src/agentkit/token.js";

// `agora-token` requires both credentials to be exactly 32 characters and
// signals a violation by returning "" rather than throwing. Sending that empty
// token produces a gateway auth error that names neither field, so agentkit
// turns it into a local failure that does.
const VALID_APP_ID = "0123456789abcdef0123456789abcdef";
const VALID_CERTIFICATE = "fedcba9876543210fedcba9876543210";

describe("token credential validation", () => {
    test("builds a token when both credentials are the right length", () => {
        const token = generateConvoAIToken({
            appId: VALID_APP_ID,
            appCertificate: VALID_CERTIFICATE,
            channelName: "demo",
            uid: 333,
        });

        expect(token.startsWith("007")).toBe(true);
    });

    test.each([
        ["a truncated certificate", VALID_APP_ID, VALID_CERTIFICATE.slice(0, 31), "appCertificate is 31 characters"],
        ["a certificate with a trailing newline", VALID_APP_ID, `${VALID_CERTIFICATE}\n`, "appCertificate is 33"],
        ["a short app id", "short-app-id", VALID_CERTIFICATE, "appId is 12 characters"],
    ])("rejects %s instead of emitting an empty token", (_label, appId, appCertificate, expected) => {
        expect(() => generateConvoAIToken({ appId, appCertificate, channelName: "demo", uid: 333 })).toThrow(expected);
    });

    test("names both fields when both are wrong", () => {
        expect(() =>
            generateConvoAIToken({
                appId: "short",
                appCertificate: "also-short",
                channelName: "demo",
                uid: 333,
            }),
        ).toThrow("appId is 5 characters and appCertificate is 10 characters");
    });

    test("never puts the credential values in the message", () => {
        try {
            generateConvoAIToken({
                appId: VALID_APP_ID,
                appCertificate: "super-secret-but-wrong-length",
                channelName: "demo",
                uid: 333,
            });
            throw new Error("expected a throw");
        } catch (error) {
            expect((error as Error).message).not.toContain("super-secret-but-wrong-length");
        }
    });

    test("guards the RTC builders too, not just the ConvoAI one", () => {
        expect(() =>
            generateRtcToken({
                appId: VALID_APP_ID,
                appCertificate: "too-short",
                channel: "demo",
                uid: 333,
            }),
        ).toThrow("appCertificate is 9 characters");

        expect(() =>
            generateRtcTokenWithAccount({
                appId: VALID_APP_ID,
                appCertificate: "too-short",
                channel: "demo",
                account: "user-1",
            }),
        ).toThrow("appCertificate is 9 characters");
    });
});
