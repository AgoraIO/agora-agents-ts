---
title: Stored-agent API transport
description: Public routing, token authentication, supported configuration mappings, and update semantics.
---

# Stored-agent API transport

Start with [Saving agents](./saved-agents.md) for the configuration → session or saved-agent workflow. This guide covers the advanced transport, configuration mapping, and rollout limits. These features require this preview checkout; no published package release is implied.

## 1. Configure client

```ts
import { Agent, AgoraClient, Area, OpenAI, SavedAgent, PreconditionFailedError, secretRef } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});
```

The public default is `https://preview.ai.agora.io/conversational-ai/v1/projects/{appid}`. The SDK supplies the path and project. Optional `v3.baseUrl` or `AGORA_AGENTS_V3_BASE_URL` changes the origin; the explicit option wins. API naming in the advanced `client.v3` namespace is retained for compatibility even though the public wire path is `v1`.

Use app credentials for fresh ConvoAI REST tokens, or supply `authToken`. Customer/Client ID and Secret options and Basic authorization overrides are rejected. Do not supply internal gateway headers or `X-Studio-Region`; they are rejected before network calls. Normal custom headers, timeout, cancellation, and custom fetch remain available. Supported regions and failover are still unconfirmed; stored-agent/session AgentKit operations remain guarded in CN.

## 2. Session routing

Ordinary inline `Agent.createSession()` retains the established session transport and controls. Secret references, variable definitions, or new session options automatically select ephemeral startup. `SavedAgent.createSession()` starts the saved identity. The application does not select an API version.

Saved configuration IDs and running session IDs are distinct. Never send a new session ID to an old running-agent endpoint. The session adapter handles start, stop, and get-info; unsupported conversation controls fail locally. See [session options](./saved-agents.md#session-options-and-status).

## 3. Credentials and configuration

```ts
await client.secrets.create({ name: 'support', secrets: { openai: process.env.OPENAI_API_KEY! } });
const config = new Agent({ client }).withLlm(new OpenAI({
  apiKey: secretRef('support', 'openai'),
  model: 'gpt-4o-mini',
  url: 'https://api.openai.com/v1/chat/completions',
  systemMessages: [{ role: 'system', content: 'Help {{customer}} resolve their issue.' }],
})).withVariable('customer', { type: 'str', required: true });
const saved = await config.save({ name: 'Support' });
```

This saves an LLM configuration; configure the complete supported pipeline before answering calls. Managed modules omit both top-level and nested provider URLs. The server chooses managed endpoints; BYOK endpoints are preserved. This does not promise availability of every model.

Secret values are write-only. `secretRef(set,key)` creates a validated reference string without a request. Direct conversion to the old inline wire format still rejects references, while `createSession()` uses ephemeral startup. Variables are definitions; runtime values belong to session `values`. `extract:true` requires a description. `dataPolicy.retention:'none'` disables post-call extraction.

Secret and number creation do not accept idempotency keys. Existing keys can be rotated through `secrets.setKey`; conditional set and key operations use their respective ETags.

## 4. Update and handle conflicts

```ts
const updated = await saved.update(config);
const loaded = await SavedAgent.get(client, updated.id);
try {
  await loaded.update(config);
} catch (error) {
  if (error instanceof PreconditionFailedError) console.log(await error.latest());
  else throw error;
}
```

Names are not unique. `save()` without an ID creates another agent; persist the ID and use `saved.update(config)`. Updates preserve the handle's name unless overridden, require the same client instance, fetch the current ETag, and make one conditional PATCH. The builder remains unchanged.

**Full replacement and creation upsert are planned, not currently assumed.** Until confirmed available, the SDK keeps the supported merge-patch adapter: recursively null stale readable mutable fields and explicitly resubmit credentials. GET hides write-only settings, so the adapter cannot guarantee removal of every stale hidden field. Use a deliberate low-level patch or create a new agent when exact removal is required. Do not search by name as an upsert key.

## Mapping supported by deployment

| Configuration | Stored representation |
|---|---|
| ASR/LLM/TTS vendors | Cascaded pipeline |
| Realtime vendor | Realtime pipeline; no cascaded mixture |
| Single provider API key / secret reference | BYOK credential; preserve supplied endpoint |
| Provider without a key | Managed credential; omit URLs |
| Vendor system messages | Joined instructions; other messages retained |
| Realtime vendor instructions | Fallback unless system messages supplied instructions |
| Greeting, modern turn boundaries, interruption | Structured greeting and turn detection |
| Static/generated filler | Flattened trigger/content |
| Supported avatars | Akool, LiveAvatar, Anam, SenseTime, Spatius, Generic |

ASR interaction language follows existing builder precedence and remains separate from provider `params.language`. Realtime interaction-language overrides are rejected. Unknown or unrepresentable settings produce `UnsupportedFieldError.fields` before transport; the SDK never silently drops them.

On ephemeral startup, existing `parameters.opt_out` maps to session retention; `farewell_config` maps to graceful-stop settings; `audio_scenario` maps to RTC audio scenario; builder labels map to session labels. Explicit session options take precedence. These session-only settings are not saved as agent fields. SAL/voiceprint is deferred. RTM/data-channel and metrics/error-message switches are unsupported. Geofencing and string UIDs await backend support; numeric RTC UIDs with exactly one non-wildcard subscriber work now.

## Source contract and maintenance

The [original corrected snapshot](../../src/v3/openapi.json) retains agent bodies and earlier staging corrections. The [engineering-generated schema](../../src/v3/engineering.openapi.json) supplies session and campaign types; the engineering reply takes precedence where it explicitly corrects that file. `python3 scripts/generate-v3-preview.py` regenerates types/resources and mapping contracts; run the repository formatter afterward. The handwritten session adapter applies corrected response/header semantics and survives regeneration. This remains a custom generator, not Fern; `.fernignore` protects it.

See the [31-operation reference](../reference/v3.md). Tests are mocked and examples are compiled; no live endpoint verification is claimed.
