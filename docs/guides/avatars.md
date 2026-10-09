---
sidebar_position: 3
title: Avatar Integration
description: Add a digital avatar to your Conversational AI agent.
---

# Avatar Integration

Avatars attach a visual representation to the agent's audio output.

| Avatar | Provider | Required TTS sample rate |
|---|---|---|
| `LiveAvatarAvatar` | LiveAvatar (formerly HeyGen) | **24,000 Hz** |
| `HeyGenAvatar` | Deprecated HeyGen alias | **24,000 Hz** |
| `AkoolAvatar` | Akool | **16,000 Hz** |
| `AnamAvatar` | Anam | Consult provider docs |
| `GenericAvatar` | Custom avatar provider | Consult provider docs |
| `Tavus` | Tavus via generic avatar | Consult provider docs |
| `Protoface` | Protoface via generic avatar | Consult provider docs |
| `LemonSlice` | LemonSlice via generic avatar | Consult provider docs |
| `SensetimeAvatar` | SenseTime (CN) | Consult provider docs |
| `SpatiusAvatar` | Spatius (CN) | Consult provider docs |

## Avatars require the cascading pipeline

Avatars currently only work with the cascading **ASR + LLM + TTS** pipeline. They are **not** supported with MLLM (`OpenAIRealtime`, `AzureOpenAIRealtime`, `GeminiLive`, `VertexAI`, `XaiGrok`, `QwenOmni`). AgentKit rejects the combination at `Agent.toProperties()` and at `AgentSession.start()` so you see a clear error before the request reaches the backend:

```
Avatars are only supported with the cascading ASR + LLM + TTS pipeline.
Remove the avatar configuration when using MLLM, or switch to a cascading session.
```

If you need an MLLM session, omit the avatar; if you need an avatar, use the cascading pipeline.

## Avatar tokens

The agent and the avatar publish with separate RTC identities:

| Identity | Field | UID |
|---|---|---|
| Agent audio pipeline | `properties.token` | `agent_rtc_uid` |
| Avatar video publisher | `avatar.params.agora_token` | `avatar.params.agora_uid` |

AgentKit auto-fills `agora_token` for avatar vendors that publish a separate RTC video identity:

- `LiveAvatarAvatar` (and the deprecated `HeyGenAvatar` alias)
- `GenericAvatar` and its `Tavus`, `Protoface`, and `LemonSlice` wrappers
- `SensetimeAvatar` (CN)
- `SpatiusAvatar` (CN)

For `AkoolAvatar` and `AnamAvatar`, the avatar provider handles publishing on its own and AgentKit never injects an `agora_token`. Use `isAvatarTokenManaged(avatar)` to check whether a config falls into the managed group.

When `agoraToken` is omitted on a managed vendor, AgentKit generates it at `session.start()` from the session App ID, channel, app certificate, and avatar `agoraUid`. The generated token uses the same ConvoAI token format as the agent token, but is scoped to the avatar `agoraUid`. AgentKit never overwrites a user-provided avatar token.

Keep `agoraUid` unique from `agentUid`. AgentKit warns when they match (managed vendors only).

## The sample-rate constraint

Avatars require the TTS audio to be at a specific sample rate. If you use the wrong rate, the avatar will not render correctly. The SDK enforces this in two ways:

### 1. Compile-time enforcement (TypeScript phantom types)

The `Agent` class tracks the TTS sample rate as a type parameter. When you call `.withAvatar()`, TypeScript checks that the TTS sample rate type matches the avatar's required rate. If they don't match, you get a compile error:

```typescript
import { AgoraClient, Area, Agent, ElevenLabsTTS, HeyGenAvatar } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

// This works — ElevenLabs at 24kHz matches HeyGen's requirement
const good = new Agent({ client })
  .withTts(new ElevenLabsTTS({ key: 'your-key', modelId: 'eleven_flash_v2_5', voiceId: 'your-voice-id', baseUrl: 'wss://api.elevenlabs.io/v1', sampleRate: 24000 }))
  .withAvatar(new HeyGenAvatar({ apiKey: 'your-heygen-key', quality: 'high', agoraUid: '12345' }));

// This fails at compile time — 16kHz does not match HeyGen's required 24kHz
const bad = new Agent({ client })
  .withTts(new ElevenLabsTTS({ key: 'your-key', modelId: 'eleven_flash_v2_5', voiceId: 'your-voice-id', baseUrl: 'wss://api.elevenlabs.io/v1', sampleRate: 16000 }))
  .withAvatar(new HeyGenAvatar({ apiKey: 'your-heygen-key', quality: 'high', agoraUid: '12345' }));
  //         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // TypeScript error: 'this' context of type 'Agent<16000>' is not assignable to
  // method's 'this' of type 'Agent<24000>'
```

### 2. Runtime enforcement

If phantom types are bypassed (for example, when config comes from external data), `session.start()` validates the TTS sample rate against the avatar vendor before sending the API request:

```
Error: HeyGen avatars ONLY support 24,000 Hz sample rate. Your TTS is configured
with 16000 Hz. Please update your TTS configuration to use 24kHz sample rate.
See: https://docs.agora.io/en/conversational-ai/models/avatar/heygen
```

For Akool:

```
Error: Akool avatars ONLY support 16,000 Hz sample rate. Your TTS is configured
with 24000 Hz. Please update your TTS configuration to use 16kHz sample rate.
See: https://docs.agora.io/en/conversational-ai/models/avatar/akool
```

## Example: LiveAvatar with auto-generated avatar token

```typescript
import {
  AgoraClient,
  Area,
  Agent,
  OpenAI,
  ElevenLabsTTS,
  DeepgramSTT,
  LiveAvatarAvatar,
} from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withLlm(new OpenAI({
    apiKey: 'your-openai-key',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    systemMessages: [{ role: 'system', content: 'You are a friendly avatar assistant.' }],
  }))
  .withTts(new ElevenLabsTTS({
    key: 'your-elevenlabs-key',
    modelId: 'eleven_flash_v2_5',
    voiceId: 'your-voice-id',
    baseUrl: 'wss://api.elevenlabs.io/v1',
    sampleRate: 24000,  // Required for LiveAvatar
  }))
  .withStt(new DeepgramSTT({ apiKey: 'your-deepgram-key', model: 'nova-2' }))
  .withAvatar(new LiveAvatarAvatar({
    apiKey: 'your-liveavatar-key',
    quality: 'high',
    agoraUid: '200', // unique avatar video UID
    avatarId: 'your-avatar-id',
    // agoraToken omitted: AgentKit generates it at session.start()
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1', // distinct from avatar agoraUid
  remoteUids: ['100'],
});

await session.start();
```

## Example: Generic avatar

```typescript
import { AgoraClient, Area, Agent, GenericAvatar, OpenAI, OpenAITTS, AresSTT } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withLlm(new OpenAI({ apiKey: 'your-openai-key', url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' }))
  .withTts(new OpenAITTS({ apiKey: 'your-openai-tts-key', model: 'tts-1', baseUrl: 'https://api.openai.com/v1', voice: 'alloy' }))
  .withStt(new AresSTT())
  .withAvatar(new GenericAvatar({
    apiKey: 'your-avatar-provider-key',
    apiBaseUrl: 'https://avatar-provider.example.com',
    avatarId: 'avatar-id',
    agoraUid: '200',
    // agoraAppId, agoraChannel, and agoraToken are filled from the session.
  }));
```

## Tavus, Protoface, and LemonSlice providers

These branded wrappers reuse `GenericAvatar`, serialize with `vendor: "generic"`, and share its session field and token auto-fill behavior. `apiKey` and `agoraUid` remain required. Tavus and Protoface also require `avatarId`. Explicit `apiBaseUrl` overrides remain supported; `GenericAvatar` itself still requires an endpoint.

| Provider | Default `apiBaseUrl` | Default `avatarId` |
|---|---|---|
| `Tavus` | `https://tavusapi.com/v2/conversations/agora` | Required |
| `Protoface` | `https://api.protoface.com/v1/agora` | Required |
| `LemonSlice` | `https://lemonslice.com/api/liveai/agora` | `lemonslice` |

LemonSlice recommends the fixed `avatarId: 'lemonslice'`; explicit overrides are retained for backwards compatibility. Its `LemonSliceOptions` accepts optional `agentId`, `agentImageUrl`, `agentImageBase64`, and `aspectRatio`. These serialize directly as `agent_id`, `agent_image_url`, `agent_image_base64`, and `aspect_ratio` inside `avatar.params`.

Supply exactly one nonempty string selector among `agentId`, `agentImageUrl`, and `agentImageBase64`, or their snake_case keys in `additionalParams`. Validation uses the final merged parameters; explicitly supplied typed fields override matching additional parameters. Empty, whitespace-only, and nonstring selectors are rejected, including malformed alternative selectors. Inputs are not mutated. `aspectRatio` (or `additionalParams.aspect_ratio`) accepts only `2x3`, `9x16`, or `1x1`. When unset it is omitted, allowing the provider default `2x3`.

```typescript
import { Tavus, Protoface, LemonSlice } from 'agora-agents';

const tavus = new Tavus({ apiKey: 'tavus-key', avatarId: 'avatar-id', agoraUid: '200' });
const protoface = new Protoface({ apiKey: 'protoface-key', avatarId: 'avatar-id', agoraUid: '200' });
const lemonSlice = new LemonSlice({ apiKey: 'lemonslice-key', agoraUid: '200', agentId: 'agent-id', aspectRatio: '9x16' });
// Pass the avatar for your provider to agent.withAvatar().
```

## Example: Akool avatar with ElevenLabs at 16kHz

```typescript
import {
  AgoraClient,
  Area,
  Agent,
  OpenAI,
  ElevenLabsTTS,
  DeepgramSTT,
  AkoolAvatar,
} from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,

  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withLlm(new OpenAI({
    apiKey: 'your-openai-key',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    systemMessages: [{ role: 'system', content: 'You are a friendly avatar assistant.' }],
  }))
  .withTts(new ElevenLabsTTS({
    key: 'your-elevenlabs-key',
    modelId: 'eleven_flash_v2_5',
    voiceId: 'your-voice-id',
    baseUrl: 'wss://api.elevenlabs.io/v1',
    sampleRate: 16000,  // Required for Akool
  }))
  .withStt(new DeepgramSTT({ apiKey: 'your-deepgram-key', model: 'nova-2' }))
  .withAvatar(new AkoolAvatar({
    apiKey: 'your-akool-key',
    avatarId: 'your-avatar-id',
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});

await session.start();
```

## HeyGenAvatar constructor options

`HeyGenAvatar` is deprecated. Use `LiveAvatarAvatar` for new integrations.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | HeyGen API key |
| `quality` | `"low" \| "medium" \| "high"` | Yes | Video quality (360p / 480p / 720p) |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream (must be unique in the channel) |
| `agoraToken` | `string` | No | Avatar token override. Omit to auto-generate at `session.start()` |
| `avatarId` | `string` | No | HeyGen avatar ID |
| `disableIdleTimeout` | `boolean` | No | Disable idle timeout (default: false) |
| `activityIdleTimeout` | `number` | No | Idle timeout in seconds (default: 120) |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

## LiveAvatarAvatar constructor options

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | LiveAvatar API key |
| `quality` | `"low" \| "medium" \| "high"` | Yes | Video quality |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream (must be unique in the channel) |
| `agoraToken` | `string` | No | Avatar token override. Omit to auto-generate at `session.start()` |
| `avatarId` | `string` | No | Avatar ID |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

## AkoolAvatar constructor options

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Akool API key |
| `avatarId` | `string` | No | Akool avatar ID |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

## AnamAvatar constructor options

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Anam API key |
| `avatarId` | `string` | No | Anam avatar ID |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

## GenericAvatar constructor options

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Custom avatar provider API key |
| `apiBaseUrl` | `string` | Yes | Avatar provider API base URL |
| `avatarId` | `string` | Yes | Avatar ID |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream |
| `agoraAppId` | `string` | No | Omit to use the session App ID |
| `agoraChannel` | `string` | No | Omit to use the session channel |
| `agoraToken` | `string` | No | Avatar token override. Omit to auto-generate at `session.start()` |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |
