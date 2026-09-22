---
sidebar_position: 2
title: Agent
description: The Agent builder — configure an AI agent with LLM, TTS, STT, and more.
---

# Agent

`Agent` is an immutable configuration object. Every builder method returns a **new** `Agent` instance — the original is never modified. This makes agents safe to reuse across multiple sessions.

An `AgoraClient` is **required**: pass `client` to `new Agent({ client, ... })` before calling `createSession()`.

The class has two type parameters: `Agent<TTSSampleRate, TArea>`. `TTSSampleRate` tracks TTS sample rate for avatar compatibility; `TArea` is inferred from the bound `AgoraClient` area (`Area.US`, `Area.CN`, etc.).

## Constructor options

<!-- snippet: executable -->
```typescript
import { AgoraClient, Area, Agent, OpenAI } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client }).withLlm(
  new OpenAI({
    apiKey: 'your-openai-key',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    systemMessages: [{ role: 'system', content: 'You are a helpful voice assistant.' }],
    greetingMessage: 'Hello! How can I help?',
    maxHistory: 20,
  }),
);
```

| Option | Type | Description |
|---|---|---|
| `client` | `AgoraClient<TArea>` | **Required.** Client used for `createSession()` |
| `pipelineId` | `string` | Published AI Studio pipeline ID used as the base configuration |
| `instructions` | `string` | Deprecated. Use LLM vendor `systemMessages` instead. |
| `greeting` | `string` | Deprecated. Use LLM/MLLM vendor `greetingMessage` instead. |
| `failureMessage` | `string` | Deprecated. Use LLM/MLLM vendor `failureMessage` instead. |
| `maxHistory` | `number` | Deprecated. Use LLM vendor `maxHistory` instead. |
| `turnDetection` | `TurnDetectionConfig` | Interaction language and voice activity detection settings |
| `interruption` | `InterruptionConfig` | Unified interruption control settings |
| `sal` | `SalConfig` | Selective Attention Locking configuration |
| `avatar` | `AvatarConfig` | Avatar configuration (prefer `withAvatar()` for type safety) |
| `advancedFeatures` | `AdvancedFeatures` | Enable MLLM mode, AI-VAD, etc. |
| `parameters` | `SessionParamsInput` | Session parameters (silence config, farewell config, data channel, etc.) |
| `geofence` | `GeofenceConfig` | Regional access restriction |
| `labels` | `Labels` | Custom key-value labels (returned in callbacks) |
| `rtc` | `RtcConfig` | RTC media encryption |
| `fillerWords` | `FillerWordsConfig` | Filler words while waiting for LLM |
| `greetingConfigs` | `LlmGreetingConfigs` | Deprecated. Configure this on the LLM vendor instead. |

## Builder methods

Each method returns a new `Agent` instance with the updated configuration. Vendor parameters use the exported `LlmVendor`, `TtsVendor`, `SttVendor`, and `AvatarVendor` types (any matching exported vendor class instance).

| Method | Signature | Description |
|---|---|---|
| `withLlm` | `withLlm(vendor: LlmVendor): Agent<TTSSampleRate, TArea>` | Set the LLM vendor (global or CN) |
| `withTts` | `withTts<SR>(vendor: TtsVendor<SR>): Agent<SR, TArea>` | Set the TTS vendor (tracks sample rate type) |
| `withStt` | `withStt(vendor: SttVendor): Agent<TTSSampleRate, TArea>` | Set the STT vendor (global or CN) |
| `withMllm` | `withMllm(vendor: GlobalMllmVendor \| CNMllmVendor): Agent<TTSSampleRate, TArea>` | Set the global or Chinese mainland MLLM vendor. Not compatible with `withAvatar()`. |
| `withAvatar` | `withAvatar<SR>(this: Agent<SR, TArea>, vendor: AvatarVendor<SR>): Agent<SR, TArea>` | Set the avatar vendor (enforces TTS sample rate match). Requires the cascading pipeline; not supported with `withMllm()`. |
| `withTurnDetection` | `withTurnDetection(config: TurnDetectionConfig): Agent<TTSSampleRate, TArea>` | Configure `turn_detection.language` and cascading-flow SOS/EOS detection |
| `withInterruption` | `withInterruption(config: InterruptionConfig): Agent<TTSSampleRate, TArea>` | Configure unified interruption behavior |
| `withInstructions` | `withInstructions(text: string): Agent<TTSSampleRate, TArea>` | Deprecated. Use LLM vendor `systemMessages` instead. |
| `withGreeting` | `withGreeting(text: string): Agent<TTSSampleRate, TArea>` | Deprecated. Use LLM/MLLM vendor `greetingMessage` instead. |
| `withGreetingConfigs` | `withGreetingConfigs(configs: LlmGreetingConfigs): Agent<TTSSampleRate, TArea>` | Deprecated. Configure greeting playback on the LLM vendor instead. |
| `withSal` | `withSal(config: SalConfig): Agent<TTSSampleRate, TArea>` | Set SAL configuration |
| `withAdvancedFeatures` | `withAdvancedFeatures(features: AdvancedFeatures): Agent<TTSSampleRate, TArea>` | Set advanced features |
| `withTools` | `withTools(enabled?: boolean): Agent<TTSSampleRate, TArea>` | Enable or disable MCP tool invocation |
| `withParameters` | `withParameters(parameters: SessionParamsInput): Agent<TTSSampleRate, TArea>` | Set session parameters |
| `withAudioScenario` | `withAudioScenario(audioScenario: ParametersAudioScenario): Agent<TTSSampleRate, TArea>` | Set `parameters.audio_scenario` |
| `withSpeakBatch` | `withSpeakBatch(batch: boolean): Agent<TTSSampleRate, TArea>` | Set `parameters.speak.batch`; `false` skips sentence segmentation for speak requests |
| `withFailureMessage` | `withFailureMessage(message: string): Agent<TTSSampleRate, TArea>` | Deprecated. Use LLM/MLLM vendor `failureMessage` instead. |
| `withMaxHistory` | `withMaxHistory(maxHistory: number): Agent<TTSSampleRate, TArea>` | Deprecated. Use LLM vendor `maxHistory` instead. |
| `withGeofence` | `withGeofence(geofence: GeofenceConfig): Agent<TTSSampleRate, TArea>` | Set geofence configuration |
| `withLabels` | `withLabels(labels: Labels): Agent<TTSSampleRate, TArea>` | Set custom labels |
| `withRtc` | `withRtc(rtc: RtcConfig): Agent<TTSSampleRate, TArea>` | Set RTC configuration |
| `withFillerWords` | `withFillerWords(fillerWords: FillerWordsConfig): Agent<TTSSampleRate, TArea>` | Set filler words configuration |

## Creating a session

Call `createSession()` to bind the agent to a channel using the client configured on the agent:

<!-- snippet: fragment -->
```typescript
const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
const agent = new Agent({ client });

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
  idleTimeout: 120,
});
```

`name` identifies this agent instance in the Agora API. Set it on `createSession()`, not on `Agent`.

### SessionOptions

| Option | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | No | Unique agent instance name sent to the Agora API (auto-generated as `agent-{timestamp}` if omitted) |
| `channel` | `string` | Yes | Channel name to join |
| `agentUid` | `string` | Yes | The agent's RTC UID |
| `remoteUids` | `string[]` | Yes | Remote user UIDs to subscribe to |
| `token` | `string` | No | Pre-built RTC+RTM token (omit to auto-generate) |
| `expiresIn` | `number` | No | Token lifetime in seconds when auto-generating (default `86400`) |
| `idleTimeout` | `number` | No | Seconds before auto-exit if no audio (0 = disabled) |
| `enableStringUid` | `boolean` | No | Use string UIDs instead of numeric |
| `preset` | `PresetInput` | No | Advanced project-specific presets |
| `pipelineId` | `string` | No | Session-specific AI Studio pipeline override |
| `debug` | `boolean` | No | Log API requests to console |
| `warn` | `(message: string) => void` | No | Custom warning logger |

## Immutable reuse

Because every method returns a new instance, you can create a base agent and derive variations:

<!-- snippet: executable -->
```typescript
import { AgoraClient, Area, Agent, OpenAI, ElevenLabsTTS, DeepgramSTT } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const base = new Agent({ client })
  .withLlm(new OpenAI({
    apiKey: 'your-openai-key',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    systemMessages: [{ role: 'system', content: 'You are helpful.' }],
  }))
  .withTts(new ElevenLabsTTS({ key: 'your-elevenlabs-key', modelId: 'eleven_flash_v2_5', voiceId: 'your-voice-id', baseUrl: 'wss://api.elevenlabs.io/v1', sampleRate: 24000 }))
  .withStt(new DeepgramSTT({ apiKey: 'your-deepgram-key', model: 'nova-2' }));

// Two sessions from the same agent config — safe, no shared mutable state

const sessionA = base.createSession({ name: 'room-a', channel: 'room-a', agentUid: '1', remoteUids: ['100'] });
const sessionB = base.createSession({ name: 'room-b', channel: 'room-b', agentUid: '1', remoteUids: ['200'] });
```

See [Agent Reference](../reference/agent.md) for full TypeScript signatures.
