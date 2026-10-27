import { CampaignsResource } from "./campaigns.js";
export { CampaignsResource } from "./campaigns.js";
import { AgentsResource, NumbersResource, SecretsResource, SessionsResource } from "./resources.js";
import type { V3Transport } from "./transport.js";

export * from "./resources.js";
export * from "./transport.js";
export * as V3 from "./types.js";
export class V3Client {
    readonly campaigns: CampaignsResource;
    readonly agents: AgentsResource;
    readonly secrets: SecretsResource;
    readonly numbers: NumbersResource;
    readonly sessions: SessionsResource;
    constructor(transport: V3Transport) {
        this.campaigns = new CampaignsResource(transport);
        this.agents = new AgentsResource(transport);
        this.secrets = new SecretsResource(transport);
        this.numbers = new NumbersResource(transport);
        this.sessions = new SessionsResource(transport);
    }
}
