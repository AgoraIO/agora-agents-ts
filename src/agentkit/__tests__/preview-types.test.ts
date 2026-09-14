/**
 * Compile-time type checks for the preview providers.
 *
 * This file is type-checked by `tsc` (it is under `src`), not executed by
 * vitest. A regression here fails `pnpm build`.
 */

import { AgoraClient } from "../../AgoraPoolClient.js";
import { Area } from "../../core/domain/index.js";
import { Agent } from "../Agent.js";
import { GeminiSTT, OpenAIGPTLive } from "../preview/index.js";
import type { MllmVendor, SttConfig } from "../types.js";
import { OpenAIRealtime } from "../vendors/mllm.js";

const CLIENT = new AgoraClient({
    area: Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate-01234567890",
});

const _gptLiveVendorName: MllmVendor = "openai_gpt_live";

// ============================================
// ✅ VALID CONFIGURATIONS
// ============================================

function _validTranscribeStt(): Agent {
    return new Agent({ client: CLIENT }).withStt(
        new GeminiSTT({
            apiKey: "test",
            model: "gemini-3.5-transcribe-live",
            languageCodes: ["en-US"],
            customVocabulary: ["Agora"],
            sampleRate: 16000,
            wordTimestamp: false,
        }),
    );
}

function _validOpenAIGPTLive(): Agent {
    return new Agent({ client: CLIENT }).withMllm(
        new OpenAIGPTLive({
            apiKey: "test",
            greeting: "Hello from GPT Live",
        }),
    );
}

function _openAIRealtimeCannotSelectGPTLive(): OpenAIRealtime {
    // @ts-expect-error - GPT Live has a separate preview vendor.
    return new OpenAIRealtime({ apiKey: "test", mode: "live" });
}

/** The preview ASR variant is part of `SttConfig`, so hand-written configs type-check too. */
const _handWrittenAsr: SttConfig = {
    vendor: "gemini",
    language: "en-US",
    params: {
        api_key: "test",
        model: "gemini-3.5-transcribe-live",
        sample_rate: 16000,
        language_codes: ["en-US"],
        custom_vocabulary: ["Agora"],
        word_timestamp: false,
    },
};

// ============================================
// ❌ INVALID CONFIGURATIONS
// ============================================

/** The API key is required — it is the only credential these providers accept. */
function _transcribeRequiresApiKey(): GeminiSTT {
    // @ts-expect-error - apiKey is required
    return new GeminiSTT({ languageCodes: ["en-US"] });
}

/** ASR params must carry a model; the preview gateway rejects a bare vendor. */
// @ts-expect-error - params.model is required
const _asrRequiresModel: SttConfig = {
    vendor: "gemini",
    params: { api_key: "test" },
};
