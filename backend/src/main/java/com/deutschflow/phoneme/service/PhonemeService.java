package com.deutschflow.phoneme.service;

import com.deutschflow.curriculum.service.WhisperApiClient;
import com.deutschflow.phoneme.dto.PhonemeEvalResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Phoneme Coach Service — evaluates user pronunciation by:
 * 1. Sending audio to Whisper STT (German language mode)
 * 2. Comparing transcription to target word-by-word using Levenshtein
 * 3. Returning a 0-100 score + per-word correctness
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PhonemeService {

    private final WhisperApiClient whisperClient;

    /**
     * Evaluate pronunciation of {@code target} from audio bytes.
     *
     * @param audioBytes raw audio (WebM/WAV/MP3)
     * @param filename   original filename for Whisper
     * @param target     the expected German text
     */
    public PhonemeEvalResponse evaluate(byte[] audioBytes, String filename, String target) {
        // 1. Transcribe
        String transcribed = whisperClient.transcribeText(audioBytes, filename);

        if (transcribed == null || transcribed.isBlank()) {
            return new PhonemeEvalResponse(
                    "", target, 0, "😶",
                    "Không nghe được giọng nói. Hãy thử lại!",
                    List.of()
            );
        }

        // 2. Word-level comparison
        String[] targetWords = normalize(target).split("\\s+");
        String[] transcribedWords = normalize(transcribed).split("\\s+");

        List<PhonemeEvalResponse.WordResult> wordResults = new ArrayList<>();
        int matchCount = 0;

        for (int i = 0; i < targetWords.length; i++) {
            String tw = targetWords[i];
            // Find best matching transcribed word (allow position drift ±1)
            double bestSim = 0.0;
            if (transcribedWords.length > 0) {
                int lo = Math.max(0, i - 1);
                int hi = Math.min(transcribedWords.length - 1, i + 1);
                for (int j = lo; j <= hi; j++) {
                    double sim = similarity(tw, transcribedWords[j]);
                    if (sim > bestSim) bestSim = sim;
                }
            }
            boolean correct = bestSim >= 0.75;
            if (correct) matchCount++;
            wordResults.add(new PhonemeEvalResponse.WordResult(tw, correct, bestSim));
        }

        // 3. Score (word-level accuracy)
        int score = targetWords.length > 0
                ? (int) Math.round(100.0 * matchCount / targetWords.length)
                : 0;

        // 4. Feedback
        String emoji;
        String feedbackVi;
        if (score >= 90) {
            emoji = "🌟";
            feedbackVi = "Tuyệt vời! Phát âm rất chuẩn!";
        } else if (score >= 70) {
            emoji = "😊";
            feedbackVi = "Khá tốt! Thử lại một lần nữa để hoàn hảo hơn.";
        } else if (score >= 50) {
            emoji = "😅";
            feedbackVi = "Cần luyện thêm. Hãy nghe lại và phát âm chậm hơn.";
        } else {
            emoji = "💪";
            feedbackVi = "Hãy thử lại! Nghe kỹ âm thanh trước khi nói.";
        }

        log.info("[Phoneme] target='{}' transcribed='{}' score={}", target, transcribed, score);
        return new PhonemeEvalResponse(transcribed, target, score, emoji, feedbackVi, wordResults);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /** Lowercase, strip punctuation, normalize umlauts for comparison */
    private String normalize(String text) {
        return text.toLowerCase()
                .replaceAll("[.!?,;:\"'()\\[\\]{}]", "")
                .replaceAll("ä", "ae").replaceAll("ö", "oe")
                .replaceAll("ü", "ue").replaceAll("ß", "ss")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Normalized Levenshtein similarity: 1.0 = identical, 0.0 = completely different.
     */
    private double similarity(String a, String b) {
        if (a.equals(b)) return 1.0;
        int maxLen = Math.max(a.length(), b.length());
        if (maxLen == 0) return 1.0;
        int dist = levenshtein(a, b);
        return 1.0 - (double) dist / maxLen;
    }

    private int levenshtein(String a, String b) {
        int la = a.length(), lb = b.length();
        int[][] dp = new int[la + 1][lb + 1];
        for (int i = 0; i <= la; i++) dp[i][0] = i;
        for (int j = 0; j <= lb; j++) dp[0][j] = j;
        for (int i = 1; i <= la; i++) {
            for (int j = 1; j <= lb; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1), dp[i-1][j-1] + cost);
            }
        }
        return dp[la][lb];
    }
}
