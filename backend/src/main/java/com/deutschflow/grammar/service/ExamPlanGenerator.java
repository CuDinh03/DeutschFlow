package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Teil;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bộ sinh lộ trình đếm ngược tới ngày thi (LT3 — kế hoạch luyện thi 21/10/2026).
 *
 * <p>Hàm thuần: cùng đầu vào cho cùng kế hoạch, không gọi DB. Mỗi tuần chia vào một giai đoạn tính
 * theo <b>tổng số tuần</b> của kế hoạch:
 * <ul>
 *   <li>≤ 6 tuần: Luyện từng Teil rồi Đề full, nửa sau cho Đề full.</li>
 *   <li>7–26 tuần: Nền / Luyện từng Teil / Đề full, mỗi giai đoạn khoảng một phần ba.</li>
 *   <li>&gt; 26 tuần: các tuần đầu theo cây lộ trình thường, kế hoạch thi chỉ bắt đầu ở 18 tuần cuối.</li>
 * </ul>
 *
 * <p>Mọi việc trong tuần trỏ tới tính năng có sẵn; không có loại bài mới. Đề giấy chưa có đường làm
 * riêng một Teil, nên Teil đọc/nghe/viết chỉ là <b>trọng tâm</b> của tuần, còn Teil nói có phiên
 * luyện tính được tiến độ.
 */
public final class ExamPlanGenerator {

    /** Tăng khi đổi cách chia tuần: trọng tâm đã chốt theo bản cũ sẽ bị bỏ. */
    public static final int ALGORITHM_VERSION = 1;

    static final int SHORT_PLAN_WEEKS = 6;
    static final int FAR_PLAN_WEEKS = 26;
    static final int FINAL_STRETCH_WEEKS = 18;

    /** Một đề full + một phiên thi Nói khoảng 3 giờ: nhịp học thấp hơn thì tuần đề full không vừa. */
    static final int FULL_WEEK_MINUTES = 180;
    /** Từ mức này một tuần ôm được hai Teil trọng tâm. */
    static final int TWO_FOCUS_MINUTES = 150;
    private static final int MINUTES_PER_ROADMAP_NODE = 60;
    private static final int MAX_ROADMAP_NODES = 4;

    public static final String WARNING_LOW_WEEKLY_TIME = "LOW_WEEKLY_TIME";
    public static final String WARNING_LEVEL_GAP = "LEVEL_GAP";

    private ExamPlanGenerator() {}

    public enum Phase { ROADMAP, FOUNDATION, TEIL, FULL }

    public enum TaskType {
        /** Đề full đầu tiên để biết Teil nào yếu; đã làm đề nào trước đó thì coi như xong. */
        DIAGNOSTIC_EXAM,
        FULL_EXAM,
        ORAL_MOCK,
        ORAL_DRILL,
        ROADMAP_NODES,
        /** Ôn yếu điểm + Redemittel: gợi ý, không tính tiến độ vì không đo được đã làm hay chưa. */
        WEAKNESS_REVIEW
    }

    public record Task(TaskType type, Integer teil, int target) {
        public boolean counted() {
            return type != TaskType.WEAKNESS_REVIEW;
        }
    }

    public record Week(int weekNo, LocalDate startDate, LocalDate endDate, Phase phase,
                       List<String> focus, List<Task> tasks) {}

    /**
     * @param rankedTeile  khoá Teil xếp theo độ ưu tiên ({@link #rank})
     * @param lockedFocus  trọng tâm đã chốt: số tuần → khoá Teil
     */
    public record Input(Blueprint blueprint, LocalDate startDate, LocalDate targetDate, int weeklyMinutes,
                        List<String> rankedTeile, Map<Integer, List<String>> lockedFocus) {}

    public static int totalWeeks(LocalDate startDate, LocalDate targetDate) {
        long days = ChronoUnit.DAYS.between(startDate, targetDate);
        return (int) Math.max(1, (days + 6) / 7);
    }

    /** Tuần chứa {@code today}, không vượt tuần cuối. */
    public static int weekOf(LocalDate startDate, LocalDate today, int totalWeeks) {
        long days = ChronoUnit.DAYS.between(startDate, today);
        return (int) Math.min(totalWeeks, Math.max(1, days / 7 + 1));
    }

    public static List<Week> generate(Input input) {
        int total = totalWeeks(input.startDate(), input.targetDate());
        Phases phases = Phases.of(total);
        int focusSize = input.weeklyMinutes() >= TWO_FOCUS_MINUTES ? 2 : 1;
        int roadmapNodes = Math.max(1, Math.min(MAX_ROADMAP_NODES, input.weeklyMinutes() / MINUTES_PER_ROADMAP_NODE));
        List<String> blueprintOrder = input.blueprint().teile().stream().map(Teil::key).toList();
        Map<String, Integer> used = new HashMap<>();
        int speakingParts = (int) input.blueprint().teile().stream()
                .filter(t -> ExamPlanBlueprints.SECTION_SPEAKING.equals(t.section())).count();

        List<Week> weeks = new ArrayList<>();
        for (int weekNo = 1; weekNo <= total; weekNo++) {
            Phase phase = phases.at(weekNo);
            List<String> focus = focusOf(input, weekNo, phase, focusSize, blueprintOrder, used);
            LocalDate start = input.startDate().plusWeeks(weekNo - 1L);
            LocalDate end = weekNo == total ? input.targetDate() : start.plusDays(6);
            boolean firstExamWeek = weekNo == phases.firstExamWeek();
            weeks.add(new Week(weekNo, start, end, phase, focus,
                    tasksOf(phase, firstExamWeek, weekNo, focus, roadmapNodes, speakingParts)));
        }
        return weeks;
    }

    /**
     * Xếp Teil theo độ ưu tiên: mất điểm nhiều nhất trước; chưa có bài làm thì Teil nặng điểm trước.
     * Dòng cả phần (Viết, Nói) chia cho các Teil của phần theo tỉ lệ điểm tối đa. Phần chưa chấm chưa
     * biết mất bao nhiêu nên tính bằng một nửa điểm tối đa.
     *
     * @param losses dòng điểm đã mất của bài làm mới nhất; rỗng khi chưa làm đề nào
     */
    public static List<String> rank(Blueprint blueprint, List<TeilLoss> losses) {
        Map<String, Double> priority = new LinkedHashMap<>();
        for (Teil teil : blueprint.teile()) priority.put(teil.key(), teil.max());
        if (losses != null && !losses.isEmpty()) {
            Map<String, Double> sectionMax = new HashMap<>();
            for (Teil teil : blueprint.teile()) sectionMax.merge(teil.section(), teil.max(), Double::sum);
            for (Teil teil : blueprint.teile()) {
                for (TeilLoss row : losses) {
                    if (!row.section().equals(teil.section())) continue;
                    if (row.teil() != null && row.teil() != teil.teil()) continue;
                    double rowLost = row.pending() || row.lost() == null ? row.max() / 2 : row.lost();
                    double share = row.teil() != null ? 1 : teil.max() / sectionMax.get(teil.section());
                    priority.put(teil.key(), rowLost * share);
                }
            }
        }
        List<Map.Entry<String, Double>> entries = new ArrayList<>(priority.entrySet());
        // Sắp xếp ổn định: bằng điểm thì giữ thứ tự của đề.
        entries.sort(Map.Entry.comparingByValue(Comparator.reverseOrder()));
        return entries.stream().map(Map.Entry::getKey).toList();
    }

    /** Cảnh báo trung thực về kế hoạch; không phải lời hứa đậu hay trượt. */
    public static List<String> warnings(int weeklyMinutes, int levelGap, int totalWeeks) {
        List<String> out = new ArrayList<>();
        if (weeklyMinutes < FULL_WEEK_MINUTES) out.add(WARNING_LOW_WEEKLY_TIME);
        if ((levelGap >= 2 && totalWeeks <= FINAL_STRETCH_WEEKS) || (levelGap == 1 && totalWeeks <= SHORT_PLAN_WEEKS)) {
            out.add(WARNING_LEVEL_GAP);
        }
        return out;
    }

    private static List<String> focusOf(Input input, int weekNo, Phase phase, int focusSize,
                                        List<String> blueprintOrder, Map<String, Integer> used) {
        if (phase == Phase.ROADMAP) return List.of();
        List<String> locked = input.lockedFocus().get(weekNo);
        List<String> focus;
        if (locked != null) {
            focus = locked;
        } else {
            // Nền đi lần lượt để làm quen mọi dạng bài; hai giai đoạn sau ưu tiên Teil yếu.
            List<String> order = phase == Phase.FOUNDATION ? blueprintOrder : input.rankedTeile();
            int size = phase == Phase.FULL ? 1 : focusSize;
            focus = leastUsed(order, used, size);
        }
        for (String key : focus) used.merge(key, 1, Integer::sum);
        return focus;
    }

    /** Teil ít được chọn nhất, trong số đó giữ thứ tự ưu tiên, để cả kế hoạch không dồn vào một Teil. */
    private static List<String> leastUsed(List<String> order, Map<String, Integer> used, int size) {
        return order.stream()
                .sorted(Comparator.comparingInt(key -> used.getOrDefault(key, 0)))
                .limit(size)
                .toList();
    }

    private static List<Task> tasksOf(Phase phase, boolean firstExamWeek, int weekNo, List<String> focus,
                                      int roadmapNodes, int speakingParts) {
        List<Task> tasks = new ArrayList<>();
        if (firstExamWeek && phase != Phase.FULL) tasks.add(new Task(TaskType.DIAGNOSTIC_EXAM, null, 1));
        switch (phase) {
            case ROADMAP -> tasks.add(new Task(TaskType.ROADMAP_NODES, null, roadmapNodes));
            case FOUNDATION, TEIL -> {
                tasks.add(new Task(TaskType.ROADMAP_NODES, null, roadmapNodes));
                tasks.add(new Task(TaskType.ORAL_DRILL, drillTeil(focus, weekNo, speakingParts), 1));
                if (phase == Phase.TEIL) tasks.add(new Task(TaskType.WEAKNESS_REVIEW, null, 1));
            }
            case FULL -> {
                tasks.add(new Task(TaskType.FULL_EXAM, null, 1));
                tasks.add(new Task(TaskType.ORAL_MOCK, null, 1));
                tasks.add(new Task(TaskType.WEAKNESS_REVIEW, null, 1));
            }
        }
        return tasks;
    }

    /** Teil Nói nằm trong trọng tâm thì luyện đúng Teil đó; không thì xoay vòng để đủ cả ba. */
    private static int drillTeil(List<String> focus, int weekNo, int speakingParts) {
        String prefix = ExamPlanBlueprints.SECTION_SPEAKING + ":";
        for (String key : focus) {
            if (key.startsWith(prefix)) return Integer.parseInt(key.substring(prefix.length()));
        }
        return (weekNo - 1) % speakingParts + 1;
    }

    /** Số tuần mỗi giai đoạn: {@code roadmap → foundation → teil → full}. */
    private record Phases(int roadmap, int foundation, int teil, int full) {

        static Phases of(int total) {
            if (total <= SHORT_PLAN_WEEKS) {
                int full = (total + 1) / 2;
                return new Phases(0, 0, total - full, full);
            }
            int roadmap = total > FAR_PLAN_WEEKS ? total - FINAL_STRETCH_WEEKS : 0;
            int rest = total - roadmap;
            int third = rest / 3;
            return new Phases(roadmap, third, rest - 2 * third, third);
        }

        Phase at(int weekNo) {
            if (weekNo <= roadmap) return Phase.ROADMAP;
            if (weekNo <= roadmap + foundation) return Phase.FOUNDATION;
            if (weekNo <= roadmap + foundation + teil) return Phase.TEIL;
            return Phase.FULL;
        }

        int firstExamWeek() {
            return roadmap + 1;
        }
    }
}
