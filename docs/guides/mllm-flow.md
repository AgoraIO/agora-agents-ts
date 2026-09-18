---
sidebar_position: 2
title: MLLM Flow (Multimodal)
description: Use global or Chinese mainland MLLM providers for end-to-end audio processing.
---

# MLLM Flow (Multimodal)

In MLLM mode, a single multimodal model handles audio input and output end-to-end — no separate STT or TTS step. AgentKit supports global OpenAI Realtime, Azure OpenAI Realtime, Gemini Live, Vertex AI, and xAI Grok providers, plus Qwen Omni for Chinese mainland deployments.

## When to use MLLM

- You want the lowest-latency conversational experience
- You are using OpenAI Realtime API, Azure OpenAI Realtime, Google Gemini Live, Vertex AI Gemini Live, xAI Grok Realtime, or Qwen Omni
- You don't need fine-grained control over STT/TTS vendor selection

## Requirements

Call `agent.withMllm(vendor)` — that's it. MLLM mode is enabled automatically through `mllm.enable`. The `withLlm()`, `withTts()`, and `withStt()` methods are not needed — the MLLM vendor handles everything.

`AzureOpenAIRealtime` is a global MLLM (`GlobalMllmVendor`). `QwenOmni` is a Chinese mainland MLLM (`CNMllmVendor`). As with the other explicit vendor helpers, `client.area` controls Agora REST routing but does not prevent you from selecting a provider explicitly.

All MLLM helpers accept inline REST `tools` and `mcpServers`: OpenAI Realtime, Azure OpenAI Realtime, Gemini Live, Vertex AI, xAI Grok, GPT Live, and CN Qwen Omni. Call `.withTools()` on the agent whenever either option is configured.

## Limitations

Avatars are not supported with MLLM at this time. The avatar publisher requires the cascading ASR + LLM + TTS pipeline, so combining `withMllm()` with `withAvatar()` throws at `Agent.toProperties()` and `AgentSession.start()`:

```
Avatars are only supported with the cascading ASR + LLM + TTS pipeline.
Remove the avatar configuration when using MLLM, or switch to a cascading session.
```

If you need an avatar, switch to the [cascading flow](./cascading-flow.md). If you need MLLM, omit the avatar.

## Example: OpenAI Realtime

```typescript
import { AgoraClient, Area, Agent, OpenAIRealtime } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withMllm(new OpenAIRealtime({
    apiKey: 'your-openai-key',
    model: 'gpt-4o-realtime-preview',
    greetingMessage: 'Hello! Ready to chat.',
    inputModalities: ['audio'],
    outputModalities: ['text', 'audio'],
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});

const agentId = await session.start();
console.log('Realtime agent running:', agentId);

// When done:
await session.stop();
```

## Example: Azure OpenAI Realtime (global)

```typescript
import { AgoraClient, Area, Agent, AzureOpenAIRealtime } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client }).withMllm(new AzureOpenAIRealtime({
  apiKey: 'your-azure-openai-key',
  url: 'wss://example.openai.azure.com/openai/realtime',
  params: {
    instructions: 'You are a conversational AI agent developed by Agora.',
    model: 'gpt-realtime-2',
    voice: 'alloy',
  },
  outputModalities: ['audio'],
  maxHistory: 32,
  turnDetection: { mode: 'server_vad' },
}));
```

## Example: Gemini Live

Use `GeminiLive` for the existing Gemini Live models and both Gemini 3.8 models. All use the configured regional production route; Extended Thinking also accepts `thinkingLevel`.

```typescript
import { AgoraClient, Area, Agent, GeminiLive } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withMllm(new GeminiLive({
    apiKey: 'your-google-ai-api-key',
    model: 'gemini-live-2.5-flash',
    instructions: 'You are a helpful voice assistant.',
    voice: 'Aoede',
    greetingMessage: 'Hello! Gemini is listening.',
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});

const agentId = await session.start();
console.log('Gemini agent running:', agentId);
```

## Example: xAI Grok

```typescript
import { AgoraClient, Area, Agent, XaiGrok } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,

  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withMllm(new XaiGrok({
    apiKey: 'your-xai-key',
    voice: 'eve',
    language: 'en',
    sampleRate: 24000,
    greetingMessage: 'Hello! Grok is listening.',
  }));

const session = agent.createSession({
  name: `conversation-${Date.now()}`,
  channel: `demo-channel-${Date.now()}`,
  agentUid: '1',
  remoteUids: ['100'],
});

const agentId = await session.start();
console.log('Grok agent running:', agentId);
```

## Example: Qwen Omni (Chinese mainland)

```typescript
import { AgoraClient, Area, Agent, QwenOmni } from 'agora-agents';

const client = new AgoraClient({
  area: Area.CN,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client }).withMllm(new QwenOmni({
  apiKey: 'your-dashscope-key',
  model: 'qwen3.5-omni-plus-realtime',
  url: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
  voice: 'Cherry',
  greetingMessage: 'Hello, Qwen Omni is ready.',
}));
```

## REST tools and MCP servers

Tool definitions are placed at the top level of `mllm`, not inside provider `params`. Inline REST tools currently use synchronous `GET` or `POST` execution. MCP server transport defaults to `streamable_http` when omitted.

```typescript
import { AgoraClient, Area, Agent, OpenAIRealtime, type LlmTool, type McpServer } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const lookupOrder: LlmTool = {
  type: 'function',
  function: {
    name: 'lookup_order',
    description: 'Look up an order by ID.',
    parameters: {
      type: 'object',
      properties: { orderId: { type: 'string' } },
      required: ['orderId'],
    },
  },
  server: {
    method: 'GET',
    url: 'https://api.example.com/orders/{{args.orderId}}',
    headers: { Authorization: 'Bearer {{template_variables.order_token}}' },
  },
};

const supportMcp: McpServer = {
  name: 'support',
  endpoint: 'https://api.example.com/mcp',
  headers: { Authorization: 'Bearer your-mcp-token' },
  allowed_tools: ['search_knowledge_base'],
  timeout_ms: 10000,
};

const agent = new Agent({ client })
  .withMllm(new OpenAIRealtime({
    apiKey: 'your-openai-key',
    model: 'gpt-4o-realtime-preview',
    tools: [lookupOrder],
    mcpServers: [supportMcp],
  }))
  .withTools();
```

The same `tools` and `mcpServers` options can be passed unchanged to `QwenOmni` for an Alibaba Cloud CN MLLM session. For the cascading Alibaba Cloud flow, `AliyunLLM` accepts the same options and emits them under top-level `llm`. Template placeholders are evaluated by the service. Inline tool headers allow `{{template_variables.<name>}}` and `{{tool_call_id}}`, but not `{{args.*}}`.

## Turn detection in MLLM mode

Configure MLLM turn detection on the MLLM vendor with `turnDetection`. When set, `mllm.turn_detection` overrides the top-level `turn_detection` object.

Example:

```typescript
import { AgoraClient, Area, Agent, OpenAIRealtime } from 'agora-agents';

const client = new AgoraClient({
  area: Area.US,
  appId: 'your-app-id',
  appCertificate: 'your-app-certificate',
});

const agent = new Agent({ client })
  .withMllm(new OpenAIRealtime({
    apiKey: 'your-openai-key',
    model: 'gpt-4o-realtime-preview',
    greetingMessage: 'Hi!',
    turnDetection: {
      mode: 'server_vad',
      server_vad_config: {
        idle_timeout_ms: 5000,
      },
    },
  }));
```

## How MLLM mode works internally

When MLLM mode is active (set automatically by `withMllm()`), the SDK:

1. Sends the `mllm` configuration in the request body
2. Omits `llm`, `tts`, and `asr` fields (the backend ignores them in MLLM mode)
3. The multimodal model processes audio input directly and generates audio output

You do not need to call `withLlm()`, `withTts()`, or `withStt()` — doing so has no effect when MLLM is enabled.

## Next steps

- [Cascading Flow](./cascading-flow.md) — if you need separate STT, LLM, and TTS vendors
- [Vendors](../concepts/vendors.md) — full MLLM vendor options
