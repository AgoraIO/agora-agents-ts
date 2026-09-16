---
sidebar_position: 10
title: Preview Endpoint
description: How AgentSession routes GPT Live and Gemini 3.8 MLLMs through the preview gateway.
---

# Preview Endpoint

OpenAI GPT Live and the Gemini 3.8 MLLMs are served by the preview Conversational AI
gateway. `AgentSession` detects them from the resolved request body and routes the full session automatically.
Gemini STT is available through the GA endpoint in v2.8.

```typescript
import { Agent, OpenAIGPTLive } from "agora-agents";

const session = new Agent({ client })
    .withMllm(
        new OpenAIGPTLive({
            apiKey: process.env.OPENAI_API_KEY!,
            prompt: "Be concise",
        }),
    )
    .createSession({ channel: "demo", agentUid: "1", remoteUids: ["100"] });

const agentId = await session.start();
```

GPT Live sessions use:

- Base URL: `https://partner.ai.agora.io/preview/api/conversational-ai-agent`
- Header: `agora-feature: live-models`

Use the single `GeminiLive({ apiKey, model })` class for either Gemini
voice model. Select `models/gemini-3.8-live` or
`models/gemini-3.8-live-extended-thinking`; the low-latency ID is the default.
Set `thinkingLevel: "medium"` for extended thinking. `GeminiLive` sends it
only for the extended-thinking ID. Gemini sessions send the
Google credential once as `mllm.api_key`, never as `mllm.params.api_key`.
They use `agora-feature: gemini-live`; GPT Live keeps its `live-models` gate.

The route is session-scoped. Every lifecycle request from the session uses the same preview route, while ordinary
client calls and Gemini STT sessions continue to use the configured GA regional endpoint. Caller headers cannot
remove the preview feature gate.

## Compatibility

The historical `agentkit/preview` imports for `GeminiSTT` and `GeminiSTTModels` remain available as aliases to the
GA implementation. New code may import them from the package root. These aliases do not enable preview routing.

## Adding a preview provider

Preview detection uses the fully resolved request body, so hand-written configurations follow the same route as
vendor class instances. Add the vendor detection, feature constant, routing tests, and resolved request-body tests
together. Generated request types must continue to describe the GA API, while preview-only types remain under
`agentkit/preview` until the provider is promoted.
