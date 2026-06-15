package com.deutschflow.speaking.tts;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

/**
 * Maps a {@link SpeakingPersona} to an {@link XttsVoice} (voice id + research-tuned preset).
 *
 * <p>Source of truth for the persona→voice contract (see {@code docs/XTTS_STREAMING_API_CONTRACT.md}
 * §4). The 5 server voices ({@code default}, {@code de-lukas_man}, {@code de-klaus_man},
 * {@code de-anna_women}, {@code de-emma_women}) are reused across 16 German personas, differentiated
 * by {@code speed}/{@code temperature}. The 3 Vietnamese tutors (TUAN/LAN/MINH) are intentionally
 * <strong>not</strong> mapped — they stay on-device for Phase 1 → {@link #resolve} returns empty,
 * which disables streaming TTS for them.
 *
 * <p>Presets are code constants (enum-parity tested) rather than YAML so that adding a new persona
 * without a mapping fails a test instead of silently going voiceless.
 */
@Component
public class XttsPersonaVoiceResolver {

    /** Per-voice synthesis preset (research §6). */
    private record Preset(double speed, double temperature, double repetitionPenalty) {}

    private static final String LANGUAGE_DE = "de";

    private static final Map<String, Preset> VOICE_PRESETS = Map.of(
            "default",       new Preset(1.00, 0.68, 5.0),
            "de-lukas_man",  new Preset(1.00, 0.68, 5.0),
            "de-klaus_man",  new Preset(0.95, 0.70, 7.0),  // deep → higher repetition penalty
            "de-anna_women", new Preset(0.90, 0.60, 5.0),  // expressive → reined-in temperature
            "de-emma_women", new Preset(0.95, 0.65, 5.0));

    private static final Map<SpeakingPersona, String> PERSONA_VOICE = buildPersonaVoiceMap();

    private static Map<SpeakingPersona, String> buildPersonaVoiceMap() {
        Map<SpeakingPersona, String> m = new EnumMap<>(SpeakingPersona.class);
        m.put(SpeakingPersona.DEFAULT, "default");
        // Male → lukas (calm) / klaus (deep)
        m.put(SpeakingPersona.LUKAS, "de-lukas_man");
        m.put(SpeakingPersona.THOMAS, "de-lukas_man");
        m.put(SpeakingPersona.NIKLAS, "de-lukas_man");
        m.put(SpeakingPersona.KLAUS, "de-klaus_man");
        m.put(SpeakingPersona.SCHNEIDER, "de-klaus_man");
        m.put(SpeakingPersona.MAX, "de-klaus_man");
        m.put(SpeakingPersona.OLIVER, "de-klaus_man");
        // Female → emma (young/clear) / anna (warm)
        m.put(SpeakingPersona.EMMA, "de-emma_women");
        m.put(SpeakingPersona.LENA, "de-emma_women");
        m.put(SpeakingPersona.NINA, "de-emma_women");
        m.put(SpeakingPersona.HANNIE, "de-emma_women");
        m.put(SpeakingPersona.ANNA, "de-anna_women");
        m.put(SpeakingPersona.PETRA, "de-anna_women");
        m.put(SpeakingPersona.SARAH, "de-anna_women");
        m.put(SpeakingPersona.WEBER, "de-anna_women");
        // TUAN / LAN / MINH: intentionally unmapped (Vietnamese tutors → on-device, Phase 1)
        return m;
    }

    /**
     * Resolve the XTTS voice for a persona, or empty when the persona has no streaming voice
     * (Vietnamese tutors, or {@code null}) — caller then skips streaming TTS.
     */
    public Optional<XttsVoice> resolve(SpeakingPersona persona) {
        if (persona == null) {
            return Optional.empty();
        }
        String voiceId = PERSONA_VOICE.get(persona);
        if (voiceId == null) {
            return Optional.empty();
        }
        Preset p = VOICE_PRESETS.getOrDefault(voiceId, VOICE_PRESETS.get("default"));
        return Optional.of(new XttsVoice(voiceId, p.speed(), p.temperature(), p.repetitionPenalty(), LANGUAGE_DE));
    }
}
