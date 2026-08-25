package com.deutschflow.examspeaking.golden;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.ExamProvider;
import com.deutschflow.examspeaking.api.model.RubricRef;
import com.deutschflow.examspeaking.dto.GoldenView;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * G.1: lưu phiếu chấm tay (V283) → điểm người chấm tính lại bằng RubricScorer trên rubric THẬT
 * (Goethe A1 từ V277) → compare/CSV ra đúng đồng thuận. Tự skip khi không có Postgres.
 */
@SpringBootTest
class ExamGoldenIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamGoldenService goldenService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    private long studentId;
    private long raterId;
    private long sessionId;

    @BeforeEach
    void seedMockResult() throws Exception {
        studentId = userRepository.save(User.builder()
                .email("golden-it-student-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Golden Student").role(User.Role.STUDENT).build()).getId();
        raterId = userRepository.save(User.builder()
                .email("golden-it-rater-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Prüferin Anna").role(User.Role.ADMIN).build()).getId();

        Long blueprintId = jdbcTemplate.queryForObject(
                "SELECT id FROM speaking_exam_blueprints WHERE provider='GOETHE' AND level='A1' LIMIT 1", Long.class);
        sessionId = jdbcTemplate.queryForObject("""
                INSERT INTO speaking_exam_sessions (user_id, blueprint_id, mode, state, plan_json, finished_at)
                VALUES (?, ?, 'MOCK', 'RESULTS', '{"parts":[]}'::jsonb, now()) RETURNING id""",
                Long.class, studentId, blueprintId);
        jdbcTemplate.update("""
                INSERT INTO speaking_exam_turns (session_id, part_no, seq, role, transcript)
                VALUES (?, 1, 0, 'CANDIDATE', 'Ich heiße Anna und komme aus Vietnam.')""", sessionId);

        // Phiếu máy tối giản nhưng ĐÚNG khoá của rubric Goethe A1 (V277): Teil 1 VHN items.
        RubricRef ref = new RubricRef(ExamProvider.GOETHE, "A1", 1);
        Ergebnisbogen machine = new Ergebnisbogen(ref,
                List.of(new Ergebnisbogen.PartResult(1, List.of(
                        new Ergebnisbogen.CriterionResult("VORSTELLUNG", "Sich vorstellen", "VOLL", 1, 1, true, "high", List.of()),
                        new Ergebnisbogen.CriterionResult("BUCHSTABIEREN", "Buchstabieren", "HALB", 0.5, 1, true, "high", List.of()),
                        new Ergebnisbogen.CriterionResult("ZAHL", "Zahl", "NULL", 0, 1, true, "high", List.of())),
                        1.5, 3, false, null)),
                List.of(), 2, 2, 2, 25, 25, null, "", List.of(), List.of(), 1);
        jdbcTemplate.update("""
                INSERT INTO speaking_exam_results (session_id, user_id, provider, level, rubric_version,
                        score_sheet_json, total_points, max_points, passed)
                VALUES (?, ?, 'GOETHE', 'A1', 1, ?::jsonb, 2, 25, NULL)""",
                sessionId, studentId, objectMapper.writeValueAsString(machine));
    }

    @Test
    @DisplayName("lưu phiếu → điểm người từ band; compare đếm đồng thuận; CSV có dòng của giám khảo")
    void saveCompareExport() {
        // Giám khảo chấm lệch máy 1 bậc ở BUCHSTABIEREN (HALB→VOLL), trùng 2 mục còn lại.
        GoldenView.SaveResult saved = goldenService.saveRatings(raterId, sessionId, List.of(
                new GoldenView.RatingRow(1, "VORSTELLUNG", "VOLL"),
                new GoldenView.RatingRow(1, "BUCHSTABIEREN", "VOLL"),
                new GoldenView.RatingRow(1, "ZAHL", "NULL")));

        assertThat(saved.bands().pairs()).isEqualTo(3);
        assertThat(saved.bands().exact()).isEqualTo(2);
        assertThat(saved.bands().within1()).isEqualTo(3);
        assertThat(saved.human().total()).isNotNull();

        GoldenView.Detail detail = goldenService.detail(sessionId, raterId);
        assertThat(detail.myRatings()).hasSize(3);
        assertThat(detail.sheet().scale()).isEqualTo("VHN");
        assertThat(detail.turns()).isNotEmpty();

        GoldenView.CompareReport report = goldenService.compare("goethe", "A1");
        assertThat(report.rows()).anyMatch(r -> r.sessionId() == sessionId && r.rater().equals("Prüferin Anna"));
        assertThat(report.within1BandPct()).isNotNull();

        String csv = goldenService.exportCsv("goethe", "A1");
        assertThat(csv).contains("T1:BUCHSTABIEREN").contains("Prüferin Anna");
    }

    @Test
    @DisplayName("phiếu là replace-all theo giám khảo: lưu lần 2 ghi đè lần 1")
    void replaceAllPerRater() {
        goldenService.saveRatings(raterId, sessionId,
                List.of(new GoldenView.RatingRow(1, "VORSTELLUNG", "VOLL")));
        goldenService.saveRatings(raterId, sessionId,
                List.of(new GoldenView.RatingRow(1, "ZAHL", "HALB")));

        GoldenView.Detail detail = goldenService.detail(sessionId, raterId);
        assertThat(detail.myRatings()).hasSize(1);
        assertThat(detail.myRatings().get(0).criterionCode()).isEqualTo("ZAHL");
    }
}
