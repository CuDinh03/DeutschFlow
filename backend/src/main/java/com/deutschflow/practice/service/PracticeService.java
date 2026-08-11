package com.deutschflow.practice.service;

import com.deutschflow.gamification.service.XpService;
import com.deutschflow.practice.dto.PracticeExerciseDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.entity.PracticeHistory;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.repository.PracticeHistoryRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeService {

    private final PracticeExerciseRepository exerciseRepository;
    private final PracticeHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final XpService xpService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Page<PracticeExerciseDto> getExercises(String exerciseType, String cefrLevel, String skillType, Pageable pageable) {
        Page<PracticeExercise> page;

        if (exerciseType != null && cefrLevel != null) {
            page = exerciseRepository.findByExerciseTypeAndCefrLevelAndIsActiveTrue(exerciseType, cefrLevel, pageable);
        } else if (exerciseType != null) {
            page = exerciseRepository.findByExerciseTypeAndIsActiveTrue(exerciseType, pageable);
        } else if (cefrLevel != null) {
            page = exerciseRepository.findByCefrLevelAndIsActiveTrue(cefrLevel, pageable);
        } else if (skillType != null) {
            page = exerciseRepository.findBySkillTypeAndIsActiveTrue(skillType, pageable);
        } else {
            page = exerciseRepository.findByIsActiveTrue(pageable);
        }

        return page.map(PracticeExerciseDto::new);
    }

    @Transactional(readOnly = true)
    public PracticeExerciseDto getExerciseById(Long id) {
        return exerciseRepository.findById(id)
                .map(PracticeExerciseDto::new)
                .orElseThrow(() -> new IllegalArgumentException("Practice exercise not found: " + id));
    }

    @Transactional
    public void submitPracticeResult(Long userId, PracticeSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        PracticeExercise exercise = exerciseRepository.findById(request.getPracticeId())
                .orElseThrow(() -> new IllegalArgumentException("Practice exercise not found: " + request.getPracticeId()));

        // SECURITY (QA F-12): the score is re-derived on the server from the stored answer key, NOT
        // trusted from the client. The old code awarded XP straight off request.getScorePercent(), so
        // a direct POST of scorePercent=100 farmed XP without answering. For exercises whose questions
        // carry a correctAnswer we grade here; only answer-less external resources (source_url only)
        // fall back to the client's self-confirmation, clamped to 0..100.
        int scorePercent = resolveServerScore(exercise, request);

        // XP is proportional to score (80% score => 80% of the declared XP)
        int earnedXp = (int) Math.round((scorePercent / 100.0) * exercise.getXpReward());

        PracticeHistory history = PracticeHistory.builder()
                .user(user)
                .practiceExercise(exercise)
                .scorePercent(scorePercent)
                .answerData(request.getAnswerDataJson())
                .xpEarned(earnedXp)
                .completedAt(LocalDateTime.now())
                .build();

        historyRepository.save(history);

        // Award XP only — no streak update (CUSTOM_PRACTICE type bypasses daily streak logic)
        if (earnedXp > 0) {
            xpService.awardCustomPractice(userId, earnedXp,
                    "Bài tập bổ trợ: " + exercise.getCefrLevel() + " " + exercise.getSkillType());
        }

        log.info("User {} completed practice exercise {} — score {}% — earned {} XP",
                userId, exercise.getId(), scorePercent, earnedXp);
    }

    /**
     * Authoritative score for an attempt, computed server-side.
     *
     * <p>If the exercise has any gradable question (a non-blank {@code correctAnswer} in
     * {@code contentJson}), the score is the fraction of gradable questions the learner got right —
     * the client-supplied {@code scorePercent} is ignored entirely. If NO question is gradable (an
     * external resource with only a {@code source_url}), we honour the client's self-confirmation but
     * clamp it to 0..100. Any parsing failure falls back to the clamped client value so a data glitch
     * never hard-fails a submission.
     */
    private int resolveServerScore(PracticeExercise exercise, PracticeSubmitRequest request) {
        int clientClamped = clampPercent(request.getScorePercent());
        try {
            JsonNode content = objectMapper.readTree(
                    exercise.getContentJson() == null ? "{}" : exercise.getContentJson());
            JsonNode questions = content.path("questions");
            if (!questions.isArray() || questions.isEmpty()) {
                return clientClamped;
            }

            Map<String, String> answers = parseSubmittedAnswers(request.getAnswerDataJson());

            int gradable = 0;
            int correct = 0;
            int index = 0;
            for (JsonNode q : questions) {
                index++;
                String key = q.path("correctAnswer").asText("");
                if (key.isBlank()) {
                    continue; // ungradable (e.g. open-ended / external) — excluded from the denominator
                }
                gradable++;
                String qid = q.path("id").asText("q" + index);
                String given = answers.getOrDefault(qid, "");
                if (normalizeAnswer(given).equals(normalizeAnswer(key))) {
                    correct++;
                }
            }

            if (gradable == 0) {
                return clientClamped; // no answer key at all → external resource self-confirm
            }
            return (int) Math.round((correct * 100.0) / gradable);
        } catch (Exception e) {
            log.warn("[Practice] server grading failed for exercise {} — falling back to clamped client score: {}",
                    exercise.getId(), e.getMessage());
            return clientClamped;
        }
    }

    /** Extract the {@code {answers: {qid: value}}} map the runner submits; tolerant of missing/legacy shapes. */
    private Map<String, String> parseSubmittedAnswers(String answerDataJson) {
        Map<String, String> result = new java.util.HashMap<>();
        if (answerDataJson == null || answerDataJson.isBlank()) {
            return result;
        }
        try {
            JsonNode root = objectMapper.readTree(answerDataJson);
            JsonNode answers = root.path("answers");
            if (answers.isObject()) {
                answers.fields().forEachRemaining(e -> result.put(e.getKey(), e.getValue().asText("")));
            }
        } catch (Exception e) {
            log.debug("[Practice] could not parse answerDataJson: {}", e.getMessage());
        }
        return result;
    }

    /** Mirror of the frontend {@code normalizeAnswer}: case/punctuation/whitespace-insensitive compare. */
    private String normalizeAnswer(String raw) {
        return (raw == null ? "" : raw)
                .toLowerCase()
                .replaceAll("[.,!?;:\"'`()\\[\\]{}]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private int clampPercent(Integer value) {
        if (value == null) {
            return 0;
        }
        return Math.max(0, Math.min(100, value));
    }
}
