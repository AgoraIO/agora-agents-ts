---
sidebar_position: 1
title: Installation
description: Install the Agora Conversational AI TypeScript SDK.
---

# Installation

## Prerequisites

- **Node.js 18 or later** — the SDK uses modern APIs (`fetch`, `AbortSignal`, `crypto`) that require Node 18+.
- A package manager: npm, pnpm, or yarn.

## Install

```sh
npm install agora-agents@3.0.0-alpha.1
```

```sh
pnpm add agora-agents@3.0.0-alpha.1
```

```sh
yarn add agora-agents@3.0.0-alpha.1
```

## Runtime compatibility

| Runtime | Minimum version | Notes |
|---|---|---|
| Node.js | 18+ | Primary target |
| Vercel | Supported | Serverless and Edge Functions |
| Cloudflare Workers | Supported | Workers runtime |
| Deno | 1.25+ | Via npm compatibility layer |
| Bun | 1.0+ | Native Node compatibility |
| React Native | Supported | Via polyfills if needed |

## Server-side only

This SDK is designed for server-side use. Do not use it in a browser or expose it client-side — your App Certificate must never be sent to the client. If you need a client-side integration, use the [Agora RTC SDK](https://docs.agora.io/en/video-calling/overview) for the media layer and call your own backend to manage agents.

## Imports

```typescript
import { Agent, AgoraClient, Area, DeepgramSTT, OpenAI } from 'agora-agents';
```

The package installs as `agora-agents`.

## Next steps

- [Authentication](./authentication.md) — configure your credentials
- [Quick Start](./quick-start.md) — build your first conversational agent

## Migrating from a previous package name

The npm package was renamed from `agora-agent-server-sdk` to `agora-agents` in v2.0.0. Update `package.json` and change imports to `agora-agents`; the public API is unchanged.

The legacy npm name remains available as a compatibility shim that re-exports `agora-agents`. See [compat/agora-agent-server-sdk](../../compat/agora-agent-server-sdk/README.md).

For release and version details, see [changelog — Migration notes](../../changelog.md#migration-notes).

## Imports

```typescript
import { Agent, AgoraClient, Area, DeepgramSTT, OpenAI } from 'agora-agents';
```

The package installs as `agora-agents`.

## Next steps

- [Authentication](./authentication.md) — configure your credentials
- [Quick Start](./quick-start.md) — build your first conversational agent

## Migrating from a previous package name

The npm package was renamed from `agora-agent-server-sdk` to `agora-agents` in v2.0.0. Update `package.json` and change imports to `agora-agents`; the public API is unchanged.

The legacy npm name remains available as a compatibility shim that re-exports `agora-agents`. See [compat/agora-agent-server-sdk](../../compat/agora-agent-server-sdk/README.md).

For release and version details, see [changelog — Migration notes](../../changelog.md#migration-notes).
