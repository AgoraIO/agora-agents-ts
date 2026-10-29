---
sidebar_position: 1
title: AgoraClient
description: AgoraClient constructor options and public methods.
---

# AgoraClient

`AgoraClient` extends the Fern-generated base client with domain pool support for regional URL cycling and three authentication modes.

Pass `appId` and `appCertificate` only for the recommended app-credentials mode. The SDK mints fresh REST tokens per request and generates RTC join tokens at session start.

`area` selects both the API routing region and the default cascading-pipeline ASR vendor used when an `Agent` omits `.withStt()` (`Area.CN` → `fengming`, all other areas → `ares`).

<!-- snippet: fragment -->
```typescript
import { AgoraClient, Area } from 'agora-agents';
```

## Constructor

<!-- snippet: fragment -->
```typescript
const client = new AgoraClient<TArea>(options: AgoraClient.Options<TArea>);
```

### Options

| Option | Type | Required | Description |
|---|---|---|---|
| `area` | `AgoraArea` | Yes | Region for API routing (`Area.US`, `Area.EU`, `Area.AP`, `Area.CN`) |
| `appId` | `string` | Yes | Agora App ID |
| `appCertificate` | `string` | For generated REST tokens | Optional with Basic or `authToken`; enables automatic RTC signing |
| `authToken` | `string` | No | Raw Agora token; the SDK adds `agora token=` |
| `customerId`, `customerSecret` | `string` | Together for Basic | Customer credentials; mutually exclusive with `authToken` |
| `timeoutInSeconds` | `number` | No | Request timeout in seconds |
| `maxRetries` | `number` | No | Max retry attempts (default from Fern config) |
| `logging` | `LogConfig \| Logger` | No | SDK logger configuration |
| `v3` | `V3Options` | No | Optional public origin/custom headers; see the [v3 reference](./v3.md) |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

Authentication mode is determined by which options you provide:

| Options provided | Resolved mode |
|---|---|
| `authToken` | `"token"` |
| `customerId` + `customerSecret` | `"basic"` |
| `appCertificate` without either above | `"app-credentials"` |

See [Authentication](../getting-started/authentication.md) for details on each mode.

## Public properties

| Property | Type | Description |
|---|---|---|
| `appId` | `string` (readonly) | The Agora App ID |
| `appCertificate` | `string \| undefined` (readonly) | The Agora App Certificate |
| `authMode` | `AgoraAuthMode` (readonly) | `"basic"`, `"token"`, or `"app-credentials"` |
| `area` | `TArea` (readonly) | The configured routing area |
| `pool` | `Pool` (readonly) | The domain pool instance |

## Public methods

### `stopAgent(agentId: string): Promise<void>`

Stop a running agent by ID without holding an `AgentSession` reference. Uses the same credentials as this client. Returns successfully if the agent has already stopped (404 is treated as success). When `authMode` is `"app-credentials"`, the SDK mints a short-lived REST token for the stop request.

### `nextRegion(): void`

Cycle to the next region prefix in the pool. Call this after a request failure to try a different regional endpoint.

### `selectBestDomain(signal?: AbortSignal): Promise<void>`

Trigger a manual DNS resolution check to select the best domain suffix. This runs automatically every 30 seconds, but you can call it manually.

### `getCurrentURL(): string`

Returns the full URL currently being used for API requests (e.g., `https://api-us-west-1.agora.io/api/conversational-ai-agent`).

## Sub-clients

The client exposes Fern-generated sub-clients for direct API access:

| Property | Description |
|---|---|
| `client.agents` | Start, stop, update, speak, interrupt, get history, list agents |
| `client.telephony` | Telephony-related endpoints |
| `client.phoneNumbers` | Phone number management |

See the [API Reference](../../reference.md) for the full sub-client method signatures.

## Project provisioning (preview)

`client.campaigns` exposes campaign CRUD and pause/resume/cancel operations. `client.secrets` manages project secret sets and keys. `client.numbers` registers, lists, retrieves, updates, and deletes project numbers. These accessors share the exact underlying instances, transport, and auth of `client.v3.secrets` and `client.v3.numbers`; existing `client.agents` and `client.phoneNumbers` keep their meanings. See [Saving agents](../guides/saved-agents.md) and [operation signatures](./v3.md).
