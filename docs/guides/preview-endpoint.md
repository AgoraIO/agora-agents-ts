---
sidebar_position: 10
title: Preview Endpoint
description: Legacy preview routing exports and production migration compatibility.
---

# Preview Endpoint

Gemini 3.8 MLLMs, OpenAI GPT Live, and Gemini STT are served by the production Conversational AI gateway.
Existing integrations require no routing changes: `AgentSession` sends them through the client's configured
regional endpoint without a preview feature header.

```typescript
import { Agent, GeminiLive, GeminiLiveModels } from "agora-agents";

const session = new Agent({ client })
    .withMllm(
        new GeminiLive({
            apiKey: process.env.GOOGLE_API_KEY!,
            model: GeminiLiveModels.Live38ExtendedThinking,
            thinkingLevel: "medium",
        }),
    )
    .createSession({ channel: "demo", agentUid: "1", remoteUids: ["100"] });

const agentId = await session.start();
```

The low-latency `models/gemini-3.8-live` model is the default. `thinkingLevel` is sent only for
`models/gemini-3.8-live-extended-thinking`. Gemini sessions keep the Google credential at top-level
`mllm.api_key`, never at `mllm.params.api_key`, and use the production `mllm.greeting_message` field.

## Compatibility

Historical `agentkit/preview` imports for Gemini model constants and types, `GeminiSTT`, `GeminiSTTModels`, and
`OpenAIGPTLive` remain available as aliases to production implementations. The old
`GEMINI_PREVIEW_MLLM_URL` constant remains as an alias to `GEMINI_MLLM_URL`. These exports do not enable preview
routing. A hand-written Gemini 3.8 config using the old `mllm.greeting` field is normalized to
`mllm.greeting_message` before the production request is sent.

## Adding a preview provider

Preview detection uses the fully resolved request body, so hand-written configurations follow the same route as
vendor class instances. Add the vendor detection, feature constant, routing tests, and resolved request-body tests
together. Generated request types must continue to describe the GA API, while preview-only types remain under
`agentkit/preview` until the provider is promoted.
