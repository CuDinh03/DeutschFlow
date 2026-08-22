package com.deutschflow.examspeaking.metrics;

import com.deutschflow.examspeaking.api.model.Utterance;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class FluencyMetricExtractorTest {

    private final FluencyMetricExtractor extractor = new FluencyMetricExtractor();

    @Test
    void computesRatePausesRunsAndRepetitions() {
        // 6 từ trong 6 giây: "ich ich wohne [pause 2s] in berlin ." 
        List<Utterance.Word> words = List.of(
                new Utterance.Word("Ich", 0.0, 0.3), new Utterance.Word("ich", 0.4, 0.7), new Utterance.Word("wohne", 0.8, 1.2),
                new Utterance.Word("in", 3.2, 3.4), new Utterance.Word("Berlin", 3.5, 4.0), new Utterance.Word("gern", 4.1, 4.5));
        Utterance u = new Utterance("CANDIDATE", "Ich ich wohne in Berlin gern", words, -0.3, 6.0);
        FluencyMetrics m = extractor.extract(List.of(u)).orElseThrow();
        assertThat(m.wordCount()).isEqualTo(6);
        assertThat(m.wordsPerMinute()).isEqualTo(60.0);
        assertThat(m.pauseCount()).isEqualTo(1);
        assertThat(m.longPauseCount()).isEqualTo(1);
        assertThat(m.pauseRatio()).isCloseTo(2.0 / 6.0, within(0.01));
        assertThat(m.meanLengthOfRun()).isEqualTo(3.0);
        assertThat(m.repetitionCount()).isEqualTo(1);
        assertThat(m.avgLogprob()).isEqualTo(-0.3);
    }

    @Test
    void noTimingMeansNoMetrics() {
        Optional<FluencyMetrics> m = extractor.extract(List.of(Utterance.candidateText("Ich heiße Anna.")));
        assertThat(m).isEmpty();
    }
}
