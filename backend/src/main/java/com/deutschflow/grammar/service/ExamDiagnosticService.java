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

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bài chẩn đoán đầu vào của Luyện thi (đợt (f) làm mới Luyện thi, 07/11/2026), telc Deutsch B1.
 *
 * <ol>
 *   <li>{@link #start}: học viên khai ngày thi + phút mỗi ngày ⇒ lưu vào hồ sơ (kỳ thi telc B1), chọn
 *       một đề có sẵn mà học viên ít luyện nhất trong các Teil chẩn đoán.</li>
 *   <li>Đủ mọi Teil như đề thật (owner chốt 13/11/2026; trước đó chỉ Teil 1 mỗi phần): Lesen 1–3,
 *       Sprachbausteine 1–2, Hören 1–3 làm và chấm qua đường luyện đề; Schreiben là đề thật của đề đó,
 *       AI chấm theo phiếu telc B1 ({@code /mock-exams/practice/{id}/schreiben}). Kết quả vào luôn
 *       tiến độ luyện. Danh sách và thứ tự: {@link ExamDiagnosticScoring#TEILE}.</li>
 *   <li>Sprechen: một lượt thi thử phần nói telc B1 với giám khảo AI (chấm theo rubric telc) làm SAU
 *       khi bắt đầu bài chẩn đoán.</li>
 *   <li>{@link #finish}: chốt tỉ lệ đạt từng phần vào {@code result_json}; lộ trình đếm ngược dùng tỉ lệ
 *       này để xếp Teil ưu tiên khi chưa có bài thi thử nào ({@link ExamPlanService}).</li>
 * </ol>
 *
 * <p><b>Lượt bắt đầu từ bản ngắn</b> (đang dở lúc phát hành bản đủ Teil): tiến độ không lưu theo danh
 * sách phần mà đọc từ tiến độ luyện của đề đã chọn, nên Teil đã chấm và nháp đang viết được giữ nguyên;
 * học viên làm tiếp các Teil còn thiếu theo thứ tự thi thật rồi mới chốt. Đề đã chọn mà thiếu Teil nào
 * thì bỏ Teil đó (chỉ bắt buộc bốn Teil lõi). Bài bản ngắn ĐÃ chốt giữ nguyên kết quả, {@link View#shortForm}
 * báo để màn kết quả mời làm lại.
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
    static final String PROVIDER = "TELC";
    static final String LEVEL = "B1";

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

    private final JdbcTemplate jdbc;
    private final ObjectMapper om;
    private final MockExamPracticeService practice;
    private final UserLearningProfileService profileService;
    private final UserLearningProfileRepository profileRepository;

    /**
     * @param teile  khoá Teil chẩn đoán, theo thứ tự làm (sau đó là phần Nói)
     * @param oral   lượt thi nói đã có điểm, làm sau khi bắt đầu bài chẩn đoán; {@code null} nếu chưa
     * @param skills kỹ năng → % (chỉ khi {@code DONE})
     * @param shortForm {@code true} khi kết quả đã chốt là của bài bản ngắn (chỉ Teil 1 mỗi phần)
     */
    public record View(String status, Long examId, List<String> teile, Oral oral, Map<String, Integer> skills,
                       Instant startedAt, Instant finishedAt, boolean shortForm) {
        static View none() {
            return new View(STATUS_NONE, null, ExamDiagnosticScoring.TEILE, null, Map.of(), null, null, false);
        }
    }

    /** Lượt thi nói dùng cho bài chẩn đoán. */
    public record Oral(long sessionId, double total, double max) {}

    @Transactional(readOnly = true)
    public View view(User user) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT exam_id, result_json::text AS result, started_at, finished_at
                FROM exam_diagnostics WHERE user_id = ?
                """, user.getId());
        if (rows.isEmpty()) return View.none();
        Map<String, Object> row = rows.get(0);
        long examId = ((Number) row.get("exam_id")).longValue();
        Instant started = instant(row.get("started_at"));
        Instant finished = instant(row.get("finished_at"));
        Oral oral = oralSince(user.getId(), started);
        if (finished == null) {
            return new View(STATUS_IN_PROGRESS, examId, ExamDiagnosticScoring.TEILE, oral, Map.of(), started, null, false);
        }
        Map<String, Object> result = readResult((String) row.get("result"));
        // Bài đủ Teil ghi thêm "teile" (tỉ lệ từng Teil); kết quả bản ngắn không có khoá này.
        boolean shortForm = !(result.get("teile") instanceof Map<?, ?>);
        return new View(STATUS_DONE, examId, ExamDiagnosticScoring.TEILE, oral, readSkills(result), started, finished,
                shortForm);
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
        profile.setExamType(PROVIDER);
        profile.setTargetLevel(UserLearningProfile.TargetLevel.B1);
        profile.setDailyGoalMinutes(dailyMinutes);
        profileRepository.save(profile);

        long examId = pickExam(user);
        jdbc.update("""
                INSERT INTO exam_diagnostics (user_id, exam_id) VALUES (?, ?)
                ON CONFLICT (user_id) DO UPDATE
                SET exam_id = EXCLUDED.exam_id, result_json = NULL, started_at = now(), finished_at = NULL
                """, user.getId(), examId);
        return view(user);
    }

    /**
     * Chốt kết quả: mọi Teil chẩn đoán mà đề có đều đã chấm (Viết đã có điểm AI) và đã có lượt thi nói
     * sau khi bắt đầu.
     */
    @Transactional
    public View finish(User user) {
        View current = view(user);
        if (!STATUS_IN_PROGRESS.equals(current.status())) throw new BadRequestException("Chưa bắt đầu bài chẩn đoán.");
        PracticeDtos.Overview overview = practice.overview(user, current.examId());
        Map<String, double[]> scores = new LinkedHashMap<>();
        List<String> required = ExamDiagnosticScoring.present(
                overview.teile().stream().map(PracticeDtos.Teil::key).toList());
        for (String core : ExamDiagnosticScoring.CORE_TEILE) {
            if (!required.contains(core)) throw new BadRequestException("Còn phần chưa làm: " + core);
        }
        for (String key : required) {
            PracticeDtos.Teil teil = overview.teile().stream().filter(t -> t.key().equals(key)).findFirst().orElse(null);
            PracticeDtos.Progress p = teil == null ? null : teil.progress();
            if (p == null || !p.checked() || p.score() == null) {
                throw new BadRequestException("Còn phần chưa làm: " + key);
            }
            double max = p.max() != null ? p.max() : teil.maxPoints();
            scores.put(key, new double[] {p.score(), max});
        }
        if (current.oral() == null) throw new BadRequestException("Còn phần chưa làm: " + ExamDiagnosticScoring.ORAL);
        double[] oral = {current.oral().total(), current.oral().max()};
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ratios", ExamDiagnosticScoring.ratios(scores, oral));
        result.put("teile", ExamDiagnosticScoring.teilRatios(scores));
        result.put("skills", ExamDiagnosticScoring.skills(scores, oral));
        result.put("oralSessionId", current.oral().sessionId());
        try {
            jdbc.update("UPDATE exam_diagnostics SET result_json = ?::jsonb, finished_at = now() WHERE user_id = ?",
                    om.writeValueAsString(result), user.getId());
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Không ghi được kết quả chẩn đoán", e);
        }
        return view(user);
    }

    /**
     * Đề cho bài chẩn đoán: trong các đề telc B1 đã duyệt mà học viên mở được và có đủ bốn Teil lõi, ưu
     * tiên đề thiếu ít Teil chẩn đoán nhất (đề đủ cả chín Teil đứng trước), rồi tới đề có ít Teil chẩn
     * đoán đã luyện nhất; bằng nhau thì đề mới nhất (đề cũ nhất để dành cho đề full đầu tiên của lộ trình).
     */
    long pickExam(User user) {
        List<Long> ids = jdbc.queryForList("""
                SELECT id FROM mock_exams
                WHERE exam_format = 'TELC' AND cefr_level = 'B1' AND is_active = TRUE AND reviewed = TRUE
                ORDER BY id DESC
                """, Long.class);
        Long best = null;
        long bestMissing = Long.MAX_VALUE;
        long bestDone = Long.MAX_VALUE;
        for (Long id : ids) {
            PracticeDtos.Overview o;
            try {
                o = practice.overview(user, id);
            } catch (RuntimeException e) {
                continue; // đề khoá với học viên này
            }
            List<String> keys = o.teile().stream().map(PracticeDtos.Teil::key).toList();
            if (!keys.containsAll(ExamDiagnosticScoring.CORE_TEILE)) continue;
            long missing = ExamDiagnosticScoring.TEILE.size() - ExamDiagnosticScoring.present(keys).size();
            long done = o.teile().stream()
                    .filter(t -> ExamDiagnosticScoring.TEILE.contains(t.key()) && t.progress() != null && t.progress().checked())
                    .count();
            if (missing < bestMissing || (missing == bestMissing && done < bestDone)) {
                best = id;
                bestMissing = missing;
                bestDone = done;
            }
        }
        if (best == null) throw new BadRequestException("Chưa có đề nào để làm bài chẩn đoán.");
        return best;
    }

    /** Lượt thi thử phần nói telc B1 có điểm gần nhất, làm từ lúc bắt đầu bài chẩn đoán. */
    private Oral oralSince(long userId, Instant since) {
        if (since == null) return null;
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT session_id, total_points, max_points FROM speaking_exam_results
                WHERE user_id = ? AND provider = ? AND level = ? AND total_points IS NOT NULL
                  AND max_points IS NOT NULL AND created_at >= ?
                ORDER BY created_at DESC LIMIT 1
                """, userId, PROVIDER, LEVEL, Timestamp.from(since));
        if (rows.isEmpty()) return null;
        Map<String, Object> r = rows.get(0);
        return new Oral(((Number) r.get("session_id")).longValue(), ((Number) r.get("total_points")).doubleValue(),
                ((Number) r.get("max_points")).doubleValue());
    }

    private static Instant instant(Object v) {
        return v instanceof Timestamp ts ? ts.toInstant() : null;
    }

    private Map<String, Object> readResult(String json) {
        try {
            return json == null ? Map.of() : om.readValue(json, MAP);
        } catch (Exception e) {
            log.warn("[Diagnostic] Không đọc được kết quả: {}", e.getMessage());
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Integer> readSkills(Map<String, Object> result) {
        Map<String, Integer> out = new LinkedHashMap<>();
        if (result.get("skills") instanceof Map<?, ?> s) {
            ((Map<String, Object>) s).forEach((k, v) -> {
                if (v instanceof Number n) out.put(k, n.intValue());
            });
        }
        return out;
    }
}
