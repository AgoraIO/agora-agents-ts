---
sidebar_position: 1
title: Overview
description: The Agora Conversational AI TypeScript SDK — install, concepts, and examples.
---

# Agora Conversational AI TypeScript SDK

The `agora-agents` package lets you build real-time voice AI agents on the [Agora Conversational AI](https://docs.agora.io/en/conversational-ai/overview) platform.

## Two conversation flows

**Cascading flow** uses ASR -> LLM -> TTS and supports the broadest set of vendor combinations.

**MLLM flow** uses a multimodal model such as OpenAI Realtime, Azure OpenAI Realtime, Gemini Live, Vertex AI, xAI Grok, or Qwen Omni for end-to-end audio.

## Start here

- Start with [Quick Start](./getting-started/quick-start.md). It shows the baseline app-credentials setup and starts a cascading ASR -> LLM -> TTS agent.
- Use [MLLM Flow Guide](./guides/mllm-flow.md) when your agent uses one realtime multimodal model, including global providers and Chinese mainland Qwen Omni.
- Use [Cascading Flow Guide](./guides/cascading-flow.md) for more examples of the default ASR -> LLM -> TTS flow, including provider-specific configuration.

## How the SDK is organized

| Layer | What it does | When to use |
|---|---|---|
| **AgentKit** (`Agent`, `AgentSession`, vendor classes) | High-level builder pattern, lifecycle, typed vendors | Most use cases |
| **Generated REST clients** (`client.agents`, `client.telephony`) | Typed access to REST APIs not covered by AgentKit | Advanced use cases |

## Install

```sh
npm install agora-agents
```

## Documentation

| Section | What you will find |
|---|---|
| [Installation](./getting-started/installation.md) | Prerequisites, package managers, runtime compatibility |
| [Authentication](./getting-started/authentication.md) | App credentials and other auth modes |
| [Quick Start](./getting-started/quick-start.md) | App credentials and AgentKit |
| [BYOK](./guides/byok.md) | Bring your own vendor credentials and config |
| [Architecture](./concepts/architecture.md) | SDK structure and generated REST clients |
| [Agent](./concepts/agent.md) | Builder pattern, immutable reuse, vendor configuration |
| [AgentSession](./concepts/session.md) | State machine, lifecycle methods, events |
| [Vendors](./concepts/vendors.md) | LLM, TTS, STT, MLLM, and Avatar provider catalog |
| [Cascading Flow Guide](./guides/cascading-flow.md) | Step-by-step ASR -> LLM -> TTS |
| [MLLM Flow Guide](./guides/mllm-flow.md) | Global MLLM providers and Chinese mainland Qwen Omni |
| [Avatar Integration](./guides/avatars.md) | LiveAvatar, Generic Avatar, Anam, Akool, SenseTime (CN), and HeyGen integration |
| [Agent Builder Features](./guides/agent-builder-features.md) | Turn detection, SAL, filler words, and advanced agent options |
| [Regional Routing](./guides/regional-routing.md) | Area enum, domain pool, failover |
| [Error Handling](./guides/error-handling.md) | AgoraError and API error handling |
| [Error Reference](./reference/errors.md) | v2.7 status codes and error reason values |
| [Pagination](./guides/pagination.md) | Iterate over paginated list endpoints |
| [Advanced](./guides/advanced.md) | Headers, retries, timeouts, logging, custom fetcher |
| [Low-Level API](./guides/low-level-api.md) | Generated REST APIs |
| [AgoraClient Reference](./reference/client.md) | Constructor options, public methods |
| [Agent Reference](./reference/agent.md) | Full builder API with TypeScript signatures |
| [AgentSession Reference](./reference/session.md) | All methods, events, and payload types |
| [Vendor Reference](./reference/vendors.md) | Constructor options for every vendor class |

For generated REST API types, see the [API Reference](../../reference.md).
