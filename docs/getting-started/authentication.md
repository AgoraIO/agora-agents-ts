---
sidebar_position: 2
title: Authentication
description: Configure AgoraClient with app credentials and understand other supported auth modes.
---

# Authentication

Create `AgoraClient` with `appId` and `appCertificate` only. Generated REST tokens include the ConvoAI service (service 9), RTC, and RTM. Externally supplied `authToken` values must include the ConvoAI service for Platform session routes; an RTC+RTM-only token is insufficient. The SDK mints a fresh ConvoAI REST token for each API call and generates the RTC join token when the session starts.

## App credentials

```typescript
import { Agent, AgoraClient, Area, DeepgramSTT, OpenAI, MiniMaxTTS } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withStt(new DeepgramSTT({ model: 'nova-3', language: 'en-US' }))
  .withLlm(new OpenAI({
    model: 'gpt-4o-mini',
    systemMessages: [{ role: 'system', content: 'Be concise.' }],
  }))
  .withTts(new MiniMaxTTS({ model: 'speech_2_6_turbo', voiceId: 'English_captivating_female1' }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});
```

## Why app credentials

- Fresh short-lived tokens per API call instead of reusing long-lived credentials
- No Customer ID / Customer Secret in request headers
- No manual REST or RTC token provisioning in application code

## Inspecting auth mode

```typescript
console.log(client.authMode); // "app-credentials"
```

## Pre-minted tokens

Alternatively, set `authToken` to a raw Agora REST token. The SDK sends `Authorization: agora token=<value>`. Keep `appId` and `appCertificate` for existing RTC token generation. `client.authMode` is `"token"` in this mode.

The public client accepts only app credentials or `authToken`. Customer/Client ID and Secret options are removed and rejected, including JavaScript calls. Basic authorization overrides are rejected before network calls on both current and legacy resources. Internal gateway and `X-Studio-Region` headers are not public options.

Saved-agent/session/campaign resources use `https://preview.ai.agora.io/conversational-ai/v1/projects/{appid}` by default. Existing ordinary inline sessions retain their established endpoint routing and use token authentication.
