# Agora Conversational AI TypeScript SDK

[![fern shield](https://img.shields.io/badge/%F0%9F%8C%BF-Built%20with%20Fern-brightgreen)](https://buildwithfern.com?utm_source=github&utm_medium=github&utm_campaign=readme&utm_source=https%3A%2F%2Fgithub.com%2FAgoraIO%2Fagora-agents-ts)
[![npm shield](https://img.shields.io/npm/v/agora-agents)](https://www.npmjs.com/package/agora-agents)
[![ci](https://github.com/AgoraIO/agora-agents-ts/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AgoraIO/agora-agents-ts/actions/workflows/ci.yml)
[![coverage](https://codecov.io/gh/AgoraIO/agora-agents-ts/branch/main/graph/badge.svg)](https://codecov.io/gh/AgoraIO/agora-agents-ts/branch/main)

The Agora Agents SDK for TypeScript lets you build real-time voice agents on Agora Conversational AI with a high-level `Agent` / `AgentSession` API and a generated REST client.

## Installation

```sh
npm install agora-agents
```

## Quick Start

Start with the `Agent` builder: create a client with app credentials, configure ASR, LLM, and TTS with vendor classes, then start a session. Omit vendor API keys for supported Agora-managed models, or provide keys when you want BYOK.
Set Agora interaction language with `turnDetection.language`; provider-specific STT language values remain under `asr.params`. Ares uses only the REST `asr.language` value sourced from `turnDetection.language`.

```typescript
import { AgoraClient, Agent, Area, DeepgramSTT, ExpiresIn, MiniMaxTTS, OpenAI } from 'agora-agents';

const AGENT_PROMPT = `You are a concise, technically credible voice assistant. Keep replies short unless the user asks for detail.`;

const GREETING = 'Hi there! I am your Agora voice assistant. How can I help?';

export async function startConversation(): Promise<string> {
  const appId = process.env.AGORA_APP_ID!;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE!;

  const client = new AgoraClient({
    area: Area.US,
    appId,
    appCertificate,
  });

  const agent = new Agent({
    client,
    turnDetection: {
      language: 'en-US',
      config: {
        speech_threshold: 0.5,
        start_of_speech: {
          mode: 'vad',
          vad_config: {
            interrupt_duration_ms: 160,
            prefix_padding_ms: 300,
          },
        },
        end_of_speech: {
          mode: 'vad',
          vad_config: {
            silence_duration_ms: 480,
          },
        },
      },
    },
    advancedFeatures: {
      enable_rtm: true,
      enable_tools: true,
    },
    parameters: {
      data_channel: 'rtm',
      enable_error_message: true,
    },
  })
    .withStt(
      new DeepgramSTT({
        model: 'nova-3',
        language: 'en',
      }),
    )
    .withLlm(
      new OpenAI({
        model: 'gpt-4o-mini',
        systemMessages: [{ role: 'system', content: AGENT_PROMPT }],
        greetingMessage: GREETING,
        failureMessage: 'Please wait a moment.',
        maxHistory: 50,
        params: {
          max_tokens: 1024,
          temperature: 0.7,
          top_p: 0.95,
        },
      }),
    )
    .withTts(
      new MiniMaxTTS({
        model: 'speech_2_6_turbo',
        voiceId: 'English_captivating_female1',
      }),
    );

  const session = agent.createSession({
    name: `conversation-${Date.now()}`,
    channel: `demo-channel-${Date.now()}`,  // Unique channel name
    agentUid: '123456',                     // Unique agent UID. Can be a random number or a specific user ID.
    remoteUids: ['*'],                     // '*' is a wildcard, or use a specific user ID.
    idleTimeout: 30,
    expiresIn: ExpiresIn.hours(1),
    debug: false,
  });

  return await session.start();
}
```

### Why no token or vendor key in the example?

`AgoraClient` generates the required ConvoAI REST auth and RTC join tokens automatically when you provide `appId` and `appCertificate`. For supported Agora-managed global models, leave vendor API keys unset; provide keys when you want BYOK. CN MiniMax TTS is not Agora-managed and always requires `key`. CN custom LLM routing reuses `CustomLLM`, so `apiKey` is also required.

### Regional agent builders

`client.area` controls API routing only. You may combine any supported vendor class with any area. See [`docs/guides/regional-routing.md`](./docs/guides/regional-routing.md) for examples.

## AI Studio pipeline IDs

Use `pipelineId` when you want a published AI Studio pipeline to provide the base agent configuration:

```typescript
import { AgoraClient, Agent, Area } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});

const agent = new Agent({
  client,
  pipelineId: 'studio-pipeline-id',
});

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});
```

You can override it per session:

```typescript
const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
  pipelineId: 'session-pipeline-id',
});
```

AgentKit sends the resolved value as the top-level `/join` field `pipeline_id`, not inside `properties`. Explicit Agent config such as `.withLlm()`, `.withTts()`, `.withStt()`, `.withMllm()`, and `advancedFeatures` may send `properties` fields that override the saved pipeline settings.

### BYOK version

Use the same `Agent` builder shape, but provide credentials explicitly when you want vendor-managed billing and routing instead of Agora-managed models.

```typescript
import { AgoraClient, Agent, Area, DeepgramSTT, MiniMaxTTS, OpenAI } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});

const SUPPORT_PROMPT = 'You are a concise support assistant.';
const GREETING = 'Hi there! I am your Agora voice assistant. How can I help?';

const agent = new Agent({ client, turnDetection: { language: 'en-US' } })
  .withStt(
    new DeepgramSTT({
      apiKey: process.env.DEEPGRAM_API_KEY!,
      model: 'nova-3',
      language: 'en',
    }),
  )
  .withLlm(
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o-mini',
      systemMessages: [{ role: 'system', content: SUPPORT_PROMPT }],
      greetingMessage: GREETING,
      maxTokens: 1024,
      temperature: 0.7,
      topP: 0.95,
    }),
  )
  .withTts(
    new MiniMaxTTS({
      model: 'speech_2_6_turbo',
      voiceId: 'English_captivating_female1',
    }),
  );
```

Migrating from `agora-agent-server-sdk`? Install and import `agora-agents` instead — see [changelog migration notes](./changelog.md#migration-notes) or [installation guide](./docs/getting-started/installation.md#migrating-from-a-previous-package-name).

## BYOK

If you want to bring your own vendor credentials instead of using Agora-managed models, use the BYOK guide:

- [BYOK Guide](./docs/guides/byok.md)

## MLLM (Realtime / Multimodal)

Use `withMllm()` for OpenAI Realtime, Gemini Live, Vertex AI, or xAI Grok — no STT, LLM, or TTS vendor needed. MLLM mode is enabled automatically.

```typescript
import { AgoraClient, Agent, Area, OpenAIRealtime } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: process.env.AGORA_APP_ID!,
  appCertificate: process.env.AGORA_APP_CERTIFICATE!,
});

const agent = new Agent({ client }).withMllm(
  new OpenAIRealtime({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-realtime-preview',
    greetingMessage: 'Hello! Ready to chat.',
  }),
);
```

See the [MLLM Flow guide](./docs/guides/mllm-flow.md) for full examples with Gemini Live, Vertex AI, and xAI Grok.

> Avatars are not supported with MLLM. The avatar publisher requires the cascading ASR + LLM + TTS pipeline; combining `withMllm()` with `withAvatar()` throws at `Agent.toProperties()` and `AgentSession.start()`.

## Avatars

AgentKit supports LiveAvatar, Generic Avatar, Anam, Akool, SenseTime (CN), and deprecated HeyGen. Avatar `agoraToken` is optional: when omitted, `session.start()` generates a token using the same ConvoAI token format as the agent token, scoped to the avatar `agoraUid`. Avatars require the cascading ASR + LLM + TTS pipeline (not MLLM).

See the [Avatar Integration guide](./docs/guides/avatars.md) for sample-rate requirements and Generic Avatar setup.

## Documentation

- [Overview](./docs/index.md)
- [Authentication](./docs/getting-started/authentication.md)
- [Quick Start](./docs/getting-started/quick-start.md)
- [BYOK Guide](./docs/guides/byok.md)
- [MLLM Flow](./docs/guides/mllm-flow.md)
- [Low-Level API](./docs/guides/low-level-api.md)

## Reference

- [SDK Reference](./reference.md)
- [Agora Conversational AI Docs](https://docs.agora.io/en/conversational-ai/overview)
