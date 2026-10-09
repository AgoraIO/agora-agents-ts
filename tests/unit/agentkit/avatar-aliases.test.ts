import { describe, expect, expectTypeOf, it } from "vitest";
import * as AgentKit from "../../../src/agentkit/index.js";
import * as Vendors from "../../../src/agentkit/vendors/avatar.js";
import * as SDK from "../../../src/index.js";

const options: SDK.GenericAvatarOptions = {
    apiKey: "provider-key",
    apiBaseUrl: "https://avatar.example.com",
    avatarId: "avatar-id",
    agoraUid: "200",
    additionalParams: { agent_id: "agent" },
};

const client = new SDK.AgoraClient({
    area: SDK.Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate",
});

describe.each([
    { name: "Tavus", Avatar: SDK.Tavus, agentKitAlias: AgentKit.Tavus, vendorAlias: Vendors.Tavus },
    { name: "Protoface", Avatar: SDK.Protoface, agentKitAlias: AgentKit.Protoface, vendorAlias: Vendors.Protoface },
    { name: "LemonSlice", Avatar: SDK.LemonSlice, agentKitAlias: AgentKit.LemonSlice, vendorAlias: Vendors.LemonSlice },
])("$name", ({ Avatar, agentKitAlias, vendorAlias }) => {
    it("exports the same constructor from the vendor, AgentKit, and package entrypoints", () => {
        expect(vendorAlias).toBe(Avatar);
        expect(agentKitAlias).toBe(Avatar);
        expect(Avatar).not.toBe(Vendors.GenericAvatar);
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
            additionalParams: { agent_id: "agent", api_key: "ignored", avatar_id: "ignored", custom: { value: 1 } },
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
                agent_id: "agent",
            },
        });
        expect(SDK.isAvatarTokenManaged(avatar.toConfig() as SDK.StrictAvatarConfig)).toBe(true);
    });
});

it("exports provider option types and GenericAvatar-compatible instances", () => {
    expectTypeOf<SDK.LemonSliceOptions>().toMatchTypeOf<{ apiKey: string; agoraUid: string }>();
    expectTypeOf<AgentKit.LemonSliceOptions>().toEqualTypeOf<Vendors.LemonSliceOptions>();
    expectTypeOf<SDK.LemonSlice>().toEqualTypeOf<SDK.GenericAvatar>();
    expectTypeOf<SDK.TavusOptions>().toMatchTypeOf<{ avatarId: string }>();
    expectTypeOf<SDK.ProtofaceOptions>().toMatchTypeOf<SDK.TavusOptions>();
    expectTypeOf<AgentKit.TavusOptions>().toEqualTypeOf<Vendors.TavusOptions>();
    expectTypeOf<AgentKit.ProtofaceOptions>().toEqualTypeOf<Vendors.ProtofaceOptions>();
    expectTypeOf<SDK.Tavus>().toEqualTypeOf<SDK.GenericAvatar>();
    expectTypeOf<SDK.Protoface>().toEqualTypeOf<SDK.GenericAvatar>();
});

const basic = { apiKey: "key", agoraUid: "200" };
it("uses branded defaults while GenericAvatar still requires its endpoint", () => {
    expect(new SDK.Tavus({ ...basic, avatarId: "id" }).toConfig().params?.api_base_url).toBe(
        "https://tavusapi.com/v2/conversations/agora",
    );
    expect(new SDK.Protoface({ ...basic, avatarId: "id" }).toConfig().params?.api_base_url).toBe(
        "https://api.protoface.com/v1/agora",
    );
    expect(new SDK.LemonSlice({ ...basic, agentId: "id" }).toConfig().params).toMatchObject({
        api_base_url: "https://lemonslice.com/api/liveai/agora",
        avatar_id: "lemonslice",
        agent_id: "id",
    });
    expect(() => new SDK.GenericAvatar({ ...options, apiBaseUrl: "" })).toThrow("requires apiBaseUrl");
});
it.each([
    ["agentId", "agent_id"],
    ["agentImageUrl", "agent_image_url"],
    ["agentImageBase64", "agent_image_base64"],
] as const)("merges and validates %s without mutating inputs", (typed, wire) => {
    const additionalParams = Object.freeze({ [wire]: "old", custom: 1 });
    const input = Object.freeze({ ...basic, additionalParams, [typed]: "new" });
    const params = new SDK.LemonSlice(input).toConfig().params ?? {};
    expect(params[wire]).toBe("new");
    expect(params).not.toHaveProperty("aspect_ratio");
    expect(additionalParams[wire]).toBe("old");
    expect(new SDK.LemonSlice({ ...basic, additionalParams }).toConfig().params?.[wire]).toBe("old");
});
it.each(["2x3", "9x16", "1x1"] as const)("supports ratio %s and typed precedence", (aspectRatio) => {
    expect(
        new SDK.LemonSlice({
            ...basic,
            agentId: "id",
            aspectRatio,
            additionalParams: { aspect_ratio: "bad" },
        }).toConfig().params?.aspect_ratio,
    ).toBe(aspectRatio);
    expect(
        new SDK.LemonSlice({ ...basic, additionalParams: { agent_id: "id", aspect_ratio: aspectRatio } }).toConfig()
            .params?.aspect_ratio,
    ).toBe(aspectRatio);
});
it("rejects zero or multiple selectors and invalid ratios", () => {
    expect(() => new SDK.LemonSlice(basic)).toThrow("exactly one");
    expect(() => new SDK.LemonSlice({ ...basic, agentId: "id", agentImageUrl: "url" })).toThrow("exactly one");
    expect(
        () => new SDK.LemonSlice({ ...basic, agentId: "id", additionalParams: { agent_image_base64: "image" } }),
    ).toThrow("exactly one");
    expect(() => new SDK.LemonSlice({ ...basic, agentId: "id", additionalParams: { aspect_ratio: "16x9" } })).toThrow(
        "aspect_ratio",
    );
});
it.each(["", "  ", null, undefined, 1, false, {}])("rejects malformed effective selectors: %s", (value) => {
    for (const key of ["agent_id", "agent_image_url", "agent_image_base64"]) {
        expect(() => new SDK.LemonSlice({ ...basic, additionalParams: { [key]: value } })).toThrow("nonempty string");
        expect(
            () => new SDK.LemonSlice({ ...basic, agentId: "id", additionalParams: { agent_image_url: value } }),
        ).toThrow("nonempty string");
    }
});
