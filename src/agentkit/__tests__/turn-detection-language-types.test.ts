/**
 * Compile-time checks for `TurnDetectionConfig.language`.
 *
 * `pnpm typecheck` fails if a `@ts-expect-error` line below stops being an error.
 */

import type { TurnDetectionConfig } from "../types.js";

// ✅ One language, any EoS mode.
const _single: TurnDetectionConfig = { language: "ja-JP" };
const _singleVad: TurnDetectionConfig = { language: "ja-JP", config: { end_of_speech: { mode: "vad" } } };

// ✅ A language list with VAD, manual, or unset EoS mode.
const _list: TurnDetectionConfig = { language: ["en-US", "es-ES"] };
const _listVad: TurnDetectionConfig = {
    language: ["en-US", "hi-IN"],
    config: { end_of_speech: { mode: "vad", vad_config: { silence_duration_ms: 640 } } },
};

// ✅ Semantic EoS with one English or Chinese language, or the en-US default.
const _semanticEn: TurnDetectionConfig = { language: "en-US", config: { end_of_speech: { mode: "semantic" } } };
const _semanticZh: TurnDetectionConfig = { language: "zh-TW", config: { end_of_speech: { mode: "semantic" } } };
const _semanticDefault: TurnDetectionConfig = { config: { end_of_speech: { mode: "semantic" } } };

// ❌ A language list with semantic EoS.
// @ts-expect-error semantic EoS takes one language, not a list
const _semanticList: TurnDetectionConfig = {
    language: ["en-US", "zh-CN"],
    config: { end_of_speech: { mode: "semantic" } },
};

// ❌ Semantic EoS with a language other than English or Chinese.
// @ts-expect-error semantic EoS supports only English and Chinese
const _semanticFr: TurnDetectionConfig = {
    language: "fr-FR",
    config: { end_of_speech: { mode: "semantic" } },
};

// ❌ An empty list.
// @ts-expect-error a language list must not be empty
const _empty: TurnDetectionConfig = { language: [] };
