/**
 * Type safety demonstrations for sample rate enforcement.
 *
 * This file demonstrates compile-time type checking for:
 * 1. Invalid sample rates (e.g., 25000 Hz)
 * 2. Avatar/TTS sample rate mismatches (e.g., 16kHz TTS + HeyGen 24kHz avatar)
 * 3. Valid configurations that compile successfully
 *
 * To verify type checking works:
 * 1. Uncomment sections marked with @ts-expect-error
 * 2. Run: npm run build
 * 3. TypeScript should show errors for the uncommented invalid sections
 */

import { AgoraClient } from "../../AgoraPoolClient.js";
import { Area } from "../../core/domain/index.js";
import { Agent } from "../Agent.js";
import { AkoolAvatar, LiveAvatarAvatar } from "../vendors/avatar.js";
import { OpenAI } from "../vendors/llm.js";
import { DeepgramSTT } from "../vendors/stt.js";
import { CartesiaTTS, ElevenLabsTTS, MicrosoftTTS, MiniMaxTTS, OpenAITTS } from "../vendors/tts.js";

const TEST_AGENT_CLIENT = new AgoraClient({
    area: Area.US,
    appId: "test-app-id",
    appCertificate: "test-app-certificate-01234567890",
});

// ============================================
// ✅ VALID CONFIGURATIONS
// ============================================

// Example 1: ElevenLabs 24kHz + HeyGen avatar
function _validExample1(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new ElevenLabsTTS({
                key: "test",
                modelId: "eleven_flash_v2_5",
                voiceId: "test",
                baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 24000,
            }),
        )
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            }),
        );
}

// Example 2: ElevenLabs 16kHz + Akool avatar
function _validExample2(): Agent<16000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new ElevenLabsTTS({
                key: "test",
                modelId: "eleven_flash_v2_5",
                voiceId: "test",
                baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 16000,
            }),
        )
        .withAvatar(
            new AkoolAvatar({
                apiKey: "test",
            }),
        );
}

// Example 3: Microsoft 24kHz + HeyGen avatar
function _validExample3(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new MicrosoftTTS({
                key: "test",
                region: "eastus",
                voiceName: "en-US-JennyNeural",
                sampleRate: 24000,
            }),
        )
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            }),
        );
}

// Example 4: OpenAI (fixed 24kHz) + HeyGen avatar
function _validExample4(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new OpenAITTS({
                apiKey: "test",
                voice: "alloy",
                model: "gpt-4o-mini-tts",
                baseUrl: "https://api.openai.com/v1",
            }),
        )
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            }),
        );
}

// Example 5: Cartesia 16kHz + Akool avatar
function _validExample5(): Agent<16000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new CartesiaTTS({
                apiKey: "test",
                voiceId: "test",
                modelId: "sonic-2",
                sampleRate: 16000,
            }),
        )
        .withAvatar(
            new AkoolAvatar({
                apiKey: "test",
            }),
        );
}

// Agora-managed models may omit credentials.
new DeepgramSTT({ model: "nova-3" });
new OpenAI({ model: "gpt-5-mini" });
new OpenAITTS({ voice: "alloy" });
new OpenAI({
    apiKey: "test",
    model: "gpt-5-mini",
    url: "https://api.openai.com/v1/chat/completions",
    vendor: "custom",
});
new MiniMaxTTS({
    model: "speech-2.6-turbo",
});

// @ts-expect-error Missing apiKey is only allowed for Agora-managed Deepgram models.
new DeepgramSTT({ model: "enhanced" });
// @ts-expect-error Missing apiKey is only allowed for Agora-managed OpenAI models.
new OpenAI({ model: "gpt-4o" });
// @ts-expect-error Missing apiKey cannot be combined with a custom vendor hint.
new OpenAI({ model: "gpt-5-mini", vendor: "custom" });
// @ts-expect-error Missing apiKey cannot be combined with a custom URL.
new OpenAI({ model: "gpt-5-mini", url: "https://proxy.example.com/chat" });
// @ts-expect-error Missing apiKey is only allowed for the openai_tts_1 preset model.
new OpenAITTS({ voice: "alloy", model: "tts-1-hd" });
// @ts-expect-error Missing key is only allowed for supported MiniMax preset models.
new MiniMaxTTS({
    groupId: "group",
    model: "speech-02-turbo",
    voiceId: "voice",
    url: "wss://example.com",
});

// ============================================
// ❌ INVALID: Sample rate mismatches
// Uncomment to verify compile errors
// ============================================

/*
// @ts-expect-error - HeyGen requires 24kHz, but TTS is configured for 16kHz
function invalidMismatch1(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new ElevenLabsTTS({
                key: "test",
                modelId: "eleven_flash_v2_5",
                voiceId: "test",
                baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 16000, // ❌ Wrong rate for HeyGen
            })
        )
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            })
        );
}
*/

/*
// @ts-expect-error - Akool requires 16kHz, but TTS is configured for 24kHz
function invalidMismatch2(): Agent<16000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new ElevenLabsTTS({
                key: "test",
                modelId: "eleven_flash_v2_5",
                voiceId: "test",
                baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 24000, // ❌ Wrong rate for Akool
            })
        )
        .withAvatar(
            new AkoolAvatar({
                apiKey: "test",
            })
        );
}
*/

/*
// @ts-expect-error - HeyGen requires 24kHz, not 48kHz
function invalidMismatch3(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new MicrosoftTTS({
                key: "test",
                region: "eastus",
                voiceName: "en-US-JennyNeural",
                sampleRate: 48000, // ❌ Wrong rate for HeyGen
            })
        )
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            })
        );
}
*/

// ============================================
// ❌ INVALID: Invalid enum values
// Uncomment to verify compile errors
// ============================================

/*
// @ts-expect-error - 25000 is not a valid ElevenLabs sample rate
function invalidEnum1() {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new ElevenLabsTTS({
            key: "test",
            modelId: "eleven_flash_v2_5",
            voiceId: "test",
            baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 25000, // ❌ Not in enum: 16000, 22050, 24000, 44100
        })
    );
}
*/

/*
// @ts-expect-error - 8000 is not a valid Microsoft sample rate
function invalidEnum2() {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new MicrosoftTTS({
            key: "test",
            region: "eastus",
            voiceName: "en-US-JennyNeural",
            sampleRate: 8000, // ❌ Not in enum: 16000, 24000, 48000
        })
    );
}
*/

/*
// @ts-expect-error - 32000 is not a valid Cartesia sample rate
function invalidEnum3() {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new CartesiaTTS({
            key: "test",
            voiceId: "test",
            baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 32000, // ❌ Not in enum: 8000-48000 (specific values)
        })
    );
}
*/

// ============================================
// ✅ VALID: Edge cases
// ============================================

// Avatar without TTS configured (allowed)
function _edgeCase1() {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withAvatar(
        new LiveAvatarAvatar({
            apiKey: "test",
            quality: "high",
            agoraUid: "12345",
        }),
    );
}

// TTS without avatar (allowed)
function _edgeCase2() {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new ElevenLabsTTS({
            key: "test",
            modelId: "eleven_flash_v2_5",
            voiceId: "test",
            baseUrl: "wss://api.elevenlabs.io/v1",
            sampleRate: 16000,
        }),
    );
}

// Method chaining preserves type tracking
function _edgeCase3(): Agent<24000> {
    return new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" })
        .withTts(
            new ElevenLabsTTS({
                key: "test",
                modelId: "eleven_flash_v2_5",
                voiceId: "test",
                baseUrl: "wss://api.elevenlabs.io/v1",
                sampleRate: 24000,
            }),
        )
        .withInstructions("Updated instructions")
        .withGreeting("Hello!")
        .withAvatar(
            new LiveAvatarAvatar({
                apiKey: "test",
                quality: "high",
                agoraUid: "12345",
            }),
        );
}

// ============================================
// Type inference verification
// ============================================

function _typeInference1() {
    const agentWith24k = new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new ElevenLabsTTS({
            key: "test",
            modelId: "eleven_flash_v2_5",
            voiceId: "test",
            baseUrl: "wss://api.elevenlabs.io/v1",
            sampleRate: 24000,
        }),
    );

    // Verify: Type should be Agent<24000>
    const _typeCheck: Agent<24000> = agentWith24k;
    return agentWith24k;
}

function _typeInference2() {
    const agentWith16k = new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new ElevenLabsTTS({
            key: "test",
            modelId: "eleven_flash_v2_5",
            voiceId: "test",
            baseUrl: "wss://api.elevenlabs.io/v1",
            sampleRate: 16000,
        }),
    );

    // Verify: Type should be Agent<16000>
    const _typeCheck: Agent<16000> = agentWith16k;
    return agentWith16k;
}

function _typeInference3() {
    const openAIAgent = new Agent({ client: TEST_AGENT_CLIENT, instructions: "Test" }).withTts(
        new OpenAITTS({
            apiKey: "test",
            voice: "alloy",
            model: "gpt-4o-mini-tts",
            baseUrl: "https://api.openai.com/v1",
        }),
    );

    // Verify: OpenAI is fixed at 24kHz, so type should be Agent<24000>
    const _typeCheck: Agent<24000> = openAIAgent;
    return openAIAgent;
}
