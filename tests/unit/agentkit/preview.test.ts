import { describe, expect, test, vi } from "vitest";
import { AgoraClient } from "../../../src/AgoraPoolClient.js";
import { Agent } from "../../../src/agentkit/Agent.js";
import {
    AgoraPreviewClient,
    applyPreviewShape,
    GeminiCleverChatter,
    GeminiWalkieTalkie,
    PREVIEW_API_BASE_URL,
    requiredPreviewFeatures,
} from "../../../src/agentkit/preview/index.js";
import type * as Agora from "../../../src/api/index.js";
import { Area } from "../../../src/core/domain/index.js";

const API_KEY = "AIza-test-key";

function createPreviewClient(fetchFn?: typeof fetch) {
    return new AgoraPreviewClient({
        area: Area.US,
        appId: "test-app-id-0123456789abcdefghij",
        appCertificate: "test-app-certificate-01234567890",
        ...(fetchFn && { fetch: fetchFn }),
    });
}

function createGaClient() {
    return new AgoraClient({
        area: Area.US,
        appId: "test-app-id-0123456789abcdefghij",
        appCertificate: "test-app-certificate-01234567890",
    });
}

function sessionOptions() {
    return { name: "preview-agent", channel: "preview-channel", agentUid: "1", remoteUids: ["100"] };
}

describe("Gemini MLLM (preview)", () => {
    test("walkie-talkie serialises to the documented mllm wire shape", () => {
        const properties = new Agent({ client: createPreviewClient() })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .toProperties({
                channel: "preview-channel",
                agentUid: "1",
                remoteUids: ["100"],
                token: "test-token",
            });

        expect(properties.mllm).toEqual({
            enable: true,
            vendor: "gemini",
            api_key: API_KEY,
            url: "https://generativelanguage.googleapis.com",
            params: {
                api_key: API_KEY,
                model: "walkie-talkie",
                voice: "Puck",
            },
        });
    });

    test("clever-chatter includes thinking_level", () => {
        const config = new GeminiCleverChatter({
            apiKey: API_KEY,
            voice: "Puck",
            thinkingLevel: "medium",
        }).toConfig();

        expect(config).toEqual({
            vendor: "gemini",
            api_key: API_KEY,
            url: "https://generativelanguage.googleapis.com",
            params: {
                api_key: API_KEY,
                model: "clever-chatter",
                voice: "Puck",
                thinking_level: "medium",
            },
        });
    });

    test("clever-chatter omits thinking_level when unset", () => {
        const config = new GeminiCleverChatter({ apiKey: API_KEY }).toConfig();

        expect(config.params).not.toHaveProperty("thinking_level");
    });

    test("sends language_codes, never the singular language", () => {
        // `mllm.params.language` belongs to xAI Grok in the Agora schema, and the
        // production Gemini Live provider sends no language field at all. The
        // preview MLLMs take the plural array.
        const withCodes = new GeminiWalkieTalkie({ apiKey: API_KEY, languageCodes: ["en-US"] }).toConfig();
        expect(withCodes.params).toMatchObject({ language_codes: ["en-US"] });
        expect(withCodes.params).not.toHaveProperty("language");

        const withMultiple = new GeminiCleverChatter({
            apiKey: API_KEY,
            languageCodes: ["en-US", "es-ES"],
        }).toConfig();
        expect(withMultiple.params).toMatchObject({ language_codes: ["en-US", "es-ES"] });
    });

    test("omits language_codes entirely when unset", () => {
        const config = new GeminiWalkieTalkie({ apiKey: API_KEY }).toConfig();

        expect(config.params).not.toHaveProperty("language_codes");
        expect(config.params).not.toHaveProperty("language");
    });

    test("exposes the Gemini transcription and dialog params", () => {
        const config = new GeminiWalkieTalkie({
            apiKey: API_KEY,
            instructions: "You are Ada.",
            transcribeAgent: true,
            transcribeUser: true,
            affectiveDialog: false,
            proactiveAudio: false,
            httpOptions: { api_version: "v1beta" },
        }).toConfig();

        expect(config.params).toEqual({
            api_key: API_KEY,
            model: "walkie-talkie",
            voice: "Puck",
            instructions: "You are Ada.",
            transcribe_agent: true,
            transcribe_user: true,
            affective_dialog: false,
            proactive_audio: false,
            http_options: { api_version: "v1beta" },
        });
    });

    test("allows overriding the model to follow a preview rename", () => {
        expect(new GeminiWalkieTalkie({ apiKey: API_KEY, model: "not-a-real-model" }).toConfig().params?.model).toBe(
            "not-a-real-model",
        );
        expect(
            new GeminiCleverChatter({ apiKey: API_KEY, model: "not-a-real-model", thinkingLevel: "low" }).toConfig()
                .params?.model,
        ).toBe("not-a-real-model");
    });

    test("omits the optional Gemini params when unset", () => {
        const config = new GeminiWalkieTalkie({ apiKey: API_KEY }).toConfig();

        for (const key of ["transcribe_agent", "transcribe_user", "affective_dialog", "proactive_audio"]) {
            expect(config.params).not.toHaveProperty(key);
        }
    });

    test("accepts Gemini server_vad turn detection", () => {
        const config = new GeminiCleverChatter({
            apiKey: API_KEY,
            turnDetection: {
                mode: "server_vad",
                server_vad_config: {
                    start_of_speech_sensitivity: "START_SENSITIVITY_HIGH",
                    end_of_speech_sensitivity: "END_SENSITIVITY_HIGH",
                },
            },
        }).toConfig();

        expect(config.turn_detection).toEqual({
            mode: "server_vad",
            server_vad_config: {
                start_of_speech_sensitivity: "START_SENSITIVITY_HIGH",
                end_of_speech_sensitivity: "END_SENSITIVITY_HIGH",
            },
        });
    });

    test("carries the shared MLLM envelope fields", () => {
        const config = new GeminiWalkieTalkie({
            apiKey: API_KEY,
            greeting: "Hello!",
            failureMessage: "One moment.",
            outputModalities: ["text", "audio"],
            turnDetection: { mode: "server_vad" },
        }).toConfig();

        expect(config.greeting).toBe("Hello!");
        expect(config.failure_message).toBe("One moment.");
        expect(config.output_modalities).toEqual(["text", "audio"]);
        expect(config.turn_detection).toEqual({ mode: "server_vad" });
    });

    test("sends greeting, never greeting_message", () => {
        // The preview Gemini models read `greeting`. `greeting_message` is what
        // the production providers use.
        const withGreeting = new GeminiWalkieTalkie({ apiKey: API_KEY, greeting: "Hi there." }).toConfig();
        expect(withGreeting.greeting).toBe("Hi there.");
        expect(withGreeting).not.toHaveProperty("greeting_message");

        const withoutGreeting = new GeminiWalkieTalkie({ apiKey: API_KEY }).toConfig();
        expect(withoutGreeting).not.toHaveProperty("greeting");
        expect(withoutGreeting).not.toHaveProperty("greeting_message");
    });

    test("an agent-level greeting reaches the preview model as `greeting`", () => {
        // Agent.toProperties writes agent-level greetings to greeting_message,
        // the production spelling. applyPreviewShape retargets it so the natural
        // `new Agent({ greeting })` usage is not a silent no-greeting.
        const properties = new Agent({ client: createPreviewClient(), greeting: "AGENT" })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });
        expect(properties.mllm?.greeting_message).toBe("AGENT");

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting).toBe("AGENT");
        expect(properties.mllm).not.toHaveProperty("greeting_message");
    });

    test("a hand-written greeting_message migrates onto greeting", () => {
        // Lets an existing MLLM config keep working after only swapping the model.
        const properties = {
            mllm: { vendor: "gemini", greeting_message: "EXISTING", params: { model: "walkie-talkie" } },
        } as unknown as Agora.StartAgentsRequest.Properties;

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting).toBe("EXISTING");
        expect(properties.mllm).not.toHaveProperty("greeting_message");
    });

    test("the vendor greeting wins over an agent-level one", () => {
        const properties = new Agent({ client: createPreviewClient(), greeting: "AGENT" })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY, greeting: "VENDOR" }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting).toBe("VENDOR");
        expect(properties.mllm).not.toHaveProperty("greeting_message");
    });

    test("leaves failure_message alone — it is an Agora engine field", () => {
        const properties = new Agent({ client: createPreviewClient(), failureMessage: "One moment." })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        applyPreviewShape(properties);

        expect(properties.mllm?.failure_message).toBe("One moment.");
    });

    test("leaves a production MLLM untouched", () => {
        const properties = {
            mllm: {
                vendor: "gemini",
                greeting_message: "PROD",
                params: { model: "gemini-2.0-flash-live-001" },
            },
        } as unknown as Agora.StartAgentsRequest.Properties;

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting_message).toBe("PROD");
        expect(properties.mllm).not.toHaveProperty("greeting");
    });

    test("is a no-op on a cascading config with no mllm", () => {
        const properties = { asr: { vendor: "gemini" } } as unknown as Agora.StartAgentsRequest.Properties;

        expect(() => applyPreviewShape(properties)).not.toThrow();
    });

    test("toProperties alone leaves the greeting in the production field", () => {
        // Documents why applyPreviewShape exists: the shared builder always
        // writes the agent-level greeting to greeting_message. The session
        // retargets it afterwards; see the end-to-end test below.
        const properties = new Agent({ client: createPreviewClient(), greeting: "AGENT" })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY, greeting: "VENDOR" }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        expect(properties.mllm?.greeting).toBe("VENDOR");
        expect(properties.mllm?.greeting_message).toBe("AGENT");
    });

    test("the renamed model IDs are recognised as preview configs", () => {
        // Google is renaming the codenames; the guard has to keep working
        // through the rollout whichever spelling a caller sends.
        for (const model of ["walkie-talkie", "clever-chatter", "gemini-3.5-live", "gemini-3.5-live-thinking"]) {
            expect(
                requiredPreviewFeatures({ mllm: { vendor: "gemini", params: { model } } }),
                `expected ${model} to require the preview endpoint`,
            ).toEqual(["gemini-live"]);
        }
    });

    test("the production Gemini Live model is not treated as preview", () => {
        expect(
            requiredPreviewFeatures({
                mllm: { vendor: "gemini", params: { model: "gemini-2.0-flash-live-001" } },
            }),
        ).toEqual([]);
    });

    test("an unrecognised model on a preview vendor still gets the greeting rename", () => {
        // Overriding `model` is the documented escape hatch for a Google rename
        // that lands ahead of an SDK release, so a name this SDK has never seen
        // is reachable by following its own advice. Matching on the model name
        // alone made that case fail silently: no rename, and an agent-level
        // greeting would land in a field these models ignore.
        const properties = new Agent({ client: createPreviewClient(), greeting: "AGENT" })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY, model: "gemini-4.0-live-unreleased" }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting).toBe("AGENT");
        expect(properties.mllm).not.toHaveProperty("greeting_message");
    });

    test("an unrecognised model on a preview vendor still requires the preview endpoint", () => {
        const properties = new Agent({ client: createPreviewClient() })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY, model: "gemini-4.0-live-unreleased" }))
            .toProperties({ channel: "c", agentUid: "1", remoteUids: ["100"], token: "t" });

        expect(requiredPreviewFeatures(properties)).toEqual(["gemini-live"]);
    });

    test("the envelope check does not catch a production Gemini Live config", () => {
        // GeminiLive leaves params.api_key unset and does not point url at the
        // Gemini Developer API host, so widening detection must not retarget
        // greeting_message for a GA caller.
        const properties = {
            mllm: {
                vendor: "gemini",
                api_key: "prod-key",
                url: "wss://generativelanguage.googleapis.com/ws",
                greeting_message: "PROD",
                params: { model: "gemini-2.0-flash-live-001" },
            },
        } as unknown as Agora.StartAgentsRequest.Properties;

        applyPreviewShape(properties);

        expect(properties.mllm?.greeting_message).toBe("PROD");
        expect(properties.mllm).not.toHaveProperty("greeting");
        expect(requiredPreviewFeatures(properties)).toEqual([]);
    });
});

describe("AgoraPreviewClient routing", () => {
    test("reports the preview base URL", () => {
        const client = createPreviewClient();

        expect(client.getCurrentURL()).toBe(PREVIEW_API_BASE_URL);
        expect(client.pool.getCurrentURL()).toBe(PREVIEW_API_BASE_URL);
    });

    test("does not participate in regional failover", async () => {
        const client = createPreviewClient();

        client.nextRegion();
        await client.selectBestDomain();

        expect(client.getCurrentURL()).toBe(PREVIEW_API_BASE_URL);
    });

    test("the started request carries greeting, not greeting_message", async () => {
        // End-to-end: proves applyPreviewShape is actually wired into start(),
        // not merely exported. An agent-level greeting is the natural usage and
        // must reach the preview model.
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));

        const session = new Agent({ client: createPreviewClient(fetchMock), greeting: "AGENT" })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .createSession(sessionOptions());

        await session.start();

        const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
        expect(body.properties.mllm.greeting).toBe("AGENT");
        expect(body.properties.mllm).not.toHaveProperty("greeting_message");
    });

    test("sends requests to the preview endpoint with the agora-feature header", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));

        const session = new Agent({ client: createPreviewClient(fetchMock) })
            .withMllm(new GeminiCleverChatter({ apiKey: API_KEY, thinkingLevel: "high" }))
            .createSession(sessionOptions());

        await session.start();

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `${PREVIEW_API_BASE_URL}/v2/projects/test-app-id-0123456789abcdefghij/join`,
        );

        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("agora-feature")).toBe("gemini-live");
        // Exactly one header may carry the preview value — the gateway accepts other
        // spellings that are not part of the public contract, and none may ship here.
        expect([...headers].filter(([, value]) => value.includes("gemini-live")).map(([name]) => name)).toEqual([
            "agora-feature",
        ]);
    });

    test("keeps the gate header on every request, not just start", async () => {
        // A request that loses the header is routed to the production environment,
        // where the preview providers do not exist — so each verb must carry it.
        // A fresh Response per call: a body can only be read once.
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(
            async () =>
                // Superset body: satisfies the start, history, and paginated list shapes alike.
                new Response(JSON.stringify({ agent_id: "agent-1", data: { list: [] } }), { status: 200 }),
        );
        const client = createPreviewClient(fetchMock);

        const session = new Agent({ client })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .createSession(sessionOptions());

        await session.start();
        await session.say("hello");
        await session.interrupt();
        await session.getHistory();
        await session.stop();
        await client.agents.list({ appid: "test-app-id-0123456789abcdefghij" });
        await client.stopAgent("agent-2");

        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(7);
        for (const [url, init] of fetchMock.mock.calls) {
            const headers = new Headers(init?.headers);
            expect(headers.get("agora-feature"), `missing gate on ${String(url)}`).toBe("gemini-live");
        }
    });

    test("caller-supplied headers cannot drop the gate", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 }));

        const client = new AgoraPreviewClient({
            area: Area.US,
            appId: "test-app-id-0123456789abcdefghij",
            appCertificate: "test-app-certificate-01234567890",
            fetch: fetchMock,
            headers: { "agora-feature": "", "x-custom": "kept" },
        });

        await new Agent({ client })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .createSession(sessionOptions())
            .start();

        const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
        expect(headers.get("agora-feature")).toBe("gemini-live");
        expect(headers.get("x-custom")).toBe("kept");
    });

    test("accepts a base URL override for staging hosts", () => {
        const client = new AgoraPreviewClient({
            area: Area.US,
            appId: "test-app-id-0123456789abcdefghij",
            appCertificate: "test-app-certificate-01234567890",
            baseUrl: "https://staging.example.com/preview/api/conversational-ai-agent",
        });

        expect(client.getCurrentURL()).toBe("https://staging.example.com/preview/api/conversational-ai-agent");
    });

    test("honours a custom feature list", () => {
        const client = new AgoraPreviewClient({
            area: Area.US,
            appId: "test-app-id-0123456789abcdefghij",
            appCertificate: "test-app-certificate-01234567890",
            features: [],
        });

        expect(client.previewFeatures).toEqual([]);
    });
});

describe("agent-level instructions in MLLM mode", () => {
    function startWithWarnCapture(vendor: GeminiWalkieTalkie) {
        const warn = vi.fn();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ agent_id: "a1" }), { status: 200 }));
        const session = new Agent({ client: createPreviewClient(fetchMock), instructions: "You are Ada." })
            .withMllm(vendor)
            .createSession({ ...sessionOptions(), warn });
        return { warn, start: () => session.start() };
    }

    test("warns that agent-level instructions is dropped", async () => {
        const { warn, start } = startWithWarnCapture(new GeminiWalkieTalkie({ apiKey: API_KEY }));

        await start();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("ignored in MLLM mode"));
    });

    test("stays quiet when the vendor supplies instructions", async () => {
        const { warn, start } = startWithWarnCapture(
            new GeminiWalkieTalkie({ apiKey: API_KEY, instructions: "You are Ada." }),
        );

        await start();

        expect(warn).not.toHaveBeenCalled();
    });
});

describe("preview feature detection", () => {
    test("flags preview MLLM models", () => {
        expect(
            requiredPreviewFeatures({
                mllm: { vendor: "gemini", params: { model: "clever-chatter" } },
            } as Agora.StartAgentsRequest.Properties),
        ).toEqual(["gemini-live"]);
    });

    test("leaves GA gemini live configs alone", () => {
        expect(
            requiredPreviewFeatures({
                mllm: { vendor: "gemini", params: { model: "gemini-live-2.5-flash" } },
            } as Agora.StartAgentsRequest.Properties),
        ).toEqual([]);
    });

    test("start() rejects preview providers on the production client", async () => {
        const session = new Agent({ client: createGaClient() })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .createSession(sessionOptions());

        await expect(session.start()).rejects.toThrow(/AgoraPreviewClient/);
    });

    test("start() rejects preview providers when the feature is not enabled", async () => {
        const client = new AgoraPreviewClient({
            area: Area.US,
            appId: "test-app-id-0123456789abcdefghij",
            appCertificate: "test-app-certificate-01234567890",
            features: [],
        });
        const session = new Agent({ client })
            .withMllm(new GeminiWalkieTalkie({ apiKey: API_KEY }))
            .createSession(sessionOptions());

        await expect(session.start()).rejects.toThrow(/gemini-live/);
    });
});
