---
sidebar_position: 4
title: Vendor Reference
description: Constructor options for all LLM, TTS, STT, MLLM, and Avatar vendor classes.
---

# Vendor Reference

All vendor classes are imported from `agora-agents`.

## Vendor classes

Import any supported vendor class and pass it to `.withStt()`, `.withLlm()`, and `.withTts()`. `client.area` does not restrict explicit provider choice, and it also determines the default ASR vendor when `.withStt()` is omitted:

- `Area.CN` defaults to `FengmingSTT`
- all other areas default to `AresSTT`

| Global-oriented classes | CN-oriented classes |
|---|---|
| `DeepgramSTT`, `OpenAI`, `MiniMaxTTS`, `ElevenLabsTTS`, `GenericTTS`, `XAiSTT`, `XAiTTS`, … | `FengmingSTT`, `AliyunLLM`, `MiniMaxCNTTS`, `TencentTTS`, `GenericTTS`, `SensetimeAvatar`, `SpatiusAvatar`, … |

`GenericTTS` is shared by the Global and CN AgentKit surfaces and is included in both `GlobalTtsVendor` and `CNTtsVendor`.

Global example:

```typescript
import { AgoraClient, Area, DeepgramSTT, MiniMaxTTS, OpenAI } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});

const agent = new Agent({ client })
  .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en-US' }))
  .withLlm(new OpenAI({ model: 'gpt-4o-mini' }))
  .withTts(new MiniMaxTTS({
    model: 'speech_2_6_turbo',
    voiceId: 'English_captivating_female1',
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});
```

CN example:

```typescript
import { AgoraClient, Area, AliyunLLM, FengmingSTT, MiniMaxCNTTS } from 'agora-agents';

const client = new AgoraClient({
  area: Area.CN,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});

const agent = new Agent({ client })
  .withStt(new FengmingSTT())
  .withLlm(new AliyunLLM({
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
  }))
  .withTts(new MiniMaxCNTTS({
    key: process.env.MINIMAX_API_KEY!,
    model: 'speech-01-turbo',
    voiceSetting: { voice_id: 'female-shaonv' },
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});
```

## LLM vendors


### OpenAI

<!-- snippet: fragment -->
```typescript
new OpenAI(options: OpenAIOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | BYOK only | OpenAI API key. Optional for supported Agora-managed OpenAI models. |
| `model` | `string` | Yes | Model name (e.g., `'gpt-4o-mini'`, `'gpt-4'`) |
| `url` | `string` | BYOK only | API endpoint URL. Required when `apiKey` is set. |
| `maxHistory` | `number` | No | Max conversation history to cache |
| `systemMessages` | `Record<string, unknown>[]` | No | System messages for context |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message when LLM call fails |
| `inputModalities` | `string[]` | No | Input modalities (default: `["text"]`) |
| `outputModalities` | `string[]` | No | Output modalities |
| `params` | `Record<string, unknown>` | No | Additional LLM parameters (overrides `model` in params) |
| `headers` | `Record<string, string>` | No | Custom HTTP headers forwarded to the LLM provider |
| `greetingAudioUrl` | `string` | No | Publicly accessible greeting audio URL |
| `greetingConfigs` | `LlmGreetingConfigs` | No | Greeting playback configuration |
| `templateVariables` | `Record<string, string>` | No | Template variables for messages |
| `tools` | `LlmTool[]` | No | Inline synchronous REST function-calling tools; requires `agent.withTools(true)` |

For supported Agora-managed models, `apiKey` is optional:

- `gpt-4o-mini`
- `gpt-4.1-mini`
- `gpt-5-nano`
- `gpt-5-mini`

For those models, omit `apiKey` to use Agora-managed credentials. This option is only available with the default OpenAI endpoint and without a custom vendor hint. If `apiKey` is provided, AgentKit uses BYOK instead.

### AzureOpenAI

<!-- snippet: fragment -->
```typescript
new AzureOpenAI(options: AzureOpenAIOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Azure OpenAI API key |
| `model` | `string` | Yes | Model/deployment name |
| `resourceName` | `string` | Yes | Azure resource name |
| `deploymentName` | `string` | Yes | Deployment name in Azure |
| `apiVersion` | `string` | No | Azure API version (default: `'2024-08-01-preview'`) |
| `maxHistory` | `number` | No | Max conversation history to cache |
| `systemMessages` | `Record<string, unknown>[]` | No | System messages |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message when LLM call fails |
| `inputModalities` | `string[]` | No | Input modalities (default: `["text"]`) |
| `outputModalities` | `string[]` | No | Output modalities |
| `params` | `Record<string, unknown>` | No | Additional LLM parameters |
| `headers` | `Record<string, string>` | No | Custom HTTP headers forwarded to the LLM provider |
| `greetingAudioUrl` | `string` | No | Publicly accessible greeting audio URL |
| `greetingConfigs` | `LlmGreetingConfigs` | No | Greeting playback configuration |
| `templateVariables` | `Record<string, string>` | No | Template variables for messages |

### Anthropic

<!-- snippet: fragment -->
```typescript
new Anthropic(options: AnthropicOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Anthropic API key |
| `model` | `string` | Yes | Model name (e.g., `'claude-3-5-sonnet-20241022'`) |
| `url` | `string` | Yes | API endpoint URL (for example, `https://api.anthropic.com/v1/messages`) |
| `maxHistory` | `number` | No | Max conversation history to cache |
| `maxTokens` | `number` | Yes | Maximum tokens to generate |
| `headers` | `Record<string, string>` | Yes | Custom HTTP headers forwarded to the LLM provider, including Anthropic API version |
| `systemMessages` | `Record<string, unknown>[]` | No | System messages |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message when LLM call fails |
| `inputModalities` | `string[]` | No | Input modalities (default: `["text"]`) |
| `outputModalities` | `string[]` | No | Output modalities |
| `params` | `Record<string, unknown>` | No | Additional LLM parameters |
| `greetingAudioUrl` | `string` | No | Publicly accessible greeting audio URL |
| `greetingConfigs` | `LlmGreetingConfigs` | No | Greeting playback configuration |
| `templateVariables` | `Record<string, string>` | No | Template variables for messages |

### Gemini

<!-- snippet: fragment -->
```typescript
new Gemini(options: GeminiOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Google API key |
| `model` | `string` | Yes | Model name (e.g., `'gemini-pro'`) |
| `url` | `string` | No | Optional full Gemini stream endpoint URL override. By default, AgentKit builds the official Gemini URL from `model` and `apiKey` |
| `maxHistory` | `number` | No | Max conversation history to cache |
| `systemMessages` | `Record<string, unknown>[]` | No | System messages |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message when LLM call fails |
| `inputModalities` | `string[]` | No | Input modalities (default: `["text"]`) |
| `outputModalities` | `string[]` | No | Output modalities |
| `params` | `Record<string, unknown>` | No | Additional LLM parameters |
| `headers` | `Record<string, string>` | No | Custom HTTP headers forwarded to the LLM provider |
| `greetingAudioUrl` | `string` | No | Publicly accessible greeting audio URL |
| `greetingConfigs` | `LlmGreetingConfigs` | No | Greeting playback configuration |
| `templateVariables` | `Record<string, string>` | No | Template variables for messages |

### Other LLM vendors

The SDK also includes named helpers for the remaining Agora-supported LLM providers. These helpers choose the correct request format internally.

| Class | Provider | Key options |
|---|---|---|
| `Groq` | Groq | `apiKey`, `model`, `url` |
| `VertexAILLM` | Google Vertex AI | `apiKey`, `model`, `projectId`, `location`, `url?` |
| `AmazonBedrock` | Amazon Bedrock | `accessKey`, `secretKey`, `region`, `model` |
| `Dify` | Dify | `apiKey`, `url`, `model`, `user?`, `conversationId?` |
| `CustomLLM` | OpenAI-compatible LLM | `apiKey`, `model`, `url` |

---

## TTS vendors

### ElevenLabsTTS

<!-- snippet: fragment -->
```typescript
new ElevenLabsTTS<SR extends ElevenLabsSampleRate>(options: ElevenLabsTTSOptions<SR>)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | ElevenLabs API key |
| `modelId` | `string` | Yes | Model ID (e.g., `'eleven_flash_v2_5'`) |
| `voiceId` | `string` | Yes | Voice ID |
| `baseUrl` | `string` | Yes | WebSocket base URL |
| `sampleRate` | `16000 \| 22050 \| 24000 \| 44100` | No | Audio sample rate in Hz |
| `optimizeStreamingLatency` | `number` | No | Latency optimization level, 0-4 |
| `stability` | `number` | No | Voice stability, 0.0-1.0 |
| `similarityBoost` | `number` | No | Voice similarity boost, 0.0-1.0 |
| `style` | `number` | No | Voice style exaggeration, 0.0-1.0 |
| `useSpeakerBoost` | `boolean` | No | Enable speaker boost |
| `skipPatterns` | `number[]` | No | Skip patterns for bracketed content |

### MicrosoftTTS

<!-- snippet: fragment -->
```typescript
new MicrosoftTTS<SR extends MicrosoftSampleRate>(options: MicrosoftTTSOptions<SR>)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | Azure Speech API key |
| `region` | `string` | Yes | Azure region (e.g., `'eastus'`) |
| `voiceName` | `string` | Yes | Voice name (e.g., `'en-US-JennyNeural'`) |
| `sampleRate` | `16000 \| 24000 \| 48000` | No | Audio sample rate in Hz |
| `speed` | `number` | No | Speaking rate multiplier |
| `volume` | `number` | No | Audio volume |
| `skipPatterns` | `number[]` | No | Skip patterns for bracketed content |

### OpenAITTS

<!-- snippet: fragment -->
```typescript
new OpenAITTS(options: OpenAITTSOptions)
```

Fixed at 24kHz — no configurable sample rate.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | BYOK only | OpenAI API key |
| `voice` | `string` | Yes | Voice name (`'alloy'`, `'echo'`, `'fable'`, `'onyx'`, `'nova'`, `'shimmer'`) |
| `model` | `string` | BYOK only | Model name (e.g., `'tts-1'`, `'tts-1-hd'`) |
| `baseUrl` | `string` | BYOK only | OpenAI TTS endpoint URL |
| `instructions` | `string` | No | Custom instructions for voice style, accent, pace, and tone |
| `speed` | `number` | No | Speech speed multiplier |
| `skipPatterns` | `number[]` | No | Skip patterns for bracketed content |

`apiKey`, `model`, and `baseUrl` are required together for BYOK. `apiKey` is optional only for the Agora-managed `tts-1` path. If omitted with `model: 'tts-1'` or no explicit model, AgentKit sends the matching Agora-managed configuration.

### CartesiaTTS

<!-- snippet: fragment -->
```typescript
new CartesiaTTS<SR extends CartesiaSampleRate>(options: CartesiaTTSOptions<SR>)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Cartesia API key |
| `voiceId` | `string` | Yes | Voice ID (serialized as `{"mode": "id", "id": "..."}`) |
| `modelId` | `string` | Yes | Model ID |
| `baseUrl` | `string` | No | WebSocket URL for the Cartesia streaming API |
| `language` | `string` | No | Target language for speech synthesis |
| `sampleRate` | `8000 \| 16000 \| 22050 \| 24000 \| 44100 \| 48000` | No | Audio sample rate in Hz |
| `skipPatterns` | `number[]` | No | Skip patterns for bracketed content |

### RimeTTS

<!-- snippet: fragment -->
```typescript
new RimeTTS(options: RimeTTSOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `credentialMode` | `CredentialMode` | No | Credential mode. Defaults to BYOK when omitted. |
| `key` | `string` | BYOK | Rime API key; optional in managed mode |
| `speaker` | `string` | BYOK | Rime speaker ID; optional in managed mode |
| `modelId` | `string` | Yes | Rime model ID |
| `baseUrl` | `string` | Managed | WebSocket URL for the Rime streaming API; optional in BYOK mode |
| `skipPatterns` | `number[]` | No | Skip patterns for bracketed content |

Use Agora-managed credentials by setting `credentialMode: CredentialMode.Managed` and providing `baseUrl` and `modelId`:

```typescript
import { CredentialMode, RimeTTS } from 'agora-agents';

const tts = new RimeTTS({
  credentialMode: CredentialMode.Managed,
  baseUrl: 'wss://users.rime.ai/ws',
  modelId: 'mist',
});
```

For BYOK, omit `credentialMode` or set it to `CredentialMode.Byok`, and provide `key`, `speaker`, and `modelId`.

### Other TTS vendors

The following vendors share a similar pattern. See `src/agentkit/vendors/tts.ts` for the full constructor options:

| Class | Key params |
|---|---|
| `GoogleTTS` | `key`, `voiceName`, `languageCode?`, `sampleRate?` |
| `AmazonTTS` | `accessKey`, `secretKey`, `region`, `voiceId`, `engine` |
| `DeepgramTTS` | `apiKey`, `model`, `baseUrl?`, `sampleRate?`, `additionalParams?` |
| `GradiumTTS` | `apiKey`, `url?`, `modelName?`, `voiceId?`, `sampleRate?`, `additionalParams?` |
| `MistralTTS` | `apiKey`, `model?`, `voice?`, `additionalParams?` |
| `TypecastTTS` | `apiKey`, `voiceId`, `model`, `additionalParams?`, `skipPatterns?` |
| `GenericTTS` | `url`, `headers?`, `apiKey?`, `model?`, `voice?`, `speed?`, `sampleRate?`, `responseFormat?`, `instruction?`, `additionalParams?`, `skipPatterns?` |
| `HumeAITTS` | `key`, `voiceId`, `provider`, `configId?`, `baseUrl?`, `speed?`, `trailingSilence?` |
| `FishAudioTTS` | `key`, `referenceId`, `backend` |
| `MiniMaxTTS` | `key?`, `groupId?`, `model`, `voiceId?`, `url?` |
| `MurfTTS` | `key`, `voiceId?`, `baseUrl?`, `locale?`, `rate?`, `pitch?`, `model?`, `sampleRate?` |
| `SarvamTTS` | `key`, `speaker`, `targetLanguageCode`, `pitch?`, `pace?`, `loudness?`, `sampleRate?` |
| `XAiTTS` | `apiKey`, `language`, `voiceId?`, `sampleRate?`, `additionalParams?` |

`GenericTTS` is the public AgentKit wrapper for generic TTS integrations. It currently accepts only absolute HTTP(S) URLs and serializes them with the wire vendor `generic_http`. WebSocket URLs are rejected until the generated API exposes a corresponding WebSocket TTS vendor; AgentKit can then route the same public wrapper by URL protocol.

For `MiniMaxTTS`, `key` is optional only for Agora-managed models:

- `speech-2.6-turbo`
- `speech-2.8-turbo`

For those models, omit `key` to use Agora-managed credentials. In that configuration, `groupId`, `voiceId`, and `url` are optional overrides rather than required fields. If `key` is provided, AgentKit uses BYOK.

---

## STT vendors

### DeepgramSTT

<!-- snippet: fragment -->
```typescript
new DeepgramSTT(options: DeepgramSTTOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | No | Deepgram API key. Optional only for `nova-2` and `nova-3` Agora-managed usage. |
| `model` | `string` | No | Model (e.g., `'nova-2'`, `'enhanced'`) |
| `language` | `string` | No | Language code (e.g., `'en-US'`) |
| `keyterm` | `string` | No | Boost specialized terms and brands; serialized as `asr.params.keyterm` |
| `smartFormat` | `boolean` | No | Enable smart formatting |
| `punctuation` | `boolean` | No | Enable punctuation |
| `additionalParams` | `Record<string, unknown>` | No | Additional vendor params |

For `nova-2` and `nova-3`, omit `apiKey` to use Agora-managed credentials. For all other Deepgram models, AgentKit requires `apiKey`.

### Other STT vendors

Use `turnDetection.language` for Agora interaction language; it defaults to `en-US`. Provider-specific language values stay under `asr.params` and may use a different format. AgentKit populates REST `asr.language` from `turnDetection.language`.

When `.withStt()` is omitted, AgentKit now selects the wire ASR vendor from `client.area`: `fengming` for `Area.CN`, otherwise `ares`.

| Class | Key params |
|---|---|
| `SpeechmaticsSTT` | `key`, `language`, `uri?`; deprecated `apiKey?` alias |
| `MicrosoftSTT` | `key`, `region`, `language` |
| `OpenAISTT` | `apiKey`, `model?`, `language?`, `prompt?`, `inputAudioTranscription?` |
| `GoogleSTT` | `projectId`, `location`, `adcCredentialsString`, `language`, `model?` |
| `AmazonSTT` | `accessKey`, `secretKey`, `region`, `language` |
| `AssemblyAISTT` | `apiKey`, `language`, `ws_url?` |
| `AresSTT` | `keywords?`, `additionalParams?` |
| `SarvamSTT` | `apiKey`, `language` |
| `XAiSTT` | `apiKey`, `language?`, `baseUrl?`, `sampleRate?`, `additionalParams?` |
| `GeminiSTT` | `apiKey`; optional `model`, `language`, `languageHints`, deprecated `languageCodes`, `customVocabulary`, `sampleRate`, `wordTimestamp`, `additionalParams` |

For both `AresSTT` and `FengmingSTT`, `keywords` is serialized at the ASR top level as `asr.keywords`. Extra vendor fields supplied through `additionalParams` remain supported and are serialized under `asr.params`.

`GeminiSTT.model` defaults to `gemini-3.5-transcribe-live`, and `sampleRate` defaults to `16000`. `languageHints` serializes as `params.language_hints`; deprecated `languageCodes` is used only when `languageHints` is unset. Omitted arrays are not sent, while explicitly empty arrays are preserved. `customVocabulary` cannot be combined with `wordTimestamp: true`.

`SpeechmaticsSTT` always serializes its credential as `asr.params.key`. The deprecated `apiKey` option remains accepted for backward compatibility and is normalized to `key`; when both are provided, `key` takes precedence.

---

## MLLM vendors

### OpenAIRealtime

<!-- snippet: fragment -->
```typescript
new OpenAIRealtime(options: OpenAIRealtimeOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | OpenAI API key |
| `model` | `string` | No | Model name (e.g., `'gpt-4o-realtime-preview'`) |
| `url` | `string` | No | WebSocket URL (defaults to `wss://api.openai.com/v1/realtime` when omitted or empty) |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message played when the model call fails |
| `inputModalities` | `string[]` | No | Input modalities (e.g., `['audio']`) |
| `outputModalities` | `string[]` | No | Output modalities (e.g., `['text', 'audio']`) |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages for short-term memory |
| `params` | `Record<string, unknown>` | No | Additional MLLM parameters |
| `turnDetection` | `MllmTurnDetectionConfig` | No | MLLM turn detection configuration; overrides top-level `turn_detection` |

### AzureOpenAIRealtime

<!-- snippet: fragment -->
```typescript
new AzureOpenAIRealtime(options: AzureOpenAIRealtimeOptions)
```

Global Azure OpenAI Realtime wrapper. It emits `mllm.vendor = 'azure'`; `maxHistory` maps to the Azure-only top-level field `mllm.max_history`.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Azure OpenAI API key |
| `url` | `string` | Yes | Azure OpenAI Realtime WebSocket URL |
| `model` | `string` | No | Model or deployment model identifier |
| `voice` | `string` | No | Voice identifier |
| `instructions` | `string` | No | System instructions |
| `maxHistory` | `number` | No | Number of cached conversation messages |
| `greetingMessage` | `string` | No | Agent greeting message |
| `outputModalities` | `string[]` | No | Output modalities |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages |
| `params` | `AzureOpenAIRealtimeParams` | No | Azure parameters limited to `instructions`, `model`, and `voice` |
| `turnDetection` | `MllmTurnDetectionConfig` | Yes | MLLM turn detection configuration |

### GeminiLive

<!-- snippet: fragment -->
```typescript
new GeminiLive(options: GeminiLiveOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Google API key |
| `model` | `string` | Yes | Model name (e.g., `'gemini-live-2.5-flash'`) |
| `url` | `string` | No | WebSocket URL |
| `instructions` | `string` | No | System instructions for the model |
| `voice` | `string` | No | Voice name (e.g., `'Aoede'`, `'Charon'`) |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message played when the model call fails |
| `inputModalities` | `string[]` | No | Input modalities |
| `outputModalities` | `string[]` | No | Output modalities |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages |
| `additionalParams` | `Record<string, unknown>` | No | Additional parameters |
| `turnDetection` | `MllmTurnDetectionConfig` | No | MLLM turn detection configuration; overrides top-level `turn_detection` |

### VertexAI

<!-- snippet: fragment -->
```typescript
new VertexAI(options: VertexAIOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | Yes | Model name (e.g., `'gemini-live-2.5-flash-preview-native-audio-09-2025'`) |
| `url` | `string` | No | WebSocket URL |
| `projectId` | `string` | Yes | Google Cloud project ID |
| `location` | `string` | Yes | Google Cloud location/region |
| `adcCredentialsString` | `string` | Yes | Application Default Credentials JSON string |
| `instructions` | `string` | No | System instructions for the model |
| `voice` | `string` | No | Voice name (e.g., `'Aoede'`, `'Charon'`) |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message played when the model call fails |
| `inputModalities` | `string[]` | No | Input modalities |
| `outputModalities` | `string[]` | No | Output modalities |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages |
| `additionalParams` | `Record<string, unknown>` | No | Additional parameters |
| `turnDetection` | `MllmTurnDetectionConfig` | No | MLLM turn detection configuration; overrides top-level `turn_detection` |

### XaiGrok

<!-- snippet: fragment -->
```typescript
new XaiGrok(options: XaiGrokOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | xAI API key |
| `url` | `string` | No | WebSocket URL (defaults to xAI Realtime API) |
| `voice` | `string` | No | Voice identifier (for example, `'eve'`) |
| `language` | `string` | No | Language code |
| `sampleRate` | `number` | No | Audio sample rate in Hz |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message played when the model call fails |
| `inputModalities` | `string[]` | No | Input modalities |
| `outputModalities` | `string[]` | No | Output modalities |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages |
| `params` | `Record<string, unknown>` | No | Additional xAI parameters |
| `turnDetection` | `MllmTurnDetectionConfig` | No | MLLM turn detection configuration; overrides top-level `turn_detection` |

### QwenOmni

<!-- snippet: fragment -->
```typescript
new QwenOmni(options: QwenOmniOptions)
```

Chinese mainland Alibaba Cloud Qwen Omni Realtime wrapper. It emits `mllm.vendor = 'qwen_omni'` and is assignable to `CNMllmVendor`, not `GlobalMllmVendor`.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Alibaba Cloud DashScope API key |
| `model` | `string` | Yes | Qwen Omni model identifier |
| `url` | `string` | Yes | Qwen Omni Realtime WebSocket URL |
| `voice` | `string` | No | Voice identifier |
| `instructions` | `string` | No | System instructions |
| `greetingMessage` | `string` | No | Agent greeting message |
| `failureMessage` | `string` | No | Message played when the model call fails |
| `inputModalities` | `string[]` | No | Input modalities |
| `outputModalities` | `string[]` | No | Output modalities |
| `messages` | `Record<string, unknown>[]` | No | Conversation messages |
| `params` | `Record<string, unknown>` | No | Additional Qwen Omni parameters |
| `turnDetection` | `MllmTurnDetectionConfig` | No | MLLM turn detection configuration |

---

## Avatar vendors

AgentKit auto-fills `agora_token` only for vendors that publish a separate RTC video identity: `HeyGenAvatar`, `LiveAvatarAvatar`, `GenericAvatar`, `SensetimeAvatar`, and `SpatiusAvatar`. When `agoraToken` is omitted on those vendors, AgentKit generates it at `session.start()` from the session App ID, channel, app certificate, and avatar `agoraUid`. Avatar tokens use the same ConvoAI token format as agent tokens, scoped to the avatar UID. Explicit `agoraToken` values are preserved. `AkoolAvatar` and `AnamAvatar` never receive an auto-generated token (the avatar provider handles publishing). Use `isAvatarTokenManaged(avatar)` to check whether a config is in the managed group.

### HeyGenAvatar

<!-- snippet: fragment -->
```typescript
new HeyGenAvatar(options: HeyGenAvatarOptions)
```

Deprecated. Use `LiveAvatarAvatar` for new integrations. Requires TTS at **24,000 Hz**. See [Avatar Integration](../guides/avatars.md).

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | HeyGen API key |
| `quality` | `"low" \| "medium" \| "high"` | Yes | Video quality (360p / 480p / 720p) |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream |
| `agoraToken` | `string` | No | Avatar token override |
| `avatarId` | `string` | No | HeyGen avatar ID |
| `disableIdleTimeout` | `boolean` | No | Disable idle timeout (default: false) |
| `activityIdleTimeout` | `number` | No | Idle timeout in seconds (default: 120) |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

### LiveAvatarAvatar

<!-- snippet: fragment -->
```typescript
new LiveAvatarAvatar(options: LiveAvatarAvatarOptions)
```

Requires TTS at **24,000 Hz**. See [Avatar Integration](../guides/avatars.md).

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | LiveAvatar API key |
| `quality` | `"low" \| "medium" \| "high"` | Yes | Video quality |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream |
| `agoraToken` | `string` | No | Avatar token override |
| `avatarId` | `string` | No | Avatar ID |
| `disableIdleTimeout` | `boolean` | No | Disable idle timeout |
| `activityIdleTimeout` | `number` | No | Idle timeout in seconds |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

### AkoolAvatar

<!-- snippet: fragment -->
```typescript
new AkoolAvatar(options: AkoolAvatarOptions)
```

Requires TTS at **16,000 Hz**. See [Avatar Integration](../guides/avatars.md).

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Akool API key |
| `avatarId` | `string` | No | Akool avatar ID |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

### AnamAvatar

<!-- snippet: fragment -->
```typescript
new AnamAvatar(options: AnamAvatarOptions)
```

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Anam API key |
| `avatarId` | `string` | No | Anam avatar ID |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

### SpatiusAvatar

<!-- snippet: fragment -->
```typescript
new SpatiusAvatar(options: SpatiusAvatarOptions)
```

`SpatiusAvatar` is a CN avatar helper. `agoraToken` is optional; when omitted, AgentKit generates it at `session.start()`.

| Option | Type | Required | Description |
|---|---|---|---|
| `spatiusApiKey` | `string` | Yes | Spatius API key |
| `spatiusAppId` | `string` | Yes | Spatius application ID |
| `spatiusAvatarId` | `string` | Yes | Spatius avatar ID |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream |
| `agoraToken` | `string` | No | Avatar token override |
| `region` | `string` | No | Spatius service region (for example, `cn-beijing`) |
| `sampleRate` | `16000 \| 24000` | No | Audio sample rate in Hz |
| `sessionExpireMinutes` | `number` | No | Spatius session validity duration in minutes |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

### GenericAvatar

<!-- snippet: fragment -->
```typescript
new GenericAvatar(options: GenericAvatarOptions)
```

Generic avatars can omit `agoraAppId`, `agoraChannel`, and `agoraToken`. AgentKit fills them from the session at `start()`.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiKey` | `string` | Yes | Custom avatar provider API key |
| `apiBaseUrl` | `string` | Yes | Avatar provider API base URL |
| `avatarId` | `string` | Yes | Avatar ID |
| `agoraUid` | `string` | Yes | RTC UID for the avatar stream |
| `agoraAppId` | `string` | No | Agora App ID override |
| `agoraChannel` | `string` | No | Agora channel override |
| `agoraToken` | `string` | No | Avatar token override |
| `enable` | `boolean` | No | Enable/disable the avatar (default: true) |

## CN vendors

### CN LLM vendors

All CN LLM helpers share the OpenAI-compatible shape and require `url` + `model`:

| Class | Key options |
|---|---|
| `AliyunLLM` | `url`, `model`, `apiKey?`, `systemMessages?`, `greetingMessage?`, `failureMessage?`, `maxHistory?`, `params?`, `headers?` |
| `BytedanceLLM` | `url`, `model`, `apiKey?`, `systemMessages?`, `greetingMessage?`, `failureMessage?`, `maxHistory?`, `params?`, `headers?` |
| `DeepSeekLLM` | `url`, `model`, `apiKey?`, `systemMessages?`, `greetingMessage?`, `failureMessage?`, `maxHistory?`, `params?`, `headers?` |
| `TencentLLM` | `url`, `model`, `apiKey?`, `systemMessages?`, `greetingMessage?`, `failureMessage?`, `maxHistory?`, `params?`, `headers?` |
| `CustomLLM` | `apiKey`, `model`, `url` |

### CN TTS vendors

CN TTS helpers reuse shared vendor names where possible. `GenericTTS` is available in both CN and Global vendor types. `MiniMaxCNTTS` and `MicrosoftCNTTS` are the CN-specific classes; `MiniMaxTTS` and `MicrosoftTTS` remain the global helpers.

| Class | Key options |
|---|---|
| `MiniMaxCNTTS` | `key`, `model`, plus either `voiceSetting.voice_id` or non-empty `timberWeights`, with optional `audioSetting`, `pronunciationDict`, `languageBoost`, `skipPatterns` |
| `TencentTTS` | `appId`, `secretId`, `secretKey`, `voiceType`; optional `volume`, `speed`, `emotionCategory`, `emotionIntensity`, `skipPatterns` |
| `BytedanceTTS` | `token`, `appId`, `cluster`, `voiceType`; optional `speedRatio`, `volumeRatio`, `pitchRatio`, `emotion`, `skipPatterns` |
| `MicrosoftCNTTS` | `key`, `region`, `voiceName`; optional `sampleRate`, `speed`, `volume`, `skipPatterns`, `additionalParams` |
| `CosyVoiceTTS` | `apiKey`, `model`, `sampleRate`, `voice`; optional `skipPatterns` |
| `BytedanceDuplexTTS` | `appId`, `token`, `speaker`; optional `skipPatterns` |
| `StepFunTTS` | `apiKey`, `model`, `voiceId`; optional `skipPatterns` |

### CN STT vendors

| Class | Key options |
|---|---|
| `FengmingSTT` | optional `keywords`, `additionalParams` |
| `TencentSTT` | `key`, `appId`, `secret`, `engineModelType`, `voiceId`; optional `language`, `additionalParams` |
| `MicrosoftCNSTT` | `key`, `region`, `language` |
| `XfyunSTT` | `apiKey`, `appId`, `apiSecret`, `language`; optional `additionalParams` |
| `XfyunBigModelSTT` | `apiKey`, `appId`, `apiSecret`, `languageName`, `language`; optional `additionalParams` |
| `XfyunDialectSTT` | `appId`, `accessKeyId`, `accessKeySecret`, `language`; optional `additionalParams` |

### CN Avatar vendors

| Class | Key options |
|---|---|
| `SensetimeAvatar` | `agoraUid`, `appId`, `appKey`; optional `sceneList`, `agoraToken`, `enable`, `additionalParams` |
| `SpatiusAvatar` | `spatiusApiKey`, `spatiusAppId`, `spatiusAvatarId`, `agoraUid`; optional `agoraToken`, `region`, `sampleRate`, `sessionExpireMinutes`, `enable`, `additionalParams` |
