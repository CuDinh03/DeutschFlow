package com.deutschflow.grammar.service;

import com.deutschflow.grammar.service.ExamPlanDays.Kind;
import com.deutschflow.grammar.service.ExamPlanDays.Session;
import com.deutschflow.grammar.service.ExamPlanGenerator.Phase;
import com.deutschflow.grammar.service.ExamPlanGenerator.Task;
import com.deutschflow.grammar.service.ExamPlanGenerator.TaskType;
import com.deutschflow.grammar.service.ExamPlanGenerator.Week;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Khoá cách chia một tuần lộ trình thành buổi theo ngày và thứ tự đổi chỗ (đợt (d) Luyện thi). */
class ExamPlanDaysTest {

    private static final LocalDate START = LocalDate.of(2026, 11, 2);
    private static final LocalDate FAR = START.plusWeeks(10);
    private static final List<String> RANKED = List.of("SCHREIBEN:1", "SPRECHEN:2", "LESEN:2", "HOEREN:1", "LESEN:1");

    private static Week week(Phase phase, List<String> focus, Task... tasks) {
        return new Week(3, START, START.plusDays(6), phase, focus, List.of(tasks));
    }

    private static List<Kind> kinds(List<Session> sessions) {
        return sessions.stream().map(Session::kind).toList();
    }

    @Test
    @DisplayName("Tuần luyện Teil: bảy ngày, sáu buổi + một ngày nghỉ, Teil trọng tâm xen với buổi khác")
    void teilWeek() {
        Week w = week(Phase.TEIL, List.of("LESEN:2", "HOEREN:2"),
                new Task(TaskType.ROADMAP_NODES, null, 3),
                new Task(TaskType.ORAL_DRILL, 3, 1),
                new Task(TaskType.WEAKNESS_REVIEW, null, 1));
        List<Session> s = ExamPlanDays.defaultSessions(w, FAR, 300, RANKED);

        assertThat(s).hasSize(7);
        assertThat(kinds(s)).containsExactly(Kind.TEIL, Kind.ROADMAP, Kind.TEIL, Kind.ORAL_DRILL, Kind.TEIL,
                Kind.TEIL, Kind.REST);
        assertThat(s.get(0).section()).isEqualTo("LESEN");
        assertThat(s.get(0).teil()).isEqualTo(2);
        assertThat(s.get(2).section()).isEqualTo("HOEREN");
        assertThat(s.get(3).teil()).isEqualTo(3);
        // Ôn yếu điểm ⇒ luyện Teil yếu nhất ngoài trọng tâm, bỏ qua phần Nói.
        assertThat(s.get(5).section()).isEqualTo("SCHREIBEN");
        assertThat(s.get(0).minutes()).isEqualTo(50);
    }

    @Test
    @DisplayName("Tuần đề full: đề full ở buổi cuối, có thi thử Nói, ngày nghỉ sau cùng")
    void fullWeek() {
        Week w = week(Phase.FULL, List.of("LESEN:2"),
                new Task(TaskType.FULL_EXAM, null, 1),
                new Task(TaskType.ORAL_MOCK, null, 1),
                new Task(TaskType.WEAKNESS_REVIEW, null, 1));
        List<Session> s = ExamPlanDays.defaultSessions(w, FAR, 210, RANKED);

        assertThat(kinds(s)).containsExactly(Kind.TEIL, Kind.ORAL_MOCK, Kind.TEIL, Kind.TEIL, Kind.TEIL,
                Kind.FULL_EXAM, Kind.REST);
        assertThat(s.get(5).minutes()).isEqualTo(ExamPlanDays.FULL_EXAM_MINUTES);
    }

    @Test
    @DisplayName("Ít thời gian: tối thiểu ba buổi, còn lại nghỉ")
    void lowMinutes_threeStudyDays() {
        Week w = week(Phase.FOUNDATION, List.of("LESEN:1"),
                new Task(TaskType.ROADMAP_NODES, null, 1), new Task(TaskType.ORAL_DRILL, 1, 1));
        List<Session> s = ExamPlanDays.defaultSessions(w, FAR, 60, RANKED);
        assertThat(s.stream().filter(x -> x.kind() != Kind.REST)).hasSize(3);
        assertThat(s.get(0).minutes()).isEqualTo(20);
    }

    @Test
    @DisplayName("Tuần cuối: ngày thi là ngày cuối, không đổi chỗ được, đề full vẫn giữ khi tuần ngắn")
    void lastWeek_examDay() {
        LocalDate target = START.plusDays(2);
        Week w = new Week(5, START, target, Phase.FULL, List.of("HOEREN:1"),
                List.of(new Task(TaskType.FULL_EXAM, null, 1), new Task(TaskType.ORAL_MOCK, null, 1),
                        new Task(TaskType.WEAKNESS_REVIEW, null, 1)));
        List<Session> s = ExamPlanDays.defaultSessions(w, target, 300, RANKED);

        assertThat(kinds(s)).containsExactly(Kind.TEIL, Kind.FULL_EXAM, Kind.EXAM_DAY);
        assertThat(s.get(2).movable()).isFalse();
    }

    @Test
    @DisplayName("Tuần chỉ theo cây lộ trình: mọi buổi là bài lộ trình")
    void roadmapWeek() {
        Week w = week(Phase.ROADMAP, List.of(), new Task(TaskType.ROADMAP_NODES, null, 4));
        List<Session> s = ExamPlanDays.defaultSessions(w, FAR, 240, RANKED);
        assertThat(kinds(s)).containsExactly(Kind.ROADMAP, Kind.ROADMAP, Kind.ROADMAP, Kind.ROADMAP,
                Kind.ROADMAP, Kind.ROADMAP, Kind.REST);
    }

    @Test
    @DisplayName("Đổi chỗ: hoán vị lưu được áp lại; thứ tự hỏng hoặc dời ngày thi thì dùng mặc định")
    void swapAndApply() {
        Week w = week(Phase.FULL, List.of("LESEN:2"),
                new Task(TaskType.FULL_EXAM, null, 1), new Task(TaskType.ORAL_MOCK, null, 1));
        List<Session> d = ExamPlanDays.defaultSessions(w, FAR, 210, RANKED);

        List<Integer> order = ExamPlanDays.swap(null, d.size(), 1, 6);
        assertThat(order).containsExactly(0, 6, 2, 3, 4, 5, 1);
        List<Session> moved = ExamPlanDays.apply(d, order);
        assertThat(moved.get(1).kind()).isEqualTo(Kind.REST);
        assertThat(moved.get(6).kind()).isEqualTo(Kind.ORAL_MOCK);

        // đổi lần hai trên thứ tự đã lưu
        assertThat(ExamPlanDays.swap(order, d.size(), 0, 1)).containsExactly(6, 0, 2, 3, 4, 5, 1);

        assertThat(ExamPlanDays.apply(d, List.of(0, 1, 2))).isEqualTo(d);
        assertThat(ExamPlanDays.apply(d, List.of(0, 0, 2, 3, 4, 5, 6))).isEqualTo(d);
        assertThat(ExamPlanDays.apply(d, null)).isEqualTo(d);

        LocalDate target = START.plusDays(2);
        Week last = new Week(5, START, target, Phase.FULL, List.of("LESEN:2"), List.of());
        List<Session> withExamDay = ExamPlanDays.defaultSessions(last, target, 300, RANKED);
        assertThat(ExamPlanDays.apply(withExamDay, List.of(2, 1, 0))).isEqualTo(withExamDay);
    }
}
