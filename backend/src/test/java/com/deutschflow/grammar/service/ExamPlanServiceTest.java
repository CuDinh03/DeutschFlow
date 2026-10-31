package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.grammar.dto.ExamPlanDto;
import com.deutschflow.grammar.dto.ExamPlanDto.TaskDto;
import com.deutschflow.grammar.dto.ExamPlanDto.WeekDto;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Khoá phần ráp lộ trình LT3: trạng thái kế hoạch, tiến độ tính từ dữ liệu thật, cách gán đề. Phần chia
 * tuần do {@link ExamPlanGeneratorTest} giữ. {@code JdbcTemplate} là một bản giả trả dòng theo SQL.
 */
class ExamPlanServiceTest {

    private static final long USER = 7L;
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 2);

    private final UserLearningProfileRepository profiles = mock(UserLearningProfileRepository.class);
    private final MockExamPackService packService = mock(MockExamPackService.class);
    private final List<String> updates = new ArrayList<>();

    private List<Map<String, Object>> stateRows = List.of();
    private List<Map<String, Object>> exams = List.of(exam(1, "Đề số 1"), exam(2, "Đề số 2"), exam(3, "Đề số 3"));
    private List<Map<String, Object>> attempts = List.of();
    private List<Map<String, Object>> oralMocks = List.of();
    private List<Map<String, Object>> drills = List.of();
    private List<Map<String, Object>> roadmapNodes = List.of();

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class, this::answer);
    private final ExamPlanService service = new ExamPlanService(jdbc, profiles, mock(ExamBudgetService.class),
            mock(ExamScoringService.class), mock(MockExamOralGateService.class), packService, new ObjectMapper());

    @BeforeEach
    void paidByDefault() {
        when(packService.isPaid(any())).thenReturn(true);
    }

    private Object answer(InvocationOnMock inv) throws Exception {
        String method = inv.getMethod().getName();
        if (inv.getArguments().length == 0 || !(inv.getArgument(0) instanceof String sql)) return null;
        if (method.equals("update")) {
            updates.add(sql);
            return 1;
        }
        if (method.equals("queryForList")) {
            return sql.contains("exam_plan_state") ? stateRows : List.of();
        }
        if (method.equals("query")) {
            List<Map<String, Object>> rows;
            if (sql.contains("FROM mock_exams")) rows = exams;
            else if (sql.contains("mock_exam_attempts")) rows = attempts;
            else if (sql.contains("speaking_exam_results")) rows = oralMocks;
            else if (sql.contains("speaking_exam_sessions")) rows = drills;
            else rows = roadmapNodes;
            RowMapper<?> mapper = inv.getArgument(1);
            List<Object> out = new ArrayList<>();
            for (Map<String, Object> row : rows) out.add(mapper.mapRow(resultSet(row), out.size()));
            return out;
        }
        return null;
    }

    private static ResultSet resultSet(Map<String, Object> row) {
        return mock(ResultSet.class, i -> {
            Object value = row.get(i.<String>getArgument(0));
            return i.getMethod().getName().equals("getLong") ? ((Number) value).longValue() : value;
        });
    }

    private static Map<String, Object> exam(long id, String title) {
        return Map.of("id", id, "title", title);
    }

    /** Một thời điểm giữa ngày {@code date} theo giờ Việt Nam. */
    private static Timestamp at(LocalDate date) {
        return Timestamp.from(QuotaVnCalendar.startOfVnDay(date).plusSeconds(12 * 3600));
    }

    private static Map<String, Object> attempt(long examId, LocalDate date) {
        return Map.of("exam_id", examId, "finished_at", at(date));
    }

    private UserLearningProfile profile(String examType, LocalDate targetDate) {
        UserLearningProfile profile = UserLearningProfile.builder()
                .goalType(UserLearningProfile.GoalType.CERT)
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .currentLevel(UserLearningProfile.CurrentLevel.A2)
                .examType(examType)
                .targetDate(targetDate)
                .sessionsPerWeek(5)
                .minutesPerSession(40)
                .build();
        when(profiles.findByUserId(USER)).thenReturn(Optional.of(profile));
        return profile;
    }

    private void storedState(LocalDate start, LocalDate target, String lockedJson) {
        java.util.Map<String, Object> row = new java.util.HashMap<>();
        row.put("provider", "TELC");
        row.put("level", "B1");
        row.put("target_date", java.sql.Date.valueOf(target));
        row.put("start_date", java.sql.Date.valueOf(start));
        row.put("algorithm_version", ExamPlanGenerator.ALGORITHM_VERSION);
        row.put("locked", lockedJson);
        stateRows = List.of(row);
    }

    private ExamPlanDto plan() {
        return service.planFor(USER, TODAY);
    }

    private static TaskDto task(WeekDto week, String type) {
        return week.tasks().stream().filter(t -> t.type().equals(type)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("Không có hồ sơ, không có kỳ thi hoặc kỳ thi chưa có kế hoạch ⇒ UNAVAILABLE")
    void unavailable() {
        when(profiles.findByUserId(USER)).thenReturn(Optional.empty());
        assertThat(plan().status()).isEqualTo(ExamPlanService.STATUS_UNAVAILABLE);

        profile(null, TODAY.plusWeeks(8));
        assertThat(plan().status()).isEqualTo(ExamPlanService.STATUS_UNAVAILABLE);

        profile("GOETHE", TODAY.plusWeeks(8));
        assertThat(plan().status()).isEqualTo(ExamPlanService.STATUS_UNAVAILABLE);
    }

    @Test
    @DisplayName("Thiếu ngày thi ⇒ NEEDS_DATE, không tạo trạng thái kế hoạch")
    void needsDate() {
        profile("TELC", null);
        ExamPlanDto plan = plan();
        assertThat(plan.status()).isEqualTo(ExamPlanService.STATUS_NEEDS_DATE);
        assertThat(plan.provider()).isEqualTo("TELC");
        assertThat(plan.weeks()).isEmpty();
        assertThat(updates).isEmpty();
    }

    @Test
    @DisplayName("Ngày thi đã qua ⇒ EXAM_PASSED, không sinh tuần nào")
    void examPassed() {
        profile("TELC", TODAY.minusDays(1));
        ExamPlanDto plan = plan();
        assertThat(plan.status()).isEqualTo(ExamPlanService.STATUS_EXAM_PASSED);
        assertThat(plan.weeks()).isEmpty();
    }

    @Test
    @DisplayName("Ngày thi là hôm nay vẫn có kế hoạch một tuần, còn 0 ngày")
    void examToday() {
        profile("TELC", TODAY);
        ExamPlanDto plan = plan();
        assertThat(plan.status()).isEqualTo(ExamPlanService.STATUS_ACTIVE);
        assertThat(plan.daysLeft()).isZero();
        assertThat(plan.totalWeeks()).isEqualTo(1);
    }

    @Test
    @DisplayName("Lần đầu mở: tạo trạng thái, bắt đầu từ hôm nay, chốt trọng tâm tuần 1")
    void firstOpen_createsState_locksCurrentWeek() {
        profile("TELC", TODAY.plusWeeks(8));
        ExamPlanDto plan = plan();
        assertThat(plan.totalWeeks()).isEqualTo(8);
        assertThat(plan.currentWeek()).isEqualTo(1);
        assertThat(plan.daysLeft()).isEqualTo(56);
        assertThat(plan.weeklyMinutes()).isEqualTo(200);
        assertThat(updates).hasSize(2);
        assertThat(updates.get(0)).contains("INSERT INTO exam_plan_state");
        assertThat(updates.get(1)).contains("locked_weeks_json = ?::jsonb");
    }

    @Test
    @DisplayName("Đổi ngày thi: kế hoạch đổi theo, tính lại từ hôm nay, bỏ tuần đã chốt")
    void dateChange_restartsPlan() {
        storedState(TODAY.minusWeeks(3), TODAY.plusWeeks(5), "{\"1\":[\"LESEN:1\"]}");
        profile("TELC", TODAY.plusWeeks(18));
        ExamPlanDto plan = plan();
        assertThat(plan.totalWeeks()).isEqualTo(18);
        assertThat(plan.currentWeek()).isEqualTo(1);
        assertThat(updates.get(0)).contains("locked_weeks_json = '{}'::jsonb");
        assertThat(plan.weeks().get(0).phase()).isEqualTo("FOUNDATION");
    }

    @Test
    @DisplayName("Cùng ngày thi: giữ ngày bắt đầu và trọng tâm đã chốt, không ghi gì thêm")
    void samePlan_keepsLockedFocus() {
        storedState(TODAY, TODAY.plusWeeks(8), "{\"1\":[\"LESEN:3\",\"HOEREN:3\"]}");
        profile("TELC", TODAY.plusWeeks(8));
        ExamPlanDto plan = plan();
        assertThat(plan.weeks().get(0).focus())
                .extracting(ExamPlanDto.FocusDto::section, ExamPlanDto.FocusDto::teil)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("LESEN", 3),
                        org.assertj.core.groups.Tuple.tuple("HOEREN", 3));
        assertThat(updates).isEmpty();
    }

    @Test
    @DisplayName("Tuần hiện tại tính từ ngày bắt đầu đã lưu")
    void currentWeekCountsFromStoredStart() {
        storedState(TODAY.minusWeeks(2), TODAY.plusWeeks(6), "{}");
        profile("TELC", TODAY.plusWeeks(6));
        assertThat(plan().currentWeek()).isEqualTo(3);
    }

    @Test
    @DisplayName("Làm một đề full trong tuần: tiến độ tuần tăng, tuần sau chuyển sang đề chưa làm")
    void fullExam_countsInWeek_nextWeekGetsNewExam() {
        LocalDate start = TODAY;
        storedState(start, start.plusWeeks(4), "{}");
        profile("TELC", start.plusWeeks(4));
        // 4 tuần: Teil 2 tuần, đề full 2 tuần. Tuần đề full đầu là tuần 3.
        attempts = List.of(attempt(1, start.plusWeeks(2).plusDays(1)));

        List<WeekDto> weeks = service.planFor(USER, start.plusWeeks(2).plusDays(2)).weeks();
        WeekDto week3 = weeks.get(2);
        TaskDto exam = task(week3, "FULL_EXAM");
        assertThat(exam.done()).isTrue();
        assertThat(exam.examId()).isEqualTo(1L);
        assertThat(week3.doneTasks()).isEqualTo(1);
        assertThat(week3.totalTasks()).isEqualTo(2);

        TaskDto next = task(weeks.get(3), "FULL_EXAM");
        assertThat(next.done()).isFalse();
        assertThat(next.examId()).isEqualTo(2L);
        assertThat(next.examTitle()).isEqualTo("Đề số 2");
    }

    @Test
    @DisplayName("Bài nộp ngoài tuần không tính cho tuần đó, nhưng đề đó không được giao lại")
    void attemptOutsideWindow_notCounted_butNeverReassigned() {
        storedState(TODAY, TODAY.plusWeeks(4), "{}");
        profile("TELC", TODAY.plusWeeks(4));
        attempts = List.of(attempt(1, TODAY.minusDays(30)));

        TaskDto exam = task(plan().weeks().get(2), "FULL_EXAM");
        assertThat(exam.done()).isFalse();
        assertThat(exam.examId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("Đã có bài làm trước đó thì đề chẩn đoán coi như xong")
    void diagnostic_doneByEarlierAttempt() {
        storedState(TODAY, TODAY.plusWeeks(8), "{}");
        profile("TELC", TODAY.plusWeeks(8));
        attempts = List.of(attempt(1, TODAY.minusDays(30)));

        TaskDto diagnostic = task(plan().weeks().get(0), "DIAGNOSTIC_EXAM");
        assertThat(diagnostic.done()).isTrue();
        assertThat(diagnostic.examId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Hết đề chưa làm ⇒ \"Sắp có\", không tính tiến độ, không giao lại đề cũ")
    void noFreshExam_isComingSoon() {
        storedState(TODAY, TODAY.plusWeeks(4), "{}");
        profile("TELC", TODAY.plusWeeks(4));
        exams = List.of(exam(1, "Đề số 1"));
        attempts = List.of(attempt(1, TODAY.minusDays(30)));

        WeekDto week = plan().weeks().get(2);
        TaskDto exam = task(week, "FULL_EXAM");
        assertThat(exam.comingSoon()).isTrue();
        assertThat(exam.counted()).isFalse();
        assertThat(exam.examId()).isNull();
        assertThat(week.totalTasks()).isEqualTo(1);
    }

    @Test
    @DisplayName("Tuần đã qua mà bỏ lỡ: không giữ chỗ đề, đề đó về tuần kế tiếp")
    void missedWeek_doesNotConsumeExam() {
        LocalDate start = TODAY.minusWeeks(3);
        storedState(start, start.plusWeeks(4), "{}");
        profile("TELC", start.plusWeeks(4));

        List<WeekDto> weeks = plan().weeks();
        assertThat(task(weeks.get(2), "FULL_EXAM").examId()).isNull();
        assertThat(task(weeks.get(3), "FULL_EXAM").examId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Tài khoản miễn phí thấy kế hoạch, việc đề full và thi Nói bị khoá, luyện Nói vẫn mở")
    void freeUser_seesPlan_examTasksLocked() {
        when(packService.isPaid(any())).thenReturn(false);
        storedState(TODAY, TODAY.plusWeeks(4), "{}");
        profile("TELC", TODAY.plusWeeks(4));

        List<WeekDto> weeks = plan().weeks();
        assertThat(weeks).hasSize(4);
        assertThat(task(weeks.get(0), "DIAGNOSTIC_EXAM").locked()).isTrue();
        assertThat(task(weeks.get(0), "ORAL_DRILL").locked()).isFalse();
        assertThat(task(weeks.get(2), "FULL_EXAM").locked()).isTrue();
        assertThat(task(weeks.get(2), "ORAL_MOCK").locked()).isTrue();
    }

    @Test
    @DisplayName("Tiến độ Nói và lộ trình đếm từ dữ liệu thật trong đúng tuần")
    void oralAndRoadmap_countedInsideWindow() {
        storedState(TODAY, TODAY.plusWeeks(4), "{}");
        profile("TELC", TODAY.plusWeeks(4));
        roadmapNodes = List.of(
                Map.of("completed_at", at(TODAY.plusDays(1))),
                Map.of("completed_at", at(TODAY.plusDays(2))),
                Map.of("completed_at", at(TODAY.plusDays(3))),
                Map.of("completed_at", at(TODAY.plusDays(9))));
        drills = List.of(
                new java.util.HashMap<>(Map.of("drill_teil_no", 1, "finished_at", at(TODAY.plusDays(1)))),
                new java.util.HashMap<>(Map.of("drill_teil_no", 2, "finished_at", at(TODAY.plusDays(1)))));
        oralMocks = List.of(Map.of("created_at", at(TODAY.plusDays(15))));

        List<WeekDto> weeks = plan().weeks();
        TaskDto nodes = task(weeks.get(0), "ROADMAP_NODES");
        assertThat(nodes.target()).isEqualTo(3);
        assertThat(nodes.doneCount()).isEqualTo(3);
        assertThat(nodes.done()).isTrue();
        assertThat(task(weeks.get(1), "ROADMAP_NODES").doneCount()).isEqualTo(1);

        TaskDto drill = task(weeks.get(0), "ORAL_DRILL");
        assertThat(drill.teil()).isEqualTo(2); // Sprechen Teil 2 nặng 30 điểm, vào trọng tâm tuần 1
        assertThat(drill.doneCount()).isEqualTo(1);
        assertThat(task(weeks.get(2), "ORAL_MOCK").done()).isTrue();
    }

    @Test
    @DisplayName("Ôn yếu điểm không vào tiến độ tuần: không có dữ liệu thật để biết đã làm chưa")
    void weaknessReview_isNotCounted() {
        storedState(TODAY, TODAY.plusWeeks(4), "{}");
        profile("TELC", TODAY.plusWeeks(4));
        WeekDto week = plan().weeks().get(2);
        assertThat(task(week, "WEAKNESS_REVIEW").counted()).isFalse();
        assertThat(week.totalTasks()).isEqualTo(2);
    }

    @Test
    @DisplayName("Lấy nhịp học cao hơn giữa mục tiêu mỗi ngày và số buổi × số phút")
    void weeklyMinutes_takesHigherOfTwoSources() {
        UserLearningProfile profile = profile("TELC", TODAY.plusWeeks(8));
        profile.setDailyGoalMinutes(40);
        assertThat(plan().weeklyMinutes()).isEqualTo(280);
        profile.setDailyGoalMinutes(10);
        assertThat(plan().weeklyMinutes()).isEqualTo(200);
    }

    @Test
    @DisplayName("Cách bậc nhiều so với số tuần còn lại ⇒ có cảnh báo LEVEL_GAP")
    void levelGapWarning() {
        UserLearningProfile profile = profile("TELC", TODAY.plusWeeks(12));
        assertThat(plan().warnings()).doesNotContain(ExamPlanGenerator.WARNING_LEVEL_GAP);
        profile.setCurrentLevel(UserLearningProfile.CurrentLevel.A0);
        assertThat(plan().warnings()).contains(ExamPlanGenerator.WARNING_LEVEL_GAP);
    }

    @Test
    @DisplayName("Dữ liệu chốt hỏng không làm sập màn kế hoạch")
    void corruptLockedJson_isIgnored() {
        storedState(TODAY, TODAY.plusWeeks(8), "không phải json");
        profile("TELC", TODAY.plusWeeks(8));
        assertThat(plan().status()).isEqualTo(ExamPlanService.STATUS_ACTIVE);
    }

    @Test
    @DisplayName("Thời điểm kiểm thử ổn định: mốc giữa ngày nằm đúng ngày Việt Nam")
    void helperTimestampIsInsideDay() {
        Instant noon = at(TODAY).toInstant();
        assertThat(QuotaVnCalendar.localDateOf(noon)).isEqualTo(TODAY);
    }
}
