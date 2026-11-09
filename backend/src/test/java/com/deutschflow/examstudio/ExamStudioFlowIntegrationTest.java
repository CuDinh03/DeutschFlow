package com.deutschflow.examstudio;

import com.deutschflow.ai.queue.AiJob;
import com.deutschflow.ai.queue.AiJobRepository;
import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.deutschflow.grammar.service.ExamQuestionSanitizer;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
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
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Luồng đủ của Xưởng đề với AI giả: dán nguồn → rút dữ kiện → viết bài → ra 5 câu theo ma trận → tự kiểm →
 * duyệt vào kho. Job được chạy thẳng bằng handler (worker nền tắt) để test tất định.
 */
@SpringBootTest
@Transactional
@TestPropertySource(properties = "app.ai-jobs.scheduled-enabled=false")
@DisplayName("Xưởng đề — luồng Lesen Teil 2 từ nguồn tới kho")
class ExamStudioFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private ExamDraftService service;
    @Autowired private ExamStudioJobHandler handler;
    @Autowired private AiJobRepository jobRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ExamQuestionSanitizer sanitizer;

    @MockBean private OpenAiChatClient chatClient;
    @MockBean private AiUsageLedgerService ledger;

    static final String SOURCE_TEXT = """
            Die Forschenden befragten in ihrer Erhebung eine große Zahl erwachsener Menschen telefonisch über ihre Gewohnheiten beim Schlafen.

            Unter der Woche erreichen rund vier von zehn Befragten nicht die empfohlene Dauer von sieben Stunden pro Nacht.

            An freien Tagen verschiebt sich das Bild deutlich, weil viele Menschen länger im Bett bleiben und ausschlafen.

            Bei älteren Personen im Ruhestand zeigen sich zwischen Werktagen und Wochenenden kaum Unterschiede in der Dauer.
            """.repeat(2);

    static final String[] PARAS = {
            "Sieben Stunden Schlaf pro Nacht empfehlen Fachleute für Erwachsene. Viele Menschen schaffen das nicht.",
            "Ein Institut hat im Jahr 2023 viele Erwachsene am Telefon gefragt, wie lange sie schlafen.",
            "An Arbeitstagen schlafen etwa vier von zehn Personen zu kurz. Männer sind öfter betroffen als Frauen.",
            "Am Wochenende ist das anders. Dann schlafen die meisten länger und holen etwas Schlaf nach.",
            "Bei Rentnern gibt es kaum einen Unterschied, denn sie gehen nicht mehr zur Arbeit.",
            "Ganz nachholen kann man fehlenden Schlaf aber nicht. Regelmäßige Zeiten helfen mehr."
    };

    private long admin;

    @BeforeEach
    void setUp() {
        admin = userRepository.save(User.builder().email("studio-" + System.nanoTime() + "@local.test")
                .passwordHash("x").displayName("Owner").role(User.Role.ADMIN).build()).getId();
        when(chatClient.chatCompletionForTier(anyList(), any(), anyDouble(), any(), anyBoolean()))
                .thenAnswer(inv -> {
                    List<ChatMessage> msgs = inv.getArgument(0);
                    String system = msgs.get(0).content();
                    String user = msgs.size() > 1 ? msgs.get(1).content() : "";
                    return new AiChatCompletionResult(reply(system, user), null, "test", "test-model");
                });
    }

    private String reply(String system, String user) {
        if (system.startsWith("Du bereitest Material")) {
            return """
                    {"title": "Schlafstudie", "publisher": "Beispielzeitung", "neutral": true,
                     "facts": [{"text": "Vier von zehn Erwachsenen schlafen werktags unter sieben Stunden (2023).",
                                "figure": "40 %", "year": "2023", "paragraph": 2},
                               {"text": "Rentner schlafen an allen Tagen ähnlich lange.", "paragraph": 4}],
                     "confirms": []}""";
        }
        if (system.startsWith("Du schreibst einen NEUEN Lesetext")) {
            StringBuilder sb = new StringBuilder("{\"titleDe\": \"Zu wenig Schlaf\", \"vorspannDe\": \"Eine Umfrage zeigt:"
                    + " Viele schlafen werktags zu kurz.\", \"glossary\": [], \"usedFactIds\": [\"s1f1\", \"s1f2\"],"
                    + " \"paragraphs\": [");
            for (int i = 0; i < PARAS.length; i++) sb.append(i == 0 ? "" : ",").append('"').append(PARAS[i]).append('"');
            return sb.append("]}").toString();
        }
        if (system.startsWith("Du erstellst Aufgaben")) {
            Matcher m = Pattern.compile("slot (\\d+) → ").matcher(user);
            List<String> items = new ArrayList<>();
            while (m.find()) {
                int s = Integer.parseInt(m.group(1));
                String ev = PARAS[s + 1].split("\\.")[0] + ".";
                items.add("""
                        {"slot": %d, "question": "Frage %d …",
                         "options": [{"text": "RICHTIG Ende %d", "correct": true, "trap": null},
                                     {"text": "falsch A %d", "correct": false, "trap": "Zukunft statt Gegenwart"},
                                     {"text": "falsch B %d", "correct": false, "trap": null}],
                         "evidence": "%s", "explanationVi": "{1} đúng; {2} sai; {3} sai.",
                         "selfScore": {"phrasing": 1, "evidence": 1, "distractors": 1, "language": 0}}"""
                        .formatted(s, s, s, s, s, ev));
            }
            return "{\"items\": [" + String.join(",", items) + "]}";
        }
        if (system.contains("Prüfungsexperte")) {
            Matcher m = Pattern.compile("(LV2-\\d+):").matcher(user);
            List<String> out = new ArrayList<>();
            while (m.find()) {
                out.add("{\"id\": \"" + m.group(1) + "\", \"phrasing\": 1, \"evidence\": 1, \"distractors\": 1,"
                        + " \"language\": 0, \"multiParagraph\": false, \"halfTrue\": false}");
            }
            return "{\"items\": [" + String.join(",", out) + "]}";
        }
        if (system.startsWith("Löse die Aufgaben")) {
            // AI giỏi: chọn phương án bắt đầu bằng RICHTIG
            Matcher q = Pattern.compile("(LV2-\\d+):[^\\n]*\\n((?:  [abc]\\) [^\\n]*\\n){3})").matcher(user);
            List<String> out = new ArrayList<>();
            while (q.find()) {
                Matcher o = Pattern.compile("  ([abc])\\) RICHTIG").matcher(q.group(2));
                out.add("{\"id\": \"" + q.group(1) + "\", \"answer\": \"" + (o.find() ? o.group(1) : "a") + "\"}");
            }
            return "{\"answers\": [" + String.join(",", out) + "]}";
        }
        // AI yếu và AI giải khi giấu bài: không trả lời được
        return "{\"answers\": []}";
    }

    private void runPendingJob(long draftId) {
        Long jobId = jdbc.queryForObject("SELECT busy_job_id FROM exam_drafts WHERE id = ?", Long.class, draftId);
        AiJob job = jobRepository.findById(jobId).orElseThrow();
        handler.handle(job);
    }

    @Test
    void fullFlowLandsInTheBankAndNeverStoresTheSourceText() {
        Draft d = service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 2, "Gesundheit", "EXAM",
                Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1, "EXPERT", 0)), admin);
        assertThat(d.itemCount()).isEqualTo(5);

        // Nguồn dán tay
        d = service.addSource(d.id(), new AddSourceRequest(null, SOURCE_TEXT, null, null), admin);
        assertThat(d.busyOp()).isEqualTo("FACTS");
        Long jobId = jdbc.queryForObject("SELECT busy_job_id FROM exam_drafts WHERE id = ?", Long.class, d.id());
        runPendingJob(d.id());
        String payload = jdbc.queryForObject("SELECT payload::text FROM ai_jobs WHERE id = ?", String.class, jobId);
        assertThat(payload).doesNotContain("pastedText").doesNotContain("Forschenden");
        Integer leaked = jdbc.queryForObject("SELECT COUNT(*) FROM exam_sources WHERE facts_json::text LIKE '%Forschenden%'"
                + " OR shingle_hashes::text LIKE '%Forschenden%'", Integer.class);
        assertThat(leaked).isZero();

        d = service.get(d.id());
        assertThat(d.busyOp()).isNull();
        assertThat(d.sources()).singleElement().satisfies(s -> {
            assertThat(s.usageMode()).isEqualTo("FACTS_ONLY");
            assertThat(s.facts()).hasSize(2);
        });
        long sourceId = d.sources().get(0).id();
        d = service.patchSource(d.id(), sourceId, new PatchSourceRequest("FACTS_ONLY", List.of("s1f1", "s1f2")));
        assertThat(d.sources().get(0).usageModeConfirmed()).isTrue();

        // Bài đọc
        service.writeText(d.id(), new WriteTextRequest(null, null, null), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.text().titleDe()).isEqualTo("Zu wenig Schlaf");
        assertThat(d.textMetrics().overlapMaxRun()).isLessThan(TeilSpec.OVERLAP_LIMIT);

        // Câu hỏi theo ma trận
        service.generateItems(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.items()).hasSize(5).extracting(Item::id).containsExactly("LV2-6", "LV2-7", "LV2-8", "LV2-9", "LV2-10");
        assertThat(d.items()).extracting(Item::difficultyTarget)
                .containsExactlyInAnyOrder("EASY", "EASY", "MEDIUM", "MEDIUM", "HARD");
        assertThat(d.items()).allSatisfy(i -> {
            assertThat(i.options().get(i.correct())).startsWith("RICHTIG");
            assertThat(i.explanationVi()).startsWith(i.correct() + " đúng");
        });
        assertThat(ExamDraftService.lettersBalanced(d.items().stream().map(Item::correct).toList())).isTrue();

        // Chưa tự kiểm thì không duyệt được
        long draftId = d.id();
        Map<String, Boolean> all = new java.util.HashMap<>();
        TeilSpec.CHECKLIST_KEYS.forEach(k -> all.put(k, true));
        assertThatThrownBy(() -> service.approve(draftId, all, admin)).isInstanceOf(ConflictException.class);

        // Tự kiểm
        service.verify(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.checks()).extracting(Check::key).contains("FORMAT", "SOLVER", "OVERLAP", "MATRIX");
        assertThat(d.checks()).noneMatch(c -> "RED".equals(c.light()));
        assertThat(d.items()).noneMatch(i -> "RED".equals(i.light()));
        assertThat(d.checklistSuggestions()).containsEntry("SINGLE_ANSWER", true).containsEntry("NO_COPY", true);

        // Duyệt
        d = service.approve(d.id(), all, admin);
        assertThat(d.status()).isEqualTo("APPROVED");
        assertThat(d.blockId()).isNotNull();
        BlockDetail block = service.getBlock(d.blockId());
        assertThat(block.content()).containsEntry("type", "MULTIPLE_CHOICE").containsEntry("context_lines", true);
        assertThat(((Map<?, ?>) block.content().get("source")).get("quelle").toString()).startsWith("Daten: Beispielzeitung");
        assertThat(service.listBlocks("B1", "LESEN", 2)).extracting(BlockSummary::id).contains(d.blockId());

        // Học viên không thấy đáp án, bằng chứng, bẫy hay nhãn độ khó
        String sections = "{\"sections\":[{\"name\":\"LESEN\",\"teile\":[" + jdbc.queryForObject(
                "SELECT content_json::text FROM exam_teil_blocks WHERE id = ?", String.class, d.blockId()) + "]}]}";
        String served = sanitizer.stripAnswerKey(sections);
        assertThat(served).doesNotContain("\"correct\"").doesNotContain("\"evidence\"").doesNotContain("\"traps\"")
                .doesNotContain("difficulty_target").doesNotContain("explanation_vi");
    }

    @Test
    void onlyOneAiOperationAtATime() {
        Draft d = service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 2, null, "EXAM",
                Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1)), admin);
        service.addSource(d.id(), new AddSourceRequest(null, SOURCE_TEXT, null, null), admin);
        assertThatThrownBy(() -> service.addSource(d.id(), new AddSourceRequest(null, SOURCE_TEXT, null, null), admin))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void examModeNeedsExactlyFiveItems() {
        assertThatThrownBy(() -> service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 2, null, "EXAM",
                Map.of("EASY", 3, "HARD", 1)), admin))
                .hasMessageContaining("đúng 5 câu");
        assertThatThrownBy(() -> service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 3, null, "EXAM",
                Map.of("EASY", 5)), admin))
                .hasMessageContaining("Lesen Teil 2");
    }
}
