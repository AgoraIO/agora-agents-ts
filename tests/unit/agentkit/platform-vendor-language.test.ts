import { describe, expect, it, vi } from "vitest";
import {
    Agent,
    AgoraClient,
    Area,
    AssemblyAISTT,
    GoogleSTT,
    MicrosoftSTT,
    SarvamSTT,
    SarvamTTS,
    SpeechmaticsSTT,
    secretRef,
} from "../../../src/index.js";
import { toV3Module } from "../../../src/agentkit/v3.js";

const vendors = (key: string) => [
    new AssemblyAISTT({ apiKey: key, language: "en" }),
    new GoogleSTT({ projectId: "project", location: "global", adcCredentialsString: key, language: "fr-FR" }),
    new MicrosoftSTT({ key, region: "eastus", language: "fr-FR" }),
    new SarvamSTT({ apiKey: key, language: "hi-IN" }),
    new SpeechmaticsSTT({ key, language: "fr" }),
];
describe("Platform provider parameters", () => {
    it("preserves an additional Sarvam model and gives the typed model precedence", () => {
        const options = {
            key: "key",
            speaker: "anushka",
            targetLanguageCode: "hi-IN" as const,
            additionalParams: { model: "custom" },
        };
        expect(new SarvamTTS(options).toConfig().params).toMatchObject({ model: "custom" });
        expect(new SarvamTTS({ ...options, model: "bulbul:v3" }).toConfig().params).toMatchObject({
            model: "bulbul:v3",
        });
    });
    for (const [index, vendor] of vendors("key").entries()) {
        const config = vendor.toConfig() as { vendor: string; language?: string; params?: Record<string, unknown> };
        const language = config.params?.language ?? config.language;
        it(`${config.vendor} preserves provider language on saved and ephemeral requests`, async () => {
            const original = JSON.stringify(config);
            const fetch = vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            agent_id: "saved",
                            agent_name: "Support",
                            agent_session_id: "session",
                            status: "RUNNING",
                            create_ts: 1,
                        }),
                        { headers: { "Content-Type": "application/json", ETag: '"1"' } },
                    ),
            );
            const client = new AgoraClient({ appId: "app", authToken: "token", area: Area.US, fetch });
            const agent = new Agent({ client }).withStt(vendor).withTurnDetection({ language: "en-US" });
            await new Agent({ client })
                .withStt(vendors(secretRef("asr", "key"))[index])
                .withTurnDetection({ language: "en-US" })
                .save();
            await agent.createEphemeralSession({ channel: "room", remoteUids: ["2"] }).start();
            const requests = fetch.mock.calls as unknown as [unknown, RequestInit][];
            for (const [, init] of requests) {
                const body = JSON.parse(init.body as string);
                const asr = (body.agent ?? body).pipeline.asr;
                expect(asr.language).toBe("en-US");
                expect(asr.params.language).toBe(language);
            }
            expect(JSON.stringify(config)).toBe(original);
        });
        it(`${config.vendor} supports language in params and top-level raw configs`, () => {
            expect(toV3Module({ vendor: config.vendor, params: { language: "fr" } }, "asr")).toMatchObject({
                language: "fr",
                params: { language: "fr" },
            });
            expect(toV3Module({ vendor: config.vendor, language: "fr" }, "asr")).toMatchObject({
                language: "fr",
                params: { language: "fr" },
            });
        });
    }
    it.each([undefined, "bulbul:v3", "future-model"])("serializes Sarvam model %s", async (model) => {
        const vendor = new SarvamTTS({ key: "key", speaker: "anushka", targetLanguageCode: "hi-IN", model });
        expect(vendor.toConfig().params).toMatchObject({ model: model ?? "bulbul:v3" });
        const fetch = vi.fn(
            async () =>
                new Response(
                    JSON.stringify({ agent_id: "saved", agent_session_id: "session", status: "RUNNING", create_ts: 1 }),
                    { headers: { "Content-Type": "application/json", ETag: '"1"' } },
                ),
        );
        const client = new AgoraClient({ appId: "app", authToken: "token", area: Area.US, fetch });
        const agent = new Agent({ client }).withTts(vendor);
        await new Agent({ client })
            .withTts(
                new SarvamTTS({ key: secretRef("tts", "key"), speaker: "anushka", targetLanguageCode: "hi-IN", model }),
            )
            .save();
        await agent.createEphemeralSession({ channel: "room", remoteUids: ["2"] }).start();
        for (const [, init] of fetch.mock.calls as unknown as [unknown, RequestInit][]) {
            const body = JSON.parse(init.body as string);
            expect((body.agent ?? body).pipeline.tts.params.model).toBe(model ?? "bulbul:v3");
        }
    });
});
