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

    static final String FILLER = "Fachleute erklären diesen Punkt in einfachen Worten, damit alle Leserinnen und Leser "
            + "ihn gut verstehen können. Sie nennen dazu Beispiele aus dem Alltag von Familien, Studierenden und "
            + "Berufstätigen in großen und kleinen Städten. Außerdem geben sie praktische Tipps für den Abend zu Hause.";

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
        // Đầu ra dài (rút dữ kiện, viết bài, ra câu hỏi, đối chiếu dữ kiện) đi đường stream.
        when(chatClient.chatCompletionStreamForTier(anyList(), any(), anyDouble(), any(), any(), any(), any()))
                .thenAnswer(inv -> {
                    List<ChatMessage> msgs = inv.getArgument(0);
                    String system = msgs.get(0).content();
                    String user = msgs.size() > 1 ? msgs.get(1).content() : "";
                    String out = reply(system, user);
                    java.util.function.Consumer<String> onToken = inv.getArgument(4);
                    java.util.function.Consumer<AiChatCompletionResult> onComplete = inv.getArgument(5);
                    onToken.accept(out);
                    onComplete.accept(new AiChatCompletionResult(out, null, "test", "test-model"));
                    return true;
                });
    }

    static final List<String> SB_TARGETS = List.of("weil", "obwohl", "damit", "dass", "wenn", "deshalb", "trotzdem",
            "sondern", "bevor", "nachdem");
    static final List<String> SB_OTHER = List.of("und", "oder", "aber", "denn", "also", "dann", "noch", "schon",
            "nur", "auch");

    static String sbLetter() {
        StringBuilder sb = new StringBuilder("Sehr geehrte Damen und Herren,\n\n");
        for (int i = 0; i < SB_TARGETS.size(); i++) {
            sb.append("Im Abschnitt Nummer ").append(i + 1).append(" schreibe ich ").append(SB_TARGETS.get(i))
                    .append(" es wichtig ist. ");
        }
        return sb.append("\n\nMit freundlichen Grüßen\nAnna Berg").toString();
    }

    private String reply(String system, String user) {
        if (system.contains("Sprachbausteine Teil 1, einen NEUEN")) {
            return "{\"letter\": \"" + sbLetter().replace("\n", "\\n") + "\"}";
        }
        if (system.startsWith("Du wählst Lücken") && system.contains("Mehrfachauswahl")) {
            Matcher m = Pattern.compile("slot (\\d+) → ").matcher(user);
            List<String> items = new ArrayList<>();
            while (m.find()) {
                int sl = Integer.parseInt(m.group(1));
                String t = SB_TARGETS.get(sl);
                items.add(("{\"slot\": %d, \"target\": \"%s\", \"before\": \"Nummer %d schreibe ich\","
                        + " \"options\": [{\"text\": \"%s\", \"correct\": true}, {\"text\": \"%s\", \"correct\": false},"
                        + " {\"text\": \"%s\", \"correct\": false}], \"explanationVi\": \"{1} đúng.\"}")
                        .formatted(sl, t, sl + 1, t, SB_OTHER.get(sl), SB_OTHER.get((sl + 1) % 10)));
            }
            return "{\"items\": [" + String.join(",", items) + "]}";
        }
        if (system.startsWith("Löse die Aufgaben") && user.contains("LÜCKEN")) {
            Matcher q = Pattern.compile("(SB1-\\d+) \\(Lücke \\d+\\): a\\) (\\S+)  b\\) (\\S+)  c\\) (\\S+)").matcher(user);
            List<String> out = new ArrayList<>();
            while (q.find()) {
                String ans = SB_TARGETS.contains(q.group(2)) ? "a" : SB_TARGETS.contains(q.group(3)) ? "b" : "c";
                out.add("{\"id\": \"" + q.group(1) + "\", \"answer\": \"" + ans + "\"}");
            }
            return "{\"answers\": [" + String.join(",", out) + "]}";
        }
        if (system.startsWith("Du bereitest Material")) {
            return """
                    {"title": "Schlafstudie", "publisher": "Beispielzeitung", "neutral": true,
                     "facts": [{"text": "Vier von zehn Erwachsenen schlafen werktags unter sieben Stunden (2023).",
                                "figure": "40 %", "year": "2023", "paragraph": 2},
                               {"text": "Rentner schlafen an allen Tagen ähnlich lange.", "paragraph": 4}],
                     "confirms": []}""";
        }
        if (system.startsWith("Du schreibst FÜNF NEUE")) {
            List<String> texts = new ArrayList<>();
            for (int i = 1; i <= 5; i++) {
                texts.add("{\"text\": \"Meldung " + i + ": " + (PARAS[i % PARAS.length] + " ").repeat(4).trim()
                        + "\", \"usedFactIds\": [\"s1f1\"]}");
            }
            return "{\"texts\": [" + String.join(",", texts) + "]}";
        }
        if (system.startsWith("Du erstellst Überschriften")) {
            Matcher m = Pattern.compile("slot (\\d+) → Text").matcher(user);
            List<String> items = new ArrayList<>();
            while (m.find()) {
                int s = Integer.parseInt(m.group(1));
                items.add(("{\"slot\": %d, \"headline\": \"RICHTIG %d\", \"nearHeadline\": \"Falle %d\","
                        + " \"trap\": \"übertreibt\", \"evidence\": \"Meldung %d\","
                        + " \"explanationVi\": \"{1} đúng, {2} là bẫy.\"}").formatted(s, s + 1, s + 1, s + 1));
            }
            return "{\"items\": [" + String.join(",", items) + "]}";
        }
        if (system.startsWith("Du schreibst einen NEUEN Lesetext")) {
            StringBuilder sb = new StringBuilder("{\"titleDe\": \"Zu wenig Schlaf\", \"vorspannDe\": \"Eine Umfrage zeigt:"
                    + " Viele schlafen werktags zu kurz.\", \"glossary\": [], \"usedFactIds\": [\"s1f1\", \"s1f2\"],"
                    + " \"paragraphs\": [");
            // Bài phải đủ khuôn 300–450 từ, nếu không bước Câu hỏi và đèn Độ dài chặn lại.
            for (int i = 0; i < PARAS.length; i++) {
                sb.append(i == 0 ? "" : ",").append('"').append(PARAS[i]).append(' ').append(FILLER).append('"');
            }
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
            Matcher m = Pattern.compile("((?:LV[12]|SB1)-\\d+)[ :]").matcher(user);
            List<String> out = new ArrayList<>();
            while (m.find()) {
                out.add("{\"id\": \"" + m.group(1) + "\", \"phrasing\": 1, \"evidence\": 1, \"distractors\": 1,"
                        + " \"language\": 0, \"multiParagraph\": false, \"halfTrue\": false}");
            }
            return "{\"items\": [" + String.join(",", out) + "]}";
        }
        if (system.startsWith("Löse die Aufgaben") && user.contains("ÜBERSCHRIFTEN")) {
            Matcher q = Pattern.compile("(LV1-(\\d+)): Text").matcher(user);
            List<String> out = new ArrayList<>();
            while (q.find()) {
                Matcher h = Pattern.compile("  ([a-j])\\) RICHTIG " + q.group(2) + "\\n").matcher(user);
                out.add("{\"id\": \"" + q.group(1) + "\", \"answer\": \"" + (h.find() ? h.group(1) : "a") + "\"}");
            }
            return "{\"answers\": [" + String.join(",", out) + "]}";
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
    @DisplayName("Nguồn từ tệp tải lên: giấy phép và đường dẫn bài gốc vào phiếu nguồn, văn bản tệp không được lưu")
    void uploadedFileBecomesASourceWithoutStoringItsText() {
        Draft d = service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 2, "Gesundheit", "EXAM",
                Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1, "EXPERT", 0)), admin);
        byte[] file = (SOURCE_TEXT + "\n\nLizenz: http://creativecommons.org/licenses/by/3.0/de/\n")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);

        d = service.addSourceFile(d.id(), "johm.txt", file, "Schlaf in Deutschland", "Journal of Health Monitoring",
                "https://doi.org/10.25646/00000", admin);
        assertThat(d.busyOp()).isEqualTo("FACTS");
        Long jobId = jdbc.queryForObject("SELECT busy_job_id FROM exam_drafts WHERE id = ?", Long.class, d.id());
        runPendingJob(d.id());
        String payload = jdbc.queryForObject("SELECT payload::text FROM ai_jobs WHERE id = ?", String.class, jobId);
        assertThat(payload).doesNotContain("pastedText").doesNotContain("Forschenden");

        d = service.get(d.id());
        assertThat(d.lastError()).isNull();
        assertThat(d.sources()).singleElement().satisfies(s -> {
            assertThat(s.url()).isEqualTo("https://doi.org/10.25646/00000");
            assertThat(s.title()).isEqualTo("Schlaf in Deutschland");
            assertThat(s.licenseText()).isEqualTo("CC BY 3.0 DE");
            assertThat(s.usageMode()).isEqualTo("ADAPT");
            assertThat(s.usageModeConfirmed()).isFalse(); // máy chỉ đoán, admin vẫn phải xác nhận
        });

        long id = d.id();
        assertThatThrownBy(() -> service.addSourceFile(id, "x.txt", file, null, null, "ftp://example.org/x", admin))
                .hasMessageContaining("http");
    }

    @Test
    void examModeNeedsExactlyFiveItems() {
        assertThatThrownBy(() -> service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 2, null, "EXAM",
                Map.of("EASY", 3, "HARD", 1)), admin))
                .hasMessageContaining("đúng 5 câu");
        assertThatThrownBy(() -> service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 3, null, "EXAM",
                Map.of("EASY", 5)), admin))
                .hasMessageContaining("đúng 10 câu"); // Lesen Teil 3 có từ đợt 3: 10 tình huống
    }

    @Test
    @DisplayName("Lesen Teil 1: 5 văn bản, 10 tiêu đề a–j không trùng, vào kho đúng khuôn MATCH_HEADLINE")
    void lesenTeil1Flow() {
        Draft d = service.create(new CreateDraftRequest("TELC", "B1", "LESEN", 1, "Wohnen", "EXAM",
                Map.of("EASY", 1, "MEDIUM", 2, "HARD", 1, "EXPERT", 1)), admin);
        service.addSource(d.id(), new AddSourceRequest(null, SOURCE_TEXT, null, null), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        service.patchSource(d.id(), d.sources().get(0).id(), new PatchSourceRequest("FACTS_ONLY", List.of("s1f1")));
        service.writeText(d.id(), new WriteTextRequest(null, null, null), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(TextChecks.paragraphs(d.text().context())).hasSize(5);

        service.generateItems(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.items()).extracting(Item::id).containsExactly("LV1-1", "LV1-2", "LV1-3", "LV1-4", "LV1-5");
        java.util.Set<String> letters = new java.util.HashSet<>();
        d.items().forEach(i -> letters.addAll(i.options().keySet()));
        assertThat(letters).hasSize(10).allMatch(l -> "abcdefghij".contains(l));
        assertThat(d.items()).allSatisfy(i -> {
            assertThat(i.options().get(i.correct())).startsWith("RICHTIG");
            assertThat(i.explanationVi()).startsWith(i.correct() + " đúng");
        });

        service.verify(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.checks()).extracting(Check::key).doesNotContain("ORDER", "ANSWERS");
        assertThat(d.checks()).noneMatch(c -> "RED".equals(c.light()));
        Map<String, Boolean> all = new java.util.HashMap<>();
        TeilSpec.CHECKLIST_KEYS.forEach(k -> all.put(k, true));
        d = service.approve(d.id(), all, admin);

        Map<String, Object> content = service.getBlock(d.blockId()).content();
        assertThat(content).containsEntry("type", "MATCH_HEADLINE").containsEntry("single_use", true);
        assertThat((Map<?, ?>) content.get("headlines")).hasSize(10);
        assertThat((List<?>) content.get("items")).hasSize(5)
                .allSatisfy(it -> assertThat(((Map<?, ?>) it).get("text").toString()).startsWith("Meldung"));
    }

    @Test
    @DisplayName("Sprachbausteine Teil 1: thư theo tình huống, 10 ô đánh số theo thứ tự thư, vào kho đúng khuôn GAP_MC")
    void sprachbausteine1Flow() {
        Draft d = service.create(new CreateDraftRequest("TELC", "B1", "SPRACHBAUSTEINE", 1, "Wohnen", "EXAM",
                Map.of("EASY", 3, "MEDIUM", 4, "HARD", 2, "EXPERT", 1), "Beschwerde: Heizung kaputt"), admin);
        assertThat(d.needsSources()).isFalse();
        assertThat(d.situation()).isEqualTo("Beschwerde: Heizung kaputt");

        service.writeText(d.id(), new WriteTextRequest(null, null, null), admin);
        runPendingJob(d.id());
        service.generateItems(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.items()).extracting(Item::id).containsExactly(
                "SB1-21", "SB1-22", "SB1-23", "SB1-24", "SB1-25", "SB1-26", "SB1-27", "SB1-28", "SB1-29", "SB1-30");
        assertThat(d.items()).allSatisfy(i -> assertThat(i.options().get(i.correct())).isEqualTo(i.meta().get("target")));
        assertThat(d.items().get(0).meta()).containsEntry("target", "weil").containsEntry("gap", "21");
        assertThat(ExamDraftService.lettersBalanced(d.items().stream().map(Item::correct).toList())).isTrue();

        service.verify(d.id(), admin);
        runPendingJob(d.id());
        d = service.get(d.id());
        assertThat(d.checks()).extracting(Check::key).contains("FORMAT", "SOLVER", "GAPS", "DUPLICATE");
        assertThat(d.checks()).noneMatch(c -> "RED".equals(c.light()));
        Map<String, Boolean> all = new java.util.HashMap<>();
        TeilSpec.CHECKLIST_KEYS.forEach(k -> all.put(k, true));
        d = service.approve(d.id(), all, admin);

        Map<String, Object> content = service.getBlock(d.blockId()).content();
        assertThat(content).containsEntry("type", "GAP_MC").containsEntry("point_per_item", 1.5);
        assertThat(content.get("gapped_text").toString()).contains("ich ___21___ es").contains("ich ___30___ es")
                .doesNotContain(" weil ");

        // Chống trùng: làm lại y hệt thì tự kiểm báo đỏ DUPLICATE và từng câu đỏ vì trùng câu kho.
        Draft again = service.create(new CreateDraftRequest("TELC", "B1", "SPRACHBAUSTEINE", 1, "Wohnen", "EXAM",
                Map.of("EASY", 3, "MEDIUM", 4, "HARD", 2, "EXPERT", 1), null), admin);
        service.writeText(again.id(), new WriteTextRequest(null, null, null), admin);
        runPendingJob(again.id());
        service.generateItems(again.id(), admin);
        runPendingJob(again.id());
        service.verify(again.id(), admin);
        runPendingJob(again.id());
        again = service.get(again.id());
        assertThat(again.checks()).filteredOn(c -> c.key().equals("DUPLICATE")).singleElement()
                .satisfies(c -> assertThat(c.light()).isEqualTo("RED"));
        assertThat(again.items()).allSatisfy(i -> assertThat(i.light()).isEqualTo("RED"));
    }
}
