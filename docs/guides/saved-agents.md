---
title: Saving agents
description: Configure an agent, create a live session or save its configuration, then work with the returned handle.
---

# Saving agents

`Agent` is an immutable configuration builder. Configure providers once, then choose a lifecycle:

- `config.createSession(options)` returns an idle `AgentSession`. Call `session.start()`, then use the session for conversation controls and `stop()`.
- `await config.save({name})` returns a `SavedAgent`. Use that handle to update the saved configuration, assign numbers, list its number assignments, or delete it.

Saving and project provisioning are available in this preview checkout, not an announced package release. Configure your client using the [staging setup](./v3-preview.md#1-configure-staging) before running these examples. The snippets below form one async server-side workflow; supply a configured `client` and your provider key.

## Configure, then choose a lifecycle

```ts
import { Agent, OpenAIRealtime, SavedAgent, secretRef } from 'agora-agents';
import type { AgoraClient } from 'agora-agents';

declare const client: AgoraClient;
declare const providerKey: string;

const config = new Agent({ client }).withMllm(new OpenAIRealtime({
  apiKey: providerKey,
  model: 'gpt-realtime',
  instructions: 'Help the caller resolve their issue.',
}));

const session = config.createSession({
  channel: 'support-room', agentUid: '1', remoteUids: ['*'],
});
await session.start();
// Use session.say(), session.getInfo(), and other conversation controls here.
await session.stop();

// Saving is a separate, explicit operation. It never starts a conversation.
const saved = await config.save({ name: 'Support' });
console.log(saved.id);
```

The builder remains reusable and unchanged. The running session ID and saved configuration ID represent different objects. A saved handle currently has no `createSession()` or `start()` method: the new session-start API will accept a saved agent ID, but its endpoint and request schema are still pending. A saved agent ID is not a published pipeline ID; do not substitute one for the other. Existing published-pipeline sessions remain supported by their established configuration.

## Update or reload the saved agent

```ts
const revisedConfig = config.withMllm(new OpenAIRealtime({
  apiKey: providerKey,
  model: 'gpt-realtime',
  instructions: 'Help briefly, and ask one question at a time.',
}));
const updated = await saved.update(revisedConfig);
const loaded = await SavedAgent.get(client, updated.id);
console.log(loaded.name, loaded.etag);
```

`update` uses the handle's ID and preserves its name. Supply `{name: 'New name'}` as a second argument to rename it. The configuration must use the same client instance as the handle. Updates fetch a fresh ETag and make one conditional write; a conflict raises `PreconditionFailedError` rather than overwriting a concurrent change. Each returned handle is a snapshot.

Calling `config.save()` again creates another stored agent unless `agentId` is explicitly supplied. Prefer `saved.update(config)` for updates. Saving is not a guaranteed full replacement of hidden write-only fields; review [replacement limits and conflict handling](./v3-preview.md#4-redeploy-and-handle-conflicts) when changing credentials or provider settings.

## Secrets and variable definitions

```ts
await client.secrets.create({
  name: 'support', secrets: { openai: providerKey },
  idempotencyKey: 'support-initial-secrets',
});
const storedConfig = config.withMllm(new OpenAIRealtime({
  apiKey: secretRef('support', 'openai'),
  model: 'gpt-realtime',
  instructions: 'Help the caller resolve their issue.',
})).withVariable('resolved', {
  type: 'bool', extract: true, description: 'Was the caller’s issue resolved?',
});
await saved.update(storedConfig);
```

Secret values are write-only. `secretRef()` references an existing set/key; it does not create or fetch credentials. Configurations containing secret references can be saved, but direct session creation rejects them because the existing session backend requires inline credentials. Variable definitions describe templates/extraction; they do not add runtime defaults or automatically expose analysis on existing sessions. See [supported mappings](./v3-preview.md#mapping-supported-by-deployment) for validation and unsupported settings.

## Register and assign a number

```ts
const number = await client.numbers.create({
  number: '+12025550123',
  sip_trunk: { hostname: 'your-provider-sip-hostname', transport: 'tls', port: 5061 },
});
await loaded.assignNumber(number, { maxCallDurationSeconds: 900 });
const assigned = await loaded.listNumbers();
console.log(assigned.map(item => item.number));
await loaded.unassignNumber(number.number_id);
// When the saved configuration is no longer needed:
await loaded.delete();
```

Use a real, authorized number and SIP trunk, and save a complete supported phone pipeline before assignment. Assignment never registers a missing number. `listNumbers()` scans all project number pages and filters assignments locally, making one list request per page. Sessions can be listed project-wide through the advanced resource API, but their responses lack a reliable saved-agent association; there is no `saved.listSessions()`.

`client.secrets` and `client.numbers` share the same resource objects, authentication, pagination, and raw-response options as their advanced counterparts. `client.v3` remains available for all 20 transport operations and read-only session records. See the [API reference](../reference/v3.md) for details. Existing `deploy()` and `DeployedAgent` names are compatibility aliases for `save()` and `SavedAgent`.
