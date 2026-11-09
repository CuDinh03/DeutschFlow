package com.deutschflow.practice.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.practice.dto.PracticeCatalogItemDto;
import com.deutschflow.practice.dto.PracticeGradeRequest;
import com.deutschflow.practice.dto.PracticeGradeResponse;
import com.deutschflow.practice.dto.PracticeQuizDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.entity.PracticeExercise;
import com.deutschflow.practice.repository.PracticeExerciseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A3 (09/11/2026): thư viện bài tập bổ trợ KHÔNG gửi đáp án xuống trình duyệt trước khi nộp.
 *
 * <p>API cũ ({@code GET /api/practice/exercises[/{id}]}) trả {@code contentJson} nguyên văn, gồm
 * {@code questions[].correctAnswer} + {@code explanation}. Lớp này dựng bản "đề không kèm đáp án"
 * và một đường nộp-rồi-chấm trả đáp án + giải thích SAU khi nộp.
 *
 * <p>Việc ghi lịch sử + cộng XP vẫn đi qua {@link PracticeService#submitPracticeResult} (không sửa
 * logic chấm/XP ở đó). Luật chấm ở đây khớp {@code PracticeService.resolveServerScore}: id câu
 * mặc định {@code q<thứ tự từ 1>}, câu không có {@code correctAnswer} bị loại khỏi mẫu số, so khớp
 * bỏ hoa/thường, dấu câu, khoảng trắng thừa.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PracticeQuizService {

    private final PracticeExerciseRepository exerciseRepository;
    private final PracticeService practiceService;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    /** Danh sách thư viện, không có {@code contentJson}. Chỉ đọc. */
    @Transactional(readOnly = true)
    public Page<PracticeCatalogItemDto> catalog(String exerciseType, String cefrLevel, String skillType,
                                                Pageable pageable) {
        return practiceService.getExercises(exerciseType, cefrLevel, skillType, pageable)
                .map(PracticeCatalogItemDto::from);
    }

    /** Đề đã ẩn đáp án. Chỉ đọc. */
    @Transactional(readOnly = true)
    public PracticeQuizDto quiz(Long id) {
        PracticeExercise exercise = load(id);
        JsonNode content = parseContent(exercise);

        List<PracticeQuizDto.Question> questions = new ArrayList<>();
        int gradableCount = 0;
        int index = 0;
        for (JsonNode q : questionsOf(content)) {
            index++;
            if (!q.isObject()) {
                continue;
            }
            boolean gradable = !q.path("correctAnswer").asText("").isBlank();
            String text = q.path("question").asText("");
            if (text.isBlank()) {
                continue; // client cũ cũng bỏ câu không có đề
            }
            if (gradable) {
                gradableCount++;
            }
            List<String> options = null;
            if (q.path("options").isArray()) {
                options = new ArrayList<>();
                for (JsonNode o : q.path("options")) {
                    if (o.isTextual() && !o.asText().isBlank()) {
                        options.add(o.asText());
                    }
                }
            }
            questions.add(new PracticeQuizDto.Question(
                    q.path("id").asText("q" + index),
                    q.path("type").isTextual() ? q.path("type").asText() : null,
                    text,
                    options,
                    gradable));
        }

        return new PracticeQuizDto(
                exercise.getId(),
                exercise.getExerciseType(),
                exercise.getCefrLevel(),
                exercise.getSkillType(),
                exercise.getExamName(),
                exercise.getSourceName(),
                exercise.getSourceUrl(),
                exercise.getXpReward(),
                textOrNull(content, "title"),
                textOrNull(content, "instructions"),
                textOrNull(content, "readingText"),
                questions,
                gradableCount);
    }

    /**
     * Nộp + chấm: ghi lượt làm (lịch sử + XP) qua {@link PracticeService#submitPracticeResult}, rồi
     * trả đúng/sai, đáp án đúng và giải thích từng câu. POST — có ghi DB.
     */
    @Transactional
    public PracticeGradeResponse grade(Long userId, Long id, PracticeGradeRequest request) {
        PracticeExercise exercise = load(id);
        JsonNode content = parseContent(exercise);
        Map<String, String> answers = request != null && request.answers() != null
                ? request.answers() : Map.of();

        List<PracticeGradeResponse.QuestionResult> results = new ArrayList<>();
        int gradable = 0;
        int correct = 0;
        int index = 0;
        for (JsonNode q : questionsOf(content)) {
            index++;
            if (!q.isObject()) {
                continue;
            }
            String qid = q.path("id").asText("q" + index);
            String key = q.path("correctAnswer").asText("");
            String explanation = q.path("explanation").isTextual() ? q.path("explanation").asText() : null;
            if (key.isBlank()) {
                results.add(new PracticeGradeResponse.QuestionResult(qid, null, null, explanation));
                continue;
            }
            gradable++;
            boolean ok = normalizeAnswer(answers.getOrDefault(qid, "")).equals(normalizeAnswer(key));
            if (ok) {
                correct++;
            }
            results.add(new PracticeGradeResponse.QuestionResult(qid, ok, key, explanation));
        }

        boolean graded = gradable > 0;
        int scorePercent = graded
                ? (int) Math.round((correct * 100.0) / gradable)
                : clampPercent(request != null ? request.scorePercent() : null);

        PracticeSubmitRequest submit = new PracticeSubmitRequest();
        submit.setPracticeId(exercise.getId());
        submit.setScorePercent(scorePercent);
        submit.setAnswerDataJson(answerDataJson(answers, graded ? correct : null, graded ? gradable : null,
                scorePercent, graded));
        Long lastBefore = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(id), 0) FROM practice_history WHERE user_id = ? AND practice_id = ?",
                Long.class, userId, exercise.getId());
        practiceService.submitPracticeResult(userId, submit);

        // Điểm + XP server THẬT SỰ trao (PracticeService có thể có luật riêng, vd. bài ngoài) — đọc lại
        // từ dòng lịch sử vừa ghi thay vì đoán ở đây hay để client tự nhân xpReward.
        Integer xpEarned = null;
        List<Map<String, Object>> recorded = jdbcTemplate.queryForList("""
                SELECT score_percent, xp_earned FROM practice_history
                WHERE user_id = ? AND practice_id = ? AND id > ?
                ORDER BY id DESC LIMIT 1
                """, userId, exercise.getId(), lastBefore == null ? 0L : lastBefore);
        if (recorded != null && !recorded.isEmpty()) {
            Map<String, Object> row = recorded.get(0);
            if (row.get("score_percent") instanceof Number sp) {
                scorePercent = sp.intValue();
            }
            if (row.get("xp_earned") instanceof Number xp) {
                xpEarned = xp.intValue();
            }
        }

        return new PracticeGradeResponse(graded, correct, gradable, scorePercent, xpEarned, results);
    }

    private PracticeExercise load(Long id) {
        return exerciseRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Practice exercise not found: " + id));
    }

    private JsonNode parseContent(PracticeExercise exercise) {
        try {
            JsonNode node = objectMapper.readTree(
                    exercise.getContentJson() == null ? "{}" : exercise.getContentJson());
            // jsonb đọc qua field String đôi khi bị bọc thêm một lớp chuỗi JSON.
            if (node != null && node.isTextual()) {
                node = objectMapper.readTree(node.asText());
            }
            return node == null ? objectMapper.createObjectNode() : node;
        } catch (Exception e) {
            log.warn("[PracticeQuiz] cannot parse contentJson of exercise {}: {}", exercise.getId(), e.getMessage());
            return objectMapper.createObjectNode();
        }
    }

    private static Iterable<JsonNode> questionsOf(JsonNode content) {
        JsonNode qs = content.path("questions");
        return qs.isArray() ? qs : List.of();
    }

    private static String textOrNull(JsonNode content, String field) {
        JsonNode v = content.path(field);
        return v.isTextual() ? v.asText() : null;
    }

    /** Cùng dạng {@code {answers, correct, total, scorePercent, graded}} mà web cũ gửi lên /practice/submit. */
    private String answerDataJson(Map<String, String> answers, Integer correct, Integer total,
                                  int scorePercent, boolean graded) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("answers", answers);
        data.put("correct", correct);
        data.put("total", total);
        data.put("scorePercent", scorePercent);
        data.put("graded", graded);
        try {
            return objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Khớp {@code normalizeAnswer} của PracticeService và của web. */
    static String normalizeAnswer(String raw) {
        return (raw == null ? "" : raw)
                .toLowerCase()
                .replaceAll("[.,!?;:\"'`()\\[\\]{}]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static int clampPercent(Integer value) {
        return value == null ? 0 : Math.max(0, Math.min(100, value));
    }
}
