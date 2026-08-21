---
sidebar_position: 2
title: Agent
description: Full API reference for the Agent builder class.
---

# Agent Reference

<!-- snippet: fragment -->
```typescript
import { Agent } from 'agora-agents';
```

If you want to bind routing credentials once, use `AgoraClient` + `Agent`:

<!-- snippet: fragment -->
```typescript
const client = new AgoraClient({ area: Area.US, appId: '...', appCertificate: '...' });
const agent = new Agent({ client });
```

Configure vendors with `new DeepgramSTT()`, `new OpenAI()`, and similar classes on `.withStt()`, `.withLlm()`, and `.withTts()`.

## Constructor

<!-- snippet: fragment -->
```typescript
new Agent<TTSSampleRate extends number = number, TArea extends AgoraArea = AgoraArea>(
  options: AgentOptions<TArea>,
)
```

`client` is **required** in `AgentOptions`. Pass it when constructing the agent: `new Agent({ client, ... })`.

### AgentOptions

| Option | Type | Default | Description |
|---|---|---|---|
| `client` | `AgoraClient<TArea>` | — | **Required.** Agora client used for `createSession()` and session credentials |
| `pipelineId` | `string` | `undefined` | Published AI Studio pipeline ID used as the base configuration |
| `instructions` | `string` | `undefined` | Deprecated. Use LLM vendor `systemMessages` instead. |
| `greeting` | `string` | `undefined` | Deprecated. Use LLM/MLLM vendor `greetingMessage` instead. |
| `failureMessage` | `string` | `undefined` | Deprecated. Use LLM/MLLM vendor `failureMessage` instead. |
| `maxHistory` | `number` | `undefined` | Deprecated. Use LLM vendor `maxHistory` instead. |
| `turnDetection` | `TurnDetectionConfig` | `undefined` | Interaction language and voice activity detection settings |
| `interruption` | `InterruptionConfig` | `undefined` | Unified interruption control settings |
| `sal` | `SalConfig` | `undefined` | Selective Attention Locking configuration |
| `avatar` | `AvatarConfig` | `undefined` | Avatar configuration |
| `advancedFeatures` | `AdvancedFeatures` | `undefined` | Enable MLLM mode, AI-VAD, etc. |
| `parameters` | `SessionParamsInput` | `undefined` | Session parameters (silence config, farewell config, data channel, etc.) |
| `geofence` | `GeofenceConfig` | `undefined` | Regional access restriction |
| `labels` | `Labels` | `undefined` | Custom key-value labels (returned in callbacks) |
| `rtc` | `RtcConfig` | `undefined` | RTC media encryption |
| `fillerWords` | `FillerWordsConfig` | `undefined` | Filler words while waiting for LLM |
| `greetingConfigs` | `LlmGreetingConfigs` | `undefined` | Deprecated. Configure this on the LLM vendor instead. |

`LlmGreetingConfigs` matches the generated wire shape and includes fields such as `audio_download_timeout_ms`, `audio_pcm_sample_rate`, and `uninterruptible_asr_policy`. New LLM helper options also support `greetingAudioUrl` for a prerecorded greeting clip.

The Agent-level `instructions`, `greeting`, `failureMessage`, `maxHistory`, and `greetingConfigs` fields are compatibility shims. New code should configure those values on the LLM or MLLM vendor because that matches the core request schema.

## Builder methods

All methods return a **new** `Agent` instance. The original is never modified. Unless noted, return type is `Agent<TTSSampleRate, TArea>`.

Vendor parameter types (`LlmVendor`, `TtsVendor`, `SttVendor`, `AvatarVendor`) are exported from `agora-agents`. Each accepts any exported vendor **class instance** in the matching group (global and CN vendors).

### `withLlm(vendor: LlmVendor): Agent<TTSSampleRate, TArea>`

Set the LLM vendor. Accepts global classes (`OpenAI`, `AzureOpenAI`, `Anthropic`, `Gemini`, …) and CN classes (`AliyunLLM`, `TencentLLM`, `CustomLLM`, …). For prerecorded greetings, configure `greetingAudioUrl` on the chosen LLM helper.

### `withTts<SR extends number>(vendor: TtsVendor<SR>): Agent<SR, TArea>`

Set the TTS vendor. The sample rate type `SR` is captured and tracked for avatar compatibility.

### `withStt(vendor: SttVendor): Agent<TTSSampleRate, TArea>`

Set the STT vendor. Accepts global classes (`DeepgramSTT`, `SpeechmaticsSTT`, …) and CN classes (`FengmingSTT`, `TencentSTT`, `MicrosoftCNSTT`, `XfyunSTT`, …).

If you omit `withStt()`, AgentKit still sends an ASR config automatically based on `client.area`: `fengming` for `Area.CN`, otherwise `ares`.

### `withMllm(vendor: GlobalMllmVendor | CNMllmVendor): Agent<TTSSampleRate, TArea>`

Set the MLLM vendor for multimodal mode. Pass a global vendor (`OpenAIRealtime`, `AzureOpenAIRealtime`, `GeminiLive`, `VertexAI`, `XaiGrok`) or the Chinese mainland vendor `QwenOmni`. Calling `withMllm()` automatically sets `mllm.enable = true`. MLLM mode does not require `withTts()` / `withLlm()` / `withStt()`.

> Avatars are only supported with the cascading ASR + LLM + TTS pipeline. Combining `withMllm()` with `withAvatar()` throws at `toProperties()` and `session.start()`.

### `withAvatar<RequiredSR extends number>(this: Agent<RequiredSR, TArea>, vendor: AvatarVendor<RequiredSR>): Agent<RequiredSR, TArea>`

Set the avatar vendor. The `this` constraint enforces that the Agent's TTS sample rate matches the avatar's required rate at compile time. Accepts `LiveAvatarAvatar`, `HeyGenAvatar`, `AkoolAvatar`, `AnamAvatar`, `GenericAvatar`, `SensetimeAvatar`, `SpatiusAvatar`, and other exported avatar classes. Requires the cascading ASR + LLM + TTS pipeline; avatars are not supported with MLLM.

### `withTurnDetection(config: TurnDetectionConfig): Agent<TTSSampleRate, TArea>`

Configure cascading-flow turn detection. Use `language` for the Agora interaction language, `config.start_of_speech` and `config.end_of_speech` for SOS/EOS detection, `withInterruption()` for interruption behavior, and MLLM vendor `turnDetection` for MLLM turn detection.

### `withInterruption(config: InterruptionConfig): Agent<TTSSampleRate, TArea>`

Configure unified interruption behavior using the top-level `interruption` object. Use this for `start_of_speech` and `keywords` interruption modes.

### `withInstructions(instructions: string): Agent<TTSSampleRate, TArea>`

Deprecated. Configure `systemMessages` on the LLM vendor instead.

### `withGreeting(greeting: string): Agent<TTSSampleRate, TArea>`

Deprecated. Configure `greetingMessage` on the LLM or MLLM vendor instead.

### `withGreetingConfigs(configs: LlmGreetingConfigs): Agent<TTSSampleRate, TArea>`

Deprecated. Configure greeting playback on the LLM vendor instead.

### `withSal(config: SalConfig): Agent<TTSSampleRate, TArea>`

Set SAL (Selective Attention Locking) configuration.

### `withAdvancedFeatures(features: AdvancedFeatures): Agent<TTSSampleRate, TArea>`

Set advanced features (e.g. `enable_rtm`).

### `withTools(enabled = true): Agent<TTSSampleRate, TArea>`

Enable or disable MCP tool invocation by setting `advanced_features.enable_tools`.

### `withParameters(parameters: SessionParamsInput): Agent<TTSSampleRate, TArea>`

Set session parameters (silence config, farewell config, data channel, etc.).

### `withAudioScenario(audioScenario: ParametersAudioScenario): Agent<TTSSampleRate, TArea>`

Set `parameters.audio_scenario`. Use the exported `AudioScenario` constants for discoverability:

<!-- snippet: fragment -->
```typescript
agent.withAudioScenario(AudioScenario.Aiserver)
```

### `withFailureMessage(message: string): Agent<TTSSampleRate, TArea>`

Deprecated. Configure `failureMessage` on the LLM or MLLM vendor instead.

### `withMaxHistory(maxHistory: number): Agent<TTSSampleRate, TArea>`

Deprecated. Configure `maxHistory` on the LLM vendor instead.

### `withGeofence(geofence: GeofenceConfig): Agent<TTSSampleRate, TArea>`

Set geofence configuration (restricts backend server regions).

### `withLabels(labels: Labels): Agent<TTSSampleRate, TArea>`

Set custom labels (key-value pairs returned in notification callbacks).

### `withRtc(rtc: RtcConfig): Agent<TTSSampleRate, TArea>`

Set RTC configuration.

### `withFillerWords(fillerWords: FillerWordsConfig): Agent<TTSSampleRate, TArea>`

Set filler words configuration (played while waiting for LLM response).

## Getter properties

| Property | Type | Description |
|---|---|---|
| `pipelineId` | `string \| undefined` | Published AI Studio pipeline ID used as the agent's base configuration |
| `llm` | `LlmConfig \| undefined` | LLM config (set via `withLlm`) |
| `tts` | `TtsConfig \| undefined` | TTS config (set via `withTts`) |
| `stt` | `SttConfig \| undefined` | STT config (set via `withStt`) |
| `mllm` | `MllmConfig \| undefined` | MLLM config (set via `withMllm`) |
| `avatar` | `AvatarConfig \| undefined` | Avatar config (set via `withAvatar`) |
| `turnDetection` | `TurnDetectionConfig \| undefined` | Interaction language and turn detection config |
| `interruption` | `InterruptionConfig \| undefined` | Interruption config |
| `instructions` | `string \| undefined` | System prompt |
| `greeting` | `string \| undefined` | Greeting message |
| `failureMessage` | `string \| undefined` | Message spoken when LLM fails |
| `maxHistory` | `number \| undefined` | Max conversation history length for the standard LLM pipeline |
| `sal` | `SalConfig \| undefined` | SAL configuration |
| `advancedFeatures` | `AdvancedFeatures \| undefined` | Advanced features |
| `parameters` | `SessionParamsInput \| undefined` | Session parameters |
| `geofence` | `GeofenceConfig \| undefined` | Geofence configuration |
| `labels` | `Labels \| undefined` | Custom labels |
| `rtc` | `RtcConfig \| undefined` | RTC configuration |
| `fillerWords` | `FillerWordsConfig \| undefined` | Filler words configuration |
| `greetingConfigs` | `LlmGreetingConfigs \| undefined` | Greeting playback configuration compatibility shim |
| `config` | `AgentOptions<TArea>` | Full read-only configuration snapshot |

## `createSession(options): AgentSession`

Creates a new `AgentSession` bound to the client configured on the `Agent`.

`client` must be passed when constructing the agent: `new Agent({ client, ... })`.

<!-- snippet: fragment -->
```typescript
createSession(
  options: SessionOptions,
): AgentSession
```

```typescript
const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});
```

`name` is optional; omit it to auto-generate `agent-{timestamp}`. Set it on `createSession()`, not on `Agent`.

### SessionOptions

| Option | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | No | Unique agent instance name sent to the Agora API (auto-generated as `agent-{timestamp}` if omitted) |
| `channel` | `string` | Yes | Channel name to join |
| `agentUid` | `string` | Yes | The agent's RTC UID |
| `remoteUids` | `string[]` | Yes | Remote user UIDs to subscribe to |
| `token` | `string` | No | Pre-built RTC+RTM token (omit to auto-generate) |
| `expiresIn` | `number` | No | Token lifetime in seconds (default: `86400` = 24 h, Agora max). Only applies when the token is auto-generated. Use `ExpiresIn.hours()` or `ExpiresIn.minutes()` for clarity. Valid range: 1–86400. |
| `idleTimeout` | `number` | No | Seconds before auto-exit if no audio (0 = disabled) |
| `enableStringUid` | `boolean` | No | Use string UIDs instead of numeric |
| `preset` | `PresetInput` | No | Advanced project-specific presets. Use only when Agora provides a specific preset ID for your project. |
| `pipelineId` | `string` | No | Published AI Studio pipeline ID to use as this session's base configuration. Overrides `agent.pipelineId`. |
| `debug` | `boolean` | No | Log the API endpoint, headers, and request body to the console. Credentials (vendor API keys, RTC token, App ID) are replaced with `[REDACTED]` first — see [Preview Endpoint](../guides/preview-endpoint.md#debug-output) |
| `warn` | `(message: string) => void` | No | Custom warning logger; pass a no-op to silence warnings |

`PresetInput` is `AgentPreset | readonly AgentPreset[] | string`.

`preset` is session-scoped because the Agora start/join API applies project-specific settings per session, not per reusable `Agent` definition. Most applications should leave it unset.

`pipelineId` can be set on `new Agent({ pipelineId })` as a reusable AI Studio base configuration, or on `agent.createSession(...)` for a session-specific override. AgentKit sends it as the top-level `/join` field `pipeline_id`; it is not included inside `properties`. Explicit Agent config such as `.withLlm()`, `.withTts()`, `.withStt()`, `.withMllm()`, `advancedFeatures`, and other builder options may send fields in `properties` that override the saved pipeline settings.

When you omit credentials for supported Agora-managed global models, AgentKit sends the matching Agora-managed configuration automatically:

- Deepgram STT: `nova-2`, `nova-3`
- OpenAI LLM: `gpt-4o-mini`, `gpt-4.1-mini`, `gpt-5-nano`, `gpt-5-mini`
- OpenAI TTS: `tts-1`
- MiniMax TTS: `speech-2.6-turbo`, `speech-2.8-turbo`

If you provide your own vendor API key for those same models, AgentKit keeps the request in BYOK mode.

## `toProperties(opts): StartAgentsRequest.Properties`

Low-level method to convert the agent config to the Fern request format. Used internally by `AgentSession.start()`. You typically don't need to call this directly unless building custom request bodies.

`opts` requires `channel`, `agentUid`, and `remoteUids`, plus either a pre-built `token` or `appId` + `appCertificate` for automatic token generation. Optional fields include `idleTimeout`, `enableStringUid`, `expiresIn`, `skipVendorValidationCategories`, and `allowMissingVendorCategories` (`ReadonlySet<PresetCategory>`).

In the cascading pipeline, `toProperties()` also fills in a default `asr` block when no STT vendor has been configured. The default wire vendor is `fengming` for `Area.CN` clients and `ares` for all other areas.

## Type aliases

Public aliases over Fern-generated types include `LlmConfig`, `SttConfig`, `AsrConfig` (= `SttConfig`), `MllmConfig`, `AvatarConfig`, session/conversation types, and think types (`ThinkOnListeningAction`, etc.).

Builder vendor unions: `LlmVendor`, `TtsVendor<SR>`, `SttVendor`, `AvatarVendor<SR>` (class instances accepted by `.withLlm()` / `.withTts()` / `.withStt()` / `.withAvatar()`).

Wire vendor name aliases: `AsrVendorName` (ASR vendor string), `AvatarWireVendor` (avatar vendor string on `AvatarConfig`).

Think value constants: `ThinkOnListeningActionInject`, `ThinkOnListeningActionInterrupt`, `ThinkOnListeningActionIgnore`, `ThinkOnThinkingActionInterrupt`, `ThinkOnThinkingActionIgnore`, `ThinkOnSpeakingActionInterrupt`, `ThinkOnSpeakingActionIgnore`.
