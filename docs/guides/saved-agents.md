---
title: Saving agents
description: Configure once, start a conversation or save the configuration, then use the returned handle.
---

# Saving agents

`Agent` is an immutable configuration builder. Choose `createSession()` for an idle session that you start, or `await save()` for a saved configuration. Continue with the returned session or `SavedAgent` handle. Saving never starts a conversation.

Saving and ephemeral sessions support cascaded pipelines only; MLLM remains available for existing inline sessions. Saving, ephemeral sessions, and project provisioning are part of SDK preview `3.0.0-alpha.1`. Configure a client with app credentials or `authToken`; [public transport setup](./v3-preview.md#1-configure-client) needs no internal gateway headers.

```ts
import { Agent, AgoraClient, Area, OpenAI, SavedAgent, secretRef } from 'agora-agents';
const client = new AgoraClient({ area: Area.US, appId: process.env.AGORA_APP_ID!, appCertificate: process.env.AGORA_APP_CERTIFICATE! });
await client.secrets.create({ name: 'support', secrets: { openai: process.env.OPENAI_API_KEY! } });
const config = new Agent({ client }).withLlm(new OpenAI({
  apiKey: secretRef('support', 'openai'), url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', systemMessages: [{ role: 'system', content: 'Help callers briefly.' }],
}));
const session = config.createEphemeralSession({ channel: 'room', agentUid: '1002', remoteUids: ['1001'] });
await session.start();
await session.stop();
const saved = await config.save({ name: 'Support' });
```

`createEphemeralSession()` explicitly starts an unsaved configuration through the Platform, including when no variables, secrets, or special options are set. Ordinary inline sessions retain their existing transport and conversation controls. Configurations with secret references or variables, and new session options, automatically use ephemeral startup instead. Ephemeral configurations are not saved. Saved BYOK credentials must use `secretRef()`; inline keys remain supported for ephemeral and existing inline sessions. The SDK never uploads secrets implicitly.

## Update, load, and assign numbers

```ts
const revised = config.withLlm(new OpenAI({
  apiKey: secretRef('support', 'openai'), url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', systemMessages: [{ role: 'system', content: 'Ask one question at a time.' }],
}));
const updated = await saved.update(revised);
const loaded = await SavedAgent.get(client, updated.id);
const number = await client.numbers.create({
  number: '+12025550123', sip_trunk: { hostname: 'your-provider-host', transport: 'tls', port: 5061 },
});
await loaded.assignNumber(number, { maxCallDurationSeconds: 900 });
console.log(await loaded.listNumbers());
await loaded.unassignNumber(number.number_id);
```

Use an authorized number/trunk and a complete supported pipeline. Assignment does not implicitly register numbers. `listNumbers()` scans project pages and filters locally. `update(config,{name?})` preserves identity/name, requires the same client instance, and returns a new snapshot. It does not mutate the builder. `SavedAgent.get` reloads a handle; `delete()` removes its configuration. Read [update limits](./v3-preview.md#4-update-and-handle-conflicts) before changing hidden write-only fields.

## Secrets and runtime values

```ts
await client.secrets.create({ name: 'support', secrets: { openai: process.env.OPENAI_API_KEY! } });
const referenced = config.withLlm(new OpenAI({
  apiKey: secretRef('support', 'openai'), url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', systemMessages: [{ role: 'system', content: 'Help {{customer}}.' }],
})).withVariable('customer', { type: 'str', required: true });
const ephemeral = referenced.createEphemeralSession({
  channel: 'ephemeral-room', agentUid: '1002', remoteUids: ['1001'],
  values: { customer: 'Ada' }, labels: { team: 'support' },
  idempotencyKey: 'support-session-4821',
});
await ephemeral.start();
await ephemeral.stop();
```

Secrets are write-only; references do not recover their values. Variable definitions belong to the configuration; primitive runtime `values` belong to a session. Saved starts use the saved configuration. After startup, `session.update()` can replace messages, model params, or the RTC token without changing the saved configuration.

## Session options and status

```ts
const fromSaved = saved.createSession({
  channel: 'saved-room', agentUid: '1002', remoteUids: ['1001'],
  token: process.env.AGORA_RTC_TOKEN,
  idleTimeout: 60, maxDuration: 120,
  gracefulStop: { enabled: true, timeout_ms: 10000 },
  dataPolicy: { retention: 'none' },
  audioScenario: 'aiserver', labels: { team: 'support' },
});
const sessionId = await fromSaved.start();
const info = await fromSaved.getInfo();
console.log(sessionId, info.agent_session_id, info.status);
await fromSaved.stop();
```

Saved/ephemeral starts support `values`, `labels`, optional `token`, RTC `encryption`, `audioScenario`, `geofence`, `gracefulStop`, and `dataPolicy`. `idleTimeout` uses seconds (0–3600); `maxDuration` uses seconds (1–3600). Graceful timeout uses milliseconds (0–120000). RTC accepts numeric or string UIDs of the same type, or omit `agentUid` (or use `0`) for automatic selection, with exactly one nonzero, non-wildcard subscriber. String UID support depends on backend rollout and may still be rejected by the server. `clientReference`/`client_reference` are rejected because the field is being removed. `name` remains a local session name and is not sent as a correlation field.

Start returns the actual session ID and reports `starting` or `running` locally. `getInfo()` updates local status; wire statuses remain uppercase, with `FAILED` mapped to local `error`. `stop()` works from starting/running. For 409 `TaskNotRunning`, local state becomes `stopped`; for 409 `TaskConflict`, it remains `stopping`. Other failures become `error`. All stop errors propagate, including 404 `TaskNotFound`, 409 `TaskNotRunning`/`TaskConflict`, and timeouts. Retry decisions belong to the caller. A successful stop emits the existing stopped event; read the server status for backend progression.

Session-start idempotency keys last 24 hours. Reusing a key/body replays the original response; a changed body or in-progress request returns `409 IdempotencyKeyConflict`. Keep the same key if the outcome is uncertain. The SDK does not automatically retry writes. Secret/number creation does not accept idempotency keys.

Retention `none` disables stored recordings/transcripts/turns and extraction; it does not delete saved agents, secrets, or numbers. Existing `parameters.opt_out`, farewell, and audio-scenario settings map to session fields during ephemeral startup; explicit session options win. Unsupported settings fail before a request. Say, think, interrupt, history/turn controls, and legacy raw-client access remain unsupported for these sessions; no old/new ID substitution is performed.

## Update a running session

```ts
await fromSaved.update({
  token: 'renewed-rtc-token',
  messages: [{ role: 'system', content: 'Keep replies concise.' }],
  llm: { params: { temperature: 0.5 } },
});
```

Use `llm.params` for cascaded models; each supplied params object **replaces** the current provider params, so include settings you want to retain. `messages` replaces the conversation message list; the existing `llm.system_messages` spelling also maps to that field for saved/ephemeral sessions. Endpoint aliases (`url`, `base_url`, `api_base_url`, `endpoint`) cannot change at runtime. The same `messages` option works with existing inline sessions, where the SDK maps it to `llm.system_messages`; legacy MLLM sessions retain their existing update behavior. Saved and ephemeral preview sessions reject MLLM updates. Updates require a running session and propagate backend errors.

## Campaigns and advanced access

`client.campaigns` exposes typed create/list/get/update/delete and pause/resume/cancel, with raw response headers and pagination. It does not implement a separate scheduling state machine or contact retry loop. See the [complete reference](../reference/v3.md#campaigns-eight-operations).

`client.secrets`, `client.numbers`, and `client.campaigns` share their advanced `client.v3` resource instances. `deploy()` and `DeployedAgent` remain compatibility aliases. Session lists still lack a reliable saved-agent association; store your own returned session-ID → saved-ID relationship.

Status reads started before a stop or restart cannot overwrite the newer local state. Concurrent status reads apply only the most recently issued read. During a restart, `id` is null until the new session ID arrives; reads and stop cannot target the previous session.

## Outbound calls

```ts
const call = saved.call({
  from: number.number_id, to: '+12025550199',
  callPolicy: { max_ring_duration_ms: 30000 },
  idempotencyKey: 'outbound-4821',
});
await call.start();
await call.stop();
```

`config.call()` provides the same lifecycle for an unsaved configuration. `from` is a registered number ID, not a phone number. Use `assignNumber(number, { callPolicy: { end_call: { on_user_request: true } } })` to configure the full inbound policy while the SDK handles conditional updates.

For RTC sessions, an explicit nonzero `agentUid` and client certificate let the SDK generate the RTC token when `token` is omitted. Explicit tokens are preserved. If the UID is omitted, zero, or a numeric identity outside the local signer’s unsigned 32-bit range, token provisioning stays with the service. A client using `authToken` can omit `appCertificate`; in that case, supply the RTC token yourself or use service provisioning.
