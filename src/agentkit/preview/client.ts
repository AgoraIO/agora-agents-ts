/**
 * Preview endpoint routing.
 *
 * Preview providers are not served by the production Conversational AI gateway.
 * They live behind a single partner host and are gated by an `agora-feature`
 * header. AgentSession detects preview providers from its resolved request body
 * and binds that session to the preview host while ordinary AgoraClient calls
 * remain on the regional production endpoint.
 *
 * Everything under `agentkit/preview/` is temporary. When a provider ships on
 * the production gateway, remove its preview registration and move its class
 * into the corresponding production vendor module.
 */

import type { AgoraClient } from "../../AgoraPoolClient.js";
import type * as Agora from "../../api/index.js";
import { AgentManagementClient } from "../../api/resources/agentManagement/client/Client.js";
import { AgentsClient } from "../../api/resources/agents/client/Client.js";
import type { BaseClientOptions } from "../../BaseClient.js";
import { isOpenAIGPTLiveConfig } from "./vendors.js";

/** Base URL that serves the preview providers. */
export const PREVIEW_API_BASE_URL = "https://partner.ai.agora.io/preview/api/conversational-ai-agent";

/**
 * Request header that opts a request into a preview provider family.
 *
 * This is the header the preview gateway routes on. A request that reaches the
 * gateway without it is not rejected — it is routed to the production
 * environment, where the preview providers do not exist.
 */
export const PREVIEW_FEATURE_HEADER = "agora-feature";

/**
 * Preview provider families. Each value is one entry in the
 * {@link PREVIEW_FEATURE_HEADER} header and gates a set of vendors on the
 * preview endpoint.
 */
export const PreviewFeatures = {
    /** @deprecated Gemini ASR now uses the production endpoint. */
    GeminiLive: "gemini-live",
    LiveModels: "live-models",
} as const;

/** A preview provider family gate value. */
export type PreviewFeature = (typeof PreviewFeatures)[keyof typeof PreviewFeatures];

/** Session-scoped clients bound to one resolved route. */
export interface PreviewRoute {
    readonly agents: AgentsClient;
    readonly agentManagement: AgentManagementClient;
    readonly baseUrl: string;
    readonly features: readonly PreviewFeature[];
}

/**
 * Pins the gate after any caller headers. This is also used for per-call auth
 * headers so a custom `agora-feature` value can never blank the session gate.
 */
export function previewRequestHeaders(
    features: readonly PreviewFeature[],
    headers?: Record<string, string>,
): Record<string, string> {
    return { ...headers, [PREVIEW_FEATURE_HEADER]: features.join(",") };
}

/** Build generated resource clients for one preview session. */
export function createPreviewRoute(client: AgoraClient, features: readonly PreviewFeature[]): PreviewRoute {
    const clientOptions = (client as unknown as { _options: BaseClientOptions })._options;
    const fetchFn = clientOptions.fetch ?? globalThis.fetch;
    const options: BaseClientOptions = {
        ...clientOptions,
        baseUrl: PREVIEW_API_BASE_URL,
        headers: previewRequestHeaders(features, clientOptions.headers as Record<string, string>),
        fetch: async (input, init) => {
            const headers = new Headers(init?.headers);
            headers.set(PREVIEW_FEATURE_HEADER, features.join(","));
            return fetchFn(input, { ...init, headers });
        },
    };
    return {
        agents: new AgentsClient(options),
        agentManagement: new AgentManagementClient(options),
        baseUrl: PREVIEW_API_BASE_URL,
        features: [...features],
    };
}

/** ASR vendor served only by the preview endpoint. */
const PREVIEW_ASR_VENDORS: ReadonlySet<string> = new Set();

/**
 * Returns the preview features a start request needs, derived from the request
 * body rather than from the vendor classes — so hand-written configs are
 * covered too.
 */
export function requiredPreviewFeatures(properties: Agora.StartAgentsRequest.Properties): PreviewFeature[] {
    const features = new Set<PreviewFeature>();

    const asrVendor = (properties.asr as { vendor?: string } | undefined)?.vendor;
    if (asrVendor !== undefined && PREVIEW_ASR_VENDORS.has(asrVendor)) {
        features.add(PreviewFeatures.GeminiLive);
    }
    if (isOpenAIGPTLiveConfig(properties.mllm)) {
        features.add(PreviewFeatures.LiveModels);
    }

    return [...features];
}
