---
sidebar_position: 3
title: AgentSession
description: Full API reference for the AgentSession class.
---

# AgentSession Reference

<!-- snippet: fragment -->

<!-- snippet: fragment -->
```typescript
import { AgentSession } from 'agora-agents';
```

Create sessions via [`agent.createSession()`](./agent.md) — not by calling the constructor directly.

Pass `name` in `SessionOptions` to set the unique agent instance identifier sent to the Agora API. Omit it to auto-generate `agent-{timestamp}`.

## State machine

```
idle ──► starting ──► running ──► stopping ──► stopped
                         │
                         ▼
                       error
```

| Transition           | Trigger                                                |
| -------------------- | ------------------------------------------------------ |
| `idle → starting`    | `start()` called                                       |
| `starting → running` | API responds with agent ID                             |
| `starting → error`   | API request fails                                      |
| `running → stopping` | `stop()` called                                        |
| `stopping → stopped` | API confirms agent stopped                             |
| `stopping → error`   | Stop request fails (and agent was not already stopped) |
| `running → error`    | Unrecoverable error during interaction                 |

`start()` can also be called from `stopped` or `error` state to restart.

## Methods

### `start(): Promise<string>`

Start the agent session. Validates avatar/TTS configuration, sends the start request, and returns the agent ID.

- Transitions: `idle` / `stopped` / `error` → `starting` → `running`
- Throws if called in `starting`, `running`, or `stopping` state
- Throws if avatar config is invalid (wrong TTS sample rate)
- Throws if MLLM is enabled together with an enabled avatar — avatars are only supported with the cascading ASR + LLM + TTS pipeline
- Applies explicit `preset` values when provided and sends Agora-managed configuration when supported vendor credentials are omitted
- Resolves pipeline IDs as `session.pipelineId ?? agent.pipelineId`; sends the resolved value as the top-level `/join` field `pipeline_id`, not inside `properties`
- Fills generic avatar `agora_appid` and `agora_channel` from the session when omitted
- Generates avatar `agora_token` for `HeyGenAvatar`, `LiveAvatarAvatar`, `GenericAvatar`, `Tavus`, `Protoface`, `LemonSlice`, `SensetimeAvatar`, and `SpatiusAvatar` when `agoraToken` is omitted and the client has an `appCertificate`. Other vendors (`AkoolAvatar`, `AnamAvatar`) never receive an auto-generated token.

### `stop(): Promise<void>`

Stop the agent session. If the agent has already stopped (e.g., timed out), resolves silently instead of throwing a 404 error.

- Transitions: `running` → `stopping` → `stopped`
- Throws if called outside `running` state

### `say(text: string, options?: SayOptions): Promise<void>`

Instruct the agent to speak the given text.

- Only valid in `running` state
- `options.priority`: `SpeakPriority` — message priority
- `options.interruptable`: `boolean` — whether this message can be interrupted

### `interrupt(): Promise<void>`

Interrupt the agent's current speech.

- Only valid in `running` state

### `update(config: AgentConfigUpdate): Promise<void>`

Update the agent configuration mid-session (LLM params, instructions, etc.).

- Only valid in `running` state
- Accepts a partial configuration object

### `getHistory(): Promise<ConversationHistory>`

Fetch the conversation history for this session.

- Requires a valid `agentId` (i.e., `start()` must have been called)

### `getTurns(options?: GetTurnsOptions): Promise<ConversationTurns>`

Fetch turn-by-turn analytics for this session, including start/end events and latency metrics.

- Requires a valid `agentId` (i.e., `start()` must have been called)
- `options.page_index`: page number, starting from `1`
- `options.page_size`: number of turns per page

### `getAllTurns(options?: Omit<GetTurnsOptions, "page_index">): Promise<ConversationTurns>`

Fetch all turn analytics pages and merge the `turns` array.

- Requires a valid `agentId`
- For very long sessions, prefer processing pages with `getTurns()` to avoid holding all turns in memory

### `getInfo(): Promise<SessionInfo>`

Fetch current agent metadata from the API.

- Requires a valid `agentId`

### `on<T>(event: AgentSessionEvent, handler: AgentSessionEventHandler<T>): void`

Subscribe to a session event.

### `off<T>(event: AgentSessionEvent, handler: AgentSessionEventHandler<T>): void`

Unsubscribe from a session event.

## Events

| Event       | Payload type          | Description                           |
| ----------- | --------------------- | ------------------------------------- |
| `"started"` | `{ agentId: string }` | Agent successfully joined the channel |
| `"stopped"` | `{ agentId: string }` | Agent left the channel                |
| `"error"`   | `Error`               | An unrecoverable error occurred       |

Event type: `AgentSessionEvent = "started" | "stopped" | "error"`

Handler type: `AgentSessionEventHandler<T> = (data: T) => void`

## Properties

| Property | Type                                                                      | Description                                                                |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `status` | `"idle" \| "starting" \| "running" \| "stopping" \| "stopped" \| "error"` | Current session state                                                      |
| `id`     | `string \| null`                                                          | Agent ID (populated after `start()` resolves)                              |
| `agent`  | `Agent`                                                                   | The agent configuration this session was created from                      |
| `appId`  | `string`                                                                  | The App ID for this session                                                |
| `raw`    | `AgentsClient`                                                            | Direct access to the Fern-generated `AgentsClient` for advanced operations |

### Using `session.raw`

Access the generated REST client to call endpoints not yet wrapped:

<!-- snippet: fragment -->

```typescript
await session.raw.someNewEndpoint({
  appid: session.appId,
  agentId: session.id!,
});
```

You must pass `appid` and `agentId` manually when using raw methods.

## Presets and BYOK

Prefer configuring vendors on the `Agent` builder. When you omit credentials for supported Agora-managed global models, AgentKit sends the matching Agora-managed configuration at session start. CN MiniMax TTS is not Agora-managed and always requires `key`.

`preset` is an advanced session option for project-specific settings, not for selecting Agora-managed models. Most applications should use the builder instead.

- Omit vendor credentials on the builder for supported Agora-managed global models.
- Provide vendor API keys when you want BYOK.
- Pass `preset` on `agent.createSession(...)` only when you need to access specific project-specific settings.

Supported Agora-managed models:

- Deepgram STT: `nova-2`, `nova-3`
- OpenAI LLM: `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, `gpt-5-mini`
- OpenAI TTS: `tts-1`
- MiniMax TTS: `speech-2.6-turbo`, `speech-2.8-turbo`
