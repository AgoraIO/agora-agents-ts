import { describe, expect, expectTypeOf, test, vi } from "vitest";
import type { ConversationSessionTurn } from "../../../src/agentkit/types.js";
import type * as Agora from "../../../src/api/index.js";
import { Agent, AgoraClient, Area } from "../../../src/index.js";

const cases: { name: string; end: Agora.GetTurnsAgentsResponse.Turns.Item.End }[] = [
    { name: "normal completion", end: { type: "ok", metadata: { playback_duration_ms: 300 } } },
    {
        name: "interrupted playback",
        end: {
            type: "interrupted",
            metadata: {
                playback_duration_ms: 120,
                intended_playback_duration_ms: 300,
                caused_by: "start_of_speech",
            },
        },
    },
    {
        name: "zero durations",
        end: { type: "interrupted", metadata: { playback_duration_ms: 0, intended_playback_duration_ms: 0 } },
    },
    { name: "legacy response", end: { type: "interrupted", metadata: { caused_by: "api_interrupt" } } },
];

describe("turn playback metadata", () => {
    test("exposes optional intended duration through generated and AgentKit types", () => {
        expectTypeOf<
            Agora.GetTurnsAgentsResponse.Turns.Item.End.Metadata["intended_playback_duration_ms"]
        >().toEqualTypeOf<number | undefined>();
        expectTypeOf<
            NonNullable<NonNullable<ConversationSessionTurn["end"]>["metadata"]>
        >().toEqualTypeOf<Agora.GetTurnsAgentsResponse.Turns.Item.End.Metadata>();
    });

    test.each(cases)("preserves $name through response parsing and pagination", async ({ end }) => {
        const pages: number[] = [];
        const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
            if (init?.method === "POST") {
                return new Response(JSON.stringify({ agent_id: "agent-1" }), { status: 200 });
            }
            const url = new URL(String(input));
            expect(url.pathname.endsWith("/agents/agent-1/turns")).toBe(true);
            const page = Number(url.searchParams.get("page_index") ?? 1);
            pages.push(page);
            const response: Agora.GetTurnsAgentsResponse = {
                pagination: { page_index: page, is_last_page: page === 2 },
                turns: [{ turn_id: page, end }],
            };
            return new Response(JSON.stringify(response), { status: 200 });
        });
        const client = new AgoraClient({
            area: Area.US,
            appId: "0".repeat(32),
            appCertificate: "1".repeat(32),
            fetch: fetchMock,
        });
        const session = new Agent({ client, pipelineId: "pipeline-id" }).createSession({
            channel: "test",
            token: "rtc-token",
            agentUid: "1",
            remoteUids: ["100"],
        });
        await session.start();
        const page = await session.getTurns({ page_index: 1, page_size: 1 });
        expect(page.turns).toEqual([{ turn_id: 1, end }]);
        const all = await session.getAllTurns({ page_size: 1 });
        expect(all.turns).toEqual([
            { turn_id: 1, end },
            { turn_id: 2, end },
        ]);
        expect(pages).toEqual([1, 1, 2]);
    });
});
