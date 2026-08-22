package com.deutschflow.examspeaking.metrics;

import com.deutschflow.examspeaking.api.model.Utterance;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Tính Flüssigkeit từ word-timestamps của STT verbose (kế hoạch 2.4 — "đo được, không đoán").
 * Không có timestamps → {@link Optional#empty()} và tiêu chí tương ứng bị đánh dấu chưa chấm.
 */
@Component
public class FluencyMetricExtractor {

    static final double PAUSE_THRESHOLD_SEC = 0.5;
    static final double LONG_PAUSE_THRESHOLD_SEC = 1.5;

    public Optional<FluencyMetrics> extract(List<Utterance> candidateUtterances) {
        List<Utterance> timed = candidateUtterances.stream().filter(Utterance::hasTiming).toList();
        if (timed.isEmpty()) {
            return Optional.empty();
        }
        int words = 0;
        double speaking = 0;
        double phonation = 0;
        int pauses = 0;
        int longPauses = 0;
        double pauseTime = 0;
        List<Integer> runs = new ArrayList<>();
        int repetitions = 0;
        double logprobSum = 0;
        int logprobN = 0;

        for (Utterance u : timed) {
            speaking += u.durationSeconds();
            int run = 0;
            String prev = null;
            Utterance.Word prevWord = null;
            for (Utterance.Word w : u.words()) {
                words++;
                phonation += Math.max(0, w.end() - w.start());
                String norm = w.word().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
                if (prevWord != null) {
                    double gap = w.start() - prevWord.end();
                    if (gap >= PAUSE_THRESHOLD_SEC) {
                        pauses++;
                        pauseTime += gap;
                        if (gap >= LONG_PAUSE_THRESHOLD_SEC) {
                            longPauses++;
                        }
                        runs.add(run);
                        run = 0;
                    }
                }
                if (!norm.isEmpty() && norm.equals(prev)) {
                    repetitions++;
                }
                run++;
                prev = norm.isEmpty() ? prev : norm;
                prevWord = w;
            }
            if (run > 0) {
                runs.add(run);
            }
            if (u.avgLogprob() != null) {
                logprobSum += u.avgLogprob();
                logprobN++;
            }
        }
        double minutes = speaking / 60.0;
        double wpm = minutes > 0 ? words / minutes : 0;
        double articulation = phonation > 0 ? words / (phonation / 60.0) : 0;
        double mlr = runs.isEmpty() ? words : runs.stream().mapToInt(Integer::intValue).average().orElse(0);
        double pauseRatio = speaking > 0 ? pauseTime / speaking : 0;
        Double logprob = logprobN > 0 ? logprobSum / logprobN : null;
        return Optional.of(new FluencyMetrics(words, speaking, phonation, wpm, articulation,
                pauses, longPauses, pauseRatio, mlr, repetitions, logprob));
    }
}
