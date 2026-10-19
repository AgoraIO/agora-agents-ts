# Conversational AI v3 preview

This additive preview preserves the existing v2 resources and `Agent.createSession()` behavior. v3 agents are stored configurations; v3 sessions are running instances. The SDK package version is separate from the API version.

```ts
import { AgoraClient, Area, Agent, OpenAI, secretRef } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
  // Internal staging override: host only, without the API path.
  v3: {
    baseUrl: 'https://studio-staging.rteappbuilder.com',
    headers: {
      'X-Studio-V2-Gateway-Secret': process.env.STAGING_GATEWAY_SECRET!,
      'X-Consumer-Username': process.env.STAGING_COMPANY_ID!,
    },
  },
});

const agent = new Agent({ client })
  .withLlm(new OpenAI({
    model: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: secretRef('production', 'openai'),
    systemMessages: [{ role: 'system', content: 'Help the caller.' }],
  }))
  .withVariable('resolved', { type: 'bool', extract: true, description: 'Was the issue resolved?' });

// Store this ID; names are not unique and each create makes a new agent.
const deployed = await agent.deploy({ name: 'Support' });
await agent.deploy({ name: 'Support', agentId: deployed.id });
// Register the number in this project with client.v3.numbers.create first.
await deployed.assignNumber('+12025550123', { maxCallDurationSeconds: 900 });
await deployed.unassignNumber('+12025550123');
```

The example configures an LLM only; configure the ASR and TTS modules appropriate for your deployment. The staging backend determines provider availability and required provider settings.

## Low-level API

`client.v3.agents` provides `create`, `list`, `get`, `update`, `delete`. `numbers` has the same methods. `secrets` also has `replace`, `setKey`, and `deleteKey`. `sessions` has only `list` and `get`. These are all 20 operations in the supplied staging OpenAPI contract. No session writes, outbound calls, analysis helpers, or campaign methods are invented.

Requests combine body fields and camelCase path/header fields. Agent/number identifiers use `id`, session identifiers use `agentSessionId`, and secret identifiers use `name` / `key`. Responses retain canonical wire names (`agent_id`, `number_id`, `agent_session_id`). `appid` defaults to the client project; callers may explicitly select another authorized project. Empty path identifiers fail locally and path segments are encoded.

```ts
const { data, rawResponse } = await client.v3.agents.get({ id: deployed.id }).withRawResponse();
await client.v3.agents.update({ id: data.agent_id, ifMatch: rawResponse.headers.get('ETag')!, instructions: 'Updated instructions' });
await client.v3.secrets.setKey({ name: 'production', key: 'openai', value: 'new-key', ifNoneMatch: '*' });
for await (const session of client.v3.sessions.listAll({ status: 'STOPPED', limit: 100 })) {
  console.log(session.agent_session_id);
}
```

`list` returns the original `{data:{count,list},has_more,next_cursor}` envelope. `listAll` is an async iterator over items and checks missing/repeated continuation cursors. Every operation supports `.withRawResponse()` for ETag, request ID, and other response headers. Errors expose `statusCode`, `body`, `rawResponse`, and `requestId`. A 412 produces `PreconditionFailedError`; `latest()` retrieves the latest resource (the parent set for a secret-key conflict, since no GET-key endpoint exists).

Transport shares the existing fetcher, custom `fetch`, timeout, cancellation, Basic/token/app-credential authentication, and current regional host. The staging headers are v3-only. `AGORA_AGENTS_V3_BASE_URL` is an alternative host override; explicit `v3.baseUrl` wins. The appended path is `/conversational-ai/v3/projects/{appid}`. The exact production path, regional availability, and Basic auth support remain unconfirmed; defaulting to the current v2 host with this path is a preview assumption. CN AgentKit deployment is blocked pending confirmation. Logging is not enabled on the preview transport, to avoid exposing gateway headers and write-only credentials through transport logs.

GET retries use the existing retry settings. Writes never retry automatically, including POST numbers (staging ignores its advertised idempotency key). Agent creation has no idempotency header. Secret create accepts `idempotencyKey`. PATCH uses `application/json`, as the published contract specifies.

## AgentKit mapping and limitations

`withVariable` is local, immutable, and validates names/types and extraction descriptions. `secretRef` validates set/key names and produces a branded string. Passing a secret reference through `createSession` or `toProperties` throws `SecretRefNotSupportedError` before sending v2 traffic. Inline credentials on v2 keep their existing behavior.

Deployment maps the serialized provider configs into cascaded/realtime modules, extracts single API-key credentials from their existing locations, and preserves explicitly configured URLs. Without a key it sends managed mode. It never invents provider URLs: staging currently requires a vendor-approved URL for managed modules, so some managed builders require low-level v3 configuration until that backend rule is settled. Vendor `system_messages` takes precedence over deprecated Agent instructions; system messages become instructions, and other messages remain messages. Greeting, turn detection, interruption, silence, and filler settings are converted where the contract supports their semantics.

Unsupported fields are collected in `UnsupportedFieldError` before any network request. This includes session-only settings, realtime/cascaded mixtures, v2 variable values (v3 definitions have no default field), multi-part AWS/Vertex credentials, unsupported avatars, unrepresentable legacy turn detection fields, numeric TTS skip patterns (no confirmed numeric-to-name mapping), and greeting policies absent from v3. Use the typed low-level v3 API for new v3 shapes. The contract validator checks structural mapping and basic constraints; backend vendor-specific validation remains authoritative. Deferred tools/MCP/custom-provider fields are represented by the contract but may be rejected by staging.

`deploy({agentId})` GETs an ETag then sends one conditional PATCH. It recursively nulls stale **readable** fields under the seven mutable top-level agent fields and resubmits each configured credential. Read-only IDs/timestamps and resolved credential metadata are excluded. Moving to managed credentials explicitly nulls `api_key`. This follows standard recursive merge-patch semantics and does not claim server-side replacement: write-only stale fields cannot be inferred from GET, and O11 remains unverified. Use low-level explicit null patches or a new agent when exact removal of hidden prior settings is required. Agent deployment conflicts are never retried automatically.

`DeployedAgent.get(client, id)` retrieves a handle with `id`, `name`, `etag`, and `raw` (the agents resource). `delete()` deletes its stored config. Number assignment accepts a number object, an ID, or an E.164 string beginning with `+`. E.164 resolution scans project pages at limit 100, normalizing whitespace, parentheses, dots, and hyphens. Assignment then GETs an ETag and PATCHes inbound agent/policy fields; one 412 triggers exactly one fresh GET/PATCH retry. Unassignment sends `inbound.agent: null`. Other inbound fields are retained by merge patch. A number must be registered separately in each project.

## Preview maintenance

`src/v3/openapi.json` is the supplied staging snapshot. `python3 scripts/generate-v3-preview.py` regenerates wire types, resources, and the mapping contract. Run the repository formatter afterward. The preview layer is protected by `.fernignore` until the shared Fern specification is integrated. No release version is changed. Tests use mocked transport; this branch does not claim a live staging verification.
