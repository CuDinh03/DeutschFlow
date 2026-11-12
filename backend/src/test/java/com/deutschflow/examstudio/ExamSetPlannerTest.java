package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamSetPlanner.Slot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — lập kế hoạch bộ đề: ma trận độ khó và gán chủ đề")
class ExamSetPlannerTest {

    private static final List<Slot> TELC_B1 = List.of(new Slot("LESEN", 1, 5), new Slot("LESEN", 2, 1),
            new Slot("LESEN", 3, 0), new Slot("SPRACHBAUSTEINE", 1, 0), new Slot("SPRACHBAUSTEINE", 2, 0),
            new Slot("SCHREIBEN", 1, 0));

    @Test
    @DisplayName("hồ sơ Giống đề thật: 5 câu ⇒ 2-2-1-0, 10 câu ⇒ 4-4-2-0, Teil Viết ⇒ toàn 0")
    void realProfile() {
        assertThat(ExamSetPlanner.difficultyPlan("REAL", 5)).containsExactly(
                Map.entry("EASY", 2), Map.entry("MEDIUM", 2), Map.entry("HARD", 1), Map.entry("EXPERT", 0));
        assertThat(ExamSetPlanner.difficultyPlan("REAL", 10).values()).containsExactly(4, 4, 2, 0);
        assertThat(ExamSetPlanner.difficultyPlan("REAL", 0).values()).containsExactly(0, 0, 0, 0);
        assertThat(ExamSetPlanner.difficultyPlan(null, 5).values()).containsExactly(2, 2, 1, 0);
    }

    @Test
    @DisplayName("Lesen Teil 1 nhận 4 chủ đề riêng, mỗi chủ đề còn ≥ 2 bài; không chủ đề nào lặp ở Teil khác")
    void assignMixedThemes() {
        List<Slot> slots = List.of(new Slot("LESEN", 1, 5, 4), new Slot("LESEN", 2, 1),
                new Slot("LESEN", 3, 0), new Slot("SCHREIBEN", 1, 0));
        Map<String, String> themes = ExamSetPlanner.assign(slots, Map.of(), t -> 3, List.of(), 5L);
        List<String> mix = ExamSetPlanner.split(themes.get("LESEN#1"));
        assertThat(mix).hasSize(4).doesNotHaveDuplicates();
        assertThat(mix).doesNotContain(themes.get("LESEN#2"), themes.get("LESEN#3"), themes.get("SCHREIBEN#1"));
        // 5 đoạn: một cặp chung chủ đề đầu, ba đoạn còn lại mỗi đoạn một chủ đề.
        assertThat(ExamSetPlanner.themePerSource(themes.get("LESEN#1"), 5))
                .containsExactly(mix.get(0), mix.get(0), mix.get(1), mix.get(2), mix.get(3));
    }

    @Test
    @DisplayName("sổ nguồn mỏng: 3 chủ đề vẫn nhận (2+2+1); dưới 3 ⇒ null")
    void assignMixedThin() {
        List<Slot> one = List.of(new Slot("LESEN", 1, 5, 4));
        java.util.Set<String> rich = java.util.Set.of("Wohnen", "Sport", "Umwelt");
        String three = ExamSetPlanner.assign(one, Map.of(), t -> rich.contains(t.name()) ? 2 : 1, List.of(), 1L).get("LESEN#1");
        assertThat(ExamSetPlanner.split(three)).containsExactlyInAnyOrder("Wohnen", "Sport", "Umwelt");
        assertThat(ExamSetPlanner.themePerSource("A / B / C", 5)).containsExactly("A", "A", "B", "B", "C");
        assertThat(ExamSetPlanner.assign(one, Map.of(), t -> t.name().equals("Wohnen") ? 9 : 1, List.of(), 1L))
                .containsEntry("LESEN#1", null);
    }

    @Test
    @DisplayName("bài kế tiếp lấy cho chủ đề còn thiếu nguồn; chủ đề đơn thì luôn là chính nó")
    void nextTheme() {
        String mix = "Wohnen / Sport / Umwelt / Familie";
        assertThat(ExamSetPlanner.nextTheme(mix, 5, List.of())).isEqualTo("Wohnen");
        assertThat(ExamSetPlanner.nextTheme(mix, 5, List.of("Wohnen"))).isEqualTo("Wohnen");
        assertThat(ExamSetPlanner.nextTheme(mix, 5, List.of("Wohnen", "Wohnen"))).isEqualTo("Sport");
        // Bài Sport bị loại sau khi các chủ đề sau đã có nguồn ⇒ quay lại lấy Sport.
        assertThat(ExamSetPlanner.nextTheme(mix, 5, List.of("Wohnen", "Wohnen", "Umwelt", "Familie"))).isEqualTo("Sport");
        assertThat(ExamSetPlanner.nextTheme("Reisen", 1, List.of())).isEqualTo("Reisen");
        assertThat(ExamSetPlanner.nextTheme("Reisen", 5, List.of("Reisen", "Reisen"))).isEqualTo("Reisen");
        assertThat(ExamSetPlanner.nextTheme(null, 5, List.of())).isNull();
    }

    @Test
    @DisplayName("hồ sơ Nước rút: tổng vẫn đúng số câu, có Siêu khó")
    void sprintProfile() {
        assertThat(ExamSetPlanner.difficultyPlan("SPRINT", 5).values()).containsExactly(1, 1, 2, 1);
        assertThat(ExamSetPlanner.difficultyPlan("SPRINT", 10).values()).containsExactly(2, 2, 4, 2);
    }

    @Test
    @DisplayName("gán chủ đề: không lặp trong bộ; ô cần nguồn chỉ nhận chủ đề đủ bài")
    void assignDistinct() {
        Map<String, String> themes = ExamSetPlanner.assign(TELC_B1, Map.of(),
                t -> t.name().equals("Wohnen") ? 9 : t.name().equals("Reisen") ? 2 : 0, List.of(), 7L);
        assertThat(themes.keySet()).containsExactly("LESEN#1", "LESEN#2", "LESEN#3", "SPRACHBAUSTEINE#1",
                "SPRACHBAUSTEINE#2", "SCHREIBEN#1");
        assertThat(themes.get("LESEN#1")).isEqualTo("Wohnen");   // chỉ Wohnen có ≥ 5 bài
        assertThat(themes.get("LESEN#2")).isEqualTo("Reisen");   // Wohnen đã lấy; Reisen có ≥ 1 bài
        assertThat(new HashSet<>(themes.values())).hasSize(6).doesNotContainNull();
    }

    @Test
    @DisplayName("gán chủ đề: ưu tiên chủ đề ô đó dùng ít nhất; chủ đề bị cấm không được chọn")
    void assignLeastUsedAndBanned() {
        Map<String, Map<String, Integer>> usage = new java.util.HashMap<>();
        Map<String, Integer> used = new java.util.HashMap<>();
        for (ExamSetPlanner.Theme t : ExamSetPlanner.THEMES) used.put(t.name(), 3);
        used.put("Sport", 0);
        used.put("Freizeit", 1);
        usage.put("LESEN#3", used);
        List<Slot> one = List.of(new Slot("LESEN", 3, 0));
        assertThat(ExamSetPlanner.assign(one, usage, t -> 0, List.of(), 1L)).containsEntry("LESEN#3", "Sport");
        assertThat(ExamSetPlanner.assign(one, usage, t -> 0, List.of("Sport"), 1L)).containsEntry("LESEN#3", "Freizeit");
    }

    @Test
    @DisplayName("ô cần nguồn mà không chủ đề nào đủ bài ⇒ null; hai lượt khác hạt giống cho bộ chủ đề khác nhau")
    void assignNoneAndSeed() {
        assertThat(ExamSetPlanner.assign(List.of(new Slot("LESEN", 1, 5)), Map.of(), t -> 4, List.of(), 1L))
                .containsEntry("LESEN#1", null);
        List<Slot> situational = TELC_B1.subList(2, 6);
        boolean differs = false;
        Map<String, String> first = ExamSetPlanner.assign(situational, Map.of(), t -> 0, List.of(), 1L);
        for (long seed = 2; seed < 8 && !differs; seed++) {
            differs = !ExamSetPlanner.assign(situational, Map.of(), t -> 0, List.of(), seed).equals(first);
        }
        assertThat(differs).isTrue();
        assertThat(ExamSetPlanner.assign(situational, Map.of(), t -> 0, List.of(), 1L)).isEqualTo(first);
    }

    @Test
    @DisplayName("tên bộ đề khi duyệt: đánh số nối tiếp số lớn nhất đang có, theo kiểu tên đề nền")
    void nextExamTitle() {
        java.util.List<String> existing = java.util.List.of("telc Deutsch B1 — Đề số 1", "telc Deutsch B1 — Đề số 4 ",
                "telc Deutsch B1 — Bộ tự tạo #9", "telc Deutsch B1 — Đề số 2", "Übungstest");
        assertThat(ExamSetRunService.nextExamTitle("telc Deutsch B1 — Đề số 1", existing, "TELC", "B1"))
                .isEqualTo("telc Deutsch B1 — Đề số 5");
        // Đề nền không theo kiểu đánh số ⇒ dựng tên từ kỳ thi + cấp; chưa có đề nào ⇒ số 1.
        assertThat(ExamSetRunService.nextExamTitle("Modelltest", java.util.List.of(), "TELC", "B2"))
                .isEqualTo("telc Deutsch B2 — Đề số 1");
        assertThat(ExamSetRunService.nextExamTitle(null, existing, "TELC", "B1")).isEqualTo("telc Deutsch B1 — Đề số 5");
    }

    @Test
    @DisplayName("mọi chủ đề có gốc từ khoá viết thường, không trùng tên")
    void themeTable() {
        assertThat(ExamSetPlanner.THEMES).extracting(ExamSetPlanner.Theme::name).doesNotHaveDuplicates();
        assertThat(ExamSetPlanner.THEMES).allSatisfy(t -> {
            assertThat(t.stems()).isNotEmpty();
            assertThat(t.stems()).allSatisfy(s -> assertThat(s).isEqualTo(s.toLowerCase(java.util.Locale.GERMAN)));
        });
        assertThat(ExamSetPlanner.theme("wohnen").name()).isEqualTo("Wohnen");
        assertThat(ExamSetPlanner.theme("Politik")).isNull();
    }
}
