---
sidebar_position: 10
title: Preview Endpoint
description: Production migration compatibility and retained preview routing helpers.
---

# Preview Endpoint

Gemini TTS, Gemini 3.8 MLLMs, OpenAI GPT Live, and Gemini STT are served by the production Conversational AI gateway.
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

Historical `agentkit/preview` imports for Gemini model constants and types, `GeminiSTT`, `GeminiSTTModels`,
`GeminiTTS`, `GeminiTTSModels`, and `OpenAIGPTLive` remain available as aliases to production implementations.
The `agentkit/preview/gemini-tts` module re-exports the production TTS class, model constants, and config/options types. The old
`GEMINI_PREVIEW_MLLM_URL` constant remains as an alias to `GEMINI_MLLM_URL`. These exports do not enable preview
routing. A hand-written Gemini 3.8 config using the old `mllm.greeting` field is normalized to
`mllm.greeting_message` before the production request is sent.

## Adding a preview provider

Preview detection uses the fully resolved request body, so hand-written configurations follow the same route as
vendor class instances. Add the vendor detection, feature constant, routing tests, and resolved request-body tests
together. Generated request types describe the GA API; historical preview imports
remain as aliases after a provider is promoted.

## Gemini 3.8 Flash TTS production migration

`GeminiTTS` emits `tts.vendor = "gemini"` with `api_key`, `model`, `voice`,
and optional `style` inside `tts.params`. It defaults to `gemini-3.8-flash-tts`
and `Puck`. Model names are sent unchanged; there is no automatic fallback or
model rewriting.
Model strings remain open for future model IDs. Blank keys are rejected.

Existing v2.11.0 calls now use the client's configured regional production
endpoint throughout the session lifecycle. Handwritten Gemini TTS configs follow
the same route, and no preview feature header is added. `GeminiTTS`, its model
constants, options, and config types now live in `agentkit/vendors/tts`; package-root
and preview imports remain compatible. `additionalParams` is merged into
`tts.params`, with named options taking precedence. `skipPatterns` maps to the generated
top-level `tts.skip_patterns` field. The provider does not expose a configurable sample rate.

```typescript
import { GeminiTTS, GeminiTTSModels } from "agora-agents";

agent.withTts(new GeminiTTS({
  apiKey: process.env.GOOGLE_API_KEY!,
  model: GeminiTTSModels.Flash38,
  voice: "Puck",
  style: "warm and reassuring",
}));
```

Greeting audio for `gemini-3.8-flash-tts` was verified in the Next.js, Python,
and Go demos on 2026-09-22. A successful start response alone does not
establish that synthesis works; verify audio delivery when testing.
