package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import com.deutschflow.grammar.service.ExamPlanGenerator.Input;
import com.deutschflow.grammar.service.ExamPlanGenerator.Phase;
import com.deutschflow.grammar.service.ExamPlanGenerator.TaskType;
import com.deutschflow.grammar.service.ExamPlanGenerator.Week;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Khoá cách chia tuần của lộ trình đếm ngược LT3 ở các mốc biên 1, 6, 18, 40 tuần. */
class ExamPlanGeneratorTest {

    private static final Blueprint TELC_B1 = ExamPlanBlueprints.find("TELC", "B1");
    private static final LocalDate START = LocalDate.of(2026, 11, 2);

    private static List<Week> plan(int weeks, int weeklyMinutes, Map<Integer, List<String>> locked) {
        return ExamPlanGenerator.generate(new Input(TELC_B1, START, START.plusWeeks(weeks), weeklyMinutes,
                ExamPlanGenerator.rank(TELC_B1, List.of()), locked));
    }

    private static List<Week> plan(int weeks) {
        return plan(weeks, 300, Map.of());
    }

    private static long count(List<Week> weeks, Phase phase) {
        return weeks.stream().filter(w -> w.phase() == phase).count();
    }

    private static boolean has(Week week, TaskType type) {
        return week.tasks().stream().anyMatch(t -> t.type() == type);
    }

    @ParameterizedTest(name = "{0} tuần → nền {2}, Teil {3}, đề full {4}")
    @CsvSource({
            "1, 0, 0, 0, 1",
            "2, 0, 0, 1, 1",
            "6, 0, 0, 3, 3",
            "7, 0, 2, 3, 2",
            "8, 0, 2, 4, 2",
            "18, 0, 6, 6, 6",
            "26, 0, 8, 10, 8",
            "27, 9, 6, 6, 6",
            "40, 22, 6, 6, 6",
    })
    void splitsWeeksIntoPhases(int total, int roadmap, int foundation, int teil, int full) {
        List<Week> weeks = plan(total);
        assertThat(weeks).hasSize(total);
        assertThat(count(weeks, Phase.ROADMAP)).isEqualTo(roadmap);
        assertThat(count(weeks, Phase.FOUNDATION)).isEqualTo(foundation);
        assertThat(count(weeks, Phase.TEIL)).isEqualTo(teil);
        assertThat(count(weeks, Phase.FULL)).isEqualTo(full);
    }

    @Test
    @DisplayName("Các giai đoạn đi đúng thứ tự, tuần cuối là tuần đề full và kết thúc đúng ngày thi")
    void phasesAreOrdered_lastWeekEndsOnExamDay() {
        List<Week> weeks = plan(40);
        List<Phase> phases = weeks.stream().map(Week::phase).distinct().toList();
        assertThat(phases).containsExactly(Phase.ROADMAP, Phase.FOUNDATION, Phase.TEIL, Phase.FULL);
        assertThat(weeks.get(39).endDate()).isEqualTo(START.plusWeeks(40));
        assertThat(weeks.get(1).startDate()).isEqualTo(START.plusWeeks(1));
    }

    @Test
    @DisplayName("1 tuần: chỉ đề full + thi Nói, không có đề chẩn đoán")
    void oneWeek_isFullExamOnly() {
        Week only = plan(1).get(0);
        assertThat(only.phase()).isEqualTo(Phase.FULL);
        assertThat(has(only, TaskType.FULL_EXAM)).isTrue();
        assertThat(has(only, TaskType.ORAL_MOCK)).isTrue();
        assertThat(has(only, TaskType.DIAGNOSTIC_EXAM)).isFalse();
    }

    @Test
    @DisplayName("Đề chẩn đoán chỉ có ở tuần đầu của phần kế hoạch thi, kể cả kế hoạch 6 tuần và 40 tuần")
    void diagnosticOnlyInFirstExamWeek() {
        assertThat(plan(6).stream().filter(w -> has(w, TaskType.DIAGNOSTIC_EXAM)).map(Week::weekNo)).containsExactly(1);
        assertThat(plan(18).stream().filter(w -> has(w, TaskType.DIAGNOSTIC_EXAM)).map(Week::weekNo)).containsExactly(1);
        assertThat(plan(40).stream().filter(w -> has(w, TaskType.DIAGNOSTIC_EXAM)).map(Week::weekNo)).containsExactly(23);
    }

    @Test
    @DisplayName("Tuần theo cây lộ trình không có trọng tâm và không có việc thi")
    void roadmapWeeks_haveOnlyRoadmapNodes() {
        Week first = plan(40).get(0);
        assertThat(first.phase()).isEqualTo(Phase.ROADMAP);
        assertThat(first.focus()).isEmpty();
        assertThat(first.tasks()).extracting(ExamPlanGenerator.Task::type).containsExactly(TaskType.ROADMAP_NODES);
    }

    @Test
    @DisplayName("Mỗi tuần đề full có đề + thi Nói; ôn yếu điểm không tính tiến độ")
    void fullWeeks_haveExamAndOral_weaknessNotCounted() {
        Week last = plan(18).get(17);
        assertThat(last.tasks()).extracting(ExamPlanGenerator.Task::type)
                .containsExactly(TaskType.FULL_EXAM, TaskType.ORAL_MOCK, TaskType.WEAKNESS_REVIEW);
        assertThat(last.tasks().stream().filter(ExamPlanGenerator.Task::counted)).hasSize(2);
    }

    @Test
    @DisplayName("Nhịp đủ cao thì hai Teil trọng tâm, nhịp thấp thì một; tuần đề full luôn một")
    void focusSizeFollowsWeeklyMinutes() {
        assertThat(plan(18, 300, Map.of()).get(6).focus()).hasSize(2);
        assertThat(plan(18, 100, Map.of()).get(6).focus()).hasSize(1);
        assertThat(plan(18, 300, Map.of()).get(17).focus()).hasSize(1);
    }

    @Test
    @DisplayName("Số nút lộ trình theo nhịp học, luôn trong khoảng 1–4")
    void roadmapNodesFollowWeeklyMinutes() {
        assertThat(plan(40, 30, Map.of()).get(0).tasks().get(0).target()).isEqualTo(1);
        assertThat(plan(40, 180, Map.of()).get(0).tasks().get(0).target()).isEqualTo(3);
        assertThat(plan(40, 900, Map.of()).get(0).tasks().get(0).target()).isEqualTo(4);
    }

    @Test
    @DisplayName("Giai đoạn Teil ưu tiên Teil mất nhiều điểm nhất, sau đó xoay sang Teil khác")
    void teilPhase_startsWithWeakest_thenRotates() {
        List<TeilLoss> losses = List.of(
                new TeilLoss("HOEREN", 2, 25, 0.0, 25.0, 2.5, 10, 0, false),
                new TeilLoss("LESEN", 1, 25, 20.0, 5.0, 5.0, 5, 4, false));
        List<String> ranked = ExamPlanGenerator.rank(TELC_B1, losses);
        assertThat(ranked.get(0)).isEqualTo("SCHREIBEN:1"); // chưa có dòng ⇒ giữ theo điểm tối đa 45
        assertThat(ranked).containsSubsequence("HOEREN:2", "LESEN:1");

        List<Week> weeks = ExamPlanGenerator.generate(
                new Input(TELC_B1, START, START.plusWeeks(6), 100, ranked, Map.of()));
        assertThat(weeks.get(0).focus()).containsExactly("SCHREIBEN:1");
        assertThat(weeks.get(1).focus()).doesNotContain("SCHREIBEN:1");
    }

    @Test
    @DisplayName("Dòng cả phần Nói chia cho ba Teil theo điểm tối đa")
    void rank_splitsWholeSectionRow() {
        List<String> ranked = ExamPlanGenerator.rank(TELC_B1, List.of(
                new TeilLoss("SPRECHEN", null, 75, 0.0, 75.0, null, null, null, false)));
        assertThat(ranked.get(0)).isEqualTo("SCHREIBEN:1");
        assertThat(ranked).containsSubsequence("SPRECHEN:2", "SPRECHEN:1");
    }

    @Test
    @DisplayName("Phần chưa chấm tính bằng nửa điểm tối đa, không coi như không mất điểm")
    void rank_pendingCountsAsHalf() {
        List<String> ranked = ExamPlanGenerator.rank(TELC_B1, List.of(
                new TeilLoss("SCHREIBEN", null, 45, null, null, null, null, null, true),
                new TeilLoss("HOEREN", 1, 25, 0.0, 25.0, 5.0, 5, 0, false),
                new TeilLoss("HOEREN", 2, 25, 25.0, 0.0, 2.5, 10, 10, false)));
        assertThat(ranked).containsSubsequence("HOEREN:1", "SCHREIBEN:1", "HOEREN:2");
    }

    @Test
    @DisplayName("Tuần đã chốt giữ trọng tâm dù thứ hạng Teil đổi; tuần sau tính theo thứ hạng mới")
    void lockedWeekKeepsFocus() {
        List<Week> weeks = plan(6, 100, Map.of(1, List.of("LESEN:3")));
        assertThat(weeks.get(0).focus()).containsExactly("LESEN:3");
        assertThat(weeks.get(1).focus()).containsExactly("SCHREIBEN:1");
    }

    @Test
    @DisplayName("Teil Nói trong trọng tâm thì luyện đúng Teil đó, không thì xoay vòng")
    void drillFollowsSpeakingFocus() {
        Week withSpeaking = plan(6, 100, Map.of(1, List.of("SPRECHEN:2"))).get(0);
        assertThat(withSpeaking.tasks().stream().filter(t -> t.type() == TaskType.ORAL_DRILL).findFirst().orElseThrow().teil())
                .isEqualTo(2);
        Week other = plan(6, 100, Map.of(2, List.of("LESEN:1"))).get(1);
        assertThat(other.tasks().stream().filter(t -> t.type() == TaskType.ORAL_DRILL).findFirst().orElseThrow().teil())
                .isEqualTo(2);
    }

    @ParameterizedTest(name = "{0} ngày → {1} tuần")
    @CsvSource({"0, 1", "1, 1", "7, 1", "8, 2", "42, 6", "43, 7"})
    void totalWeeksRoundsUp(int days, int weeks) {
        assertThat(ExamPlanGenerator.totalWeeks(START, START.plusDays(days))).isEqualTo(weeks);
    }

    @Test
    @DisplayName("Tuần hiện tại không vượt tuần cuối")
    void weekOfIsCapped() {
        assertThat(ExamPlanGenerator.weekOf(START, START, 6)).isEqualTo(1);
        assertThat(ExamPlanGenerator.weekOf(START, START.plusDays(6), 6)).isEqualTo(1);
        assertThat(ExamPlanGenerator.weekOf(START, START.plusDays(7), 6)).isEqualTo(2);
        assertThat(ExamPlanGenerator.weekOf(START, START.plusDays(100), 6)).isEqualTo(6);
    }

    @Test
    @DisplayName("Cảnh báo: thiếu thời gian cho tuần đề full; cách bậc so với số tuần còn lại")
    void warnings() {
        assertThat(ExamPlanGenerator.warnings(100, 0, 18)).containsExactly(ExamPlanGenerator.WARNING_LOW_WEEKLY_TIME);
        assertThat(ExamPlanGenerator.warnings(300, 2, 18)).containsExactly(ExamPlanGenerator.WARNING_LEVEL_GAP);
        assertThat(ExamPlanGenerator.warnings(300, 2, 19)).isEmpty();
        assertThat(ExamPlanGenerator.warnings(300, 1, 6)).containsExactly(ExamPlanGenerator.WARNING_LEVEL_GAP);
        assertThat(ExamPlanGenerator.warnings(300, 1, 7)).isEmpty();
        assertThat(ExamPlanGenerator.warnings(300, 0, 1)).isEmpty();
    }

    @Test
    @DisplayName("Blueprint telc B1 cộng đủ 300 điểm; kỳ thi chưa có dữ liệu thì không có kế hoạch")
    void blueprint() {
        assertThat(TELC_B1.teile().stream().mapToDouble(ExamPlanBlueprints.Teil::max).sum()).isEqualTo(300);
        assertThat(TELC_B1.teile()).hasSize(12);
        assertThat(ExamPlanBlueprints.find("telc", "b1")).isSameAs(TELC_B1);
        assertThat(ExamPlanBlueprints.find("GOETHE", "B1")).isNull();
        assertThat(ExamPlanBlueprints.find(null, "B1")).isNull();
    }
}
