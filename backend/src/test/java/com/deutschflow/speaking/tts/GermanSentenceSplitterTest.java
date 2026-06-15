package com.deutschflow.speaking.tts;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link GermanSentenceSplitter}.
 *
 * <p>Drives the streaming-TTS sentence boundary logic: cut at {@code . ! ? …} only when followed by
 * whitespace, never inside German abbreviations or decimals, and surface the trailing fragment via
 * {@link GermanSentenceSplitter#flush()} when the LLM stream ends.
 */
class GermanSentenceSplitterTest {

    private final GermanSentenceSplitter splitter = new GermanSentenceSplitter();

    // ── Core boundary detection ───────────────────────────────────────────

    @Test
    @DisplayName("emits a sentence once its terminator is followed by whitespace")
    void emitsSentenceWhenTerminatorFollowedByWhitespace() {
        List<String> out = splitter.append("Hallo. Wie geht es dir");
        assertThat(out).containsExactly("Hallo.");
    }

    @Test
    @DisplayName("does NOT emit while the terminator is still the last char (awaits whitespace)")
    void doesNotEmitUntilWhitespaceAfterTerminatorArrives() {
        assertThat(splitter.append("Hallo.")).isEmpty();
        assertThat(splitter.append(" ")).containsExactly("Hallo.");
    }

    @Test
    @DisplayName("splits multiple complete sentences contained in one append")
    void splitsMultipleSentencesInOneAppend() {
        List<String> out = splitter.append("Erste. Zweite! Dritte? Vierte");
        assertThat(out).containsExactly("Erste.", "Zweite!", "Dritte?");
    }

    @Test
    @DisplayName("handles ! and ? and the … ellipsis character as terminators")
    void handlesAllTerminators() {
        assertThat(splitter.append("Echt! ")).containsExactly("Echt!");
        assertThat(splitter.append("Wirklich? ")).containsExactly("Wirklich?");
        assertThat(splitter.append("Tja… ")).containsExactly("Tja…");
    }

    @Test
    @DisplayName("treats a run of terminators (?! …) as a single boundary, kept together")
    void keepsTerminatorRunTogether() {
        assertThat(splitter.append("Was?! Echt")).containsExactly("Was?!");
        assertThat(splitter.append("...")).isEmpty();            // three dots, no trailing ws yet
        assertThat(splitter.append(" Ja")).containsExactly("Echt...");
    }

    // ── Abbreviations & numbers must NOT split ────────────────────────────

    @Test
    @DisplayName("does not split inside the abbreviation z.B.")
    void doesNotSplitOnZB() {
        List<String> out = splitter.append("Ich mag Obst, z.B. Bananen und Aepfel");
        assertThat(out).isEmpty();
        assertThat(splitter.flush()).contains("Ich mag Obst, z.B. Bananen und Aepfel");
    }

    @Test
    @DisplayName("does not split on common German abbreviations (d.h. u.a. usw. Dr. Prof. ca. Nr.)")
    void doesNotSplitOnCommonAbbreviations() {
        assertThat(splitter.append("d.h. ")).isEmpty();
        assertThat(splitter.append("u.a. ")).isEmpty();
        assertThat(splitter.append("usw. ")).isEmpty();
        assertThat(splitter.append("Dr. ")).isEmpty();
        assertThat(splitter.append("Prof. ")).isEmpty();
        assertThat(splitter.append("ca. ")).isEmpty();
        assertThat(splitter.append("Nr. ")).isEmpty();
    }

    @Test
    @DisplayName("does not split a decimal number like 3.14")
    void doesNotSplitDecimal() {
        List<String> out = splitter.append("Pi ist 3.14 ungefaehr");
        assertThat(out).isEmpty();
    }

    @Test
    @DisplayName("does not split a German ordinal like '3. Klasse' (digit before the period)")
    void doesNotSplitOrdinal() {
        List<String> out = splitter.append("Er ist in der 3. Klasse heute");
        assertThat(out).isEmpty();
    }

    @Test
    @DisplayName("DOES split a real sentence that merely contains an abbreviation earlier")
    void splitsRealSentenceAfterAbbreviation() {
        List<String> out = splitter.append("Ich mag z.B. Tee. Und du");
        assertThat(out).containsExactly("Ich mag z.B. Tee.");
    }

    // ── Fragmented token stream ───────────────────────────────────────────

    @Test
    @DisplayName("reassembles a sentence split across several tiny tokens")
    void reassemblesFragmentedTokens() {
        assertThat(splitter.append("Hal")).isEmpty();
        assertThat(splitter.append("lo")).isEmpty();
        assertThat(splitter.append(".")).isEmpty();
        assertThat(splitter.append(" Wie")).containsExactly("Hallo.");
        assertThat(splitter.append(" geht's? ")).containsExactly("Wie geht's?");
    }

    @Test
    @DisplayName("terminator and following whitespace arriving in separate tokens still emits")
    void terminatorThenWhitespaceSeparateTokens() {
        assertThat(splitter.append("Tschuess")).isEmpty();
        assertThat(splitter.append("!")).isEmpty();
        assertThat(splitter.append("\n")).containsExactly("Tschuess!");
    }

    // ── Whitespace hygiene & empties ──────────────────────────────────────

    @Test
    @DisplayName("trims surrounding whitespace and skips empty/blank segments")
    void trimsAndSkipsBlanks() {
        List<String> out = splitter.append("  Eins.   Zwei.  ");
        assertThat(out).containsExactly("Eins.", "Zwei.");
    }

    @Test
    @DisplayName("ignores null and empty tokens")
    void ignoresNullAndEmptyTokens() {
        assertThat(splitter.append(null)).isEmpty();
        assertThat(splitter.append("")).isEmpty();
        assertThat(splitter.flush()).isEmpty();
    }

    // ── Closing quotes are transparent after a terminator ─────────────────

    @Test
    @DisplayName("allows a boundary after a closing quote following the terminator")
    void boundaryAfterClosingQuote() {
        // Er sagte „Hallo.“ Dann ging er.   (German quotes via unicode escapes)
        List<String> out = splitter.append("Er sagte „Hallo.“ Dann ging er");
        assertThat(out).containsExactly("Er sagte „Hallo.“");
    }

    // ── flush() ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("flush returns the trailing fragment that has no terminator, then clears")
    void flushReturnsTrailingFragment() {
        splitter.append("Erste. Zweite ohne Punkt");
        assertThat(splitter.flush()).contains("Zweite ohne Punkt");
        assertThat(splitter.flush()).isEmpty();   // buffer cleared
    }

    @Test
    @DisplayName("flush returns the last sentence even if it ends with a terminator but no trailing space")
    void flushReturnsLastTerminatedSentenceWithoutTrailingSpace() {
        splitter.append("Nur ein Satz.");
        assertThat(splitter.flush()).contains("Nur ein Satz.");
    }

    @Test
    @DisplayName("full conversational turn: streamed deltas then flush yields every sentence in order")
    void fullTurnInOrder() {
        StringBuilder all = new StringBuilder();
        List<String> emitted = new java.util.ArrayList<>();
        for (String tok : List.of("Guten ", "Morgen", "! ", "Wie ", "geht ", "es ", "dir", "? ", "Mir ", "geht ", "es ", "gut.")) {
            emitted.addAll(splitter.append(tok));
            all.append(tok);
        }
        splitter.flush().ifPresent(emitted::add);
        assertThat(emitted).containsExactly("Guten Morgen!", "Wie geht es dir?", "Mir geht es gut.");
    }
}
