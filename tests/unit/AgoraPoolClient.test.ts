import { afterEach, describe, expect, test, vi } from "vitest";
import { Area } from "../../src/core/domain/index.js";
import { AgoraClient } from "../../src/index.js";

const API_BASE_URL_ENV = "AGORA_AGENTS_API_BASE_URL";

function createClient(area: Area.US | Area.EU | Area.AP | Area.CN): AgoraClient {
    return new AgoraClient({
        area,
        appId: "test-app-id",
        appCertificate: "test-app-certificate-01234567890",
    });
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("AgoraClient configured base URL", () => {
    test.each([
        [Area.US, "https://api-test.agora.io/api/conversational-ai-agent"],
        [Area.EU, "https://api-test.agora.io/api/conversational-ai-agent"],
        [Area.AP, "https://api-test.agora.io/api/conversational-ai-agent"],
        [Area.CN, "https://api-test.agora.io/cn/api/conversational-ai-agent"],
    ] as const)("uses the area-specific API path for area %s", (area, expected) => {
        vi.stubEnv(API_BASE_URL_ENV, "https://api-test.agora.io/");

        expect(createClient(area).getCurrentURL()).toBe(expected);
    });

    test("disables dynamic routing for the client and exposed pool", async () => {
        vi.stubEnv(API_BASE_URL_ENV, "https://api-test.agora.io");
        const client = createClient(Area.US);
        const expected = "https://api-test.agora.io/api/conversational-ai-agent";

        for (let index = 0; index < 3; index += 1) {
            client.nextRegion();
            await client.selectBestDomain();
            client.pool.nextRegion();
            await client.pool.selectBestDomain();
            expect(client.getCurrentURL()).toBe(expected);
            expect(client.pool.getCurrentURL()).toBe(expected);
        }
    });

    test("uses the configured base URL for API requests", async () => {
        vi.stubEnv(API_BASE_URL_ENV, "https://api-test.agora.io");
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
        const client = new AgoraClient({
            area: Area.CN,
            appId: "test-app-id",
            appCertificate: "test-app-certificate-01234567890",
            fetch: fetchMock,
        });

        client.nextRegion();
        await client.selectBestDomain();
        await client.agents.stop({ appid: "test-app-id", agentId: "test-agent-id" });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            "https://api-test.agora.io/cn/api/conversational-ai-agent/v2/projects/test-app-id/agents/test-agent-id/leave",
        );
    });

    test.each([
        ["https://staging.example.com/", "https://staging.example.com/api/conversational-ai-agent"],
        ["http://localhost:8080", "http://localhost:8080/api/conversational-ai-agent"],
        [
            "https://user:password@staging.example.com/gateway?debug=true#section",
            "https://user:password@staging.example.com/gateway/api/conversational-ai-agent?debug=true#section",
        ],
    ])("joins the API path onto %s", (baseUrl, expected) => {
        vi.stubEnv(API_BASE_URL_ENV, baseUrl);

        expect(createClient(Area.US).getCurrentURL()).toBe(expected);
    });

    test("keeps regional routing when the environment variable is empty", () => {
        vi.stubEnv(API_BASE_URL_ENV, "   ");
        const client = createClient(Area.US);

        expect(client.getCurrentURL()).toBe("https://api-us-west-1.agora.io/api/conversational-ai-agent");
        client.nextRegion();
        expect(client.getCurrentURL()).toBe("https://api-us-east-1.agora.io/api/conversational-ai-agent");
    });

    test("captures the configured base URL when the client is constructed", () => {
        vi.stubEnv(API_BASE_URL_ENV, "https://api-test.agora.io");
        const client = createClient(Area.CN);

        vi.stubEnv(API_BASE_URL_ENV, "https://staging.example.com");
        client.nextRegion();

        expect(client.getCurrentURL()).toBe("https://api-test.agora.io/cn/api/conversational-ai-agent");
    });

    test("rejects an invalid base URL", () => {
        vi.stubEnv(API_BASE_URL_ENV, "://invalid");

        expect(() => createClient(Area.US)).toThrow(`invalid ${API_BASE_URL_ENV}`);
    });
});
