import { BaseTTS } from "../vendors/base.js";

/** Gemini 3.8 Flash TTS preview model. */
export const GeminiTTSModels = {
    Flash38: "gemini-3.8-flash-tts",
} as const;

export type GeminiTTSModel = (typeof GeminiTTSModels)[keyof typeof GeminiTTSModels] | (string & {});

export interface GeminiTTSOptions {
    apiKey: string;
    /** Sent verbatim; defaults to Gemini 3.8 Flash TTS. */
    model?: GeminiTTSModel;
    /** Defaults to Puck. */
    voice?: string;
    /** Natural-language speaking instructions. Omitted unless supplied. */
    style?: string;
}

/** Preview wire shape, kept separate from the generated production schema. */
export interface GeminiTTSConfig {
    vendor: "gemini";
    params: {
        api_key: string;
        model: string;
        voice: string;
        style?: string;
    };
}

/** Preview-only TTS. AgentSession selects the gemini-live gate automatically. */
export class GeminiTTS extends BaseTTS {
    private readonly options: GeminiTTSOptions;

    constructor(options: GeminiTTSOptions) {
        super();
        for (const field of ["apiKey", "model", "voice"] as const) {
            const value = options[field];
            if ((field === "apiKey" || value !== undefined) && (typeof value !== "string" || !value.trim())) {
                throw new Error(`GeminiTTS requires ${field}`);
            }
        }
        if (options.style !== undefined && typeof options.style !== "string") {
            throw new Error("GeminiTTS style must be a string");
        }
        this.options = { ...options };
    }

    toConfig(): GeminiTTSConfig {
        const { apiKey, model = GeminiTTSModels.Flash38, voice = "Puck", style } = this.options;
        return {
            vendor: "gemini",
            params: { api_key: apiKey, model, voice, ...(style !== undefined && { style }) },
        };
    }
}
