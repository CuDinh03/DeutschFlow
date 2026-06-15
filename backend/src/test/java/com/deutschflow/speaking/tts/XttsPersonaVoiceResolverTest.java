package com.deutschflow.speaking.tts;

import com.deutschflow.speaking.persona.SpeakingPersona;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link XttsPersonaVoiceResolver}. Includes an enum-parity guard so a newly added
 * {@link SpeakingPersona} that nobody mapped fails here instead of silently going voiceless in prod.
 */
class XttsPersonaVoiceResolverTest {

    /** Vietnamese tutors are deliberately on-device for Phase 1 (no streaming voice). */
    private static final Set<SpeakingPersona> EXPECTED_UNMAPPED =
            EnumSet.of(SpeakingPersona.TUAN, SpeakingPersona.LAN, SpeakingPersona.MINH);

    private static final Set<String> KNOWN_VOICE_IDS =
            Set.of("default", "de-lukas_man", "de-klaus_man", "de-anna_women", "de-emma_women");

    private final XttsPersonaVoiceResolver resolver = new XttsPersonaVoiceResolver();

    @Test
    @DisplayName("exact-match personas resolve to their namesake voice with the research preset")
    void exactMatchPersonasResolve() {
        assertThat(resolver.resolve(SpeakingPersona.LUKAS)).get()
                .isEqualTo(new XttsVoice("de-lukas_man", 1.00, 0.68, 5.0, "de"));
        assertThat(resolver.resolve(SpeakingPersona.EMMA)).get()
                .isEqualTo(new XttsVoice("de-emma_women", 0.95, 0.65, 5.0, "de"));
        assertThat(resolver.resolve(SpeakingPersona.ANNA)).get()
                .isEqualTo(new XttsVoice("de-anna_women", 0.90, 0.60, 5.0, "de"));
        assertThat(resolver.resolve(SpeakingPersona.KLAUS)).get()
                .isEqualTo(new XttsVoice("de-klaus_man", 0.95, 0.70, 7.0, "de"));
        assertThat(resolver.resolve(SpeakingPersona.DEFAULT)).get()
                .extracting(XttsVoice::voiceId).isEqualTo("default");
    }

    @Test
    @DisplayName("reused personas map to the right gendered voice (Schneider→klaus, Hannie→emma, Petra→anna)")
    void reusedPersonasMapToGenderedVoice() {
        assertThat(resolver.resolve(SpeakingPersona.SCHNEIDER)).get().extracting(XttsVoice::voiceId).isEqualTo("de-klaus_man");
        assertThat(resolver.resolve(SpeakingPersona.OLIVER)).get().extracting(XttsVoice::voiceId).isEqualTo("de-klaus_man");
        assertThat(resolver.resolve(SpeakingPersona.THOMAS)).get().extracting(XttsVoice::voiceId).isEqualTo("de-lukas_man");
        assertThat(resolver.resolve(SpeakingPersona.HANNIE)).get().extracting(XttsVoice::voiceId).isEqualTo("de-emma_women");
        assertThat(resolver.resolve(SpeakingPersona.PETRA)).get().extracting(XttsVoice::voiceId).isEqualTo("de-anna_women");
        assertThat(resolver.resolve(SpeakingPersona.SARAH)).get().extracting(XttsVoice::voiceId).isEqualTo("de-anna_women");
    }

    @Test
    @DisplayName("Vietnamese tutors and null resolve to empty (on-device fallback)")
    void vietnameseTutorsAndNullAreEmpty() {
        assertThat(resolver.resolve(SpeakingPersona.TUAN)).isEmpty();
        assertThat(resolver.resolve(SpeakingPersona.LAN)).isEmpty();
        assertThat(resolver.resolve(SpeakingPersona.MINH)).isEmpty();
        assertThat(resolver.resolve(null)).isEmpty();
    }

    @Test
    @DisplayName("ENUM PARITY: every persona is either mapped to a known voice or an expected unmapped tutor")
    void everyPersonaIsAccountedFor() {
        for (SpeakingPersona persona : SpeakingPersona.values()) {
            Optional<XttsVoice> resolved = resolver.resolve(persona);
            if (EXPECTED_UNMAPPED.contains(persona)) {
                assertThat(resolved).as("%s should be unmapped (on-device)", persona).isEmpty();
            } else {
                assertThat(resolved).as("%s must resolve to a streaming voice", persona).isPresent();
                XttsVoice v = resolved.orElseThrow();
                assertThat(KNOWN_VOICE_IDS).as("%s → unknown voiceId %s", persona, v.voiceId()).contains(v.voiceId());
                assertThat(v.language()).isEqualTo("de");
            }
        }
    }

    @Test
    @DisplayName("preset values stay within sane synthesis bounds for every mapped persona")
    void presetsWithinSaneBounds() {
        for (SpeakingPersona persona : SpeakingPersona.values()) {
            resolver.resolve(persona).ifPresent(v -> {
                assertThat(v.speed()).as("%s speed", persona).isBetween(0.5, 1.5);
                assertThat(v.temperature()).as("%s temperature", persona).isBetween(0.3, 1.0);
                assertThat(v.repetitionPenalty()).as("%s repetitionPenalty", persona).isGreaterThanOrEqualTo(1.0);
            });
        }
    }
}
