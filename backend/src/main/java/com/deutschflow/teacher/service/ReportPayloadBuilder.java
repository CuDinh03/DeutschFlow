package com.deutschflow.teacher.service;

import com.deutschflow.organization.repository.ClassCurriculumLinkRepository;
import com.deutschflow.organization.repository.OrgCurriculumRepository;
import com.deutschflow.organization.repository.OrgCurriculumVersionRepository;
import com.deutschflow.organization.service.OrgSettingsService;
import com.deutschflow.teacher.dto.MySkillReportDto;
import com.deutschflow.teacher.dto.SkillReportDto;
import com.deutschflow.teacher.dto.StudentEvaluationDto;
import com.deutschflow.teacher.entity.ClassStudent;
import com.deutschflow.teacher.entity.ClassStudentId;
import com.deutschflow.teacher.entity.ClassTeacher;
import com.deutschflow.teacher.entity.StudentReportIssue;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Dựng {@code payload_json} — TOÀN BỘ nội dung một phiếu gửi gia đình tại thời điểm phát hành (R2/R4,
 * thiết kế 10/09/2026 §3.3). Trang công khai, PDF và màn "phiếu đã gửi gia đình" của học viên đều đọc
 * từ bản này, không đọc lại bảng nguồn.
 *
 * <p><b>Nguồn số liệu = đúng những gì học viên đã thấy</b> ở tab Đánh giá (thiết kế §1.2 "đây là nội
 * dung phiếu phụ huynh, đã gom đúng một chỗ"): bốn kỹ năng + nhận xét qua
 * {@link StudentEvaluationService#mySkillReport} (điểm giáo viên nhập, thiếu thì trung bình bài đã CHỐT
 * gắn kỹ năng — không bao giờ là đề xuất AI), chuyên cần + điểm bài + điều kiện chứng nhận qua
 * {@link StudentEvaluationService#evaluationOf}. Không có phép tính mới ở đây.
 *
 * <p><b>Danh sách cấm (R4, §3.5.5):</b> email học viên, ngày sinh thô, ghi âm/transcript, nội dung bài,
 * {@code ai_score}/{@code ai_feedback}, tin nhắn. {@link #assertNoForbiddenKeys} quét khoá của map đã
 * dựng trước khi trả về — một PR sau lỡ nhét {@code aiScore} vào là nổ ở unit test, không phải ở nhà
 * phụ huynh. Chỉ số XP/token KHÔNG dùng (retention 90–180 ngày, §3.3 mục 7).
 *
 * <p>Giá trị trong map chỉ gồm String / Number / Boolean / List / Map (JSON thuần) để Hibernate ghi
 * {@code jsonb} và Jackson đọc lại không cần cấu hình gì thêm; mốc thời gian là chuỗi ISO-8601.
 *
 * <p>KHÔNG kiểm quyền — {@code ReportIssueService} đã chứng minh người gọi là giáo viên phụ trách.
 */
@Component
@RequiredArgsConstructor
public class ReportPayloadBuilder {

    /** Tăng khi hình dạng payload đổi; client đọc để render tương thích ngược. */
    public static final int SCHEMA_VERSION = 1;

    /** Bốn kỹ năng, đúng thứ tự in trên phiếu (§3.3 mục 3). */
    public static final List<String> SKILL_CODES = List.of("HOREN", "LESEN", "SCHREIBEN", "SPRECHEN");

    /**
     * Mảnh khoá (chữ thường) không bao giờ được xuất hiện trong payload — kiểm đệ quy mọi cấp.
     * {@code ai} trần cố ý KHÔNG nằm đây (sẽ bắt nhầm "email"-kiểu tự do như "detail"); bắt đúng ba
     * dạng tên cột/thuộc tính AI đang có trong repo.
     */
    static final Set<String> FORBIDDEN_KEY_FRAGMENTS = Set.of(
            "email", "ai_", "aiscore", "aifeedback", "aigraded", "transcript", "audio",
            "birth", "message", "submission", "phone");

    /** Trần phút mỗi phiên nói khi cộng dồn — phiên zombie bị sweeper đóng sau nhiều giờ không thành "300 phút". */
    static final int SPEAKING_SESSION_MINUTES_CAP = 120;

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final StudentEvaluationService evaluationService;
    private final ObjectiveAssessmentService objectiveAssessmentService;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassCurriculumLinkRepository curriculumLinkRepository;
    private final OrgCurriculumVersionRepository curriculumVersionRepository;
    private final OrgCurriculumRepository curriculumRepository;
    private final UserRepository userRepository;
    private final OrgSettingsService orgSettingsService;
    private final JdbcTemplate jdbcTemplate;

    /**
     * @param cls      lớp (đã tồn tại, đã kiểm quyền)
     * @param student  học viên (đã thuộc lớp)
     * @param period   MIDTERM/FINAL — khối chứng nhận CHỈ có ở FINAL (R10)
     * @param lang     ngôn ngữ phiếu (đã chuẩn hoá)
     * @param issuedAt mốc phát hành, dùng chung cho mọi ngày tháng trong phiếu
     * @param orgName  tên trung tâm đã snapshot ({@code null} = lớp B2C)
     * @param orgLogoUrl logo trung tâm đã snapshot
     */
    public Map<String, Object> build(TeacherClass cls, User student, StudentReportIssue.Period period,
                                     String lang, Instant issuedAt, String orgName, String orgLogoUrl) {
        Long classId = cls.getId();
        Long studentId = student.getId();
        StudentEvaluationDto eval = evaluationService.evaluationOf(classId, studentId);
        MySkillReportDto skills = evaluationService.mySkillReport(studentId, classId);
        StudentEvaluationService.AssignmentCounts counts = evaluationService.assignmentCountsOf(classId, studentId);

        Map<String, Object> p = new LinkedHashMap<>();
        p.put("schemaVersion", SCHEMA_VERSION);
        p.put("period", period.name());
        p.put("lang", lang);
        p.put("issuedAt", issuedAt.toString());
        p.put("org", orgName == null ? null : map("name", orgName, "logoUrl", orgLogoUrl));
        // Không chép id nội bộ vào payload: chúng đã nằm ở cột class_id/student_id của dòng phiếu, còn
        // payload thì đi ra trang công khai — không có lý do để phụ huynh (hay ai cầm link) thấy id.
        p.put("class", map(
                "name", cls.getName(),
                "level", classLevelOf(classId),
                "primaryTeacherName", primaryTeacherNameOf(classId)));
        p.put("student", map(
                "name", displayNameOf(student),
                "joinedAt", joinedDateOf(classId, studentId)));

        List<Map<String, Object>> skillRows = new ArrayList<>();
        skillRows.add(skillRow("HOREN", skills.horen()));
        skillRows.add(skillRow("LESEN", skills.lesen()));
        skillRows.add(skillRow("SCHREIBEN", skills.schreiben()));
        skillRows.add(skillRow("SPRECHEN", skills.sprechen()));
        p.put("skills", skillRows);
        p.put("overall", map("score", round1(skills.total()), "grade", SkillReportDto.gradeCodeOf(skills.total())));

        int recorded = eval.recordedSessions();
        Integer ratePct = recorded > 0
                ? (int) Math.round(100.0 * (eval.presentCount() + eval.lateCount()) / recorded)
                : null;
        p.put("attendance", map(
                "present", eval.presentCount(),
                "absent", eval.absentCount(),
                "late", eval.lateCount(),
                "recorded", recorded,
                "ratePct", ratePct));

        p.put("assignments", map(
                "avgScore", counts.confirmed() > 0 ? round1(eval.avgScore()) : null,
                "confirmed", counts.confirmed(),
                "awaitingTeacher", counts.awaitingTeacher()));

        p.put("objectives", objectiveAssessmentService.summaryFor(classId, studentId)
                .map(s -> map(
                        "total", s.total(),
                        "achieved", s.achieved(),
                        "needsPractice", s.needsPractice(),
                        "notAssessed", s.notAssessed(),
                        "needsPracticeItems", s.needsPracticeItems()))
                .orElse(null));

        p.put("selfStudy", selfStudyOf(studentId));

        // Nguyên văn — không dịch, không cắt (§5 mặc định). Chuỗi rỗng ⇒ null để client/PDF in "chưa có".
        String comment = skills.teacherComment();
        p.put("teacherComment", comment == null || comment.isBlank() ? null : comment);
        p.put("evaluatedAt", skills.evaluatedAt() == null ? null : skills.evaluatedAt().atZone(ZONE).toInstant().toString());

        if (period == StudentReportIssue.Period.FINAL) {
            Long orgId = cls.getOrgId();
            p.put("certificate", map(
                    "eligible", eval.certificateEligible(),
                    "minAvgScore", orgSettingsService.getInt(orgId, OrgSettingsService.CERTIFICATE_MIN_AVG),
                    "minAttendancePct", orgSettingsService.getInt(orgId, OrgSettingsService.CERTIFICATE_MIN_ATTENDANCE_PCT)));
        } else {
            p.put("certificate", null);
        }

        assertNoForbiddenKeys(p, "");
        return p;
    }

    // ── mảnh ──────────────────────────────────────────────────────────────────

    private static Map<String, Object> skillRow(String code, Double score) {
        return map("code", code, "score", round1(score), "grade", SkillReportDto.gradeCodeOf(score));
    }

    /** Tên hiện tại của giáo viên PRIMARY; nhiều PRIMARY (dữ liệu cũ) ⇒ người vào lớp sớm nhất. */
    private String primaryTeacherNameOf(Long classId) {
        return classTeacherRepository.findByIdClassId(classId).stream()
                .filter(ct -> "PRIMARY".equals(ct.getRole()))
                .sorted((a, b) -> {
                    if (a.getJoinedAt() == null || b.getJoinedAt() == null) return 0;
                    return a.getJoinedAt().compareTo(b.getJoinedAt());
                })
                .map(ClassTeacher::getId)
                .map(id -> userRepository.findById(id.getTeacherId()).map(ReportPayloadBuilder::displayNameOf).orElse(null))
                .filter(n -> n != null)
                .findFirst()
                .orElse(null);
    }

    /** Cấp CEFR của giáo trình đã gán cho lớp; lớp không gắn giáo trình ⇒ null (ô bị ẩn). */
    private String classLevelOf(Long classId) {
        return curriculumLinkRepository.findByClassId(classId)
                .flatMap(link -> curriculumVersionRepository.findById(link.getVersionId()))
                .flatMap(v -> curriculumRepository.findById(v.getCurriculumId()))
                .map(c -> c.getCefrLevel())
                .filter(l -> l != null && !l.isBlank())
                .orElse(null);
    }

    private String joinedDateOf(Long classId, Long studentId) {
        return classStudentRepository.findById(new ClassStudentId(classId, studentId))
                .map(ClassStudent::getJoinedAt)
                .map(t -> t.toLocalDate().toString())
                .orElse(null);
    }

    /**
     * Tự học ngoài lớp — TỔNG HỢP, không chi tiết (R4): số phiên nói AI đã kết thúc + tổng phút (mỗi
     * phiên chặn trần {@value #SPEAKING_SESSION_MINUTES_CAP}′), số thẻ từ vựng "đã thuộc" (FSRS
     * stability ≥ 21 ngày — cùng định nghĩa với dashboard học viên), số bài tự học đã hoàn thành.
     * Ba nguồn đều là bảng sống không có job xoá theo hạn, khác {@code user_xp_events}/{@code ai_token_usage_events}.
     */
    private Map<String, Object> selfStudyOf(Long studentId) {
        Map<String, Object> speaking = jdbcTemplate.queryForMap("""
                SELECT COUNT(*) AS sessions,
                       COALESCE(SUM(LEAST(GREATEST(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60, 0), ?)), 0) AS minutes
                  FROM ai_speaking_sessions
                 WHERE user_id = ? AND status = 'ENDED' AND ended_at IS NOT NULL
                """, SPEAKING_SESSION_MINUTES_CAP, studentId);
        Long vocabMastered = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM vocab_review_schedule WHERE user_id = ? AND stability >= 21",
                Long.class, studentId);
        Long lessonsCompleted = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM learning_session_progress WHERE user_id = ? AND status = 'COMPLETED'",
                Long.class, studentId);
        return map(
                "speakingSessions", ((Number) speaking.get("sessions")).intValue(),
                "speakingMinutes", (int) Math.round(((Number) speaking.get("minutes")).doubleValue()),
                "vocabMastered", vocabMastered == null ? 0 : vocabMastered.intValue(),
                "lessonsCompleted", lessonsCompleted == null ? 0 : lessonsCompleted.intValue());
    }

    private static String displayNameOf(User u) {
        String name = u.getDisplayName();
        return name == null || name.isBlank() ? "Học viên" : name.trim();
    }

    private static Double round1(Double v) {
        return v == null ? null : Math.round(v * 10.0) / 10.0;
    }

    /** {@link LinkedHashMap} chấp nhận giá trị null (Map.of không) — thứ tự khoá ổn định để JSON đọc được. */
    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    /**
     * Quét đệ quy mọi KHOÁ của payload; gặp mảnh cấm ⇒ ném. Đây là lưới chặn PR sau, không phải kiểm
     * đầu vào: ném {@link IllegalStateException} để lỗi lập trình không hoá thành 400/409 "của người dùng".
     */
    static void assertNoForbiddenKeys(Object node, String path) {
        if (node instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                String key = String.valueOf(e.getKey());
                String lower = key.toLowerCase(Locale.ROOT);
                for (String fragment : FORBIDDEN_KEY_FRAGMENTS) {
                    if (lower.contains(fragment)) {
                        throw new IllegalStateException("payload phiếu chứa khoá bị cấm (R4): " + path + key);
                    }
                }
                assertNoForbiddenKeys(e.getValue(), path + key + ".");
            }
        } else if (node instanceof List<?> l) {
            for (Object item : l) {
                assertNoForbiddenKeys(item, path);
            }
        }
    }
}
