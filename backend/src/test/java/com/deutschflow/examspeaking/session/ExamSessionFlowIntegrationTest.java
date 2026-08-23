package com.deutschflow.examspeaking.session;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobRepository;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.examspeaking.dto.CreateExamSessionRequest;
import com.deutschflow.examspeaking.dto.ExamResultView;
import com.deutschflow.examspeaking.dto.ExamSessionView;
import com.deutschflow.examspeaking.dto.TurnResponse;
import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import com.deutschflow.examspeaking.entity.SpeakingExamTurn;
import com.deutschflow.examspeaking.repository.SpeakingExamTurnRepository;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.TokenUsage;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * DoD Đợt 0: seed V277 đúng; trọn phiên DRILL (A1 Teil 2) và MOCK A1 text-only (dev flag) qua service —
 * tương đương "curl trọn phiên": tạo → lượt → tự chuyển Teil → finish → job chấm → kết quả 2 hệ.
 * LLM được giả lập theo loại prompt. Tự skip khi không có Postgres.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "app.examspeaking.allow-text-turns-in-mock=true",
        "app.examspeaking.grading-passes=1"
})
class ExamSessionFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamSessionService sessionService;
    @Autowired private ExamGradingJobHandler gradingJobHandler;
    @Autowired private SpeakingExamTurnRepository turnRepository;
    @Autowired private AiJobRepository aiJobRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockBean private OpenAiChatClient chatClient;

    private long userId;

    @BeforeEach
    void seedUserWithBudget() {
        User u = userRepository.save(User.builder()
                .email("exam-it-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h").displayName("Exam IT").role(User.Role.STUDENT).build());
        userId = u.getId();
        jdbcTemplate.update("INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at) VALUES (?, 'PRO', 'ACTIVE', ?, NULL)",
                userId, Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")));
        jdbcTemplate.update("INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date) VALUES (?, ?, NULL)",
                userId, 1_000_000L);
        when(chatClient.chatCompletionForTier(any(), any(), anyDouble(), anyInt(), anyBoolean())).thenAnswer(inv -> {
            List<ChatMessage> msgs = inv.getArgument(0);
            String user = msgs.get(msgs.size() - 1).content();
            String all = msgs.stream().map(ChatMessage::content).reduce("", (a, b) -> a + "\n" + b);
            return new AiChatCompletionResult(fakeLlm(user, all), TokenUsage.exact(120, 40, 160), "test", "fake-model");
        });
    }

    /** LLM giả: nhận dạng loại prompt qua dấu hiệu ổn định trong text. */
    static String fakeLlm(String user, String all) {
        if (user.contains("Kandidat sagt:")) {
            if (all.contains("DEINE VORLAGE")) {
                return "{\"reply_de\":\"Interessant. Auf meiner Vorlage steht, wie junge Leute verreisen: die meisten mit dem Auto. Und du?\"}";
            }
            if (user.contains("DEINEM Vortrag") || user.contains("zu DEINEM Vortrag")) {
                return "{\"reply_de\":\"Danke! Ja, ich fahre auch im Winter mit dem Fahrrad, nur bei Schnee nehme ich den Bus.\"}";
            }
            // Lịch của partner nằm trong SYSTEM prompt (không bao giờ gửi client) → dò trên toàn bộ messages.
            if (all.contains("DEIN TERMINKALENDER")) {
                return "{\"reply_de\":\"Montag kann ich nicht, da habe ich Deutschkurs. Geht Dienstag um 18 Uhr?\"}";
            }
            return "{\"reply_de\":\"Ja, gern. Und Sie: Was essen Sie zum Frühstück?\"}";
        }
        if (user.contains("Bewerte NUR diese eine Äußerung")) {
            return "{\"score\":7,\"feedback_vi\":\"Câu hỏi đúng trọng tâm. Chú ý chia động từ.\",\"corrections\":[{\"code\":\"VERB.CONJUGATION\",\"original\":\"du trinken\",\"correction\":\"du trinkst\"}],\"redemittel\":[\"Was … Sie gern?\"]}";
        }
        if ((user.contains("B1") || user.contains("B2")) && user.contains("TRANSKRIPT")) {
            // Quét MỌI mã tiêu chí prompt thực sự hỏi, thay vì liệt kê cứng. Danh sách cứng từng làm
            // Đợt 4 đỏ: B2 có KOHAERENZ_FLUESSIGKEIT / INTERAKTION_REGISTER / FRAGEN_ANTWORTEN mà mock
            // không biết → mọi tiêu chí đó unscored → trần tụt từ 84 xuống 16 mà không ai ngờ nguyên nhân
            // nằm trong test double. Quét động thì thêm cấp mới (C1…) không phải sửa mock nữa.
            StringBuilder sb = new StringBuilder("{\"items\":[],\"criteria\":[");
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("- ([A-Z_]{3,}):").matcher(user);
            java.util.Set<String> seen = new java.util.LinkedHashSet<>();
            while (m.find()) {
                seen.add(m.group(1));
            }
            boolean first = true;
            for (String c : seen) {
                sb.append(first ? "" : ",").append("{\"code\":\"").append(c).append("\",\"band\":\"B\",\"evidence\":[\"Beleg\"]}");
                first = false;
            }
            sb.append("],\"errors\":[{\"code\":\"CASE.PREP_DAT_MIT\",\"original\":\"mit die Bahn\",\"correction\":\"mit der Bahn\",\"severity\":\"MAJOR\"}]}");
            return sb.toString();
        }
        if (user.contains("Goethe-Zertifikat A2") && user.contains("GESAMTBEWERTUNG")) {
            return "{\"criteria\":[{\"code\":\"WORTSCHATZ\",\"band\":\"B\",\"evidence\":[\"Wortschatz zum Alltag\"]},{\"code\":\"STRUKTUREN\",\"band\":\"C\",\"evidence\":[]}]}";
        }
        if (user.contains("Goethe-Zertifikat A2") && user.contains("TRANSKRIPT")) {
            return "{\"items\":[],\"criteria\":[{\"code\":\"ERFUELLUNG\",\"band\":\"B\",\"evidence\":[\"Vorschlag gemacht\"]}],"
                    + "\"errors\":[{\"code\":\"VERB.CONJUGATION\",\"original\":\"ich haben\",\"correction\":\"ich habe\",\"severity\":\"MAJOR\"}]}";
        }
        if (user.contains("Teil 1") && user.contains("TRANSKRIPT")) {
            return "{\"items\":[{\"code\":\"VORSTELLUNG\",\"status\":\"VOLL\",\"quote\":\"Ich heiße\"},{\"code\":\"BUCHSTABIEREN\",\"status\":\"HALB\"},{\"code\":\"ZAHL\",\"status\":\"VOLL\"}],\"criteria\":[],\"errors\":[]}";
        }
        if (user.contains("Teil 2") && user.contains("TRANSKRIPT")) {
            return "{\"items\":[{\"code\":\"FRAGE_1\",\"status\":\"VOLL\"},{\"code\":\"ANTWORT_1\",\"status\":\"VOLL\"},{\"code\":\"FRAGE_2\",\"status\":\"VOLL\"},{\"code\":\"ANTWORT_2\",\"status\":\"HALB\"}],\"criteria\":[],\"errors\":[{\"code\":\"WORD_ORDER.V2_MAIN_CLAUSE\",\"original\":\"Gern ich trinke\",\"correction\":\"Ich trinke gern\",\"severity\":\"MAJOR\"}]}";
        }
        if (user.contains("Teil 3") && user.contains("TRANSKRIPT")) {
            return "{\"items\":[{\"code\":\"BITTE_1\",\"status\":\"VOLL\"},{\"code\":\"REAKTION_1\",\"status\":\"VOLL\"},{\"code\":\"BITTE_2\",\"status\":\"VOLL\"},{\"code\":\"REAKTION_2\",\"status\":\"VOLL\"}],\"criteria\":[],\"errors\":[]}";
        }
        return "{\"reply_de\":\"Danke.\"}";
    }

    @Test
    @DisplayName("V277 seed: 8 blueprint (Goethe/telc A1–B2) và ngân hàng đề A1 6/50/24")
    void seedIsPresent() {
        Integer blueprints = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_blueprints WHERE active", Integer.class);
        assertThat(blueprints).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A1' AND teil_no=1", Integer.class)).isEqualTo(6);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A1' AND teil_no=2", Integer.class)).isEqualTo(50);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A1' AND teil_no=3", Integer.class)).isEqualTo(24);
        // rubric telc B1 phải mang ngưỡng nói riêng 45 và bảng bandPoints
        String telcB1 = jdbcTemplate.queryForObject("SELECT rubric_json::text FROM speaking_exam_blueprints WHERE provider='TELC' AND level='B1'", String.class);
        assertThat(telcB1).contains("\"speakingOnlyMin\": 45").contains("bandPoints");
    }

    @Test
    @DisplayName("DRILL Goethe A1 Teil 2: 4 lượt text → partner AI đáp, chấm nhanh mỗi lượt, kết thúc DONE")
    void drillA1Teil2EndToEnd() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "DRILL", 2));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(s.totalParts()).isEqualTo(1);
        assertThat(s.directive().archetype()).isEqualTo("CARD_QA");
        assertThat(s.directive().candidateAction()).isEqualTo("ASK");
        assertThat(s.directive().stimulus()).containsKeys("thema", "wort");
        assertThat(s.directive().prueferText()).contains("Teil 2");

        TurnResponse t1 = sessionService.submitTextTurn(userId, s.id(), "Was essen Sie gern zum Frühstück?");
        assertThat(t1.aiRole()).isEqualTo("PARTNER");
        assertThat(t1.aiText()).contains("Frühstück");
        assertThat(t1.turnEval()).containsEntry("score", 7);
        assertThat(t1.session().directive().candidateAction()).isEqualTo("ANSWER");

        sessionService.submitTextTurn(userId, s.id(), "Ich esse gern Brot mit Käse.");
        sessionService.submitTextTurn(userId, s.id(), "Wo kaufen Sie Obst?");
        TurnResponse last = sessionService.submitTextTurn(userId, s.id(), "Im Supermarkt.");
        assertThat(last.session().state()).isEqualTo(SpeakingExamSession.STATE_DONE);

        List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(s.id());
        assertThat(turns.stream().filter(t -> SpeakingExamTurn.ROLE_CANDIDATE.equals(t.getRole())).count()).isEqualTo(4);
        assertThat(turns.stream().filter(t -> SpeakingExamTurn.ROLE_PARTNER.equals(t.getRole())).count()).isEqualTo(4);
        assertThat(turns.get(0).getRole()).isEqualTo(SpeakingExamTurn.ROLE_PRUEFER);
        assertThat(turns.stream().filter(t -> t.getTurnEvalJson() != null).count()).isEqualTo(4);
    }

    @Test
    @DisplayName("MOCK Goethe A1 text-only (dev flag): 3 Teil tự chuyển → GRADING → handler chấm → RESULTS 2 hệ thang")
    void mockA1EndToEndWithGrading() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A1", "MOCK", null));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(s.currentPart()).isEqualTo(1);
        assertThat(s.partDeadlineAt()).isAfter(s.serverNow());

        // Teil 1: 3 lượt (giới thiệu, đánh vần, số) → tự chuyển Teil 2
        sessionService.submitTextTurn(userId, s.id(), "Ich heiße Minh, ich bin 24 Jahre alt und komme aus Vietnam. Ich wohne in Hanoi, spreche Vietnamesisch und Deutsch. Ich bin Student. Mein Hobby ist Fußball.");
        sessionService.submitTextTurn(userId, s.id(), "S-T-R-A-S-S-E.");
        TurnResponse t3 = sessionService.submitTextTurn(userId, s.id(), "Null eins sieben sechs, zwei drei vier fünf, sechs sieben acht neun.");
        assertThat(t3.session().currentPart()).isEqualTo(2);
        assertThat(t3.session().directive().prueferText()).contains("Teil 2");
        // Teil 2: 4 lượt → Teil 3
        for (String line : List.of("Was trinken Sie gern?", "Ich trinke gern Kaffee.", "Wo ist der Supermarkt?", "Der Supermarkt ist in der Stadt.")) {
            sessionService.submitTextTurn(userId, s.id(), line);
        }
        // Teil 3: 4 lượt → hết → GRADING
        TurnResponse end = null;
        for (String line : List.of("Können Sie bitte die Tür öffnen?", "Ja, natürlich.", "Geben Sie mir bitte das Buch.", "Hier, bitte.")) {
            end = sessionService.submitTextTurn(userId, s.id(), line);
        }
        assertThat(end.session().state()).isEqualTo(SpeakingExamSession.STATE_GRADING);
        assertThat(end.session().gradingJobId()).isNotNull();

        AiJob job = aiJobRepository.findById(end.session().gradingJobId()).orElseThrow();
        assertThat(job.getJobType()).isEqualTo(ExamSessionService.JOB_TYPE_MOCK_GRADING);
        Map<String, Object> out = gradingJobHandler.handle(job);
        assertThat(out).containsKeys("total", "max", "passed");

        ExamResultView r = sessionService.result(userId, s.id());
        // thô: (1 + 0.5 + 1) + (1.5×3 + 0.75) + 6 = 13.75 → ×1,66 = 22.8 → 23
        assertThat(r.total().doubleValue()).isEqualTo(23.0);
        assertThat(r.max().doubleValue()).isEqualTo(25.0);
        assertThat(r.passed()).isNull(); // A1: không ngưỡng nói riêng
        assertThat(r.scoreSheet()).containsKey("parts");
        assertThat(sessionService.get(userId, s.id()).state()).isEqualTo(SpeakingExamSession.STATE_RESULTS);
        assertThat(sessionService.results(userId)).hasSize(1);

        // cách ly theo chủ sở hữu
        assertThatThrownBy(() -> sessionService.get(userId + 99_999, s.id())).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("V281 seed: đề B2 đủ pool lớn hơn cardsNeeded (Goethe 16/12, telc 30/8/8)")
    void seedB2IsPresent() {
        // Pool phải LỚN HƠN cardsNeeded của Teil, nếu không ExamTaskBankService ném 409 lúc tạo phiên:
        // Goethe T1 cần 2, telc T1 cần 5.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND provider='GOETHE' AND teil_no=1", Integer.class)).isEqualTo(16);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND provider='GOETHE' AND teil_no=2", Integer.class)).isEqualTo(12);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND provider='TELC' AND teil_no=1", Integer.class)).isEqualTo(30);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND provider='TELC' AND teil_no=2", Integer.class)).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND provider='TELC' AND teil_no=3", Integer.class)).isEqualTo(8);

        // Mọi thẻ Diskussion phải có 'question' — DefaultPrueferScriptService đọc đúng khoá này để
        // đọc đề; thiếu là lời giám khảo in ra dấu ba chấm mà không lỗi gì cả.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND archetype='DISCUSS' AND stimulus_json->>'question' IS NULL",
                Integer.class)).isZero();
        // Lập trường của partner là dữ liệu RIÊNG: có trong DB để AI dùng, bị lược trước khi tới client.
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B2' AND stimulus_json ? 'partnerStance'", Integer.class)).isEqualTo(20);
    }

    @Test
    @DisplayName("Chưa có blueprint (C1 ngoài MVP) → 404 rõ ràng")
    void missingBlueprintFailsFast() {
        assertThatThrownBy(() -> sessionService.create(userId, new CreateExamSessionRequest("TELC", "C1", "MOCK", null)))
                .isInstanceOf(com.deutschflow.common.exception.NotFoundException.class)
                .hasMessageContaining("blueprint");
    }

    @Test
    @DisplayName("Có blueprint nhưng ngân hàng đề rỗng → 409 rõ ràng, không tạo phiên hỏng")
    void missingTasksFailsFast() {
        // Test này từng trỏ vào B1, rồi B2— mỗi đợt seed thêm một cấp là nó phải dời sang cấp kế tiếp,
        // và sau Đợt 4 thì A1–B2 đã kín. Nên dựng blueprint tạm cho một cấp ngoài MVP thay vì đi mượn
        // cấp thật: test không còn mục nát theo mỗi lần seed nữa.
        jdbcTemplate.update("INSERT INTO speaking_exam_blueprints (provider, level, version, title, parts_json, rubric_json) "
                + "VALUES ('TELC','C1',1,'IT tạm — không có đề', ?::jsonb, ?::jsonb)",
                "{\"prepSec\":0,\"parts\":[{\"teilNo\":1,\"archetype\":\"DISCUSS\",\"title\":\"IT\",\"durationSec\":60,"
                        + "\"flow\":\"DIALOGUE\",\"partnerRole\":\"PARTNER\",\"stimulusType\":\"DEBATE_CARD\",\"cardsNeeded\":1}]}",
                "{\"scheme\":\"TELC\",\"scale\":\"A_D\",\"maxTotal\":25,\"parts\":[],\"global\":[]}");
        try {
            assertThatThrownBy(() -> sessionService.create(userId, new CreateExamSessionRequest("TELC", "C1", "MOCK", null)))
                    .isInstanceOf(com.deutschflow.common.exception.ConflictException.class)
                    .hasMessageContaining("Chưa đủ đề");
        } finally {
            jdbcTemplate.update("DELETE FROM speaking_exam_blueprints WHERE provider='TELC' AND level='C1'");
        }
    }

    @Test
    @DisplayName("V278 seed: đề A2 (Goethe T1/T2, T3 chung, telc T1/T2) đủ số lượng")
    void a2SeedIsPresent() {
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A2' AND provider='GOETHE' AND teil_no=1", Integer.class)).isEqualTo(22);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A2' AND provider='GOETHE' AND teil_no=2", Integer.class)).isEqualTo(12);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A2' AND provider IS NULL AND teil_no=3", Integer.class)).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A2' AND provider='TELC' AND teil_no=1", Integer.class)).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='A2' AND provider='TELC' AND teil_no=2", Integer.class)).isEqualTo(24);
        String parts = jdbcTemplate.queryForObject("SELECT parts_json::text FROM speaking_exam_blueprints WHERE provider='GOETHE' AND level='A2'", String.class);
        assertThat(parts).contains("PERSON_CARD");
    }

    @Test
    @DisplayName("DRILL Goethe A2 Teil 3 (lịch tuần A≠B): client chỉ thấy lịch của mình, AI partner được biết lịch kia")
    void drillA2CalendarKeepsPartnerCalendarPrivate() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A2", "DRILL", 3));
        assertThat(s.directive().archetype()).isEqualTo("PLAN_NEGOTIATE");
        assertThat(s.directive().stimulus()).containsKeys("situation", "candidateCalendar");
        assertThat(s.directive().stimulus()).doesNotContainKey("partnerCalendar");
        assertThat(s.directive().prueferText()).contains("Terminkalender");

        TurnResponse t1 = sessionService.submitTextTurn(userId, s.id(), "Hast du am Montag Zeit?");
        assertThat(t1.aiRole()).isEqualTo("PARTNER");
        assertThat(t1.aiText()).contains("Dienstag"); // fakeLlm chỉ trả câu này khi prompt có DEIN TERMINKALENDER
        assertThat(t1.session().directive().stimulus()).doesNotContainKey("partnerCalendar");
    }

    @Test
    @DisplayName("MOCK Goethe A2 trọn gói text-only: 3 Teil → chấm A–E + tiêu chí chung + ngưỡng nói riêng 15/25")
    void mockA2EndToEndAppliesSpeakingOnlyThreshold() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "A2", "MOCK", null));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(s.totalParts()).isEqualTo(3);
        String[] lines = {"Wann hast du Geburtstag?", "Im Mai.", "Wo wohnst du?", "In Hanoi.", "Was ist dein Hobby?", "Musik.",
                "Welche Sprachen sprichst du?", "Vietnamesisch und Deutsch.",
                "Ich spare mein Geld und ich reise gern. Ich kaufe auch Kleidung.", "Ja, einmal im Jahr.", "Nach Deutschland.",
                "Hast du am Dienstag Zeit?", "Dienstag um 18 Uhr ist gut.", "Wir kaufen ein Buch.", "Im Buchladen.",
                "Gut, Dienstag 18 Uhr.", "Bis dann.", "Tschüss.", "Danke."};
        ExamSessionView cur = s;
        for (String line : lines) {
            if (!SpeakingExamSession.STATE_IN_PART.equals(cur.state())) {
                break;
            }
            cur = sessionService.submitTextTurn(userId, s.id(), line).session();
        }
        assertThat(cur.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);
        AiJob job = aiJobRepository.findById(cur.gradingJobId()).orElseThrow();
        gradingJobHandler.handle(job);
        ExamResultView r = sessionService.result(userId, s.id());
        assertThat(r.max()).isEqualByComparingTo("20.00"); // Aussprache (5) chưa chấm được ở text-only → mẫu 20/25
        assertThat(r.total()).isPositive();
        assertThat(r.scoreSheet().get("passRule").toString()).contains("15");
        assertThat(r.passed()).isNotNull();
    }


    @Test
    @DisplayName("V279 seed: đề B1 (Goethe T1/T2/T3, telc T1/T2/T3) + cột prep_sec")
    void b1SeedIsPresent() {
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='GOETHE' AND teil_no=1", Integer.class)).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='GOETHE' AND teil_no=2", Integer.class)).isEqualTo(12);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='GOETHE' AND teil_no=3", Integer.class)).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='TELC' AND teil_no=1", Integer.class)).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='TELC' AND teil_no=2", Integer.class)).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM speaking_exam_tasks WHERE level='B1' AND provider='TELC' AND teil_no=3", Integer.class)).isEqualTo(8);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_name='speaking_exam_sessions' AND column_name='prep_sec'", Integer.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("MOCK Goethe B1 text-only: prep rút gọn 5′ + tài liệu chuẩn bị (không lộ partner*), chọn 1/2 chủ đề, partner trình bày trước ở T3 (2 lượt AI), chấm thang 100")
    void mockB1WithPrepChoiceAndPartnerPresentation() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "B1", "MOCK", null));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_PREP);
        assertThat(s.prepSec()).isEqualTo(300); // SHORT mặc định (blueprint 900)
        assertThat(s.prepDeadlineAt()).isNotNull();
        assertThat(s.prepMaterials()).hasSize(3);
        ExamSessionView.PrepMaterial t2 = s.prepMaterials().get(1);
        assertThat(t2.choiceRequired()).isTrue();
        assertThat(t2.stimuli()).hasSize(2);
        assertThat(t2.stimuli().get(0)).containsKeys("topic", "folien");
        ExamSessionView.PrepMaterial t3 = s.prepMaterials().get(2);
        assertThat(t3.stimuli().get(0)).containsKey("topic").doesNotContainKey("partnerPresentation");

        ExamSessionView chosen = sessionService.choose(userId, s.id(), 2, 1);
        assertThat(chosen.prepMaterials().get(1).chosenIndex()).isEqualTo(1);
        String chosenTopic = String.valueOf(t2.stimuli().get(1).get("topic"));

        ExamSessionView live = sessionService.advance(userId, s.id());
        assertThat(live.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        assertThat(live.currentPart()).isEqualTo(1);
        assertThat(live.directive().stimulus()).containsKeys("situation", "prompts");

        // T1: 8 lượt hội thoại planen
        ExamSessionView cur = live;
        for (int i = 0; i < 8 && cur.currentPart() == 1; i++) {
            cur = sessionService.submitTextTurn(userId, s.id(), "Ich schlage vor, wir besuchen sie am Samstag.").session();
        }
        assertThat(cur.currentPart()).isEqualTo(2);
        assertThat(cur.directive().stimulus().get("topic")).isEqualTo(chosenTopic);
        assertThat(cur.directive().prueferText()).contains(chosenTopic);
        // T2: trình bày → partner nhận xét+hỏi → trả lời → giám khảo hỏi → trả lời
        TurnResponse present = sessionService.submitTextTurn(userId, s.id(), "Mein Thema ist " + chosenTopic + ". Zuerst …");
        assertThat(present.aiRole()).isEqualTo("PARTNER");
        cur = sessionService.submitTextTurn(userId, s.id(), "Ja, das stimmt.").session();
        cur = sessionService.submitTextTurn(userId, s.id(), "Ich denke, das ist wichtig.").session();
        assertThat(cur.currentPart()).isEqualTo(3);
        // T3: partner đã trình bày TRƯỚC (lượt PARTNER ngay sau lời giới thiệu Teil)
        List<SpeakingExamTurn> turns = turnRepository.findBySessionIdOrderBySeqAsc(s.id());
        SpeakingExamTurn partnerPres = turns.stream().filter(t -> t.getPartNo() == 3 && SpeakingExamTurn.ROLE_PARTNER.equals(t.getRole())).findFirst().orElseThrow();
        assertThat(partnerPres.getTranscript()).hasSizeGreaterThan(150); // bài trình bày đầy đủ (~100–150 từ), không phải câu đệm
        assertThat(cur.directive().lastAiRole()).isEqualTo("PARTNER");
        TurnResponse fb = sessionService.submitTextTurn(userId, s.id(), "Ich fand deinen Vortrag interessant. Fährst du auch im Winter mit dem Fahrrad?");
        assertThat(fb.aiTurns()).hasSize(2);
        assertThat(fb.aiTurns().get(0).role()).isEqualTo("PARTNER");
        assertThat(fb.aiTurns().get(0).text()).contains("Winter");
        assertThat(fb.aiTurns().get(1).role()).isEqualTo("PRUEFER");
        cur = sessionService.submitTextTurn(userId, s.id(), "Ich fahre lieber mit dem Bus.").session();
        assertThat(cur.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);

        gradingJobHandler.handle(aiJobRepository.findById(cur.gradingJobId()).orElseThrow());
        ExamResultView r = sessionService.result(userId, s.id());
        assertThat(r.max()).isEqualByComparingTo("84.00"); // 100 − Aussprache 16 (text-only chưa chấm)
        assertThat(r.total()).isPositive();
        assertThat(r.scoreSheet().get("passRule").toString()).contains("60");
    }

    @Test
    @DisplayName("DRILL telc B1 Teil 2 (Vorlage A/B): client chỉ thấy Vorlage A, partner AI thuật lại Vorlage B từ system prompt")
    void drillTelcB1VorlagePairKeepsPartnerSheetPrivate() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("TELC", "B1", "DRILL", 2));
        assertThat(s.directive().stimulus()).containsKeys("thema", "candidateText", "candidateChart");
        assertThat(s.directive().stimulus()).doesNotContainKeys("partnerText", "partnerChart");
        TurnResponse t1 = sessionService.submitTextTurn(userId, s.id(), "Auf meiner Vorlage steht, wohin die Deutschen reisen.");
        assertThat(t1.aiRole()).isEqualTo("PARTNER");
        assertThat(t1.aiText()).contains("Auf meiner Vorlage steht");
    }

    @Test
    @DisplayName("Chọn đề sau khi đã nói ở Teil đó → 409")
    void choiceAfterSpeakingIsRejected() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "B1", "DRILL", 2));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_IN_PART);
        sessionService.choose(userId, s.id(), 2, 1); // chưa nói → được
        sessionService.submitTextTurn(userId, s.id(), "Mein Thema ist …");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> sessionService.choose(userId, s.id(), 2, 0))
                .isInstanceOf(com.deutschflow.common.exception.ConflictException.class);
    }


    // ── Đợt 4: B2 ──────────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("MOCK Goethe B2: Vortrag chọn 1/2 → partner BẮT BUỘC hỏi → giám khảo hỏi → Diskussion; trần 84 vì text-only")
    void mockGoetheB2VortragThenDiskussion() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("GOETHE", "B2", "MOCK", null));
        assertThat(s.state()).isEqualTo(SpeakingExamSession.STATE_PREP);
        assertThat(s.prepSec()).isEqualTo(300);           // SHORT mặc định (blueprint 900)
        assertThat(s.prepMaterials()).hasSize(2);

        ExamSessionView.PrepMaterial t1 = s.prepMaterials().get(0);
        assertThat(t1.choiceRequired()).isTrue();          // Vortrag: 2 chủ đề, chọn 1
        assertThat(t1.stimuli()).hasSize(2);
        assertThat(t1.stimuli().get(0)).containsKeys("topic", "aspects", "context");

        // Thẻ Diskussion không được lộ lập trường riêng của partner cho thí sinh.
        ExamSessionView.PrepMaterial t2 = s.prepMaterials().get(1);
        assertThat(t2.stimuli().get(0)).containsKey("question").doesNotContainKey("partnerStance");

        ExamSessionView chosen = sessionService.choose(userId, s.id(), 1, 1);
        assertThat(chosen.prepMaterials().get(0).chosenIndex()).isEqualTo(1);
        String chosenTopic = String.valueOf(t1.stimuli().get(1).get("topic"));

        ExamSessionView live = sessionService.advance(userId, s.id());
        assertThat(live.currentPart()).isEqualTo(1);
        assertThat(live.directive().stimulus().get("topic")).isEqualTo(chosenTopic);

        // T1: trình bày → PARTNER hỏi (quy chế: bạn thi bắt buộc đặt câu hỏi) → giám khảo hỏi tiếp
        TurnResponse vortrag = sessionService.submitTextTurn(userId, s.id(),
                "Mein Thema ist " + chosenTopic + ". Zuerst beschreibe ich mehrere Möglichkeiten, dann bewerte ich Vor- und Nachteile.");
        assertThat(vortrag.aiRole()).isEqualTo("PARTNER");
        ExamSessionView cur = sessionService.submitTextTurn(userId, s.id(), "Ja, das sehe ich auch so.").session();
        assertThat(cur.directive().lastAiRole()).isEqualTo("PRUEFER");
        cur = sessionService.submitTextTurn(userId, s.id(), "Aus meiner Sicht überwiegen die Vorteile.").session();
        cur = sessionService.submitTextTurn(userId, s.id(), "Das hängt von der Situation ab.").session();
        assertThat(cur.currentPart()).isEqualTo(2);

        // T2 Diskussion: partner giữ vai phản biện, kết bằng tóm tắt dafür/dagegen
        assertThat(cur.directive().stimulus()).containsKey("question").doesNotContainKey("partnerStance");
        for (int i = 0; i < 8 && cur.currentPart() == 2; i++) {
            cur = sessionService.submitTextTurn(userId, s.id(), "Ich bin dafür, weil es die Lebensqualität verbessert.").session();
        }
        assertThat(cur.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);

        gradingJobHandler.handle(aiJobRepository.findById(cur.gradingJobId()).orElseThrow());
        ExamResultView r = sessionService.result(userId, s.id());
        assertThat(r.max()).isEqualByComparingTo("84.00"); // 100 − Aussprache 16 (text-only chưa chấm được)
        assertThat(r.total()).isPositive();
        assertThat(r.scoreSheet().get("passRule").toString()).contains("60");
    }

    @Test
    @DisplayName("MOCK telc B2: Präsentation chọn 1/5 → Diskussion từ text → Problemlösung; trần 63 vì Aussprache nằm trong từng Teil")
    void mockTelcB2ThreeParts() {
        ExamSessionView s = sessionService.create(userId, new CreateExamSessionRequest("TELC", "B2", "MOCK", null));
        assertThat(s.prepMaterials()).hasSize(3);

        ExamSessionView.PrepMaterial t1 = s.prepMaterials().get(0);
        assertThat(t1.choiceRequired()).isTrue();
        assertThat(t1.stimuli()).hasSize(5);               // telc: chọn 1 trong 5 chủ đề

        ExamSessionView.PrepMaterial t2 = s.prepMaterials().get(1);
        assertThat(t2.stimuli().get(0)).containsKeys("text", "question").doesNotContainKey("partnerStance");
        assertThat(s.prepMaterials().get(2).stimuli().get(0)).containsKeys("situation", "prompts");

        sessionService.choose(userId, s.id(), 1, 3);
        String chosenTopic = String.valueOf(t1.stimuli().get(3).get("topic"));

        ExamSessionView cur = sessionService.advance(userId, s.id());
        assertThat(cur.directive().stimulus().get("topic")).isEqualTo(chosenTopic);

        // T1 Präsentation (3 bước): trình bày → partner hỏi → giám khảo
        for (int i = 0; i < 3 && cur.currentPart() == 1; i++) {
            cur = sessionService.submitTextTurn(userId, s.id(), "Mein Thema ist " + chosenTopic + ". Ich nenne drei Aspekte.").session();
        }
        assertThat(cur.currentPart()).isEqualTo(2);
        for (int i = 0; i < 6 && cur.currentPart() == 2; i++) {
            cur = sessionService.submitTextTurn(userId, s.id(), "Ich sehe das kritisch, denn es gibt auch Nachteile.").session();
        }
        assertThat(cur.currentPart()).isEqualTo(3);
        for (int i = 0; i < 6 && cur.currentPart() == 3; i++) {
            cur = sessionService.submitTextTurn(userId, s.id(), "Wir könnten am Freitag anfangen und die Aufgaben aufteilen.").session();
        }
        assertThat(cur.state()).isEqualTo(SpeakingExamSession.STATE_GRADING);

        gradingJobHandler.handle(aiJobRepository.findById(cur.gradingJobId()).orElseThrow());
        ExamResultView r = sessionService.result(userId, s.id());
        // 75 − 3×4 (Aussprache und Intonation nằm TRONG từng Teil, không phải global như Goethe)
        assertThat(r.max()).isEqualByComparingTo("63.00");
        assertThat(r.scoreSheet().get("passRule").toString()).contains("45");
    }
}
