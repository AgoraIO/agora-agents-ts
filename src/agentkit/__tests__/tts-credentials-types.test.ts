import { CredentialMode } from "../constants.js";
import type { BaseTTS } from "../vendors/base.js";
import { CartesiaTTS, FishAudioTTS } from "../vendors/tts.js";

// Compile-time coverage: a key is optional only when managed mode is explicit.
function _ttsCredentialModes(): void {
    const cartesia = new CartesiaTTS({
        credentialMode: CredentialMode.Managed,
        voiceId: "voice",
        modelId: "sonic-2",
        sampleRate: 24000,
    });
    const sampleRateCheck: BaseTTS<24000> = cartesia;
    void sampleRateCheck;
    new CartesiaTTS({ apiKey: "key", voiceId: "voice", modelId: "sonic-2" });
    new CartesiaTTS({ credentialMode: CredentialMode.Byok, apiKey: "key", voiceId: "voice", modelId: "sonic-2" });
    new FishAudioTTS({ credentialMode: CredentialMode.Managed, referenceId: "ref", backend: "speech-1.5" });
    new FishAudioTTS({ key: "key", referenceId: "ref", backend: "speech-1.5" });
    new FishAudioTTS({ credentialMode: CredentialMode.Byok, key: "key", referenceId: "ref", backend: "speech-1.5" });

    // @ts-expect-error BYOK requires apiKey when credentialMode is omitted.
    new CartesiaTTS({ voiceId: "voice", modelId: "sonic-2" });
    // @ts-expect-error Explicit BYOK requires apiKey.
    new CartesiaTTS({ credentialMode: CredentialMode.Byok, voiceId: "voice", modelId: "sonic-2" });
    // @ts-expect-error BYOK requires key when credentialMode is omitted.
    new FishAudioTTS({ referenceId: "ref", backend: "speech-1.5" });
    // @ts-expect-error Explicit BYOK requires key.
    new FishAudioTTS({ credentialMode: CredentialMode.Byok, referenceId: "ref", backend: "speech-1.5" });
    // @ts-expect-error Managed Cartesia still requires voiceId.
    new CartesiaTTS({ credentialMode: CredentialMode.Managed, modelId: "sonic-2" });
    // @ts-expect-error Managed Fish Audio still requires backend.
    new FishAudioTTS({ credentialMode: CredentialMode.Managed, referenceId: "ref" });
    // @ts-expect-error Credential mode is restricted to managed or byok.
    new CartesiaTTS({ credentialMode: "invalid", apiKey: "key", voiceId: "voice", modelId: "sonic-2" });
    // @ts-expect-error Credential mode is restricted to managed or byok.
    new FishAudioTTS({ credentialMode: "invalid", key: "key", referenceId: "ref", backend: "speech-1.5" });
}
