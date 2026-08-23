package com.deutschflow.examspeaking.metrics;

import com.deutschflow.examspeaking.api.model.Utterance;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class LexicalProfilerTest {

    static GoetheWordlist wordlist;

    @BeforeAll
    static void load() {
        wordlist = new GoetheWordlist();
        wordlist.load();
    }

    @Test
    void loadsOfficialWordlistAndProfilesA1Speech() {
        assertThat(wordlist.size()).isGreaterThan(3000);
        assertThat(wordlist.levelOf("aber")).contains("A1");
        assertThat(wordlist.levelOf("wohne")).isPresent(); // wohnen via đuôi biến tố
        LexicalProfiler profiler = new LexicalProfiler(wordlist);
        LexicalProfile p = profiler.profile(List.of(Utterance.candidateText(
                "Ich heiße Anna und ich wohne in Berlin, weil ich dort arbeite. Dann gehe ich nach Hause.")), "A1");
        assertThat(p.tokenCount()).isEqualTo(17);
        assertThat(p.inListShare()).isGreaterThan(0.6);
        assertThat(p.subordinatorCount()).isEqualTo(1); // weil
        assertThat(p.connectorCount()).isGreaterThanOrEqualTo(2); // und, dann
        assertThat(p.typeTokenRatio()).isBetween(0.5, 1.0);
    }
}
