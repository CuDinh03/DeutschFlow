package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.GroqWhisperClient;
import com.deutschflow.speaking.ai.GroqWhisperClient.VerboseTranscript;
import com.deutschflow.speaking.ai.GroqWhisperClient.WordTimestamp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Scores pronunciation by comparing Whisper word timestamps against the expected text.
 *
 * Strategy:
 *   1. Transcribe with verbose_json + word timestamps
 *   2. Normalize both expected and transcribed word lists
 *   3. Use sequence alignment (LCS-based) to classify each expected word as:
 *      CORRECT / CLOSE (1 edit-distance) / MISSING
 *   4. Blend with segment avg_logprob for confidence calibration
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PronunciationScorerService {

    private final GroqWhisperClient whisperClient;

    public record WordResult(String expected, String transcribed, String verdict, int score) {}

    public record PronunciationScore(
            String transcribedText,
            int overallScore,       // 0-100
            double avgLogprob,
            List<WordResult> words
    ) {}

    public PronunciationScore score(byte[] audioBytes, String expectedText) {
        VerboseTranscript verbose = whisperClient.transcribeVerbose(audioBytes, "audio.webm", "de", expectedText);

        List<String> expectedWords = tokenize(expectedText);
        List<String> transcribedWords = extractWords(verbose);

        List<WordResult> results = align(expectedWords, transcribedWords);

        int correct = (int) results.stream().filter(r -> "CORRECT".equals(r.verdict())).count();
        int close   = (int) results.stream().filter(r -> "CLOSE".equals(r.verdict())).count();
        int total   = results.size();

        // logprob: -0.0 (perfect) .. -1.0+ (poor) → map to 0-100 bonus
        double logprobBonus = Math.max(0, Math.min(20, (verbose.avgLogprob() + 0.5) * 40));
        int rawScore = total == 0 ? 0 : (int) Math.round((correct + 0.5 * close) * 100.0 / total);
        int finalScore = (int) Math.min(100, rawScore * 0.8 + logprobBonus);

        log.info("[Pronunciation] expected='{}' transcribed='{}' score={} logprob={}",
                expectedText, verbose.text(), finalScore, verbose.avgLogprob());

        return new PronunciationScore(verbose.text(), finalScore, verbose.avgLogprob(), results);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private List<String> tokenize(String text) {
        return Arrays.stream(text.replaceAll("[,!?.;:]", " ").toLowerCase().split("\\s+"))
                .filter(w -> !w.isBlank())
                .toList();
    }

    private List<String> extractWords(VerboseTranscript t) {
        if (!t.words().isEmpty()) {
            return t.words().stream()
                    .map(w -> w.word().replaceAll("[,!?.;:]", "").toLowerCase().strip())
                    .filter(w -> !w.isBlank())
                    .toList();
        }
        return tokenize(t.text());
    }

    private List<WordResult> align(List<String> expected, List<String> transcribed) {
        List<WordResult> results = new ArrayList<>();
        Set<Integer> usedTranscribed = new HashSet<>();

        for (String exp : expected) {
            String best = null;
            int bestDist = Integer.MAX_VALUE;
            int bestIdx = -1;

            for (int i = 0; i < transcribed.size(); i++) {
                if (usedTranscribed.contains(i)) continue;
                int d = levenshtein(exp, transcribed.get(i));
                if (d < bestDist) { bestDist = d; best = transcribed.get(i); bestIdx = i; }
            }

            String verdict;
            int score;
            if (bestDist == 0) {
                verdict = "CORRECT"; score = 100;
            } else if (bestDist <= 1 || (exp.length() >= 4 && bestDist <= 2)) {
                verdict = "CLOSE"; score = 70;
            } else {
                verdict = "MISSING"; score = 0; best = null;
            }

            if (bestIdx >= 0 && !"MISSING".equals(verdict)) usedTranscribed.add(bestIdx);
            results.add(new WordResult(exp, best, verdict, score));
        }

        return results;
    }

    private int levenshtein(String a, String b) {
        int[] dp = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) dp[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            int prev = dp[0];
            dp[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int temp = dp[j];
                dp[j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? prev
                        : 1 + Math.min(prev, Math.min(dp[j], dp[j - 1]));
                prev = temp;
            }
        }
        return dp[b.length()];
    }
}
