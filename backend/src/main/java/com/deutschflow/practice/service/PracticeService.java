package com.deutschflow.practice.service;

import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.practice.dto.PracticeExerciseDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.dto.PracticeSubmitResponse;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.entity.PracticeHistory;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.deutschflow.practice.repository.PracticeHistoryRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class PracticeService {

    /** Micrometer → Prometheus {@code practice_score_fallback_total{reason=...}}. */
    static final String FALLBACK_METRIC = "practice.score.fallback";

    /**
     * Khoá advisory 2 tham số, lớp 2 = "XP bài external theo ngày". Tách khỏi lớp 1 của
     * {@code XpService.lockUserXp} và khoá 1 tham số của {@code SubscriptionActivationService}.
     */
    private static final int EXTERNAL_XP_LOCK_CLASS = 2;

    private final PracticeExerciseRepository exerciseRepository;
    private final PracticeHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final XpService xpService;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final Clock clock;
    private final JdbcTemplate jdbcTemplate;
    private final int externalCompletionXp;

    public PracticeService(PracticeExerciseRepository exerciseRepository,
                           PracticeHistoryRepository historyRepository,
                           UserRepository userRepository,
                           XpService xpService,
                           ObjectMapper objectMapper,
                           MeterRegistry meterRegistry,
                           Clock clock,
                           JdbcTemplate jdbcTemplate,
                           @Value("${app.practice.external-completion-xp:5}") int externalCompletionXp) {
        this.exerciseRepository = exerciseRepository;
        this.historyRepository = historyRepository;
        this.userRepository = userRepository;
        this.xpService = xpService;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.clock = clock;
        this.jdbcTemplate = jdbcTemplate;
        this.externalCompletionXp = Math.max(0, externalCompletionXp);
    }

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

    /**
     * Ghi một lần làm bài bổ trợ và cộng XP.
     *
     * <p>SECURITY (QA F-12, A2 09/11/2026): điểm và XP KHÔNG BAO GIỜ lấy từ {@code scorePercent} client
     * gửi (trường chỉ còn để client cũ không lỗi 400).
     * <ul>
     *   <li>Bài có đáp án → server chấm theo {@code correctAnswer}; XP = điểm% × {@code xp_reward}.</li>
     *   <li>Bài "external" (có {@code source_url}, không có câu nào chấm được) → XP CỐ ĐỊNH nhỏ
     *       ({@code app.practice.external-completion-xp}) cho lần tự xác nhận, tối đa 1 lần/bài/ngày giờ VN.</li>
     *   <li>Mọi trường hợp không chấm được (JSON lỗi, không có câu hỏi, không có đáp án, không có câu
     *       trả lời) → 0 điểm, 0 XP, log + metric {@code practice_score_fallback_total{reason}}.</li>
     * </ul>
     */
    @Transactional
    public PracticeSubmitResponse submitPracticeResult(Long userId, PracticeSubmitRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        PracticeExercise exercise = exerciseRepository.findById(request.getPracticeId())
                .orElseThrow(() -> new IllegalArgumentException("Practice exercise not found: " + request.getPracticeId()));

        Instant now = clock.instant();
        Grade grade = grade(exercise, request);

        int earnedXp;
        if (grade.external()) {
            earnedXp = externalCompletionXpToday(userId, exercise, now);
        } else {
            // XP tỉ lệ với điểm server chấm (80% điểm → 80% XP khai báo).
            earnedXp = (int) Math.round((grade.scorePercent() / 100.0) * exercise.getXpReward());
        }

        PracticeHistory history = PracticeHistory.builder()
                .user(user)
                .practiceExercise(exercise)
                .scorePercent(grade.scorePercent())
                .answerData(request.getAnswerDataJson())
                .xpEarned(earnedXp)
                .completedAt(toStoredLocal(now))
                .build();

        historyRepository.save(history);

        // Award XP only — no streak update (CUSTOM_PRACTICE type bypasses daily streak logic)
        if (earnedXp > 0) {
            xpService.awardCustomPractice(userId, earnedXp,
                    "Bài tập bổ trợ: " + exercise.getCefrLevel() + " " + exercise.getSkillType());
        }

        log.info("User {} completed practice exercise {} — score {}% (graded={}, external={}) — earned {} XP",
                userId, exercise.getId(), grade.scorePercent(), grade.graded(), grade.external(), earnedXp);
        return new PracticeSubmitResponse(grade.scorePercent(), earnedXp, grade.graded(), grade.external());
    }

    /** Kết quả chấm phía server. */
    record Grade(int scorePercent, boolean graded, boolean external) {
        static Grade graded(int score) { return new Grade(score, true, false); }
        static Grade externalCompletion() { return new Grade(0, false, true); }
        static Grade zero() { return new Grade(0, false, false); }
    }

    /**
     * Điểm có thẩm quyền cho một lần nộp, tính hoàn toàn ở server.
     *
     * <p>Có ít nhất một câu chấm được ({@code correctAnswer} không rỗng) → điểm = tỉ lệ câu đúng trên
     * số câu chấm được. Không câu nào chấm được mà bài có {@code source_url} → bài external (XP cố
     * định). Mọi trường hợp còn lại → 0 + {@link #fallback}.
     */
    Grade grade(PracticeExercise exercise, PracticeSubmitRequest request) {
        JsonNode content;
        try {
            content = objectMapper.readTree(
                    exercise.getContentJson() == null ? "{}" : exercise.getContentJson());
        } catch (Exception e) {
            return fallback(exercise, "content_parse_error", e.getMessage());
        }
        if (content == null) {
            return fallback(exercise, "content_parse_error", "empty content");
        }
        JsonNode questions = content.path("questions");
        boolean hasQuestions = questions.isArray() && !questions.isEmpty();

        int gradable = 0;
        if (hasQuestions) {
            for (JsonNode q : questions) {
                if (!q.path("correctAnswer").asText("").isBlank()) {
                    gradable++;
                }
            }
        }
        if (gradable == 0) {
            if (isExternal(exercise)) {
                return Grade.externalCompletion();
            }
            return fallback(exercise, hasQuestions ? "no_answer_key" : "no_questions", null);
        }

        Map<String, String> answers = parseSubmittedAnswers(request.getAnswerDataJson());
        if (answers == null) {
            return fallback(exercise, "answers_parse_error", null);
        }
        if (answers.isEmpty()) {
            return fallback(exercise, "no_answers", null);
        }

        int correct = 0;
        int index = 0;
        for (JsonNode q : questions) {
            index++;
            String key = q.path("correctAnswer").asText("");
            if (key.isBlank()) {
                continue; // ungradable (e.g. open-ended) — excluded from the denominator
            }
            String qid = q.path("id").asText("q" + index);
            String given = answers.getOrDefault(qid, "");
            if (normalizeAnswer(given).equals(normalizeAnswer(key))) {
                correct++;
            }
        }
        return Grade.graded((int) Math.round((correct * 100.0) / gradable));
    }

    private Grade fallback(PracticeExercise exercise, String reason, String detail) {
        log.warn("[Practice] cannot grade exercise {} ({}){} — score 0, client scorePercent ignored",
                exercise.getId(), reason, detail == null ? "" : ": " + detail);
        meterRegistry.counter(FALLBACK_METRIC, "reason", reason).increment();
        return Grade.zero();
    }

    private static boolean isExternal(PracticeExercise exercise) {
        return exercise.getSourceUrl() != null && !exercise.getSourceUrl().isBlank();
    }

    /**
     * XP cố định cho bài external, tối đa 1 lần/bài/người/ngày giờ VN; lần thứ hai trong ngày → 0.
     * Không vượt {@code xp_reward} của bài. Khoá advisory theo user để hai request song song không
     * cùng lọt qua bước kiểm tra.
     */
    private int externalCompletionXpToday(Long userId, PracticeExercise exercise, Instant now) {
        int declared = exercise.getXpReward() == null ? 0 : Math.max(0, exercise.getXpReward());
        int xp = Math.min(externalCompletionXp, declared);
        if (xp <= 0) {
            return 0;
        }
        jdbcTemplate.query("SELECT pg_advisory_xact_lock(?, ?)", rs -> null,
                EXTERNAL_XP_LOCK_CLASS, userId.intValue());
        Instant[] bounds = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        boolean alreadyRewarded = historyRepository.existsRewardedCompletionBetween(
                userId, exercise.getId(), toStoredLocal(bounds[0]), toStoredLocal(bounds[1]));
        return alreadyRewarded ? 0 : xp;
    }

    /**
     * {@code completed_at} lưu {@link LocalDateTime} theo múi giờ JVM (đúng như {@code LocalDateTime.now()}
     * trước đây) — mốc ngày VN phải đổi về cùng hệ quy chiếu đó thì mới so được.
     */
    private static LocalDateTime toStoredLocal(Instant instant) {
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }

    /**
     * Extract the {@code {answers: {qid: value}}} map the runner submits. Missing/legacy shapes → empty
     * map; malformed JSON → {@code null}.
     */
    private Map<String, String> parseSubmittedAnswers(String answerDataJson) {
        Map<String, String> result = new HashMap<>();
        if (answerDataJson == null || answerDataJson.isBlank()) {
            return result;
        }
        try {
            JsonNode root = objectMapper.readTree(answerDataJson);
            JsonNode answers = root == null ? null : root.path("answers");
            if (answers != null && answers.isObject()) {
                answers.fields().forEachRemaining(e -> result.put(e.getKey(), e.getValue().asText("")));
            }
        } catch (Exception e) {
            log.debug("[Practice] could not parse answerDataJson: {}", e.getMessage());
            return null;
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
}
