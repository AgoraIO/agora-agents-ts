---
sidebar_position: 10
title: Preview Endpoint
description: Legacy preview routing exports and production migration compatibility.
---

# Preview Endpoint

OpenAI GPT Live and Gemini STT are served by the production Conversational AI gateway. Existing GPT Live
integrations require no code changes: `AgentSession` sends them through the client's configured regional endpoint
without a preview feature header.

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

The constructor options and `mllm` request body are unchanged. Only the control-plane routing changed: every GPT
Live lifecycle request now uses the same production route as other GA sessions, and the SDK no longer adds
`agora-feature: live-models`.

## Compatibility

The historical `agentkit/preview` imports for `OpenAIGPTLive`, `GeminiSTT`, and `GeminiSTTModels` remain available.
Package-root imports also remain unchanged. These compatibility exports do not enable preview routing.

## Adding a preview provider

Preview detection uses the fully resolved request body, so hand-written configurations follow the same route as
vendor class instances. Add the vendor detection, feature constant, routing tests, and resolved request-body tests
together. Removing a provider's registration automatically migrates both helper-based and hand-written configs to
production without changing their request body.
