package com.deutschflow.speaking.ai;

import com.deutschflow.interview.prompt.InterviewPromptBuilder;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;
import com.deutschflow.speaking.interview.PersonaInterviewRegistry;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.system.service.SystemConfigService;
import com.deutschflow.user.entity.UserLearningProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Bộ test VÀNG cho dữ kiện bài học đáp án cố định (QA prod 09/08 mục B: model dạy
 * A đọc là "baa" — lệch cả bảng một nhịp). Dữ kiện bất biến nằm ngoài model nên test
 * này bắt hồi quy mỗi khi đổi provider/model (Groq → Fireworks đã xảy ra).
 */
class LessonFactSheetsTest {

    // ─── Dữ kiện bất biến: bảng chữ cái ──────────────────────────────────

    @Test
    void alphabet_aDocLaA_khongPhaiBaa() {
        String sheet = LessonFactSheets.factSheetFor("alphabet");
        assertThat(sheet).contains("A = \"a\" [aː]");
        assertThat(sheet).doesNotContain("A = \"baa\"");
        // Chốt đúng lỗi QA: "bê" là B, không phải A.
        assertThat(sheet).contains("B = \"bê\" [beː]");
        assertThat(sheet).contains("KHÔNG phải \"bê\"");
    }

    @Test
    void alphabet_duDuKienChinh() {
        String sheet = LessonFactSheets.factSheetFor("alphabet");
        assertThat(sheet)
                .contains("C = \"xê\" [tseː]")
                .contains("V = \"phao\" [faʊ]")
                .contains("Z = \"txét\" [tsɛt]")
                .contains("ß = \"ét-xét\"");
    }

    // ─── Dữ kiện bất biến: số đếm ────────────────────────────────────────

    @Test
    void numbers_cacCaDacBietVaQuyTacDaoNguoc() {
        String sheet = LessonFactSheets.factSheetFor("numbers");
        assertThat(sheet)
                .contains("16 sechzehn")
                .contains("17 siebzehn")
                .contains("30 dreißig")
                .contains("21 = einundzwanzig");
    }

    // ─── Dữ kiện bất biến: umlaut + số khẩn cấp ─────────────────────────

    @Test
    void umlaut_baNguyenAm() {
        String sheet = LessonFactSheets.factSheetFor("umlaut");
        assertThat(sheet).contains("ä [ɛ").contains("ö [œ").contains("ü [ʏ");
    }

    @Test
    void emergency_110Polizei_112Feuerwehr() {
        String sheet = LessonFactSheets.factSheetFor("emergency_numbers");
        assertThat(sheet).contains("110 = Polizei");
        assertThat(sheet).contains("112 = Feuerwehr");
        assertThat(sheet).contains("116117");
    }

    @Test
    void chuDeTinhHuong_khongCoSheet() {
        assertThat(LessonFactSheets.factSheetFor("anmeldung")).isNull();
        assertThat(LessonFactSheets.factSheetFor("street_names")).isNull();
        assertThat(LessonFactSheets.factSheetFor(null)).isNull();
    }

    // ─── Fact sheet phải thật sự vào prompt LESSON ───────────────────────

    static class PromptWiring {
        @Mock
        SystemConfigService systemConfigService;
        @Mock
        InterviewPromptBuilder interviewPromptBuilder;
        SystemPromptBuilder builder;
    }

    PromptWiring w = new PromptWiring();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(w);
        lenient().when(w.systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        w.builder = new SystemPromptBuilder(w.systemConfigService, new PersonaInterviewRegistry(), w.interviewPromptBuilder);
    }

    private SpeakingPromptRequest lessonRequest(String topic, int turnCount) {
        return SpeakingPromptRequest.builder()
                .profile(UserLearningProfile.builder()
                        .targetLevel(UserLearningProfile.TargetLevel.A1)
                        .goalType(UserLearningProfile.GoalType.CERT)
                        .currentLevel(UserLearningProfile.CurrentLevel.A1)
                        .build())
                .topic(topic)
                .sessionCefrLevel("A1")
                .persona(SpeakingPersona.TUAN)
                .sessionMode(SpeakingSessionMode.LESSON)
                .turnCount(turnCount)
                .build();
    }

    @Test
    void lessonPrompt_alphabet_chuaDuKienBatBuocVaRangBuoc() {
        String p = w.builder.buildSystemPrompt(lessonRequest("alphabet", 0));
        assertThat(p).contains("DỮ KIỆN BẮT BUỘC");
        assertThat(p).contains("A = \"a\" [aː]");
        assertThat(p).contains("KHÔNG tự bịa cách đọc");
    }

    @Test
    void lessonPrompt_chuDeTinhHuong_coRangBuocThanTrong() {
        String p = w.builder.buildSystemPrompt(lessonRequest("anmeldung", 0));
        assertThat(p).doesNotContain("DỮ KIỆN BẮT BUỘC");
        assertThat(p).contains("KHÔNG dạy dữ kiện đó");
    }

    @Test
    void lessonPrompt_khongConYeuCauMarkdownBold() {
        String p = w.builder.buildSystemPrompt(lessonRequest("alphabet", 0));
        assertThat(p).doesNotContain("**bold**");
        assertThat(p).doesNotContain("**A**");
        assertThat(p).contains("PLAINTEXT");
    }

    @Test
    void dynamicContext_luot2_camChaoLai() {
        String ctx = w.builder.buildDynamicTurnContext(lessonRequest("alphabet", 1), null);
        assertThat(ctx).contains("CẤM chào lại");
        // Lượt đầu chưa có luật này.
        String ctxFirst = w.builder.buildDynamicTurnContext(lessonRequest("alphabet", 0), null);
        assertThat(ctxFirst == null || !ctxFirst.contains("CẤM chào lại")).isTrue();
    }
}
