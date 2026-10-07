import { describe, expect, expectTypeOf, it } from "vitest";
import * as AgentKit from "../../../src/agentkit/index.js";
import * as Vendors from "../../../src/agentkit/vendors/avatar.js";
import * as SDK from "../../../src/index.js";

const options: SDK.GenericAvatarOptions = {
    apiKey: "provider-key",
    apiBaseUrl: "https://avatar.example.com",
    avatarId: "avatar-id",
    agoraUid: "200",
};

const client = new SDK.AgoraClient({
    area: SDK.Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate",
});

describe.each([
    { name: "Tavus", Avatar: SDK.Tavus, agentKitAlias: AgentKit.Tavus, vendorAlias: Vendors.Tavus },
    { name: "Protoface", Avatar: SDK.Protoface, agentKitAlias: AgentKit.Protoface, vendorAlias: Vendors.Protoface },
])("$name", ({ Avatar, agentKitAlias, vendorAlias }) => {
    it("exports the same constructor from the vendor, AgentKit, and package entrypoints", () => {
        expect(vendorAlias).toBe(Vendors.GenericAvatar);
        expect(agentKitAlias).toBe(Vendors.GenericAvatar);
        expect(Avatar).toBe(Vendors.GenericAvatar);
        const avatar = new Avatar(options);
        expect(avatar).toBeInstanceOf(SDK.GenericAvatar);
        expect(avatar.requiredSampleRate).toBe(0);
    });

    it("preserves generic defaults and validation", () => {
        expect(new Avatar(options).toConfig()).toEqual(new SDK.GenericAvatar(options).toConfig());
        expect(new Avatar(options).toConfig().enable).toBe(true);
        for (const field of ["apiKey", "apiBaseUrl", "avatarId", "agoraUid"] as const) {
            expect(() => new Avatar({ ...options, [field]: "" })).toThrow(`Generic avatar requires ${field}`);
        }
    });

    it("serializes through AgentKit with generic vendor and explicit fields taking precedence", () => {
        const avatar = new Avatar({
            ...options,
            enable: false,
            agoraAppId: "avatar-app-id",
            agoraChannel: "avatar-channel",
            agoraToken: "avatar-token",
            additionalParams: { api_key: "ignored", avatar_id: "ignored", custom: { value: 1 } },
        });
        const properties = new SDK.Agent({ client })
            .withStt(new SDK.AresSTT())
            .withLlm(new SDK.OpenAI({ apiKey: "llm-key", url: "https://llm.example.com", model: "test-model" }))
            .withTts(
                new SDK.ElevenLabsTTS({
                    key: "tts-key",
                    modelId: "model",
                    voiceId: "voice",
                    baseUrl: "https://tts.example.com",
                }),
            )
            .withAvatar(avatar)
            .toProperties({
                token: "agent-token",
                channel: "session-channel",
                agentUid: "1",
                remoteUids: ["100"],
            });
        expect(JSON.parse(JSON.stringify(properties)).avatar).toEqual({
            enable: false,
            vendor: "generic",
            params: {
                api_key: "provider-key",
                api_base_url: "https://avatar.example.com",
                avatar_id: "avatar-id",
                agora_uid: "200",
                agora_appid: "avatar-app-id",
                agora_channel: "avatar-channel",
                agora_token: "avatar-token",
                custom: { value: 1 },
            },
        });
        expect(SDK.isAvatarTokenManaged(avatar.toConfig() as SDK.StrictAvatarConfig)).toBe(true);
    });
});

it("exports identical option and instance types", () => {
    expectTypeOf<SDK.TavusOptions>().toEqualTypeOf<SDK.GenericAvatarOptions>();
    expectTypeOf<SDK.ProtofaceOptions>().toEqualTypeOf<SDK.GenericAvatarOptions>();
    expectTypeOf<AgentKit.TavusOptions>().toEqualTypeOf<Vendors.TavusOptions>();
    expectTypeOf<AgentKit.ProtofaceOptions>().toEqualTypeOf<Vendors.ProtofaceOptions>();
    expectTypeOf<SDK.Tavus>().toEqualTypeOf<SDK.GenericAvatar>();
    expectTypeOf<SDK.Protoface>().toEqualTypeOf<SDK.GenericAvatar>();
});
