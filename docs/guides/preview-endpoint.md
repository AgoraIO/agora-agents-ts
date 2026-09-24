---
sidebar_position: 10
title: Preview Endpoint
description: Gemini TTS preview routing and production migration compatibility.
---

# Preview Endpoint

Gemini TTS uses the preview gateway with `agora-feature: gemini-live`.

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

## Gemini 3.8 Flash TTS preview

`GeminiTTS` emits `tts.vendor = "gemini"` with `api_key`, `model`, `voice`,
and optional `style` inside `tts.params`. It defaults to `gemini-3.8-flash-tts`
and `Puck`. Model names are sent unchanged; there is no automatic fallback
or model rewriting.
Model strings remain open for preview rollout changes. Blank keys are rejected.

AgentSession detects the TTS vendor from the resolved request body, including
handwritten configs, and uses the existing preview host with
`agora-feature: gemini-live` throughout the session lifecycle. Use the retained
session for stop/say/interrupt; the shared client remains on its normal route.
Gemini ASR alone still uses the production route. No sample-rate or avatar
compatibility is assumed by this preview provider.

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
