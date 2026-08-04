package com.deutschflow.speaking.ai;

import com.deutschflow.interview.prompt.InterviewPromptBuilder;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.SpeakingPromptRequest;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.interview.PersonaInterviewRegistry;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.system.service.SystemConfigService;
import com.deutschflow.user.entity.UserLearningProfile;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

/**
 * Đ2 (kế hoạch 04/08) — hợp đồng tách TĨNH/ĐỘNG để ăn prefix-cache của Groq:
 * phần tĩnh phải BẤT BIẾN TỪNG BYTE giữa các lượt của một phiên dù learner context / adaptive
 * policy đổi; phần đổi theo lượt phải nằm trọn trong khối động. Chỉ cần một lượt phần tĩnh
 * "trôi", prefix-cache trượt toàn bộ — nên bộ test này so sánh CHUỖI TUYỆT ĐỐI, không contains.
 */
class SystemPromptBuilderCacheSplitTest {

    @Mock
    private SystemConfigService systemConfigService;

    @Mock
    private InterviewPromptBuilder interviewPromptBuilder;

    private SystemPromptBuilder builder;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        lenient().when(systemConfigService.getString(anyString(), anyString()))
                .thenAnswer(inv -> inv.getArgument(1));
        lenient().when(interviewPromptBuilder.build(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn("TURN_DIRECTIVE: TEST\n");
        builder = new SystemPromptBuilder(systemConfigService, new PersonaInterviewRegistry(), interviewPromptBuilder);
    }

    private static UserLearningProfile profile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.B1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.B1)
                .industry("IT")
                .build();
    }

    private static SpeakingPromptRequest.SpeakingPromptRequestBuilder base() {
        return SpeakingPromptRequest.builder()
                .profile(profile()).topic("Alltag").sessionCefrLevel("B1").persona(SpeakingPersona.LUKAS);
    }

    private static SpeakingPolicy enabledPolicy(String cefr, String focusCode) {
        return new SpeakingPolicy(true, cefr, 2, List.of(focusCode), List.of(),
                List.of("weil-Sätze"), "Wochenende", false, null, "luyện Kasus");
    }

    @Test
    @DisplayName("phần TĨNH bất biến từng byte dù interests/weak points/policy đổi giữa các lượt")
    void staticPrompt_isByteStableAcrossTurns() {
        String turn1 = builder.buildStaticSystemPrompt(base()
                .knownInterests(List.of("kochen"))
                .weakPoints(List.of(new WeakPoint("Genus", 3)))
                .policy(enabledPolicy("A2", "GEN-001"))
                .build());
        String turn2 = builder.buildStaticSystemPrompt(base()
                .knownInterests(List.of("kochen", "reisen", "fußball"))
                .weakPoints(List.of(new WeakPoint("Kasus", 7), new WeakPoint("Wortstellung", 2)))
                .policy(enabledPolicy("B2", "KAS-002"))
                .build());

        assertThat(turn1).isEqualTo(turn2);
        // và tuyệt đối không rò khối động vào phần tĩnh
        assertThat(turn1)
                .doesNotContain("Interessen").doesNotContain("Schwachstellen")
                .doesNotContain("ADAPTIVE POLICY").doesNotContain("RAG CONTEXT");
    }

    @Test
    @DisplayName("level phần tĩnh theo PHIÊN, không theo policy.cefrEffective (policy trôi = vỡ cache)")
    void staticPrompt_usesSessionLevelNotPolicyLevel() {
        String prompt = builder.buildStaticSystemPrompt(base()
                .policy(enabledPolicy("C1", "GEN-001"))
                .build());

        assertThat(prompt).contains("User_Level: B1");
        assertThat(prompt).doesNotContain("User_Level: C1");
    }

    @Test
    @DisplayName("khối ĐỘNG chứa đủ learner context + policy + RAG, đóng khung 'không phải lời học viên'")
    void dynamicContext_carriesPerTurnBlocks() {
        String dynamic = builder.buildDynamicTurnContext(base()
                .knownInterests(List.of("kochen"))
                .weakPoints(List.of(new WeakPoint("Genus", 3)))
                .policy(enabledPolicy("A2", "GEN-001"))
                .build(), "Dativ nach 'mit': mit dem Bus.");

        assertThat(dynamic)
                .contains("KHÔNG phải lời học viên")
                .contains("Interessen").contains("kochen")
                .contains("Schwachstellen").contains("Genus (×3)")
                .contains("ADAPTIVE POLICY").contains("effektives Niveau: A2").contains("GEN-001")
                .contains("RAG CONTEXT").contains("Dativ nach 'mit'");
    }

    @Test
    @DisplayName("không có gì đổi theo lượt ⇒ khối động = null (đừng gửi message rỗng tốn token)")
    void dynamicContext_isNullWhenEmpty() {
        assertThat(builder.buildDynamicTurnContext(base().build(), null)).isNull();
        assertThat(builder.buildDynamicTurnContext(base().build(), "   ")).isNull();
    }

    @Test
    @DisplayName("tĩnh + động cộng lại vẫn đủ nội dung của bản gộp cũ (không mất khối nào)")
    void staticPlusDynamic_coversCombined() {
        var reqBuilder = base()
                .knownInterests(List.of("kochen"))
                .weakPoints(List.of(new WeakPoint("Genus", 3)));
        String combined = builder.buildSystemPrompt(reqBuilder.build());
        String staticPart = builder.buildStaticSystemPrompt(reqBuilder.build());
        String dynamic = builder.buildDynamicTurnContext(reqBuilder.build(), null);

        // mọi khối của bản gộp phải xuất hiện ở đúng một trong hai nửa
        assertThat(staticPart).contains("AI TASKS & LOGIC").contains("Target_Topic: Alltag");
        assertThat(dynamic).contains("Interessen").contains("Schwachstellen");
        assertThat(combined).contains("Interessen").contains("AI TASKS & LOGIC");
    }

    @Test
    @DisplayName("INTERVIEW chưa tách: static = bản gộp, dynamic = null")
    void interviewMode_staysCombined() {
        var req = base().sessionMode(SpeakingSessionMode.INTERVIEW)
                .interviewPosition("Backend Developer").experienceLevel("3Y").turnCount(2)
                .build();

        assertThat(builder.buildStaticSystemPrompt(req)).isEqualTo(builder.buildSystemPrompt(req));
        assertThat(builder.buildDynamicTurnContext(req, "rag")).isNull();
    }
}
