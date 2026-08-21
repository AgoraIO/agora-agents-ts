/**
 * Preview endpoint client.
 *
 * Preview providers are not served by the production Conversational AI gateway.
 * They live behind a single partner host and are gated by an `agora-feature`
 * header. {@link AgoraPreviewClient} is a drop-in replacement for
 * {@link AgoraClient} that points every request at that host and sends the
 * header, so the rest of agentkit (`Agent`, `AgentSession`, vendor classes)
 * works unchanged.
 *
 * Everything under `agentkit/preview/` is temporary. When these providers ship
 * on the production gateway, delete this directory and move the vendor classes
 * into `vendors/mllm.ts`.
 */

import { AgoraClient } from "../../AgoraPoolClient.js";
import type * as Agora from "../../api/index.js";
import { AgentManagementClient } from "../../api/resources/agentManagement/client/Client.js";
import { AgentsClient } from "../../api/resources/agents/client/Client.js";
import { PhoneNumbersClient } from "../../api/resources/phoneNumbers/client/Client.js";
import { TelephonyClient } from "../../api/resources/telephony/client/Client.js";
import type { BaseClientOptions } from "../../BaseClient.js";
import { Pool } from "../../core/domain/index.js";
import type { AgoraArea } from "../area.js";
import { GEMINI_PREVIEW_MLLM_URL } from "./vendors.js";

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
    /** The Gemini walkie-talkie / clever-chatter MLLMs. */
    GeminiLive: "gemini-live",
} as const;

/** A preview provider family (`"gemini-live"`). */
export type PreviewFeature = (typeof PreviewFeatures)[keyof typeof PreviewFeatures];

const DEFAULT_PREVIEW_FEATURES: readonly PreviewFeature[] = [PreviewFeatures.GeminiLive];

/**
 * Options for {@link AgoraPreviewClient}. Identical to {@link AgoraClient.Options}
 * plus the preview-only `features` and `baseUrl` overrides.
 */
export type PreviewClientOptions<TArea extends AgoraArea = AgoraArea> = AgoraClient.Options<TArea> & {
    /**
     * Preview families to request via the `agora-feature` header.
     * Defaults to `["gemini-live"]`.
     */
    features?: readonly PreviewFeature[];
    /** Override the preview base URL. For internal testing against a staging host. */
    baseUrl?: string;
};

/**
 * A {@link Pool} pinned to a single preview host.
 *
 * The preview endpoint is one partner host with no regional replicas, so
 * failover and DNS-based domain selection are no-ops.
 */
class PreviewPool extends Pool {
    private readonly _url: string;

    constructor(area: AgoraArea, url: string) {
        super(area);
        this._url = url;
    }

    override getCurrentURL(): string {
        return this._url;
    }

    override nextRegion(): void {}

    override selectBestDomain(_signal?: AbortSignal): Promise<void> {
        return Promise.resolve();
    }
}

/**
 * Client for the Agora Conversational AI preview endpoint.
 *
 * Use it exactly like {@link AgoraClient} — same auth modes, same `Agent` and
 * `AgentSession` API. It differs only in where requests go and in the
 * `agora-feature` header it attaches.
 *
 * @example
 * ```typescript
 * import { Agent, Area, AgoraPreviewClient, GeminiCleverChatter } from 'agora-agents';
 *
 * const client = new AgoraPreviewClient({
 *   area: Area.US,
 *   appId: process.env.AGORA_APP_ID!,
 *   appCertificate: process.env.AGORA_APP_CERTIFICATE!,
 * });
 *
 * const session = new Agent({ client })
 *   .withMllm(new GeminiCleverChatter({
 *     apiKey: process.env.GOOGLE_API_KEY!,
 *     thinkingLevel: 'medium',
 *   }))
 *   .createSession({ channel: 'demo', agentUid: '1', remoteUids: ['100'] });
 *
 * await session.start();
 * ```
 */
export class AgoraPreviewClient<TArea extends AgoraArea = AgoraArea> extends AgoraClient<TArea> {
    /** Preview families sent in the `agora-feature` header. */
    public readonly previewFeatures: readonly PreviewFeature[];
    private readonly _previewPool: Pool;

    constructor(options: PreviewClientOptions<TArea>) {
        const { features, baseUrl, ...clientOptions } = options;
        const previewFeatures = features ?? DEFAULT_PREVIEW_FEATURES;

        super({
            ...clientOptions,
            headers: {
                ...clientOptions.headers,
                // Last, so caller-supplied headers cannot drop or blank the gate.
                // Without it the gateway routes to the production environment,
                // where these providers do not exist — use `features` to change
                // the value. This is the whole point of the class.
                [PREVIEW_FEATURE_HEADER]: previewFeatures.join(","),
            },
        } as AgoraClient.Options<TArea>);

        this.previewFeatures = [...previewFeatures];
        this._previewPool = new PreviewPool(options.area, baseUrl ?? PREVIEW_API_BASE_URL);
    }

    /**
     * Sub-clients are built from the inherited options with the preview base URL
     * substituted for the regional pool URL. They are cached by the base class,
     * so this runs once per resource.
     */
    private _previewOptions(): BaseClientOptions {
        return { ...this._options, baseUrl: this._previewPool.getCurrentURL() };
    }

    public override get agents(): AgentsClient {
        return (this._agents ??= new AgentsClient(this._previewOptions()));
    }

    public override get agentManagement(): AgentManagementClient {
        return (this._agentManagement ??= new AgentManagementClient(this._previewOptions()));
    }

    public override get telephony(): TelephonyClient {
        return (this._telephony ??= new TelephonyClient(this._previewOptions()));
    }

    public override get phoneNumbers(): PhoneNumbersClient {
        return (this._phoneNumbers ??= new PhoneNumbersClient(this._previewOptions()));
    }

    public override get pool(): Pool {
        return this._previewPool;
    }

    public override getCurrentURL(): string {
        return this._previewPool.getCurrentURL();
    }

    /** No-op: the preview endpoint has no regional replicas to fail over to. */
    public override nextRegion(): void {}

    /** No-op: the preview endpoint has a single fixed host. */
    public override async selectBestDomain(_signal?: AbortSignal): Promise<void> {}
}

/**
 * Preview MLLM models. `mllm.vendor` is `"gemini"` for both the production
 * Gemini Live provider and the preview ones, so the model name is one of two
 * things that mark a config as preview-only; see
 * {@link hasPreviewMllmEnvelope} for the other.
 *
 * Both the codenames and their post-rename IDs are listed, so recognition keeps
 * working through Google's rollout whichever name a caller sends.
 */
const PREVIEW_MLLM_MODELS: ReadonlySet<string> = new Set([
    "walkie-talkie",
    "clever-chatter",
    "gemini-3.5-live",
    "gemini-3.5-live-thinking",
]);

/**
 * Whether a config carries the envelope the preview MLLM vendor classes emit:
 * the API key repeated inside `params`, and a `url` on the Gemini Developer API
 * host. The production {@link GeminiLive} vendor emits neither — it leaves
 * `params.api_key` unset and defaults `url` to `""` or a WebSocket endpoint.
 *
 * This is the second recognition path, and it exists because keying only off
 * {@link PREVIEW_MLLM_MODELS} makes an unrecognised model name fail silently:
 * {@link applyPreviewShape} would stop retargeting `greeting_message`, the
 * greeting would land in a field these models ignore, and the agent would
 * simply never greet. A model name we have not listed yet is reachable by
 * following this SDK's own advice to override `model` when Google renames one
 * ahead of a release, so the failure has to not be silent.
 */
function hasPreviewMllmEnvelope(mllm: Agora.Mllm): boolean {
    const params = mllm.params as Record<string, unknown> | undefined;
    return (
        typeof params?.api_key === "string" &&
        typeof mllm.url === "string" &&
        mllm.url.startsWith(GEMINI_PREVIEW_MLLM_URL)
    );
}

/**
 * Whether an MLLM config targets a preview model — by name, or by the wire
 * envelope only the preview vendor classes produce.
 */
function isPreviewMllm(mllm: Agora.Mllm | null | undefined): boolean {
    if (!mllm || mllm.vendor !== "gemini") {
        return false;
    }
    const model = mllm.params?.model;
    if (typeof model === "string" && PREVIEW_MLLM_MODELS.has(model)) {
        return true;
    }
    return hasPreviewMllmEnvelope(mllm);
}

/**
 * Returns the preview features a start request needs, derived from the request
 * body rather than from the vendor classes — so hand-written configs are
 * covered too.
 */
export function requiredPreviewFeatures(properties: Agora.StartAgentsRequest.Properties): PreviewFeature[] {
    const features = new Set<PreviewFeature>();

    if (isPreviewMllm(properties.mllm)) {
        features.add(PreviewFeatures.GeminiLive);
    }

    return [...features];
}

/**
 * MLLM wire keys the preview route spells differently from the Agora schema,
 * as production spelling -> preview spelling.
 *
 * `failure_message` is deliberately absent: it is an Agora engine feature
 * rather than a Gemini one, so it keeps its schema spelling.
 */
const PREVIEW_MLLM_FIELD_RENAMES: ReadonlyMap<string, string> = new Map([["greeting_message", "greeting"]]);

/**
 * Retargets MLLM fields that the shared builder wrote using production
 * spellings, so a preview config follows the preview route's structure.
 *
 * `Agent` fills `mllm.greeting_message` from an agent-level `greeting` whenever
 * the vendor has not set that key — correct for every GA vendor, but the
 * preview Gemini models read `greeting`, so the value would land in a field
 * they ignore and the agent would silently never greet.
 *
 * Rather than teach the shared builder about preview providers, the translation
 * lives here and disappears with this directory at GA. The vendor's own value
 * wins; the production-spelled one is the fallback, which also migrates a
 * hand-written `greeting_message` onto the preview key so an existing config
 * keeps working after only swapping the model.
 *
 * Mutates `properties.mllm` in place. Safe because every SDK hands this a fresh
 * copy of the MLLM config rather than the Agent's stored one.
 */
export function applyPreviewShape(properties: Agora.StartAgentsRequest.Properties): void {
    const mllm = properties.mllm;
    if (!mllm || !isPreviewMllm(mllm)) {
        return;
    }
    for (const [production, preview] of PREVIEW_MLLM_FIELD_RENAMES) {
        const value = mllm[production];
        if (value === undefined) {
            continue;
        }
        if (mllm[preview] === undefined) {
            mllm[preview] = value;
        }
        delete mllm[production];
    }
}

/**
 * Fails fast when a session configured with preview providers would be sent to
 * a client that cannot reach them, instead of surfacing an opaque gateway error.
 */
export function assertPreviewSupport(client: unknown, properties: Agora.StartAgentsRequest.Properties): void {
    const required = requiredPreviewFeatures(properties);
    if (required.length === 0) {
        return;
    }

    const enabled = client instanceof AgoraPreviewClient ? client.previewFeatures : [];
    const missing = required.filter((feature) => !enabled.includes(feature));
    if (missing.length === 0) {
        return;
    }

    throw new Error(
        `This agent uses preview providers that require the preview endpoint (${missing.join(", ")}). ` +
            "Create the session with AgoraPreviewClient instead of AgoraClient, and make sure its " +
            `\`features\` include: ${missing.join(", ")}.`,
    );
}
