import type * as Agora from "../api/index.js";

export const AgentPresets = {
    asr: {
        deepgramNova2: "deepgram_nova_2",
        deepgramNova3: "deepgram_nova_3",
    },
    llm: {
        openaiGpt4oMini: "openai_gpt_4o_mini",
        openaiGpt41Mini: "openai_gpt_4_1_mini",
        openaiGpt5Nano: "openai_gpt_5_nano",
        openaiGpt5Mini: "openai_gpt_5_mini",
    },
    tts: {
        minimaxSpeech26Turbo: "minimax_speech_2_6_turbo",
        minimaxSpeech28Turbo: "minimax_speech_2_8_turbo",
        openaiTts1: "openai_tts_1",
    },
} as const;

export const DeepgramPresetModels = ["nova-2", "nova-3"] as const;
export const OpenAIPresetModels = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-5-nano", "gpt-5-mini"] as const;
export const OpenAITtsPresetModels = ["tts-1"] as const;
export const MiniMaxPresetModels = [
    "speech-2.6-turbo",
    "speech_2_6_turbo",
    "speech-2.8-turbo",
    "speech_2_8_turbo",
] as const;

export type AsrPreset = (typeof AgentPresets.asr)[keyof typeof AgentPresets.asr];
export type LlmPreset = (typeof AgentPresets.llm)[keyof typeof AgentPresets.llm];
export type TtsPreset = (typeof AgentPresets.tts)[keyof typeof AgentPresets.tts];
export type AgentPreset = AsrPreset | LlmPreset | TtsPreset;
export type PresetInput = AgentPreset | readonly AgentPreset[] | string;
export type DeepgramPresetModel = (typeof DeepgramPresetModels)[number];
export type OpenAIPresetModel = (typeof OpenAIPresetModels)[number];
export type OpenAITtsPresetModel = (typeof OpenAITtsPresetModels)[number];
export type MiniMaxPresetModel = (typeof MiniMaxPresetModels)[number];

export type PresetCategory = "asr" | "llm" | "tts";
type AsrInference = {
    category: "asr";
    preset: AsrPreset;
    stripModel: boolean;
};
type LlmInference = {
    category: "llm";
    preset: LlmPreset;
    stripModel: boolean;
    stripDefaultUrl: boolean;
};
type OpenAITtsInference = {
    category: "tts";
    preset: typeof AgentPresets.tts.openaiTts1;
    vendor: "openai";
    stripModel: boolean;
};
type MiniMaxTtsInference = {
    category: "tts";
    preset: TtsPreset;
    vendor: "minimax";
    stripModel: boolean;
};
type TtsInference = OpenAITtsInference | MiniMaxTtsInference;
type InferenceMap = {
    asr?: AsrInference;
    llm?: LlmInference;
    tts?: TtsInference;
};

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const deepgramModelToPreset: Record<string, AsrPreset> = {
    "nova-2": AgentPresets.asr.deepgramNova2,
    "nova-3": AgentPresets.asr.deepgramNova3,
};
const openAiModelToPreset: Record<string, LlmPreset> = {
    "gpt-4o-mini": AgentPresets.llm.openaiGpt4oMini,
    "gpt-4.1-mini": AgentPresets.llm.openaiGpt41Mini,
    "gpt-5-nano": AgentPresets.llm.openaiGpt5Nano,
    "gpt-5-mini": AgentPresets.llm.openaiGpt5Mini,
};
const minimaxModelToPreset: Record<string, TtsPreset> = {
    "speech-2.6-turbo": AgentPresets.tts.minimaxSpeech26Turbo,
    speech_2_6_turbo: AgentPresets.tts.minimaxSpeech26Turbo,
    "speech-2.8-turbo": AgentPresets.tts.minimaxSpeech28Turbo,
    speech_2_8_turbo: AgentPresets.tts.minimaxSpeech28Turbo,
};

function normalizeModelName(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
}

export function getPresetCategory(preset: string): PresetCategory | undefined {
    if (Object.values(AgentPresets.asr).includes(preset as AsrPreset)) return "asr";
    if (Object.values(AgentPresets.llm).includes(preset as LlmPreset)) return "llm";
    if (Object.values(AgentPresets.tts).includes(preset as TtsPreset)) return "tts";
    return undefined;
}

function parsePresetInput(preset?: PresetInput | readonly string[]): string[] {
    if (preset == null) return [];
    if (Array.isArray(preset)) return preset.map((item) => item.trim()).filter(Boolean);
    if (typeof preset !== "string") return [];
    return preset
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean);
}

function omitUndefinedKeys<T extends Record<string, unknown>>(value: T): T | undefined {
    const next = Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
    return Object.keys(next).length > 0 ? next : undefined;
}

export function inferAsrPreset(asr?: Agora.Asr): AsrInference | undefined {
    if (!asr || asr.vendor !== "deepgram" || asr.params?.api_key || asr.params?.key) return undefined;
    const preset = deepgramModelToPreset[normalizeModelName(asr.params?.model) ?? ""];
    if (!preset) return undefined;
    return {
        category: "asr",
        preset,
        stripModel: true,
    };
}

export function inferLlmPreset(llm?: Agora.Llm): LlmInference | undefined {
    if (!llm || llm.api_key) return undefined;
    if (llm.vendor && llm.vendor !== "openai") return undefined;
    if (llm.url && llm.url !== OPENAI_CHAT_COMPLETIONS_URL) return undefined;
    const preset = openAiModelToPreset[normalizeModelName(llm.params?.model) ?? ""];
    if (!preset) return undefined;
    return {
        category: "llm",
        preset,
        stripModel: true,
        stripDefaultUrl: true,
    };
}

export function inferTtsPreset(tts?: Agora.Tts): TtsInference | undefined {
    if (!tts) return undefined;
    if (tts.vendor === "openai") {
        if ((tts.params as unknown as Record<string, unknown> | undefined)?.api_key) return undefined;
        const model = normalizeModelName(tts.params?.model) ?? "tts-1";
        if (model !== "tts-1") return undefined;
        return {
            category: "tts",
            preset: AgentPresets.tts.openaiTts1,
            vendor: "openai",
            stripModel: true,
        };
    }
    if (tts.vendor === "minimax") {
        if (tts.params?.key) return undefined;
        // Model is no longer in params for the preset path; fall back to the top-level hint.
        const model =
            normalizeModelName(tts.params?.model) ??
            normalizeModelName((tts as unknown as Record<string, unknown>)._minimaxPresetModel as string) ??
            "";
        const preset = minimaxModelToPreset[model];
        if (!preset) return undefined;
        return {
            category: "tts",
            preset,
            vendor: "minimax",
            stripModel: true,
        };
    }
    return undefined;
}

function stripInferredPresetFields(
    properties: Agora.StartAgentsRequest.Properties,
    inferred: InferenceMap,
): Agora.StartAgentsRequest.Properties {
    let asr = properties.asr;
    const asrInference = inferred.asr;
    if (asr && asrInference) {
        asr = {
            ...asr,
            params: omitUndefinedKeys({
                ...asr.params,
                api_key: undefined,
                model: asrInference.stripModel ? undefined : asr.params?.model,
            }),
        } as Agora.Asr;
    }

    let llm = properties.llm;
    const llmInference = inferred.llm;
    if (llm && llmInference) {
        const { url: llmUrl, ...llmRest } = llm;
        llm = {
            ...llmRest,
            api_key: undefined,
            url: llmInference.stripDefaultUrl ? undefined : llmUrl,
            params: omitUndefinedKeys({
                ...llm.params,
                model: llmInference.stripModel ? undefined : llm.params?.model,
            }),
        } as unknown as Agora.Llm;
    }

    let tts = properties.tts;
    const ttsInference = inferred.tts;
    if (tts && ttsInference) {
        if (ttsInference.vendor === "openai" && tts.vendor === "openai") {
            tts = {
                ...tts,
                params: omitUndefinedKeys({
                    ...tts.params,
                    api_key: undefined,
                    model: ttsInference.stripModel ? undefined : tts.params?.model,
                }) as unknown as typeof tts.params,
            };
        } else if (ttsInference.vendor === "minimax" && tts.vendor === "minimax") {
            const { _minimaxPresetModel: _stripped, ...ttsWithoutHint } = tts as unknown as Record<string, unknown>;
            tts = {
                ...(ttsWithoutHint as unknown as typeof tts),
                params: omitUndefinedKeys({
                    ...tts.params,
                    key: undefined,
                    group_id: undefined,
                    url: undefined,
                    model: ttsInference.stripModel ? undefined : tts.params?.model,
                }) as unknown as typeof tts.params,
            };
        }
    }
    if (tts && "_minimaxPresetModel" in (tts as unknown as Record<string, unknown>)) {
        const { _minimaxPresetModel: _discarded, ...rest } = tts as unknown as Record<string, unknown>;
        tts = rest as unknown as typeof tts;
    }

    return {
        ...properties,
        ...(asr && { asr }),
        ...(llm && { llm }),
        ...(tts && { tts }),
    };
}

export function normalizePresetInput(preset?: PresetInput | readonly string[]): string | undefined {
    const entries = parsePresetInput(preset);
    return entries.length > 0 ? entries.join(",") : undefined;
}

export function resolveSessionPresets(args: {
    preset?: PresetInput;
    properties: Agora.StartAgentsRequest.Properties;
}): { preset?: string; properties: Agora.StartAgentsRequest.Properties } {
    const explicitPresets = parsePresetInput(args.preset);
    const explicitCategories = new Set(explicitPresets.map(getPresetCategory).filter(Boolean));
    const inferred: InferenceMap = {};

    if (!explicitCategories.has("asr")) {
        const result = inferAsrPreset(args.properties.asr);
        if (result) inferred.asr = result;
    }
    if (!explicitCategories.has("llm")) {
        const result = inferLlmPreset(args.properties.llm);
        if (result) inferred.llm = result;
    }
    if (!explicitCategories.has("tts")) {
        const result = inferTtsPreset(args.properties.tts);
        if (result) inferred.tts = result;
    }
    const inferredPresets = Object.values(inferred).map((result) => result.preset);

    return {
        preset: normalizePresetInput([...explicitPresets, ...inferredPresets]),
        properties: stripInferredPresetFields(args.properties, inferred),
    };
}
