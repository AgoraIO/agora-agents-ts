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

Use app credentials for fresh ConvoAI REST tokens, or supply `authToken`. Customer/Client ID and Secret options and Basic authorization overrides are rejected. Do not supply internal gateway headers or `X-Studio-Region`; they are rejected before network calls. Normal custom headers, timeout, cancellation, and custom fetch remain available. See the [release notes](../../changelog.md) for current regional availability. Preview availability is release guidance rather than an SDK region restriction; existing inline-session regional routing remains intact.

## 2. Session routing

Ordinary inline `Agent.createSession()` retains the established session transport and controls. Secret references, variable definitions, or new session options automatically select ephemeral startup. `SavedAgent.createSession()` starts the saved identity. The application does not select an API version.

Saved configuration IDs and running session IDs are distinct. Never send a new session ID to an old running-agent endpoint. The session adapter handles start, stop, get-info, and runtime updates; unsupported conversation controls fail locally. See [session options](./saved-agents.md#session-options-and-status).

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

Saved BYOK credentials require explicit secret references; ephemeral input accepts inline credentials. The SDK does not create secret sets automatically. Secret set names and newly written keys use 1–64 ASCII letters, digits, or underscores. Secret values are write-only. `secretRef(set,key)` creates a validated reference string without a request. Direct conversion to the old inline wire format still rejects references, while `createSession()` uses ephemeral startup. Variables are definitions; runtime values belong to session `values`. `extract:true` requires a description. `dataPolicy.retention:'none'` disables post-call extraction.

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
| Provider credentials / secret references | Vendor-specific `credential.fields`; saved writes require references, ephemeral input permits inline values |
| Provider without a key | Managed credential; omit URLs |
| Vendor system messages | Joined instructions; other messages retained |
| Greeting, modern turn boundaries, interruption | Structured greeting and turn detection |
| Static/generated filler | Flattened trigger/content |
| Supported avatars | Akool, LiveAvatar, Anam, SenseTime, Spatius, Generic |

ASR interaction language follows existing builder precedence and remains separate from provider `params.language`. Unknown or unrepresentable settings produce `UnsupportedFieldError.fields` before transport; the SDK never silently drops them.

On ephemeral startup, existing `parameters.opt_out` maps to session retention; `farewell_config` maps to graceful-stop settings; `audio_scenario` maps to RTC audio scenario; builder labels map to session labels. Explicit session options take precedence. These session-only settings are not saved as agent fields. SAL/voiceprint is deferred. RTM/data-channel and metrics/error-message switches are unsupported. Optional RTC `geofence` accepts `area` (`global`, `north_america`, `europe`, `asia`, `india`, `japan`) and `exclude_area` only with `global`; the excluded area cannot be `global`. This corrected field depends on backend rollout. Existing builder geofence maps into transport during ephemeral startup and is not saved. RTC accepts matching numeric/string UID types and omitted UID or UID `0` for auto-selection, with exactly one nonzero, non-wildcard subscriber; servers awaiting rollout may reject string UIDs.

## Source contract and maintenance

The [OpenAPI handoff](../../openapi.yaml) and [JSON generation snapshot](../../src/v3/openapi.json) describe the same corrected contract, including cascaded pipelines and 24-hour idempotency. `python3 scripts/generate-v3-preview.py` regenerates wire types, resource methods, and mapping validators from that single JSON snapshot; run the repository formatter afterward. The handwritten session adapter preserves lifecycle normalization and survives regeneration. This remains a custom generator, not Fern; `.fernignore` protects the source and handoff. Schema inclusion does not claim that every rollout-dependent feature is live.

See the [32-operation reference](../reference/v3.md). Tests are mocked and examples are compiled; no live endpoint verification is claimed.

Realtime/MLLM pipelines are excluded from saved-agent and ephemeral-session APIs in this preview. Existing inline MLLM sessions remain supported, but cannot use saving, secret references, or options that require the new session API. Unsupported combinations fail before HTTP.
