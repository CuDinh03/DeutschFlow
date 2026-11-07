package com.deutschflow.grammar.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.PracticeDtos;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.UserLearningProfileService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f) làm mới Luyện thi, 07/11/2026).
 *
 * <ol>
 *   <li>{@link #start}: học viên khai ngày thi + phút mỗi ngày ⇒ lưu vào hồ sơ (kỳ thi telc B1), chọn
 *       một đề có sẵn mà học viên ít luyện nhất trong ba Teil chẩn đoán.</li>
 *   <li>Ba Teil khách quan làm và chấm qua đường luyện đề ({@code /mock-exams/practice/.../check}) —
 *       kết quả vào luôn tiến độ luyện, bốn kỹ năng ở màn Hôm nay đọc được ngay.</li>
 *   <li>{@link #saveSelf}: tự đánh giá Viết và Nói (1–4).</li>
 *   <li>{@link #finish}: chốt tỉ lệ đạt từng phần vào {@code result_json}; lộ trình đếm ngược dùng tỉ lệ
 *       này để xếp Teil ưu tiên khi chưa có bài thi thử nào ({@link ExamPlanService}).</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExamDiagnosticService {

    public static final String STATUS_NONE = "NONE";
    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_DONE = "DONE";
    static final int MIN_DAILY_MINUTES = 10;
    static final int MAX_DAILY_MINUTES = 240;

    private static final TypeReference<Map<String, Integer>> SELF = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;
    private final MockExamPracticeService practice;
    private final UserLearningProfileService profileService;
    private final UserLearningProfileRepository profileRepository;

    /**
     * @param teile  khoá Teil chẩn đoán, theo thứ tự làm
     * @param self   phần → mức tự đánh giá đã chọn
     * @param skills kỹ năng → % (chỉ khi {@code DONE})
     * @param selfRated kỹ năng tính từ tự đánh giá
     */
    public record View(String status, Long examId, List<String> teile, Map<String, Integer> self,
                       Map<String, Integer> skills, List<String> selfRated, Instant finishedAt) {
        static View none() {
            return new View(STATUS_NONE, null, ExamDiagnosticScoring.TEILE, Map.of(), Map.of(), List.of(), null);
        }
    }

    @Transactional(readOnly = true)
    public View view(User user) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT exam_id, self_json::text AS self, result_json::text AS result, finished_at
                FROM exam_diagnostics WHERE user_id = ?
                """, user.getId());
        if (rows.isEmpty()) return View.none();
        Map<String, Object> row = rows.get(0);
        long examId = ((Number) row.get("exam_id")).longValue();
        Map<String, Integer> self = readSelf((String) row.get("self"));
        Instant finished = row.get("finished_at") instanceof java.sql.Timestamp ts ? ts.toInstant() : null;
        if (finished == null) {
            return new View(STATUS_IN_PROGRESS, examId, ExamDiagnosticScoring.TEILE, self, Map.of(), List.of(), null);
        }
        Map<String, Integer> skills = readSkills((String) row.get("result"));
        return new View(STATUS_DONE, examId, ExamDiagnosticScoring.TEILE, self, skills,
                ExamDiagnosticScoring.SELF_SKILLS, finished);
    }

    /** Bắt đầu (hoặc làm lại) bài chẩn đoán: lưu ngày thi + phút mỗi ngày, chọn đề. */
    @Transactional
    public View start(User user, LocalDate targetDate, Integer dailyMinutes) {
        practice.assertAccess(user);
        if (dailyMinutes == null || dailyMinutes < MIN_DAILY_MINUTES || dailyMinutes > MAX_DAILY_MINUTES) {
            throw new BadRequestException("Số phút mỗi ngày phải từ " + MIN_DAILY_MINUTES + " đến " + MAX_DAILY_MINUTES + ".");
        }
        if (targetDate == null || !targetDate.isAfter(LocalDate.now())) {
            throw new BadRequestException("Ngày thi phải sau hôm nay.");
        }
        profileService.updateTargetDate(user, targetDate);
        UserLearningProfile profile = profileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning profile not found. Please complete onboarding first."));
        // Màn chẩn đoán chỉ có telc Deutsch B1 — học viên chọn kỳ thi này một cách tường minh.
        profile.setExamType("TELC");
        profile.setTargetLevel(UserLearningProfile.TargetLevel.B1);
        profile.setDailyGoalMinutes(dailyMinutes);
        profileRepository.save(profile);

        long examId = pickExam(user);
        jdbc.update("""
                INSERT INTO exam_diagnostics (user_id, exam_id) VALUES (?, ?)
                ON CONFLICT (user_id) DO UPDATE
                SET exam_id = EXCLUDED.exam_id, self_json = '{}'::jsonb, result_json = NULL,
                    started_at = now(), finished_at = NULL
                """, user.getId(), examId);
        return view(user);
    }

    /** Lưu tự đánh giá một phần (Viết / Nói), mức 1–4. */
    @Transactional
    public View saveSelf(User user, String skill, Integer level) {
        if (skill == null || !ExamDiagnosticScoring.SELF_SKILLS.contains(skill)) {
            throw new BadRequestException("Phần tự đánh giá không hợp lệ.");
        }
        if (level == null || level < 1 || level > 4) throw new BadRequestException("Mức tự đánh giá phải từ 1 đến 4.");
        int n = jdbc.update("""
                UPDATE exam_diagnostics SET self_json = self_json || jsonb_build_object(?::text, ?::int)
                WHERE user_id = ? AND finished_at IS NULL
                """, skill, level, user.getId());
        if (n == 0) throw new BadRequestException("Chưa bắt đầu bài chẩn đoán.");
        return view(user);
    }

    /** Chốt kết quả: ba Teil phải đã kiểm tra, hai phần tự đánh giá phải đã chọn. */
    @Transactional
    public View finish(User user) {
        View current = view(user);
        if (!STATUS_IN_PROGRESS.equals(current.status())) throw new BadRequestException("Chưa bắt đầu bài chẩn đoán.");
        PracticeDtos.Overview overview = practice.overview(user, current.examId());
        Map<String, double[]> scores = new LinkedHashMap<>();
        for (String key : ExamDiagnosticScoring.TEILE) {
            PracticeDtos.Teil teil = overview.teile().stream().filter(t -> t.key().equals(key)).findFirst().orElse(null);
            PracticeDtos.Progress p = teil == null ? null : teil.progress();
            if (p == null || !p.checked() || p.score() == null) {
                throw new BadRequestException("Còn phần chưa làm: " + key);
            }
            double max = p.max() != null ? p.max() : teil.maxPoints();
            scores.put(key, new double[] {p.score(), max});
        }
        for (String skill : ExamDiagnosticScoring.SELF_SKILLS) {
            if (!current.self().containsKey(skill)) throw new BadRequestException("Còn phần chưa làm: " + skill);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ratios", ExamDiagnosticScoring.ratios(scores, current.self()));
        result.put("skills", ExamDiagnosticScoring.skills(scores, current.self()));
        try {
            jdbc.update("UPDATE exam_diagnostics SET result_json = ?::jsonb, finished_at = now() WHERE user_id = ?",
                    om.writeValueAsString(result), user.getId());
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Không ghi được kết quả chẩn đoán", e);
        }
        return view(user);
    }

    /**
     * Đề cho bài chẩn đoán: trong các đề telc B1 đã duyệt mà học viên mở được, đề có ít Teil chẩn đoán
     * đã luyện nhất; bằng nhau thì đề mới nhất (đề cũ nhất để dành cho đề full đầu tiên của lộ trình).
     */
    long pickExam(User user) {
        List<Long> ids = jdbc.queryForList("""
                SELECT id FROM mock_exams
                WHERE exam_format = 'TELC' AND cefr_level = 'B1' AND is_active = TRUE AND reviewed = TRUE
                ORDER BY id DESC
                """, Long.class);
        Long best = null;
        long bestDone = Long.MAX_VALUE;
        for (Long id : ids) {
            PracticeDtos.Overview o;
            try {
                o = practice.overview(user, id);
            } catch (RuntimeException e) {
                continue; // đề khoá với học viên này
            }
            if (!o.teile().stream().map(PracticeDtos.Teil::key).toList().containsAll(ExamDiagnosticScoring.TEILE)) continue;
            long done = o.teile().stream()
                    .filter(t -> ExamDiagnosticScoring.TEILE.contains(t.key()) && t.progress() != null && t.progress().checked())
                    .count();
            if (done < bestDone) {
                best = id;
                bestDone = done;
            }
        }
        if (best == null) throw new BadRequestException("Chưa có đề nào để làm bài chẩn đoán.");
        return best;
    }

    private Map<String, Integer> readSelf(String json) {
        try {
            return json == null ? Map.of() : om.readValue(json, SELF);
        } catch (Exception e) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Integer> readSkills(String json) {
        try {
            Map<String, Object> m = json == null ? Map.of() : om.readValue(json, MAP);
            Map<String, Integer> out = new LinkedHashMap<>();
            if (m.get("skills") instanceof Map<?, ?> s) {
                ((Map<String, Object>) s).forEach((k, v) -> {
                    if (v instanceof Number n) out.put(k, n.intValue());
                });
            }
            return out;
        } catch (Exception e) {
            log.warn("[Diagnostic] Không đọc được kết quả: {}", e.getMessage());
            return Map.of();
        }
    }
}
