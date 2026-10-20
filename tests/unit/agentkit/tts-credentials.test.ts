import { describe, expect, test } from "vitest";
import { CredentialMode } from "../../../src/agentkit/constants.js";
import { CartesiaTTS, FishAudioTTS } from "../../../src/agentkit/vendors/tts.js";

const providers = [
    {
        name: "CartesiaTTS",
        vendor: "cartesia",
        keyField: "apiKey",
        options: {
            voiceId: "voice",
            modelId: "sonic-2",
            sampleRate: 24000,
            baseUrl: "wss://api.cartesia.ai/tts/websocket",
            language: "en",
        },
        params: {
            voice: { mode: "id", id: "voice" },
            model_id: "sonic-2",
            output_format: { container: "raw", sample_rate: 24000 },
            base_url: "wss://api.cartesia.ai/tts/websocket",
            language: "en",
        },
        requiredFields: ["voiceId", "modelId"],
        create: (options: Record<string, unknown>) => new CartesiaTTS(options as never),
    },
    {
        name: "FishAudioTTS",
        vendor: "fishaudio",
        keyField: "key",
        options: { referenceId: "ref", backend: "speech-1.5" },
        params: { reference_id: "ref", backend: "speech-1.5" },
        requiredFields: ["referenceId", "backend"],
        create: (options: Record<string, unknown>) => new FishAudioTTS(options as never),
    },
];

for (const provider of providers) {
    describe(`${provider.name} credential modes`, () => {
        test.each([
            { mode: undefined, key: "tts-key" },
            { mode: CredentialMode.Byok, key: "tts-key" },
            { mode: CredentialMode.Managed, key: undefined },
            { mode: CredentialMode.Managed, key: "" },
            { mode: CredentialMode.Managed, key: "tts-key" },
        ])("serializes mode=$mode with key=$key", ({ mode, key }) => {
            const config = provider
                .create({
                    ...provider.options,
                    credentialMode: mode,
                    [provider.keyField]: key,
                    skipPatterns: [1, 2],
                })
                .toConfig();
            expect(config).toEqual({
                vendor: provider.vendor,
                ...(mode !== undefined && { credential_mode: mode }),
                params: { ...provider.params, ...(key && { api_key: key }) },
                skip_patterns: [1, 2],
            });
            if (!key) {
                expect(config.params).not.toHaveProperty("api_key");
            }
        });

        test.each([undefined, CredentialMode.Byok])("requires a key in %s mode", (mode) => {
            for (const key of [undefined, ""]) {
                expect(() =>
                    provider.create({
                        ...provider.options,
                        credentialMode: mode,
                        [provider.keyField]: key,
                    }),
                ).toThrow(`${provider.name} requires ${provider.keyField}`);
            }
        });

        test("rejects an unknown credential mode", () => {
            expect(() =>
                provider.create({
                    ...provider.options,
                    credentialMode: "invalid",
                    [provider.keyField]: "tts-key",
                }),
            ).toThrow(`${provider.name} credentialMode must be one of: managed, byok`);
        });

        test.each(provider.requiredFields)("managed mode still requires %s", (field) => {
            expect(() =>
                provider.create({
                    ...provider.options,
                    credentialMode: CredentialMode.Managed,
                    [field]: undefined,
                }),
            ).toThrow(`${provider.name} requires ${field}`);
        });
    });
}
