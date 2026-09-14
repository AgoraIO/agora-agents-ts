/** Compile-time checks for the global Gemini STT vendor and its legacy public surface. */

import {
    type AgoraClient,
    createPreviewRoute,
    type GeminiAsrParams,
    GeminiSTT,
    GeminiSTTModels,
    type GeminiSTTOptions,
    type GlobalSttVendor,
    PREVIEW_API_BASE_URL,
    PREVIEW_FEATURE_HEADER,
    type PreviewFeature,
    PreviewFeatures,
    type PreviewRoute,
    previewRequestHeaders,
    type SampleRate,
    type SttConfig,
    type TurnDetectionLanguage,
} from "../../index.js";

const _globalGeminiStt: GlobalSttVendor = new GeminiSTT({
    apiKey: "test",
    language: "en-US",
    languageHints: ["en-US"],
    languageCodes: ["en-US", "es-ES"],
    customVocabulary: ["Agora"],
    sampleRate: 24_000,
    wordTimestamp: false,
});

const _handWrittenAsr: SttConfig = {
    vendor: "gemini",
    language: "en-US",
    params: {
        api_key: "test",
        model: "gemini-3.7-transcribe-live",
        language: "en-US",
        word_timestamp: true,
    },
};

function _requiresApiKey(): GeminiSTT {
    // @ts-expect-error apiKey is required
    return new GeminiSTT({ model: "gemini-3.7-transcribe-live" });
}

const _usesDefaultModel = new GeminiSTT({ apiKey: "test" });

declare const _legacyOptions: GeminiSTTOptions;
const _legacyLanguageCodes: readonly TurnDetectionLanguage[] | undefined = _legacyOptions.languageCodes;
const _legacySampleRate: SampleRate | undefined = _legacyOptions.sampleRate;
const _legacyModel = GeminiSTTModels.Transcribe35Live;
declare const _legacyParams: GeminiAsrParams;
const _legacyWireLanguages: string[] | undefined = _legacyParams.language_codes;
const _legacyVocabulary: string[] | undefined = _legacyParams.custom_vocabulary;

function _legacyPreviewRoute(client: AgoraClient): PreviewRoute {
    const features: readonly PreviewFeature[] = [PreviewFeatures.GeminiLive];
    previewRequestHeaders(features);
    PREVIEW_API_BASE_URL;
    PREVIEW_FEATURE_HEADER;
    return createPreviewRoute(client, features);
}
