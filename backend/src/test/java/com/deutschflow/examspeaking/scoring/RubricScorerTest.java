package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Bảng điểm 2 hệ do CODE quyết — mapping phải đúng từng con số công bố (kế hoạch 2.4). */
class RubricScorerTest {

    private final RubricScorer scorer = new RubricScorer();

    static PassAssessment.CriterionAssessment band(String b) {
        return new PassAssessment.CriterionAssessment(b, true, "high", List.of("Beleg"));
    }

    // ── Goethe A1: VHN × 1,66 ──────────────────────────────────────────────────────────────

    static RubricDefinition goetheA1() {
        return new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.VHN, Map.of(), 25, null, null, 15.0, 1.66,
                false, true, List.of(
                new RubricDefinition.RubricPart(1, List.of(), List.of(
                        new RubricDefinition.RubricItem("VORSTELLUNG", "", 1), new RubricDefinition.RubricItem("BUCHSTABIEREN", "", 1),
                        new RubricDefinition.RubricItem("ZAHL", "", 1))),
                new RubricDefinition.RubricPart(2, List.of(), List.of(
                        new RubricDefinition.RubricItem("FRAGE_1", "", 1.5), new RubricDefinition.RubricItem("ANTWORT_1", "", 1.5),
                        new RubricDefinition.RubricItem("FRAGE_2", "", 1.5), new RubricDefinition.RubricItem("ANTWORT_2", "", 1.5))),
                new RubricDefinition.RubricPart(3, List.of(), List.of(
                        new RubricDefinition.RubricItem("BITTE_1", "", 1.5), new RubricDefinition.RubricItem("REAKTION_1", "", 1.5),
                        new RubricDefinition.RubricItem("BITTE_2", "", 1.5), new RubricDefinition.RubricItem("REAKTION_2", "", 1.5)))),
                List.of(), null, null);
    }

    @Test
    @DisplayName("Goethe A1: 15 điểm thô đầy đủ × 1,66 → 25; nửa điểm → làm tròn half-up")
    void goetheA1FullAndHalf() {
        RubricDefinition r = goetheA1();
        PassAssessment full = new PassAssessment(Map.of(
                1, part(1, Map.of("VORSTELLUNG", band("VOLL"), "BUCHSTABIEREN", band("VOLL"), "ZAHL", band("VOLL"))),
                2, part(2, Map.of("FRAGE_1", band("VOLL"), "ANTWORT_1", band("VOLL"), "FRAGE_2", band("VOLL"), "ANTWORT_2", band("VOLL"))),
                3, part(3, Map.of("BITTE_1", band("VOLL"), "REAKTION_1", band("VOLL"), "BITTE_2", band("VOLL"), "REAKTION_2", band("VOLL")))),
                Map.of(), List.of(), List.of());
        Ergebnisbogen e = scorer.score(new RubricRef(ExamProvider.GOETHE, "A1", 1), r, full);
        assertThat(e.total()).isEqualTo(25.0);
        assertThat(e.maxPoints()).isEqualTo(25.0);
        assertThat(e.passed()).isNull(); // A1 không có ngưỡng nói riêng

        PassAssessment halves = new PassAssessment(Map.of(
                1, part(1, Map.of("VORSTELLUNG", band("VOLL"), "BUCHSTABIEREN", band("HALB"), "ZAHL", band("NULL"))),
                2, part(2, Map.of("FRAGE_1", band("HALB"), "ANTWORT_1", band("HALB"), "FRAGE_2", band("VOLL"), "ANTWORT_2", band("NULL"))),
                3, part(3, Map.of("BITTE_1", band("VOLL"), "REAKTION_1", band("VOLL"), "BITTE_2", band("HALB"), "REAKTION_2", band("HALB")))),
                Map.of(), List.of(), List.of());
        // thô: 1 + 0.5 + 0 + 0.75 + 0.75 + 1.5 + 0 + 1.5 + 1.5 + 0.75 + 0.75 = 9.0 → ×1,66 = 14.94 → 15
        Ergebnisbogen h = scorer.score(new RubricRef(ExamProvider.GOETHE, "A1", 1), r, halves);
        assertThat(h.total()).isEqualTo(15.0);
    }

    // ── Goethe B1: 28/40/16 + Aussprache 16 ────────────────────────────────────────────────

    static RubricDefinition goetheB1() {
        Map<String, Double> fr = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
        return new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.A_E, fr, 100, 60.0, null, null, null,
                true, true, List.of(
                new RubricDefinition.RubricPart(1, List.of(c("ERFUELLUNG", 8), c("INTERAKTION", 4), c("WORTSCHATZ", 8), c("STRUKTUREN", 8)), List.of()),
                new RubricDefinition.RubricPart(2, List.of(c("ERFUELLUNG", 12), c("KOHAERENZ", 4), c("WORTSCHATZ", 12), c("STRUKTUREN", 12)), List.of()),
                new RubricDefinition.RubricPart(3, List.of(c("ERFUELLUNG", 16)), List.of())),
                List.of(c("AUSSPRACHE", 16)), null, null);
    }

    @Test
    @DisplayName("Goethe B1: toàn A = 100/100 đỗ; B đều = 75 đỗ; Erfüllung=E làm Teil 0 điểm")
    void goetheB1Mapping() {
        RubricDefinition r = goetheB1();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);
        Ergebnisbogen all = scorer.score(ref, r, uniform(r, "A"));
        assertThat(all.total()).isEqualTo(100.0);
        assertThat(all.passed()).isTrue();
        assertThat(all.parts().get(0).points()).isEqualTo(28.0);
        assertThat(all.parts().get(1).points()).isEqualTo(40.0);
        assertThat(all.parts().get(2).points()).isEqualTo(16.0);

        Ergebnisbogen allB = scorer.score(ref, r, uniform(r, "B"));
        assertThat(allB.total()).isEqualTo(75.0);
        assertThat(allB.passed()).isTrue();

        Ergebnisbogen allD = scorer.score(ref, r, uniform(r, "D"));
        assertThat(allD.total()).isEqualTo(25.0);
        assertThat(allD.passed()).isFalse();

        // Teil 2 Erfüllung = E → cả Teil 2 = 0 dù các tiêu chí khác A
        PassAssessment mixed = new PassAssessment(Map.of(
                1, partC(1, Map.of("ERFUELLUNG", band("A"), "INTERAKTION", band("A"), "WORTSCHATZ", band("A"), "STRUKTUREN", band("A"))),
                2, partC(2, Map.of("ERFUELLUNG", band("E"), "KOHAERENZ", band("A"), "WORTSCHATZ", band("A"), "STRUKTUREN", band("A"))),
                3, partC(3, Map.of("ERFUELLUNG", band("A")))),
                Map.of("AUSSPRACHE", band("A")), List.of(), List.of());
        Ergebnisbogen z = scorer.score(ref, r, mixed);
        assertThat(z.parts().get(1).zeroed()).isTrue();
        assertThat(z.parts().get(1).points()).isEqualTo(0.0);
        assertThat(z.total()).isEqualTo(60.0);
        assertThat(z.notes()).anyMatch(n -> n.contains("Teil 2"));
    }

    @Test
    @DisplayName("Aussprache không có tín hiệu → loại khỏi tử và mẫu, đỗ/trượt quy đổi tỉ lệ")
    void unscoredCriterionReducesMax() {
        RubricDefinition r = goetheB1();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);
        PassAssessment pa = new PassAssessment(uniform(r, "B").parts(),
                Map.of("AUSSPRACHE", PassAssessment.CriterionAssessment.unscored("không có audio")), List.of(), List.of());
        Ergebnisbogen e = scorer.score(ref, r, pa);
        assertThat(e.maxPoints()).isEqualTo(84.0);
        assertThat(e.total()).isEqualTo(63.0); // 84 × 0.75
        assertThat(e.passed()).isTrue();       // 63/84 = 75% ≥ 60%
        assertThat(e.global().get(0).scored()).isFalse();
        assertThat(e.notes()).anyMatch(n -> n.contains("chưa chấm được"));
    }

    // ── Goethe A2: ngưỡng nói riêng 15/25 ───────────────────────────────────────────────────

    @Test
    @DisplayName("Goethe A2: 25 điểm, ngưỡng nói riêng ≥15 — 14,75 trượt, 15 đỗ")
    void goetheA2SpeakingThreshold() {
        Map<String, Double> fr = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
        RubricDefinition r = new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.A_E, fr, 25, null, 15.0, null, null,
                true, true, List.of(
                new RubricDefinition.RubricPart(1, List.of(c("ERFUELLUNG", 4)), List.of()),
                new RubricDefinition.RubricPart(2, List.of(c("ERFUELLUNG", 4)), List.of()),
                new RubricDefinition.RubricPart(3, List.of(c("ERFUELLUNG", 4)), List.of())),
                List.of(c("WORTSCHATZ", 4), c("STRUKTUREN", 4), c("AUSSPRACHE", 5)), null, null);
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "A2", 1);
        // C đều = 12,5 → trượt
        Ergebnisbogen c = scorer.score(ref, r, uniform(r, "C"));
        assertThat(c.total()).isEqualTo(12.5);
        assertThat(c.passed()).isFalse();
        // B đều = 18,75 → đỗ
        Ergebnisbogen b = scorer.score(ref, r, uniform(r, "B"));
        assertThat(b.total()).isEqualTo(18.75);
        assertThat(b.passed()).isTrue();
        assertThat(b.passRule()).contains("15");
    }

    // ── telc B1: bandPoints tuyệt đối, A–D, ngưỡng 45/75 ───────────────────────────────────

    @Test
    @DisplayName("telc B1: A–D theo bảng điểm tuyệt đối; toàn A = 75; toàn B = 55 đỗ; toàn C = 35 trượt (ngưỡng 45)")
    void telcB1Mapping() {
        RubricDefinition r = telcB1();
        RubricRef ref = new RubricRef(ExamProvider.TELC, "B1", 1);
        assertThat(scorer.score(ref, r, uniform(r, "A")).total()).isEqualTo(75.0);
        Ergebnisbogen b = scorer.score(ref, r, uniform(r, "B"));
        assertThat(b.total()).isEqualTo(55.0); // (3+3+3+2) + 2×(6+6+6+4) = 11 + 44
        assertThat(b.passed()).isTrue();
        Ergebnisbogen cc = scorer.score(ref, r, uniform(r, "C"));
        assertThat(cc.total()).isEqualTo(35.0); // (2+2+2+1) + 2×(4+4+4+2) = 7 + 28
        assertThat(cc.passed()).isFalse();
        assertThat(scorer.score(ref, r, uniform(r, "D")).total()).isEqualTo(0.0);
    }

    static RubricDefinition telcB1() {
        Map<String, Double> p4 = Map.of("A", 4.0, "B", 3.0, "C", 2.0, "D", 0.0);
        Map<String, Double> p3 = Map.of("A", 3.0, "B", 2.0, "C", 1.0, "D", 0.0);
        Map<String, Double> p8 = Map.of("A", 8.0, "B", 6.0, "C", 4.0, "D", 0.0);
        Map<String, Double> p6 = Map.of("A", 6.0, "B", 4.0, "C", 2.0, "D", 0.0);
        List<RubricDefinition.RubricCriterion> t1 = List.of(cb("AUSDRUCKSFAEHIGKEIT", 4, p4), cb("AUFGABENBEWAELTIGUNG", 4, p4),
                cb("FORMALE_RICHTIGKEIT", 4, p4), cb("AUSSPRACHE_INTONATION", 3, p3));
        List<RubricDefinition.RubricCriterion> t23 = List.of(cb("AUSDRUCKSFAEHIGKEIT", 8, p8), cb("AUFGABENBEWAELTIGUNG", 8, p8),
                cb("FORMALE_RICHTIGKEIT", 8, p8), cb("AUSSPRACHE_INTONATION", 6, p6));
        return new RubricDefinition(ExamProvider.TELC, RubricDefinition.BandScale.A_D, Map.of(), 75, null, 45.0, null, null,
                false, true, List.of(new RubricDefinition.RubricPart(1, t1, List.of()),
                new RubricDefinition.RubricPart(2, t23, List.of()), new RubricDefinition.RubricPart(3, t23, List.of())),
                List.of(), null, null);
    }

    // ── Goethe B2: T1 44 + T2 40 + Aussprache 16 = 100 ─────────────────────────────────────

    static RubricDefinition goetheB2() {
        Map<String, Double> fr = Map.of("A", 1.0, "B", 0.75, "C", 0.5, "D", 0.25, "E", 0.0);
        return new RubricDefinition(ExamProvider.GOETHE, RubricDefinition.BandScale.A_E, fr, 100, 60.0, null, null, null,
                true, true, List.of(
                new RubricDefinition.RubricPart(1, List.of(c("ERFUELLUNG", 16), c("KOHAERENZ_FLUESSIGKEIT", 8),
                        c("WORTSCHATZ", 8), c("STRUKTUREN", 8), c("FRAGEN_ANTWORTEN", 4)), List.of()),
                new RubricDefinition.RubricPart(2, List.of(c("ERFUELLUNG", 16), c("INTERAKTION_REGISTER", 8),
                        c("WORTSCHATZ", 8), c("STRUKTUREN", 8)), List.of())),
                List.of(c("AUSSPRACHE", 16)), null, null);
    }

    @Test
    @DisplayName("Goethe B2: Vortrag 44 + Diskussion 40 + Aussprache 16 = 100; thang 16/12/8/4/0")
    void goetheB2Mapping() {
        RubricDefinition r = goetheB2();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B2", 1);

        Ergebnisbogen all = scorer.score(ref, r, uniform(r, "A"));
        assertThat(all.total()).isEqualTo(100.0);
        assertThat(all.passed()).isTrue();
        assertThat(all.parts().get(0).points()).isEqualTo(44.0);
        assertThat(all.parts().get(1).points()).isEqualTo(40.0);
        assertThat(all.global().get(0).points()).isEqualTo(16.0);

        // Thang ba nhóm trọng số của phiếu chấm B2: 16/12/8/4/0 · 8/6/4/2/0 · 4/3/2/1/0
        Ergebnisbogen b = scorer.score(ref, r, uniform(r, "B"));
        assertThat(b.parts().get(0).criteria().get(0).points()).isEqualTo(12.0); // Erfüllung 16 → B
        assertThat(b.parts().get(0).criteria().get(1).points()).isEqualTo(6.0);  // nhóm 8 → B
        assertThat(b.parts().get(0).criteria().get(4).points()).isEqualTo(3.0);  // nhóm 4 → B
        assertThat(b.total()).isEqualTo(75.0);
        assertThat(b.passed()).isTrue();

        assertThat(scorer.score(ref, r, uniform(r, "C")).total()).isEqualTo(50.0);
        assertThat(scorer.score(ref, r, uniform(r, "C")).passed()).isFalse(); // 50 < 60
    }

    @Test
    @DisplayName("Goethe B2: Erfüllung=E ở Teil 1 xoá trắng 44 điểm của Teil đó → trượt dù Teil 2 hoàn hảo")
    void goetheB2ErfuellungLowestZeroesPart() {
        RubricDefinition r = goetheB2();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B2", 1);
        PassAssessment mixed = new PassAssessment(Map.of(
                1, partC(1, Map.of("ERFUELLUNG", band("E"), "KOHAERENZ_FLUESSIGKEIT", band("A"),
                        "WORTSCHATZ", band("A"), "STRUKTUREN", band("A"), "FRAGEN_ANTWORTEN", band("A"))),
                2, partC(2, Map.of("ERFUELLUNG", band("A"), "INTERAKTION_REGISTER", band("A"),
                        "WORTSCHATZ", band("A"), "STRUKTUREN", band("A")))),
                Map.of("AUSSPRACHE", band("A")), List.of(), List.of());

        Ergebnisbogen z = scorer.score(ref, r, mixed);
        assertThat(z.parts().get(0).zeroed()).isTrue();
        assertThat(z.parts().get(0).points()).isEqualTo(0.0);
        assertThat(z.total()).isEqualTo(56.0); // 0 + 40 + 16
        assertThat(z.passed()).isFalse();      // 56 < 60 — đúng tinh thần quy chế
        assertThat(z.notes()).anyMatch(n -> n.contains("Teil 1"));
    }

    @Test
    @DisplayName("Goethe B2 text-only: Aussprache chưa chấm được → trần còn 84, toàn B vẫn đỗ theo tỉ lệ")
    void goetheB2TextOnlyCapsAt84() {
        RubricDefinition r = goetheB2();
        PassAssessment pa = new PassAssessment(uniform(r, "B").parts(),
                Map.of("AUSSPRACHE", PassAssessment.CriterionAssessment.unscored("không có audio")), List.of(), List.of());
        Ergebnisbogen e = scorer.score(new RubricRef(ExamProvider.GOETHE, "B2", 1), r, pa);
        assertThat(e.maxPoints()).isEqualTo(84.0);
        assertThat(e.total()).isEqualTo(63.0);
        assertThat(e.passed()).isTrue();
    }

    // ── telc B2: 3 Teil × 25 = 75, ngưỡng nói riêng 45 ──────────────────────────────────────

    static RubricDefinition telcB2() {
        Map<String, Double> p7 = Map.of("A", 7.0, "B", 5.0, "C", 3.0, "D", 0.0);
        Map<String, Double> p4 = Map.of("A", 4.0, "B", 3.0, "C", 2.0, "D", 0.0);
        List<RubricDefinition.RubricCriterion> teil = List.of(cb("AUSDRUCKSFAEHIGKEIT", 7, p7),
                cb("AUFGABENBEWAELTIGUNG", 7, p7), cb("FORMALE_RICHTIGKEIT", 7, p7), cb("AUSSPRACHE_INTONATION", 4, p4));
        return new RubricDefinition(ExamProvider.TELC, RubricDefinition.BandScale.A_D, Map.of(), 75, null, 45.0, null, null,
                false, true, List.of(new RubricDefinition.RubricPart(1, teil, List.of()),
                new RubricDefinition.RubricPart(2, teil, List.of()), new RubricDefinition.RubricPart(3, teil, List.of())),
                List.of(), null, null);
    }

    @Test
    @DisplayName("telc B2: mỗi Teil 25 (7/7/7/4) → 75; ngưỡng nói riêng 45 quyết đỗ/trượt")
    void telcB2Mapping() {
        RubricDefinition r = telcB2();
        RubricRef ref = new RubricRef(ExamProvider.TELC, "B2", 1);

        Ergebnisbogen all = scorer.score(ref, r, uniform(r, "A"));
        assertThat(all.total()).isEqualTo(75.0);
        assertThat(all.passed()).isTrue();
        assertThat(all.parts()).hasSize(3);
        assertThat(all.parts().get(0).points()).isEqualTo(25.0);

        Ergebnisbogen b = scorer.score(ref, r, uniform(r, "B"));
        assertThat(b.total()).isEqualTo(54.0); // (5+5+5+3) × 3
        assertThat(b.passed()).isTrue();       // 54 ≥ 45

        Ergebnisbogen cc = scorer.score(ref, r, uniform(r, "C"));
        assertThat(cc.total()).isEqualTo(33.0); // (3+3+3+2) × 3
        assertThat(cc.passed()).isFalse();      // 33 < 45

        assertThat(scorer.score(ref, r, uniform(r, "D")).total()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("telc B2 text-only: Aussprache nằm TRONG từng Teil nên trần còn 63, không phải 75")
    void telcB2TextOnlyCapsAt63() {
        RubricDefinition r = telcB2();
        Map<Integer, PassAssessment.PartAssessment> parts = new java.util.HashMap<>();
        for (RubricDefinition.RubricPart rp : r.parts()) {
            Map<String, PassAssessment.CriterionAssessment> m = new java.util.HashMap<>();
            rp.criteria().forEach(c -> m.put(c.code(), "AUSSPRACHE_INTONATION".equals(c.code())
                    ? PassAssessment.CriterionAssessment.unscored("không có audio") : band("A")));
            parts.put(rp.teilNo(), partC(rp.teilNo(), m));
        }
        Ergebnisbogen e = scorer.score(new RubricRef(ExamProvider.TELC, "B2", 1),
                r, new PassAssessment(parts, Map.of(), List.of(), List.of()));
        assertThat(e.maxPoints()).isEqualTo(63.0); // 75 − 3×4
        assertThat(e.total()).isEqualTo(63.0);
        assertThat(e.passed()).isTrue();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────────────────

    static RubricDefinition.RubricCriterion c(String code, double max) {
        return new RubricDefinition.RubricCriterion(code, code, max, Map.of());
    }

    static RubricDefinition.RubricCriterion cb(String code, double max, Map<String, Double> bp) {
        return new RubricDefinition.RubricCriterion(code, code, max, bp);
    }

    @Test
    @DisplayName("N1c-1: Teil thí sinh KHÔNG nói = 0 điểm CÓ CHẤM (vẫn trong mẫu số) — không được quy đổi tỉ lệ để đỗ")
    void silentTeilCountsAsZeroNotReducedMax() {
        RubricDefinition r = goetheB1();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);
        // Nói tốt Teil 1 (A trọn) + Aussprache A, bỏ hẳn Teil 2 và 3.
        PassAssessment pa = new PassAssessment(Map.of(
                1, partC(1, Map.of("ERFUELLUNG", band("A"), "INTERAKTION", band("A"), "WORTSCHATZ", band("A"), "STRUKTUREN", band("A"))),
                2, new PassAssessment.PartAssessment(2, Map.of(), Map.of(), true, null),
                3, new PassAssessment.PartAssessment(3, Map.of(), Map.of(), true, null)),
                Map.of("AUSSPRACHE", band("A")), List.of(), List.of());
        Ergebnisbogen e = scorer.score(ref, r, pa);
        // Trước N1c-1: max co về 44 → normalized 100 → ĐỖ OAN. Nay: max giữ 100, tổng 44 → TRƯỢT.
        assertThat(e.maxPoints()).isEqualTo(100.0);
        assertThat(e.total()).isEqualTo(44.0);
        assertThat(e.passed()).isFalse();
        assertThat(e.parts().get(1).points()).isEqualTo(0.0);
        assertThat(e.parts().get(1).max()).isEqualTo(40.0);
        assertThat(e.parts().get(1).criteria()).allMatch(c -> c.scored() && "E".equals(c.band()));
    }

    @Test
    @DisplayName("N1c-2: nhận xét Teil của giám khảo được truyền tới Ergebnisbogen")
    void partCommentPropagates() {
        RubricDefinition r = goetheB1();
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "B1", 1);
        PassAssessment pa = new PassAssessment(Map.of(
                1, new PassAssessment.PartAssessment(1,
                        Map.of(),
                        Map.of("ERFUELLUNG", band("B"), "INTERAKTION", band("B"), "WORTSCHATZ", band("B"), "STRUKTUREN", band("B")),
                        false, "Gut strukturiert, aber mehr Details nennen.")),
                Map.of(), List.of(), List.of());
        Ergebnisbogen e = scorer.score(ref, r, pa);
        assertThat(e.parts().get(0).comment()).isEqualTo("Gut strukturiert, aber mehr Details nennen.");
    }

    static PassAssessment.PartAssessment part(int teil, Map<String, PassAssessment.CriterionAssessment> items) {
        return new PassAssessment.PartAssessment(teil, items, Map.of());
    }

    static PassAssessment.PartAssessment partC(int teil, Map<String, PassAssessment.CriterionAssessment> criteria) {
        return new PassAssessment.PartAssessment(teil, Map.of(), criteria);
    }

    static PassAssessment uniform(RubricDefinition r, String b) {
        Map<Integer, PassAssessment.PartAssessment> parts = new java.util.HashMap<>();
        for (RubricDefinition.RubricPart rp : r.parts()) {
            Map<String, PassAssessment.CriterionAssessment> m = new java.util.HashMap<>();
            rp.criteria().forEach(c -> m.put(c.code(), band(b)));
            parts.put(rp.teilNo(), partC(rp.teilNo(), m));
        }
        Map<String, PassAssessment.CriterionAssessment> g = new java.util.HashMap<>();
        r.global().forEach(c -> g.put(c.code(), band(b)));
        return new PassAssessment(parts, g, List.of(), List.of());
    }
}
