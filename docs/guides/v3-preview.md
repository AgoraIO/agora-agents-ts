---
title: Conversational AI v3 preview
description: Configure staging, deploy stored agents, manage secrets and numbers, and preserve existing v2 sessions.
---

# Conversational AI v3 preview

The preview adds stored agents, secrets, project-scoped numbers, and read-only sessions through `client.v3`. Existing v2 resources and `Agent.createSession()` retain their behavior. This guide applies to the preview branch/package build; it does not announce a published release.

| Task | API |
|---|---|
| Start an RTC conversation now | `Agent.createSession(...).start()` — existing v2 |
| Save or redeploy a configuration | `Agent.deploy(...)` — new v3 |
| Assign an existing number to a stored agent | `DeployedAgent.assignNumber(...)` — v3 |
| Read sessions already available in the project | `client.v3.sessions.list/get` |
| Start/stop/update v3 sessions, outbound calls, campaigns | Not implemented; backend schemas are pending |

The complete [v3 reference](../reference/v3.md) lists all 20 REST operations, request fields, headers, and return types.

## 1. Configure staging

Use a build of this preview branch in your application. Keep the application credentials and gateway secret on your server. Set environment variables using your own authorized project and gateway credentials:

```sh
export AGORA_APP_ID='your-project-app-id'
export AGORA_APP_CERTIFICATE='your-app-certificate'
export AGORA_AGENTS_V3_BASE_URL='https://studio-staging.rteappbuilder.com'
export STAGING_GATEWAY_SECRET='your-staging-gateway-secret'
export STAGING_COMPANY_ID='your-company-id'
export OPENAI_API_KEY='your-provider-key'
```

The examples below are successive fragments of one async server-side flow; they are not an instruction to provision resources simply by importing a module.

```ts
import {
  Agent, AgoraClient, Area, DeployedAgent, OpenAI, OpenAIRealtime,
  PreconditionFailedError, V3Error, secretRef,
} from 'agora-agents';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

const client = new AgoraClient({
  area: Area.US,
  appId: required('AGORA_APP_ID'),
  appCertificate: required('AGORA_APP_CERTIFICATE'),
  v3: {
    baseUrl: required('AGORA_AGENTS_V3_BASE_URL'),
    headers: {
      'X-Studio-V2-Gateway-Secret': required('STAGING_GATEWAY_SECRET'),
      'X-Consumer-Username': required('STAGING_COMPANY_ID'),
    },
  },
});
```

`v3.baseUrl` is a host, without the API prefix. The SDK appends `/conversational-ai/v3/projects/{appid}`. Alternatively, omit `v3.baseUrl` and let `AGORA_AGENTS_V3_BASE_URL` supply it; the explicit option wins. Staging headers apply only to v3.

The client retains its normal token, Basic, or app-credential authentication and custom `fetch`, timeout, and cancellation support. Without a v3 override, it uses the current regional v2 host with the v3 path above. **That production path, regional availability, and Basic-auth acceptance remain unconfirmed.** AgentKit deployment in CN is blocked pending confirmation. See [authentication](../getting-started/authentication.md) and [regional routing](./regional-routing.md) for existing v2 behavior.

## 2. Keep the v2 session flow separate

A v2 session still takes inline provider credentials and starts a running conversation. The v3 staging override does not route this session through v3:

```ts
const liveV2Agent = new Agent({ client }).withMllm(new OpenAIRealtime({
  apiKey: required('OPENAI_API_KEY'),
  model: 'gpt-realtime',
}));
const liveSession = liveV2Agent.createSession({
  channel: 'support-room', agentUid: '1', remoteUids: ['*'],
});
await liveSession.start();
// At the end of this conversation:
await liveSession.stop();
```

A v3 stored-agent ID cannot be passed to this flow as if it were a v2 running-agent ID. The preview does not establish that v2 agent IDs and v3 session IDs are interchangeable. See the [MLLM flow](./mllm-flow.md) or [cascading flow](./cascading-flow.md) for complete v2 conversation examples.

## 3. Store credentials, then deploy a configuration

Create the secret set once. Secret values are write-only; GET returns names and key names, not their values. Choose a set name you own in the project:

```ts
await client.v3.secrets.create({
  name: 'support-preview',
  secrets: { openai: required('OPENAI_API_KEY') },
  idempotencyKey: 'support-preview-initial-secrets',
});

const storedConfig = new Agent({ client })
  .withLlm(new OpenAI({
    model: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: secretRef('support-preview', 'openai'),
    systemMessages: [{ role: 'system', content: 'Help the caller resolve their issue.' }],
  }))
  .withVariable('customer_name', { type: 'str', required: true })
  .withVariable('resolved', {
    type: 'bool', extract: true, description: 'Was the caller’s issue resolved?',
  });

const deployed = await storedConfig.deploy({ name: 'Support preview' });
console.log(deployed.id); // Persist this ID for future redeployments.
```

This saves an LLM configuration; it does **not** start a conversation or provide a complete ASR/TTS phone pipeline. Configure those modules before using the agent to answer calls. The backend remains authoritative for supported providers and endpoint settings.

`secretRef(set, key)` returns `$secrets.<set>.<key>` as a branded string. Both components must contain 1–64 letters, digits, underscores, or hyphens. It does not create or resolve the secret. Calling `createSession()` or `toProperties()` with a secret reference throws `SecretRefNotSupportedError` locally; use a separate inline-credential builder for v2.

`withVariable(name, definition)` returns a new Agent and performs no network call. Names match `^[a-z][a-z0-9_]{0,63}$`; types are `str`, `int`, `float`, `bool`, `date`, or `datetime`. Optional fields are `required`, `options`, `extract`, and `description`. `extract: true` requires a nonblank description. These are definitions, not runtime values; v2 `templateVariables` cannot be migrated as variable defaults because v3 has no default field. Extraction results, when available, are read through the low-level session response’s `analysis` field; there is no AgentKit `getAnalysis()` method in this phase.

To rotate an existing key, use `setKey({name,key,value})`, optionally with its key ETag. Use `ifNoneMatch: '*'` only when creating a new key. Set ETags and key ETags are distinct; retrieve the set again after key changes before conditional set replacement or deletion.

For cascaded deploys, `turnDetection.language` maps to `pipeline.asr.language` rather than the v3 turn-detection object. With an STT vendor configured, the interaction language follows v2 precedence (`turnDetection.language`, otherwise `en-US`), while provider-specific languages remain in `asr.params`. Explicitly setting an interaction language without an STT vendor uses the existing managed default (`ares` globally; CN deployment remains unavailable). It does not invent a provider URL: if staging requires one, configure an approved STT vendor/endpoint explicitly. A partial builder with neither STT nor an interaction language keeps ASR absent. Only realtime vendor `params.instructions` becomes top-level instructions; cascaded provider params remain separate from Agent instructions.

## 4. Redeploy and handle conflicts

Names are not unique upsert keys. Every `deploy()` without `agentId` creates a new stored agent. Update a known ID explicitly:

```ts
const updated = await storedConfig.deploy({ name: 'Support preview', agentId: deployed.id });
const loaded = await DeployedAgent.get(client, updated.id);
console.log(loaded.id, loaded.name, loaded.etag);
// loaded.raw is client.v3.agents, for operations the handle does not wrap.
```

An update GETs the current ETag and sends one PATCH with `If-Match`. It recursively nulls stale readable fields beneath `agent_name`, `instructions`, `messages`, `greeting`, `variables`, `pipeline`, and `filler_words`. It excludes IDs, timestamps, and resolved credential metadata, and explicitly resubmits configured credentials. Switching to managed mode explicitly nulls `api_key`.

**Redeploy is not a guaranteed full replacement.** GET omits write-only data, so the SDK cannot discover every stale hidden setting. Recursive deletion follows standard JSON merge-patch semantics; the backend’s whole-pipeline replacement behavior has not been verified. Use a deliberate low-level null patch or a new agent when hidden prior settings must be removed exactly. The SDK never silently retries an agent update after a conflict.

```ts
const current = await client.v3.agents.get({ id: loaded.id }).withRawResponse();
const tag = current.rawResponse.headers.get('ETag');
if (!tag) throw new Error('Agent response is missing ETag');
try {
  await client.v3.agents.update({
    id: loaded.id, ifMatch: tag, instructions: 'Help briefly and clearly.',
  });
} catch (error) {
  if (error instanceof PreconditionFailedError) {
    const latest = await error.latest(); // Fetches; never retries the write.
    console.log('Review the concurrent change before updating', latest);
  } else if (error instanceof V3Error) {
    console.error(error.statusCode, error.requestId); // Do not log credentials.
    throw error;
  } else {
    throw error;
  }
}
```

The conflict error preserves the raw response and parsed error body. `latest()` preserves per-call request options, including auth and custom headers, but removes write-condition/idempotency headers. For a secret-key conflict it GETs the parent set because the contract has no GET-key operation. See [errors and raw responses](../reference/v3.md#responses-errors-and-retries).

## 5. Register and assign a number

Register the number and its real SIP trunk in the same project first. Use the hostname supplied by your provider:

```ts
const registered = await client.v3.numbers.create({
  number: '+12025550123',
  description: 'Support staging line',
  sip_trunk: { hostname: required('SIP_TRUNK_HOSTNAME'), transport: 'tls', port: 5061 },
});
// Only after deployed contains the complete pipeline you intend to use:
await loaded.assignNumber(registered, { maxCallDurationSeconds: 900, maxSilenceDurationMs: 30000 });
const assignedNumbers = await loaded.listNumbers();
console.log(assignedNumbers.map(number => number.number_id));
await loaded.unassignNumber(registered.number_id);
```

`assignNumber`/`unassignNumber` accept a `V3.NumberResponse`, an ID, or a string beginning with `+` for E.164 lookup. Lookup scans project pages at limit 100 and ignores whitespace, parentheses, dots, and hyphens when comparing numbers. It throws `NumberNotFoundError` if the number is absent from that project.

Assignment GETs a fresh number ETag, then PATCHes `inbound.agent` and supplied policy fields. One 412 triggers exactly one further GET/PATCH attempt. Unassignment sends `inbound.agent: null`; unrelated inbound settings survive merge patch. No number is implicitly created. Staging does not implement `end_call`, `transfer`, `allowed_ips`, or a secret-reference SIP password; use only supported SIP fields. This preview provides no outbound-call helper.

`deployed.listNumbers()` returns all project numbers whose `inbound.agent` equals the handle’s ID. It scans every project page at limit 100 and filters locally, making one list request per page and no per-number GETs. Its cost grows with the project’s number count.

There is no `deployed.listSessions()` helper: session list items contain only session ID, start time, and status; retrieval adds a nonunique `agent_name` but no `agent_id`. Scanning pages cannot establish reliable agent ownership. Use project-wide `client.v3.sessions.listAll()` until the API exposes an association, or maintain your own verified session-to-agent mapping outside this preview.

## Mapping supported by deployment

| Builder configuration | Stored v3 representation |
|---|---|
| `withStt`, `withLlm`, `withTts` | `pipeline.mode: 'cascaded'` and provider modules |
| `withMllm` | `pipeline.mode: 'realtime'` and `mllm`; no cascaded module mixture |
| Provider single API key, including `secretRef` | `credential: {mode:'byok', api_key}` |
| Provider without a key | `credential: {mode:'managed'}` |
| Vendor system/messages | System text joined into `instructions`; other messages retained |
| Realtime vendor `params.instructions` | Top-level instructions, unless explicit vendor messages are supplied |
| Deprecated Agent instructions/greeting/history/failure | Fallback when the corresponding vendor configuration is absent |
| Greeting text/audio and supported playback settings | Top-level structured `greeting` |
| Modern turn boundaries and cascaded interruption | Flattened `turn_detection` boundaries/interruption |
| `parameters.silence_config` | Cascaded `silence_config`, with `enabled: true` |
| Static/generated filler words | Flattened trigger/content; generated prompt becomes instructions |
| Supported avatars | Avatar module with `enabled` |

Deployment collects unsupported settings into `UnsupportedFieldError.fields` before a request. Examples include `sal`, `advancedFeatures`, `geofence`, `labels`, `rtc`, `pipelineId`, parameters other than `silence_config`, unsupported avatar vendors, unrepresentable legacy turn settings, realtime interruption/silence overrides, multi-part provider credentials, numeric TTS skip patterns, and greeting policies absent from v3. It also rejects v2 template-variable values. Use the typed low-level API when configuring v3 shapes that the builder does not represent.

Provider URLs are preserved from configuration; the SDK invents none. Staging requires a vendor-approved URL for managed modules, so some managed builders need low-level v3 configuration. Managed mode is not a promise that a provider is available. Structural/basic constraint checks run locally; vendor-specific validation remains the backend’s responsibility. Tools/MCP/custom-provider fields appear in the contract but remain deferred on staging.

## Migration and maintenance

1. Keep existing v2 sessions and inline credentials unchanged while evaluating v3.
2. Create project secrets and separate stored-agent builders; remove unsupported session-only configuration from those builders.
3. Save each new `agent_id` and pass it on redeploy. Register numbers per project before assignment.
4. Use low-level session reads only for IDs available through v3. Do not assume that a v2 ID is interchangeable.
5. Keep session writes, outbound calls, and campaigns on hold until their schemas and SDK support exist.

The SDK package version is separate from API v3; this branch does not automatically bump a release version or deprecate v2 telephony.

The checked-in [staging snapshot](../../src/v3/openapi.json) drives a **custom preview generator, not Fern**. `python3 scripts/generate-v3-preview.py` regenerates wire types, resource methods, and the mapping contract; run the repository formatter afterward. `.fernignore` protects the preview until shared Fern generation is integrated. See the [generator](../../scripts/generate-v3-preview.py) and [resource implementation](../../src/v3/resources.ts). Examples are type-checked and transport tests are mocked; no live staging verification is claimed.
