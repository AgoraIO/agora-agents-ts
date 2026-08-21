# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added

- **Preview endpoint support** — `AgoraPreviewClient` routes every request to the preview gateway and pins the `agora-feature` gate header, which is merged after caller-supplied `headers` so it cannot be dropped or blanked. A request that loses it is not rejected; it routes to the production environment, where the preview providers do not exist.
- **Gemini preview MLLMs** — `GeminiWalkieTalkie` (`walkie-talkie`) and `GeminiCleverChatter` (`clever-chatter`), served only by the preview gateway. `thinkingLevel` is exclusive to clever-chatter, so it is a separate class rather than an ignored option on the other.
- **Preview MLLM rename constants** — `GeminiPreviewMllmModels.Live35` (`gemini-3.5-live`) and `.Live35Thinking` (`gemini-3.5-live-thinking`) are the post-rename IDs for walkie-talkie and clever-chatter. Both spellings are accepted by `requiredPreviewFeatures`, so the guard works throughout Google's rollout. The vendor classes still send the codenames — see `GEMINI_PREVIEW_MLLM_DEFAULTS`.
- **Preview support guard** — `assertPreviewSupport` throws before any request when preview providers are paired with a plain `AgoraClient`. It reads the resolved request body, so hand-written configs are covered.
- **Debug redaction** — `redactSecrets` and `redactHeadersForDebug` replace vendor API keys, RTC tokens, and the App ID with `[REDACTED]` in `debug: true` output. Empty strings stay visible so an unset environment variable remains diagnosable. Neither mutates its input.
- **Preview MLLM language** — `languageCodes` serializes to `params.language_codes`, omitted when unset. The preview MLLMs never send the singular `params.language`: that field belongs to xAI Grok in the Agora schema, and the production Gemini Live provider sends no language field at all.
- **Preview MLLM greeting** — the option is `greeting` (not `greetingMessage`) and serializes to `greeting`, the spelling the new Gemini preview models read. An agent-level `greeting` also works — the builder writes it as `mllm.greeting_message` and `applyPreviewShape` retargets it.
- **Preview wire-shape translation** — `applyPreviewShape` runs at session start and retargets MLLM fields the shared builder wrote with production spellings, so an agent-level `greeting` reaches the preview models as `greeting` rather than the `greeting_message` they ignore. A hand-written `greeting_message` migrates too, so an existing config keeps working after only swapping the model. `failure_message` is left alone as an Agora engine field, and production MLLMs are untouched.

### Fixed

- **Malformed credentials no longer produce an empty token** — `agora-token` returns `""` rather than throwing when `appId` or `appCertificate` is not exactly 32 characters, so a value with a trailing newline or a truncated paste was sent as `token: ""` and failed at the gateway with an error naming neither field. The token builders now throw locally and say which field is the wrong length. Credential values are never included in the message.
- **An unrecognised MLLM model no longer silently skips the wire-shape translation** — preview detection matched only the four known model names, so overriding `model` to a rename this SDK had not shipped yet turned off `applyPreviewShape` with no error: the greeting stayed in `greeting_message`, which these models ignore, and the agent never greeted. A config is now also recognised by its envelope (`params.api_key` set and `url` on the Gemini Developer API host), which the production `GeminiLive` vendor does not emit.

### Documentation

- Added [Preview Endpoint](docs/guides/preview-endpoint.md), covering the gate header, intake-node failure signatures, and how to add a future preview family.
- Documented every field `Agent.toProperties` injects into a vendor config, and why a preview provider must be verified against the resolved request body rather than the vendor class output — a value written under a spelling the route ignores fails silently.
- Documented the two signals that mark a config as preview, and why matching on the model name alone was a silent failure.

## [v2.2.0] — 2026-06-05

### Added

- **Expanded provider surface** — Added generated API support for the latest Conversational AI vendors and configuration types, including Dify LLM and Generic Avatar.
- **Interaction language handling** — AgentKit now consistently derives REST `asr.language` from `turnDetection.language` while keeping provider-specific STT language values under `asr.params`.
- **Deepgram keyterm** — Added `keyterm` support on `DeepgramSTT`, serialized as `asr.params.keyterm`.

### Changed

- **MiniMax managed presets** — MiniMax preset-backed TTS now keeps the preset model as an internal hint while sending only supported partial TTS settings such as `voice_setting.voice_id`.
- **Vertex AI LLM routing** — `VertexAILLM` now keeps project and location in the generated endpoint URL instead of duplicating them in `llm.params`.

### Fixed

- **Provider wire keys** — Corrected alias-sensitive TTS payloads so Google TTS emits `VoiceSelectionParams` and `AudioConfig`, Rime TTS emits `modelId`, and Murf TTS preserves `voiceId`.
- **AgentKit request validation** — Start request validation preserves generated wire keys while still allowing preset and pipeline-backed partial configs.
- **Request body coverage** — Added regression tests for BYOK, preset-backed, mixed preset/BYOK, and pipeline override request shapes across provider configurations.
- **TTS vendor tests** — Removed duplicate TTS vendor assertions and added Microsoft TTS coverage to the vendor helper test matrix.

## [v2.1.0] — 2026-06-02

### Added

- **Turn detection language** — AgentKit now manages Agora interaction language through `turnDetection.language`, validates it against the supported BCP-47 language list, and sends the default `en-US` when no language is provided.
- **Provider parameter parity** — ASR, LLM, MLLM, TTS, and avatar wrappers expose typed provider parameters plus passthrough fields where the generated core supports additional properties.

### Changed

- **Generated core refresh** — Regenerated core types from the v2.1 API schema.
- **Deepgram TTS passthrough** — `DeepgramTTS` now uses `additionalParams` for passthrough fields and flattens them into `tts.params`; the removed nested `params.params` shape is no longer documented or emitted.
- **OpenAI TTS** — Docs and tests now reflect the generated core shape, including `instructions` and `speed` under `tts.params`.
- **TTS provider docs** — Updated TTS provider reference tables to match implemented wrapper fields and generated core params.

### Fixed

- **Managed-provider validation** — AgentKit validation now distinguishes preset-backed providers from BYOK providers so required provider fields are only required when credentials are caller-supplied.
- **Language placement** — Provider-specific STT language values remain under `asr.params`; the REST `asr.language` field is populated from `turn_detection.language`.

## [v2.0.0] — 2026-05-21

### Added

- **Type aliases** — `AsrConfig` (= `SttConfig`), think value constants (`ThinkOnListeningActionInject`, etc.).
- **Agent-level greeting configs** — `Agent.withGreetingConfigs()` maps directly to `llm.greeting_configs`, including v2.7 `interruptable`.
- **v2.7 value constants** — Exported discoverable constants for Think actions, interruption modes, speak priorities, and MLLM turn detection modes.
- **`XaiGrok`** — New MLLM vendor wrapper for xAI Grok Realtime API (`vendor: "xai"`), including voice, language, sample rate, modalities, messages, greeting/failure, and MLLM turn detection support.
- **`GenericAvatar`** — New generic avatar provider wrapper with typed options for `apiKey`, `apiBaseUrl`, `avatarId`, and `agoraUid`.
- **Avatar token automation** — AgentKit now fills generic avatar `agora_appid` / `agora_channel` from the session and auto-generates `avatar.params.agora_token` for vendors that publish a separate RTC video identity (`HeyGenAvatar`, `LiveAvatarAvatar`, `GenericAvatar`) when `agoraToken` is omitted. Avatar tokens use the same ConvoAI token format as agent tokens, scoped to the avatar `agora_uid`. `AkoolAvatar` and `AnamAvatar` never receive an auto-generated token (matching the Go and Python SDKs).
- **`isAvatarTokenManaged()`** — Type guard exported from AgentKit that returns `true` when AgentKit manages the avatar's RTC publisher identity.
- **`AgentSession.getTurns(options)` and `AgentSession.getAllTurns()`** — High-level support for paginated turn analytics.
- **`AudioScenario` constants and `Agent.withAudioScenario()`** — Discoverable AgentKit API for `parameters.audio_scenario`.
- **Parity coverage** — Added AgentKit regression tests covering v2.5-v2.7 behavior, including presets, MLLM shapes, avatar enrichment, paginated turns, interruption, tools, and pause-state detection.

### Changed

- **ConvoAI token options** — `generateConvoAIToken()` now accepts an integer `uid` and handles the internal token string conversion for users, agents, and avatars.
- **Avatar token generation** — Removed the dedicated `generateAvatarRtcToken()` wrapper; avatar RTC tokens use the existing ConvoAI token helper.
- **`AgentSession.think()` typing** — `ThinkOptions.on_listening_action` now includes `"interrupt"` to match the v2.7 API. The server default changed from `"inject"` to `"interrupt"`; pass `"inject"` explicitly to preserve prior behavior.
- **MLLM + avatar guard** — `Agent.toProperties()` and `AgentSession.start()` now throw a clear error when an MLLM vendor is combined with an enabled avatar. Avatars currently require the cascading ASR + LLM + TTS pipeline; the guard prevents an opaque backend failure (matches Go and Python SDKs).
- **MLLM message shape** — `GeminiLive` and `VertexAI` now emit `messages` at the top level of `mllm`, matching the generated v2.7 core type.
- **MLLM core parity** — AgentKit no longer exposes or emits non-core `mllm.max_history` or `mllm.predefined_tools` fields. Use supported top-level MLLM fields from the generated TypeScript core SDK.
- **Session warning logger typing** — `SessionOptions.warn` is now part of the public type, matching the existing runtime behavior.
- **Generic avatar validation** — `validateAvatarConfig()` now accepts pre-start Generic avatar configs where session-derived fields are intentionally omitted. Post-enrichment validation still requires `agora_appid`, `agora_channel`, and `agora_token`.
- **Docs refreshed for v2.7** — Vendor, avatar, session, pagination, and error-handling docs now cover xAI Grok, Generic Avatar, avatar token automation, paginated turns, and updated error `reason` values.
- **npm distribution rename** — The published package name is now `agora-agents` (formerly `agora-agent-server-sdk`). The public API is unchanged; update your install and import path to `agora-agents`.

### Fixed

- **ESM release output** — Includes the v1.4.1 packaging hotfix: multiline relative exports are rewritten from `.js` to `.mjs`, `dist/esm` is verified during `build:esm`, and build helper scripts are protected from Fern regeneration.

### Deprecated

- **`HeyGenAvatar`** — Use `LiveAvatarAvatar` (`vendor: "liveavatar"`). The legacy wrapper remains available for backward compatibility and emits `@deprecated` JSDoc.

### Migration notes

- **npm package rename** — Install `agora-agents` instead of `agora-agent-server-sdk` (`npm install agora-agents`, `pnpm add agora-agents`, or `yarn add agora-agents`). The legacy npm package name remains available as a compatibility shim that re-exports the public API from `agora-agents`.

## [v1.4.1] — 2026-05-21

### Fixed

- **ESM release output** — Multiline relative exports are now rewritten from `.js` to `.mjs`, and the ESM build fails if relative `.js` imports remain in `dist/esm`.

## [v1.4.0] — 2026-05-13

### Added

- **`DeepgramTTS`** — New TTS vendor wrapper for Deepgram (Beta). Accepts `apiKey`, `model`, `baseUrl`, `sampleRate`, `additionalParams`, and `skipPatterns`.
- **`Agent.withTools(enabled = true)`** — Dedicated builder method to enable MCP tool invocation (`advancedFeatures.enable_tools`). Replaces the raw `.withAdvancedFeatures({ enable_tools: true })` call.
- **LLM vendors: `headers` option** — All four LLM vendors (`OpenAI`, `AzureOpenAI`, `Anthropic`, `Gemini`) now accept an optional `headers: Record<string, string>` option. Use this to pass custom HTTP headers to the LLM provider.
- **`AgentSession.think()`** — Send a custom instruction to a running agent through the `agentManagement` API.
- **`Agent.withInterruption()`** — Configure the new top-level `interruption` object for unified interruption control.
- **MLLM turn detection** — `OpenAIRealtime`, `GeminiLive`, and `VertexAI` now accept `turnDetection`, which maps to `mllm.turn_detection` and overrides top-level turn detection for MLLM sessions.
- **`audioScenario` AgentKit support** — Session params and AgentKit request construction now expose the top-level `parameters.audio_scenario` field.

### Fixed

- **MiniMax TTS preset stripping** — When a MiniMax reseller preset is inferred (`minimax_speech_2_6_turbo` or `minimax_speech_2_8_turbo`), the `group_id` and `url` fields are now correctly stripped from `tts.params` alongside `key` and `model`. Previously they were forwarded to the API, causing request failures.
- **MLLM enable flag** — `Agent.withMllm()` now sets `mllm.enable = true` and removes the deprecated `advancedFeatures.enable_mllm` flag from generated requests.
- **MLLM wrapper shape** — MLLM vendors no longer emit removed fields such as `style`; docs and tests now reflect the v2.6 MLLM contract.
- **Preset-backed OpenAI TTS** — `OpenAITTS` no longer requires `apiKey` when a reseller preset supplies credentials server-side.
- **AgentKit parity coverage** — Added regression coverage for interruption, MLLM turn detection, Deepgram TTS, LLM headers, and deprecated MLLM flag cleanup.

## [v1.3.2] — 2026-04-10

### Fixed

- **`GeminiLive` and `VertexAI` were missing the `url` parameter.** The optional WebSocket URL override supported by `OpenAIRealtime` was not exposed on the other two MLLM vendors, making it impossible to point them at a custom endpoint. Both constructors now accept an optional `url` field that is passed through to the API request.

- **`withMllm()` is now self-contained.** Previously, calling `agent.withMllm(vendor)` still required a separate `.withAdvancedFeatures({ enable_mllm: true })` call to bypass the STT/LLM/TTS required-field guards. Omitting it produced a misleading `"TTS configuration is required"` error. `withMllm()` now automatically sets `enable_mllm: true` — no extra configuration needed.

## [v1.3.1] — 2026-04-06

### Fixed

- ESM release output now rewrites multiline re-exports/imports correctly during `.js` -> `.mjs` conversion, including the top-level AgentKit re-export path.
- Added `scripts/verify-esm-imports.js` and wired it into `build:esm` to fail builds when `dist/esm/**/*.mjs` contains broken relative `.js` specifiers that should resolve to `.mjs`.
- ESM token generation path now imports `agora-token` through CJS interop (`default` import) instead of fragile named ESM imports, preventing runtime import failures in strict ESM environments.
- Build now clears `dist/cjs` and `dist/esm` before compilation to avoid stale artifacts being published, and build configs exclude `src/**/__tests__/**`.
- Packaging no longer references a non-existent `LICENSE` file.

## [v1.3.0] — 2026-04-02

### Added

- `AgentSession.getTurns()` for high-level turn analytics access without dropping to `session.raw`.
- Session-level `preset` and `pipelineId` support with automatic reseller preset inference for supported Deepgram, OpenAI, and MiniMax models.
- AgentKit preset constants for discoverable session preset composition.

### Changed

- `AgentSession.start()` now normalizes preset input and resolves inferred presets before sending the request to the low-level SDK.
- AgentKit MLLM wrappers now mirror the generated low-level MLLM contract and no longer expose unsupported wrapper-only fields.
- AgentKit TTS wrappers now mirror the generated low-level TTS contract and no longer expose unsupported wrapper-only fields.
- README and vendor reference docs now describe the low-level SDK as a 1:1 match for the Agora REST API and link to the current CI and coverage badges.

### Fixed

- Preset stripping now uses a single structured inference pass instead of re-deriving presets inside the transform step.
- OpenAI, Deepgram, and MiniMax preset-backed session paths now preserve BYOK behavior while inferring reseller presets only when credentials are omitted.

## [v1.2.0] — 2026-03-27

### Fixed

- **`AresSTT`** — Removed redundant `language` key from the `params` dict. Ares only selects the provider; AgentKit populates REST `asr.language` from `turnDetection.language`. `params` is only included when `additionalParams` is provided.
- **`OpenAIRealtime` / `VertexAI` (MLLM)** — Agent-level `greeting` and `failureMessage` overrides are now correctly applied when the agent is in MLLM mode. Previously these values were silently dropped.
- **`VertexAI` (MLLM)** — Message handling was updated for the MLLM wrapper. As of v2.0.0, `messages` is emitted at top-level `mllm.messages` to match the generated v2.7 core type.

### Changed

- **`OpenAITTS`** — Renamed constructor option `key` → `apiKey` to match the Agora server API expectation. ⚠️ **Breaking change.**
- **`CartesiaTTS`** — Renamed constructor option `key` → `apiKey`. Voice is now serialized as `{"mode": "id", "id": "<voiceId>"}` instead of a flat `voice_id` string. ⚠️ **Breaking change.**
- **`HeyGenAvatar`** — Removed legacy options `avatarName`, `voiceId`, `language`, `version`. Added `agoraToken`, `avatarId`, `enable`, `disableIdleTimeout`, `activityIdleTimeout`. The config now includes a top-level `enable` field (defaults `true`). ⚠️ **Breaking change.**

### Added

- **`OpenAITTS`** — New optional parameters: `instructions` (string) and `speed` (number).
- **`CartesiaTTS`** — `voiceId` user-facing option is preserved; voice is serialized to the required nested object format automatically.
- **`RimeTTS`** — New optional parameters: `lang` (string), `samplingRate` (number, serialized as `samplingRate`), `speedAlpha` (number, serialized as `speedAlpha`).
- **`OpenAIRealtime`** — New optional parameter: `failureMessage` (string).
- **`VertexAI` (MLLM)** — New optional parameter: `failureMessage` (string).
- **`HeyGenAvatar`** — New options: `agoraToken` (string), `avatarId` (string), `enable` (boolean, default `true`), `disableIdleTimeout` (boolean), `activityIdleTimeout` (number).

## [v1.1.0] — 2026-03-17

### Fixed

- `ElevenLabsTTS`: added missing voice tuning params — `optimizeStreamingLatency`, `stability`, `similarityBoost`, `style`, `useSpeakerBoost`
- `Gemini` LLM: `toConfig()` now serializes `temperature`, `topP`, `topK`, and `maxOutputTokens` (fields existed on the interface but were silently dropped)
- `AzureOpenAI` LLM: corrected default `apiVersion` from `2023-05-15` to `2024-08-01-preview`
- `SpeechmaticsSTT`, `SarvamSTT`: added optional `model` field

## [v1.0.0] — 2026-03-11

Initial stable release of the Agora Conversational AI TypeScript SDK.

### Added

- `Agent` builder with fluent API (`.withLlm()`, `.withTts()`, `.withStt()`, `.withMllm()`, `.withAvatar()`)
- `AgentSession` for session lifecycle management (`start()`, `stop()`)
- Automatic token generation — pass `appId` + `appCertificate` and tokens are handled internally
- Token utilities: `generateRtcToken`, `generateConvoAIToken`, `ExpiresIn.hours()`, `ExpiresIn.minutes()`
- Turn detection configuration via `TurnDetectionConfig` with nested `StartOfSpeechConfig` and `EndOfSpeechConfig`
- SAL (Selective Attention Locking) via `SalConfig` with `SalMode`
- Filler words support: `FillerWordsConfig`, `FillerWordsTrigger`, `FillerWordsContent`
- Session parameters: `SessionParams`, `SilenceConfig`, `FarewellConfig`, `ParametersDataChannel`
- Geofencing via `GeofenceConfig`
- Advanced features (MLLM mode) via `AdvancedFeatures`
- Type-safe constants: `DataChannel`, `SilenceActionValues`, `SalModeValues`, `Geofence`, `FillerWordsSelectionRule`, `TurnDetectionTypeValues`
- Vendor integrations:
  - **LLM**: `OpenAI`, `AzureOpenAI`, `Anthropic`, `Gemini`, `VertexAI`
  - **MLLM**: `OpenAIRealtime`
  - **TTS**: `ElevenLabsTTS`, `MicrosoftTTS`, `OpenAITTS`, `CartesiaTTS`, `GoogleTTS`, `AmazonTTS`, `HumeAITTS`, `RimeTTS`, `FishAudioTTS`, `MiniMaxTTS`, `SarvamTTS`
  - **STT**: `DeepgramSTT`, `MicrosoftSTT`, `OpenAISTT`, `GoogleSTT`, `AmazonSTT`, `AssemblyAISTT`, `AresSTT`, `SarvamSTT`, `SpeechmaticsSTT`
  - **Avatar**: `HeyGenAvatar`, `AkoolAvatar`
