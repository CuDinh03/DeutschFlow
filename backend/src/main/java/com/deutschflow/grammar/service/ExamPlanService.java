package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.QuotaVnCalendar;
import com.deutschflow.grammar.dto.ExamBudgetDto;
import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.dto.ExamPlanDto;
import com.deutschflow.grammar.dto.ExamPlanDto.FocusDto;
import com.deutschflow.grammar.dto.ExamPlanDto.TaskDto;
import com.deutschflow.grammar.dto.ExamPlanDto.WeekDto;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Teil;
import com.deutschflow.grammar.service.ExamPlanGenerator.Task;
import com.deutschflow.grammar.service.ExamPlanGenerator.TaskType;
import com.deutschflow.grammar.service.ExamPlanGenerator.Week;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
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
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;

/**
 * Dựng lộ trình đếm ngược cho một học viên (LT3): lấy đầu vào từ hồ sơ, chấm tiến độ từ dữ liệu thật
 * (bài nộp, phiên có kết quả, nút đã xong) rồi chốt trọng tâm các tuần đã tới.
 *
 * <p>Kế hoạch không lưu: mỗi lần đọc sinh lại, nên đổi ngày thi hay làm xong một đề full là thấy ngay.
 * {@code exam_plan_state} chỉ giữ ngày bắt đầu và các tuần đã chốt. Đổi ngày thi, nhà tổ chức hay bậc
 * thì tính lại từ hôm nay.
 *
 * <p>Đọc bảng của module khác bằng SQL thẳng, cùng lý do với {@link MockExamOralGateService}: giữ
 * {@code grammar} không phụ thuộc {@code examspeaking}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExamPlanService {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_NEEDS_DATE = "NEEDS_DATE";
    public static final String STATUS_EXAM_PASSED = "EXAM_PASSED";
    public static final String STATUS_UNAVAILABLE = "UNAVAILABLE";

    private static final TypeReference<Map<Integer, List<String>>> LOCKED_WEEKS = new TypeReference<>() {};

    private final JdbcTemplate jdbcTemplate;
    private final UserLearningProfileRepository profileRepository;
    private final ExamBudgetService budgetService;
    private final ExamScoringService scoringService;
    private final MockExamOralGateService oralGateService;
    private final MockExamPackService packService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ExamPlanDto planFor(long userId) {
        return planFor(userId, QuotaVnCalendar.localDateOf(Instant.now()));
    }

    /** {@code today} tách riêng để test chạy được ở mọi ngày. */
    @Transactional
    public ExamPlanDto planFor(long userId, LocalDate today) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        Blueprint blueprint = profile == null || profile.getTargetLevel() == null ? null
                : ExamPlanBlueprints.find(profile.getExamType(), profile.getTargetLevel().name());
        if (blueprint == null) return ExamPlanDto.of(STATUS_UNAVAILABLE, null, null, null);

        LocalDate targetDate = profile.getTargetDate();
        if (targetDate == null) {
            return ExamPlanDto.of(STATUS_NEEDS_DATE, blueprint.provider(), blueprint.level(), null);
        }
        if (targetDate.isBefore(today)) {
            return ExamPlanDto.of(STATUS_EXAM_PASSED, blueprint.provider(), blueprint.level(), targetDate);
        }

        PlanState state = loadOrCreateState(userId, blueprint, targetDate, today);
        int weeklyMinutes = weeklyMinutes(profile);
        List<String> ranked = ExamPlanGenerator.rank(blueprint, latestLosses(userId, blueprint));
        List<Week> weeks = ExamPlanGenerator.generate(new ExamPlanGenerator.Input(
                blueprint, state.startDate(), targetDate, weeklyMinutes, ranked, state.lockedFocus()));

        int totalWeeks = weeks.size();
        int currentWeek = ExamPlanGenerator.weekOf(state.startDate(), today, totalWeeks);
        lockReachedWeeks(userId, state, weeks, currentWeek);

        Activity activity = loadActivity(userId, blueprint, state.startDate());
        boolean paid = packService.isPaid(userId);
        return new ExamPlanDto(STATUS_ACTIVE, blueprint.provider(), blueprint.level(), targetDate,
                (int) ChronoUnit.DAYS.between(today, targetDate), totalWeeks, currentWeek, weeklyMinutes,
                ExamPlanGenerator.warnings(weeklyMinutes, levelGap(profile), totalWeeks),
                toDtos(weeks, currentWeek, activity, paid));
    }

    // ─── Chấm tiến độ ────────────────────────────────────────────────────────

    private List<WeekDto> toDtos(List<Week> weeks, int currentWeek, Activity activity, boolean paid) {
        ExamPicker picker = new ExamPicker(activity.exams(), activity.attempts());
        List<WeekDto> out = new ArrayList<>();
        for (Week week : weeks) {
            Window window = Window.of(week);
            List<TaskDto> tasks = new ArrayList<>();
            for (Task task : week.tasks()) {
                tasks.add(switch (task.type()) {
                    case DIAGNOSTIC_EXAM, FULL_EXAM -> examTask(task, window, week.weekNo() < currentWeek, picker, paid);
                    case ORAL_MOCK -> countTask(task, window.count(activity.oralMocks()), !paid);
                    case ORAL_DRILL -> countTask(task, activity.drillsIn(window, task.teil()), false);
                    case ROADMAP_NODES -> countTask(task, window.count(activity.roadmapNodes()), false);
                    case WEAKNESS_REVIEW -> countTask(task, 0, false);
                });
            }
            int total = (int) tasks.stream().filter(TaskDto::counted).count();
            int done = (int) tasks.stream().filter(t -> t.counted() && t.done()).count();
            List<FocusDto> focus = week.focus().stream().map(ExamPlanService::focusOf).toList();
            out.add(new WeekDto(week.weekNo(), week.startDate(), week.endDate(), week.phase().name(),
                    focus, tasks, done, total));
        }
        return out;
    }

    private static TaskDto countTask(Task task, int count, boolean locked) {
        boolean done = count >= task.target();
        return new TaskDto(task.type().name(), task.teil(), task.target(), count, done,
                task.counted(), locked && !done, false, null, null);
    }

    private static TaskDto examTask(Task task, Window window, boolean pastWeek, ExamPicker picker, boolean paid) {
        Optional<ExamChoice> done = picker.doneFor(task.type(), window);
        if (done.isPresent()) {
            return new TaskDto(task.type().name(), null, task.target(), 1, true, true, false, false,
                    done.get().id(), done.get().title());
        }
        // Tuần đã qua mà chưa làm: không giữ chỗ một đề cho tuần đó, đề vẫn còn cho tuần tới.
        if (pastWeek) {
            return new TaskDto(task.type().name(), null, task.target(), 0, false, true, !paid, false, null, null);
        }
        Optional<ExamChoice> next = picker.next();
        if (next.isEmpty()) {
            return new TaskDto(task.type().name(), null, task.target(), 0, false, false, false, true, null, null);
        }
        return new TaskDto(task.type().name(), null, task.target(), 0, false, true, !paid, false,
                next.get().id(), next.get().title());
    }

    private static FocusDto focusOf(String key) {
        int colon = key.indexOf(':');
        return new FocusDto(key.substring(0, colon), Integer.parseInt(key.substring(colon + 1)));
    }

    /**
     * Gán đề cho các việc đề full theo thứ tự tuần: đề đã nộp không bao giờ giao lại, vì làm lại đề cũ
     * cho điểm cao giả (sổ lời hứa). Hết đề thì việc đó là "Sắp có".
     */
    private static final class ExamPicker {
        private final Map<Long, ExamChoice> examsById = new LinkedHashMap<>();
        private final List<ExamAttempt> attempts;
        private final Set<Long> taken = new HashSet<>();

        ExamPicker(List<ExamChoice> exams, List<ExamAttempt> attempts) {
            exams.forEach(e -> examsById.put(e.id(), e));
            this.attempts = attempts;
            attempts.forEach(a -> taken.add(a.examId()));
        }

        Optional<ExamChoice> doneFor(TaskType type, Window window) {
            return attempts.stream()
                    .filter(a -> type == TaskType.DIAGNOSTIC_EXAM || window.contains(a.finishedAt()))
                    .findFirst()
                    .map(a -> examsById.getOrDefault(a.examId(), new ExamChoice(a.examId(), null)));
        }

        Optional<ExamChoice> next() {
            Optional<ExamChoice> choice = examsById.values().stream().filter(e -> !taken.contains(e.id())).findFirst();
            choice.ifPresent(e -> taken.add(e.id()));
            return choice;
        }
    }

    // ─── Đầu vào ─────────────────────────────────────────────────────────────

    private static int weeklyMinutes(UserLearningProfile profile) {
        int daily = profile.getDailyGoalMinutes() == null ? 0 : profile.getDailyGoalMinutes() * 7;
        return Math.max(daily, profile.getSessionsPerWeek() * profile.getMinutesPerSession());
    }

    private static int levelGap(UserLearningProfile profile) {
        return Math.max(0, profile.getTargetLevel().ordinal() + 1 - profile.getCurrentLevel().ordinal());
    }

    /** Dòng điểm mất của bài telc nộp gần nhất; rỗng khi chưa có bài hoặc dữ liệu không đọc được. */
    private List<TeilLoss> latestLosses(long userId, Blueprint blueprint) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT a.id, a.detailed_scores_json::text AS detailed, a.answers_submitted_json::text AS answers,
                       e.sections_json::text AS sections, e.total_points, e.pass_points
                FROM mock_exam_attempts a
                JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.user_id = ? AND a.status = 'COMPLETED' AND e.exam_format = ? AND e.cefr_level = ?
                ORDER BY a.finished_at DESC NULLS LAST
                LIMIT 1
                """, userId, blueprint.provider(), blueprint.level());
        if (rows.isEmpty()) return List.of();
        Map<String, Object> row = rows.get(0);
        try {
            ExamBudgetDto budget = budgetOf(userId, blueprint.level(), row);
            return budget == null ? List.of() : budget.losses();
        } catch (Exception e) {
            // Thiếu dữ liệu chỉ làm mất phần "ưu tiên Teil yếu", kế hoạch vẫn dựng được theo trọng số.
            log.warn("[ExamPlan] Không đọc được bài {}: {}", row.get("id"), e.getMessage());
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private ExamBudgetDto budgetOf(long userId, String level, Map<String, Object> row) throws Exception {
        Map<String, Object> structure = objectMapper.readValue((String) row.get("sections"), Map.class);
        if (!(structure.get("pass_rule") instanceof Map<?, ?> rawRule)) return null;
        Map<String, Object> passRule = (Map<String, Object>) rawRule;
        String detailedJson = (String) row.get("detailed");
        Map<String, Object> detailed = detailedJson == null ? Map.of() : objectMapper.readValue(detailedJson, Map.class);

        Map<String, String> answers = new HashMap<>();
        String answersJson = (String) row.get("answers");
        if (answersJson != null && !answersJson.isBlank() && !"null".equals(answersJson)) {
            ((Map<String, Object>) objectMapper.readValue(answersJson, Map.class)).forEach((id, value) -> {
                if (value != null) answers.put(id, value.toString());
            });
        }
        Integer passPoints = row.get("pass_points") instanceof Number n ? n.intValue() : null;
        Integer totalPoints = row.get("total_points") instanceof Number n ? n.intValue() : null;
        var totals = scoringService.summarize(detailed, ExamScoringService.passPercent(passPoints, totalPoints),
                passRule, oralGateService.externalScores(userId, passRule, level));
        return budgetService.compute(structure, answers, detailed, totals.gates(), level);
    }

    private Activity loadActivity(long userId, Blueprint blueprint, LocalDate startDate) {
        Timestamp since = Timestamp.from(QuotaVnCalendar.startOfVnDay(startDate));
        String provider = blueprint.provider();
        String level = blueprint.level();

        List<ExamChoice> exams = jdbcTemplate.query("""
                SELECT id, title FROM mock_exams
                WHERE exam_format = ? AND cefr_level = ? AND is_active = TRUE AND reviewed = TRUE
                ORDER BY id
                """, (rs, n) -> new ExamChoice(rs.getLong("id"), rs.getString("title")), provider, level);
        // Lấy mọi bài đã nộp, cả trước ngày bắt đầu: đề đã làm không được giao lại.
        List<ExamAttempt> attempts = jdbcTemplate.query("""
                SELECT a.exam_id, a.finished_at
                FROM mock_exam_attempts a
                JOIN mock_exams e ON e.id = a.exam_id
                WHERE a.user_id = ? AND a.status = 'COMPLETED' AND e.exam_format = ? AND e.cefr_level = ?
                ORDER BY a.finished_at
                """, (rs, n) -> new ExamAttempt(rs.getLong("exam_id"), instant(rs.getTimestamp("finished_at"))),
                userId, provider, level);
        List<Instant> oralMocks = jdbcTemplate.query("""
                SELECT created_at FROM speaking_exam_results
                WHERE user_id = ? AND provider = ? AND level = ? AND total_points IS NOT NULL AND created_at >= ?
                """, (rs, n) -> instant(rs.getTimestamp("created_at")), userId, provider, level, since);
        List<Drill> drills = jdbcTemplate.query("""
                SELECT s.drill_teil_no, s.finished_at
                FROM speaking_exam_sessions s
                JOIN speaking_exam_blueprints b ON b.id = s.blueprint_id
                WHERE s.user_id = ? AND s.mode = 'DRILL' AND s.state <> 'ABORTED'
                  AND b.provider = ? AND b.level = ? AND s.finished_at >= ?
                """, (rs, n) -> new Drill((Integer) rs.getObject("drill_teil_no"), instant(rs.getTimestamp("finished_at"))),
                userId, provider, level, since);
        List<Instant> roadmapNodes = jdbcTemplate.query("""
                SELECT completed_at FROM skill_tree_user_progress
                WHERE user_id = ? AND status = 'COMPLETED' AND completed_at >= ?
                """, (rs, n) -> instant(rs.getTimestamp("completed_at")), userId, since);
        return new Activity(exams, attempts, oralMocks, drills, roadmapNodes);
    }

    private static Instant instant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    // ─── exam_plan_state ─────────────────────────────────────────────────────

    private PlanState loadOrCreateState(long userId, Blueprint blueprint, LocalDate targetDate, LocalDate today) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT provider, level, target_date, start_date, algorithm_version,
                       locked_weeks_json::text AS locked
                FROM exam_plan_state WHERE user_id = ?
                """, userId);
        if (rows.isEmpty()) {
            // Hai thiết bị mở cùng lúc: dòng đến sau bị bỏ qua, ngày bắt đầu của cả hai vẫn là hôm nay.
            jdbcTemplate.update("""
                    INSERT INTO exam_plan_state (user_id, provider, level, target_date, start_date, algorithm_version)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT (user_id) DO NOTHING
                    """, userId, blueprint.provider(), blueprint.level(), java.sql.Date.valueOf(targetDate),
                    java.sql.Date.valueOf(today), ExamPlanGenerator.ALGORITHM_VERSION);
            return new PlanState(today, new TreeMap<>());
        }
        Map<String, Object> row = rows.get(0);
        LocalDate storedTarget = localDate(row.get("target_date"));
        LocalDate storedStart = localDate(row.get("start_date"));
        boolean samePlan = blueprint.provider().equals(row.get("provider"))
                && blueprint.level().equals(row.get("level"))
                && targetDate.equals(storedTarget)
                && !storedStart.isAfter(today);
        if (!samePlan) {
            jdbcTemplate.update("""
                    UPDATE exam_plan_state
                    SET provider = ?, level = ?, target_date = ?, start_date = ?, algorithm_version = ?,
                        locked_weeks_json = '{}'::jsonb, updated_at = now()
                    WHERE user_id = ?
                    """, blueprint.provider(), blueprint.level(), java.sql.Date.valueOf(targetDate),
                    java.sql.Date.valueOf(today), ExamPlanGenerator.ALGORITHM_VERSION, userId);
            return new PlanState(today, new TreeMap<>());
        }
        boolean sameAlgorithm = row.get("algorithm_version") instanceof Number n
                && n.intValue() == ExamPlanGenerator.ALGORITHM_VERSION;
        Map<Integer, List<String>> locked = sameAlgorithm
                ? readLocked((String) row.get("locked"), blueprint)
                : new TreeMap<>();
        return new PlanState(storedStart, locked);
    }

    private Map<Integer, List<String>> readLocked(String json, Blueprint blueprint) {
        Set<String> known = new HashSet<>();
        for (Teil teil : blueprint.teile()) known.add(teil.key());
        Map<Integer, List<String>> out = new TreeMap<>();
        try {
            objectMapper.readValue(json, LOCKED_WEEKS).forEach((week, keys) -> {
                if (known.containsAll(keys)) out.put(week, keys);
            });
        } catch (Exception e) {
            log.warn("[ExamPlan] Bỏ trọng tâm đã chốt không đọc được: {}", e.getMessage());
        }
        return out;
    }

    /** Chốt trọng tâm các tuần đã tới, để tuần này không nhảy khi vừa nộp một đề full. */
    private void lockReachedWeeks(long userId, PlanState state, List<Week> weeks, int currentWeek) {
        Map<Integer, List<String>> locked = new TreeMap<>(state.lockedFocus());
        for (Week week : weeks) {
            if (week.weekNo() <= currentWeek && !week.focus().isEmpty()) locked.put(week.weekNo(), week.focus());
        }
        if (locked.equals(state.lockedFocus())) return;
        try {
            jdbcTemplate.update("""
                    UPDATE exam_plan_state
                    SET locked_weeks_json = ?::jsonb, algorithm_version = ?, updated_at = now()
                    WHERE user_id = ?
                    """, objectMapper.writeValueAsString(locked), ExamPlanGenerator.ALGORITHM_VERSION, userId);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Không ghi được trọng tâm đã chốt", e);
        }
    }

    private static LocalDate localDate(Object value) {
        return value instanceof java.sql.Date d ? d.toLocalDate() : (LocalDate) value;
    }

    // ─── Kiểu nội bộ ─────────────────────────────────────────────────────────

    private record PlanState(LocalDate startDate, Map<Integer, List<String>> lockedFocus) {}

    private record ExamChoice(long id, String title) {}

    private record ExamAttempt(long examId, Instant finishedAt) {}

    private record Drill(Integer teil, Instant finishedAt) {}

    private record Activity(List<ExamChoice> exams, List<ExamAttempt> attempts, List<Instant> oralMocks,
                            List<Drill> drills, List<Instant> roadmapNodes) {
        int drillsIn(Window window, Integer teil) {
            return (int) drills.stream()
                    .filter(d -> window.contains(d.finishedAt()) && (d.teil() == null || d.teil().equals(teil)))
                    .count();
        }
    }

    /** Khung thời gian của một tuần, tính theo ngày giờ Việt Nam như hạn mức. */
    private record Window(Instant from, Instant to) {
        static Window of(Week week) {
            return new Window(QuotaVnCalendar.startOfVnDay(week.startDate()),
                    QuotaVnCalendar.endOfVnDayExclusive(week.endDate()));
        }

        boolean contains(Instant at) {
            return at != null && !at.isBefore(from) && at.isBefore(to);
        }

        int count(List<Instant> events) {
            return (int) events.stream().filter(this::contains).count();
        }
    }
}
