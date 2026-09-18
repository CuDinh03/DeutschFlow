package com.deutschflow.grammar.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.ai.tier.LlmTierResolver;
import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("AI Exam Evaluator Service")
@ExtendWith(MockitoExtension.class)
class AiExamEvaluatorServiceTest {

    @Mock
    private OpenAiChatClient chatClient;
    @Mock
    private LlmTierResolver llmTierResolver;
    @Mock
    private AiUsageLedgerService ledgerService;

    private AiExamEvaluatorService evaluatorService;

    @BeforeEach
    void setUp() {
        evaluatorService = new AiExamEvaluatorService(chatClient, llmTierResolver, ledgerService);
        // lenient: vài test đi nhánh early-return không chạm LLM (MockitoExtension strict-stubs)
        org.mockito.Mockito.lenient().when(llmTierResolver.spec(LlmTier.GRADING_EXAM))
                .thenReturn(new TierSpec(LlmTier.GRADING_EXAM, "openai/gpt-oss-120b", null, null, null, null, null, null, null, false, false));
    }

    @Test
    @DisplayName("mô hình bỏ sót một tiêu chí thì tiêu chí đó rời khỏi thang, không bị tính 0")
    void evaluateSchreibenEmail_missingCriterion_shrinksMaxInsteadOfScoringZero() {
        // Phiếu thật trên prod: nhận xét khen ngữ pháp mức B2 nhưng `strukturen` ra 0/3 — parser cũ
        // đọc khoá thiếu thành 0 y hệt điểm 0 thật.
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":5,"kohaerenz":4,"wortschatz":3,
                 "feedback_vi":"Ngữ pháp ở mức B2","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B2");

        assertEquals(12, result.get("total"), "chỉ cộng ba tiêu chí mô hình có chấm");
        assertEquals(12, result.get("max"), "thang co lại theo tiêu chí có mặt, không còn 15");
        assertEquals(100, result.get("percentage"));
        assertNull(result.get("strukturen"), "không bịa điểm cho tiêu chí mô hình không chấm");
        assertEquals(List.of("strukturen"), result.get("missing_criteria"));
    }

    // ─── telc: chấm theo BẬC A/B/C/D (Bewertungsbogen Übungstest 2020), 17/09/2026 ──────────────
    // Trước đợt này bảng telc chấm điểm liên tục 0–15 mỗi Kriterium — thang telc không có 12/15:
    // mỗi Kriterium chỉ có A/B/C/D = 15/9/3/0. Mọi ca dưới đây đều phải ra điểm trong {0, 3, 9, 15}.

    /** Bài viết đủ bốn ý, câu mở đầu đa dạng — dùng cho các ca không kiểm luật Ich/Wir. */
    private static final String EMAIL_GUT = """
            Liebe Lena,
            vielen Dank für deine Mail! Natürlich passt mir der Juli, da habe ich frei.
            Seit dem Umzug wohne ich in Leipzig, und die Stadt gefällt mir sehr gut.
            Für die Übernachtung kenne ich ein günstiges Hostel direkt am Park.
            Neu bei mir: Am Montag fange ich einen neuen Job an.
            Liebe Grüße
            Minh""";

    @Test
    @DisplayName("telc: bậc A/B/C ra 15/9/3 — mỗi Kriterium chỉ nhận 0/3/9/15, tổng 45")
    void evaluateSchreibenEmail_telcBands_mapToStepPoints() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"thema_verfehlt":false,"situierung_verfehlt":false,
                 "leitpunkte":{"band":"A","erfuellt":[1,2,3,4],"fehlt":[]},
                 "kommunikative_gestaltung":{"band":"B","kein_a_weil":["UNVERBUNDEN"]},
                 "formale_richtigkeit":{"band":"C"},
                 "feedback_vi":"Đủ bốn ý","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(27, result.get("total"));
        assertEquals(45, result.get("max"), "thang telc là 45, không phải 15 của Goethe");
        assertEquals(15, result.get("leitpunkte"));
        assertEquals(9, result.get("kommunikative_gestaltung"));
        assertEquals(3, result.get("formale_richtigkeit"));
        assertEquals(Map.of("leitpunkte", "A", "kommunikative_gestaltung", "B", "formale_richtigkeit", "C"),
                result.get("bands"));
        assertEquals(List.of("UNVERBUNDEN"), result.get("kein_a_weil"), "lý do mất A đi ra phiếu");
        assertNull(result.get("kohaerenz"), "không lẫn tiêu chí Goethe vào phiếu telc");
        for (String key : List.of("leitpunkte", "kommunikative_gestaltung", "formale_richtigkeit")) {
            assertTrue(List.of(0, 3, 9, 15).contains(result.get(key)), key + " phải là bậc telc");
        }
    }

    @Test
    @DisplayName("telc: phiếu tự mô tả tiêu chí kèm BẬC để màn kết quả in đúng chữ trên Bewertungsbogen")
    void evaluateSchreibenEmail_telc_emitsSelfDescribingCriteriaWithBand() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"leitpunkte":{"band":"A"},"kommunikative_gestaltung":{"band":"A"},"formale_richtigkeit":{"band":"A"},
                 "feedback_vi":"Rất tốt","feedback_de":"Sehr gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(List.of(
                Map.of("key", "leitpunkte", "score", 15, "max", 15, "band", "A"),
                Map.of("key", "kommunikative_gestaltung", "score", 15, "max", 15, "band", "A"),
                Map.of("key", "formale_richtigkeit", "score", 15, "max", 15, "band", "A")),
                result.get("criteria"));
        assertEquals(45, result.get("total"));
    }

    @Test
    @DisplayName("telc: bài lạc đề (thema_verfehlt) ⇒ D cả ba Kriterien = 0/45, vẫn là ĐÃ CHẤM chứ không chờ")
    void evaluateSchreibenEmail_telc_themaVerfehlt_zeroOnAllThree() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"thema_verfehlt":true,
                 "leitpunkte":{"band":"B"},"kommunikative_gestaltung":{"band":"A"},"formale_richtigkeit":{"band":"A"},
                 "feedback_vi":"Lạc đề","feedback_de":"Thema verfehlt","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(0, result.get("total"));
        assertEquals(45, result.get("max"));
        assertEquals(Boolean.TRUE, result.get("thema_verfehlt"));
        assertEquals(Map.of("leitpunkte", "D", "kommunikative_gestaltung", "D", "formale_richtigkeit", "D"),
                result.get("bands"));
    }

    @Test
    @DisplayName("telc: sai người nhận/tình huống (situierung_verfehlt) ⇒ chỉ Kriterium I = D, II và III giữ nguyên")
    void evaluateSchreibenEmail_telc_situierungVerfehlt_zeroOnlyOnLeitpunkte() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"situierung_verfehlt":true,
                 "leitpunkte":{"band":"A","fehlt":[]},"kommunikative_gestaltung":{"band":"B"},"formale_richtigkeit":{"band":"A"},
                 "feedback_vi":"Viết cho công ty thay vì cho bạn","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(0, result.get("leitpunkte"));
        assertEquals(9, result.get("kommunikative_gestaltung"));
        assertEquals(15, result.get("formale_richtigkeit"));
        assertEquals(24, result.get("total"));
    }

    @Test
    @DisplayName("telc: đủ bốn ý nhưng câu nào cũng mở bằng „Ich“ ⇒ Kriterium II không được A (kéo về B), ghi rõ lý do")
    void evaluateSchreibenEmail_telc_ichAnfangDominant_capsGestaltungAtB() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"leitpunkte":{"band":"A","erfuellt":[1,2,3,4],"fehlt":[]},
                 "kommunikative_gestaltung":{"band":"A","kein_a_weil":[]},
                 "formale_richtigkeit":{"band":"A"},
                 "feedback_vi":"Đủ ý","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));
        String ichIchIch = """
                Liebe Lena,
                Ich freue mich sehr über deine Mail. Ich habe im Juli auch frei. Ich wohne jetzt in Leipzig.
                Ich finde die Stadt sehr schön. Ich kenne ein günstiges Hostel am Park. Ich fange am Montag
                einen neuen Job an. Ich freue mich auf dich.
                Liebe Grüße
                Minh""";

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, ichIchIch, "Task", "B1", "TELC");

        assertEquals(15, result.get("leitpunkte"), "Kriterium I không bị ảnh hưởng");
        assertEquals(9, result.get("kommunikative_gestaltung"), "A bị kéo về B");
        assertEquals(List.of("ICH_ANFANG"), result.get("kein_a_weil"));
        assertEquals(39, result.get("total"));
    }

    @Test
    @DisplayName("telc: mô hình tự liệt kê lý do mất A ở Kriterium II mà vẫn cho A ⇒ máy kéo về B")
    void evaluateSchreibenEmail_telc_reasonListedButBandA_capsAtB() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"leitpunkte":{"band":"A"},
                 "kommunikative_gestaltung":{"band":"A","kein_a_weil":["REGISTER","unbekannt"]},
                 "formale_richtigkeit":{"band":"B"},
                 "feedback_vi":"","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(9, result.get("kommunikative_gestaltung"));
        assertEquals(List.of("REGISTER"), result.get("kein_a_weil"), "mã lạ bị loại, mã đúng giữ lại");
    }

    @Test
    @DisplayName("telc: mô hình lỡ trả số như bảng cũ thì kéo về bậc gần nhất — không bao giờ ra 12/15")
    void evaluateSchreibenEmail_telc_numericFallback_snapsToNearestBand() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"leitpunkte":12,"kommunikative_gestaltung":"B (B1 erfüllt)","formale_richtigkeit":{"points":14},
                 "feedback_vi":"","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(9, result.get("leitpunkte"), "12 gần 9 hơn 15");
        assertEquals(9, result.get("kommunikative_gestaltung"), "chuỗi có chú thích vẫn đọc được chữ cái");
        assertEquals(15, result.get("formale_richtigkeit"), "14 gần 15");
    }

    @Test
    @DisplayName("telc: Leitpunkte thiếu đi ra phiếu theo số thứ tự để màn nhận xét nói được ý nào thiếu")
    void evaluateSchreibenEmail_telc_reportsMissingLeitpunkte() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"leitpunkte":{"band":"C","erfuellt":[1,3],"fehlt":[2,4]},
                 "kommunikative_gestaltung":{"band":"B"},"formale_richtigkeit":{"band":"B"},
                 "feedback_vi":"Thiếu ý 2 và 4","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "TELC");

        assertEquals(3, result.get("leitpunkte"));
        assertEquals(List.of(2, 4), result.get("leitpunkte_fehlt"));
    }

    @Test
    @DisplayName("tỉ lệ câu mở bằng Ich/Wir: bỏ dòng chào/ký, đếm đúng câu")
    void ichWirShare_countsSentencesNotGreetings() {
        assertEquals(0.0, AiExamEvaluatorService.ichWirShare("Liebe Lena,\nDanke für deine Mail, das freut mich sehr."));
        assertEquals(1.0, AiExamEvaluatorService.ichWirShare("Ich komme im Juli. Wir sehen uns dann bald."));
        assertEquals(0.5, AiExamEvaluatorService.ichWirShare(
                "Ich komme gern im Juli. Die Stadt ist wirklich schön. Wir gehen dann ins Museum. Das Hostel liegt am Park."));
        assertEquals(0.0, AiExamEvaluatorService.ichWirShare(null));
    }

    @Test
    @DisplayName("HỒI QUY: bảng Goethe vẫn chấm điểm liên tục, không bị kéo về bậc")
    void evaluateSchreibenEmail_goethe_keepsContinuousPoints() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":4,"kohaerenz":3,"wortschatz":2,"strukturen":2,
                 "feedback_vi":"","feedback_de":"","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, EMAIL_GUT, "Task", "B1", "GOETHE");

        assertEquals(11, result.get("total"));
        assertEquals(15, result.get("max"));
        assertNull(result.get("bands"));
        assertEquals(Map.of("key", "aufgabenerfuellung", "score", 4, "max", 5),
                ((List<?>) result.get("criteria")).get(0), "hàng tiêu chí Goethe không có khoá band");
    }

    @Test
    @DisplayName("HỒI QUY: không khai định dạng thì vẫn là bảng Goethe 4 tiêu chí tổng 15")
    void evaluateSchreibenEmail_noFormat_keepsGoetheRubric() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":5,"kohaerenz":4,"wortschatz":3,"strukturen":3,
                 "feedback_vi":"Tốt","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B1");

        assertEquals(15, result.get("total"));
        assertEquals(15, result.get("max"));
        assertEquals(5, result.get("aufgabenerfuellung"));
        assertNull(result.get("leitpunkte"));
    }

    @Test
    @DisplayName("khoá lệch tên vẫn đọc được thay vì rơi về 0")
    void evaluateSchreibenEmail_aliasKeys_areRead() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":4,"kohärenz":3,"vocabulary":2,"grammatik":3,
                 "feedback_vi":"Ổn","feedback_de":"Okay","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B1");

        assertEquals(3, result.get("strukturen"), "khoá `grammatik` phải được hiểu là strukturen");
        assertEquals(3, result.get("kohaerenz"));
        assertEquals(2, result.get("wortschatz"));
        assertEquals(12, result.get("total"));
        assertEquals(15, result.get("max"));
        assertNull(result.get("missing_criteria"));
    }

    @Test
    @DisplayName("thiếu TOÀN BỘ tiêu chí thì để chờ chấm, không trả điểm 0")
    void evaluateSchreibenEmail_noCriteriaAtAll_returnsPending() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"feedback_vi":"Không chấm được","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Ein Text.", "Task", "B1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
    }

    @Test
    @DisplayName("chấm bài viết theo rubric của trình độ đề, không đóng cứng A1")
    void evaluateSchreibenEmail_usesExamLevelInPrompt() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":5,"kohaerenz":4,"wortschatz":3,"strukturen":3,"total":15,"max":15,
                 "feedback_vi":"Tốt","feedback_de":"Gut","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));
        var captor = org.mockito.ArgumentCaptor.forClass(List.class);

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(
                1L, "Meiner Meinung nach sollte der Nahverkehr günstiger werden.", "Forumsbeitrag schreiben", "B2");

        verify(chatClient).chatCompletionForTier(captor.capture(), any(TierSpec.class), anyDouble(), anyInt());
        String gopLai = ((List<ChatMessage>) captor.getValue()).stream()
                .map(ChatMessage::content).reduce("", (a, b) -> a + "\n" + b);
        assertTrue(gopLai.contains("CEFR level of this exam: B2"), "prompt phải nêu trình độ của đề");
        assertTrue(gopLai.contains("At B2 expect"), "prompt phải kèm kỳ vọng ngôn ngữ của bậc đó");
        assertFalse(gopLai.contains("Start Deutsch 1"), "không được đóng cứng rubric A1 cho đề B2");
        assertEquals("B2", result.get("level"), "kết quả phải nói rõ đã chấm theo rubric nào");
    }

    @Test
    @DisplayName("trình độ rỗng hoặc lạ thì lấy B1 làm mặc định")
    void evaluateSchreibenEmail_unknownLevel_fallsBackToB1() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("""
                {"aufgabenerfuellung":3,"kohaerenz":2,"wortschatz":2,"strukturen":2,"total":9,"max":15,
                 "feedback_vi":"Ổn","feedback_de":"Okay","strengths_vi":[],"improvements_vi":[]}
                """, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Hallo Anna.", "Task", "  ");

        assertEquals("B1", result.get("level"));
    }

    @Test
    @DisplayName("evaluates email and returns scored rubric")
    void evaluateSchreibenEmail_validEmail_returnsScoredRubric() {
        String aiResponse = """
            {
              "aufgabenerfuellung": 4,
              "kohaerenz": 3,
              "wortschatz": 2,
              "strukturen": 2,
              "total": 11,
              "max": 15,
              "feedback_vi": "Bạn đã trả lời được 3 yêu cầu. Cần cải thiện từ vựng.",
              "feedback_de": "Sie haben alle 3 Punkte beantwortet.",
              "strengths_vi": ["Cấu trúc rõ ràng", "Đủ 3 điểm yêu cầu"],
              "improvements_vi": ["Dùng từ vựng phong phú hơn"]
            }
            """;
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L,
            "Hallo, ich heiße Anna und ich komme aus Vietnam.",
            "Schreibe eine Vorstellung.",
            "A1"
        );

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(4, result.get("aufgabenerfuellung"));
        assertEquals(3, result.get("kohaerenz"));
        assertEquals(2, result.get("wortschatz"));
        assertEquals(2, result.get("strukturen"));
        assertEquals(11, result.get("total"));
        assertEquals(15, result.get("max"));
        assertNotNull(result.get("feedback_vi"));
    }

    @Test
    @DisplayName("returns pending when email content is empty")
    void evaluateSchreibenEmail_emptyContent_returnsPending() {
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "", "Task", "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
        verifyNoInteractions(chatClient);
    }

    @Test
    @DisplayName("returns pending when email content is null")
    void evaluateSchreibenEmail_nullContent_returnsPending() {
        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, null, "Task", "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        verifyNoInteractions(chatClient);
    }

    @Test
    @DisplayName("clamps scores to valid rubric ranges")
    void evaluateSchreibenEmail_outOfRangeScores_clampsToMax() {
        String aiResponse = """
            {
              "aufgabenerfuellung": 99,
              "kohaerenz": -5,
              "wortschatz": 10,
              "strukturen": 3,
              "total": 0,
              "max": 15,
              "feedback_vi": "test",
              "feedback_de": "test",
              "strengths_vi": [],
              "improvements_vi": []
            }
            """;
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some email content here.", null, "A1");

        assertEquals(5, result.get("aufgabenerfuellung"), "Should clamp to max 5");
        assertEquals(0, result.get("kohaerenz"), "Should clamp to min 0");
        assertEquals(3, result.get("wortschatz"), "Should clamp to max 3");
        assertEquals(3, result.get("strukturen"));
        // total = 5+0+3+3 = 11
        assertEquals(11, result.get("total"));
    }

    @Test
    @DisplayName("handles malformed JSON gracefully")
    void evaluateSchreibenEmail_malformedJson_returnsPending() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult("not valid json at all {{{{", null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some valid email.", null, "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
    }

    @Test
    @DisplayName("strips markdown code blocks from AI response")
    void evaluateSchreibenEmail_markdownWrapped_parsesCorrectly() {
        String aiResponse = """
            ```json
            {
              "aufgabenerfuellung": 3,
              "kohaerenz": 2,
              "wortschatz": 1,
              "strukturen": 1,
              "total": 7,
              "max": 15,
              "feedback_vi": "Cần cải thiện nhiều hơn.",
              "feedback_de": "Bitte verbessern Sie.",
              "strengths_vi": [],
              "improvements_vi": ["Cải thiện cấu trúc"]
            }
            ```
            """;
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenReturn(new AiChatCompletionResult(aiResponse, null, "GROQ", "test-model"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Email text here.", null, "A1");

        assertEquals("AI_EVALUATED", result.get("status"));
        assertEquals(7, result.get("total"));
    }

    @Test
    @DisplayName("handles AI service exception gracefully")
    void evaluateSchreibenEmail_aiServiceThrows_returnsPending() {
        when(chatClient.chatCompletionForTier(anyList(), any(TierSpec.class), anyDouble(), anyInt()))
            .thenThrow(new RuntimeException("Service unavailable"));

        Map<String, Object> result = evaluatorService.evaluateSchreibenEmail(1L, "Some email content.", null, "A1");

        assertEquals("PENDING_AI_EVALUATION", result.get("status"));
        assertEquals(0, result.get("total"));
    }
}
