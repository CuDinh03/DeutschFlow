package com.deutschflow.speaking.service;

import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.exception.AiErrorCode;
import com.deutschflow.speaking.exception.AiServiceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

/**
 * Audit speaking 24/07 — R-B3: sáu endpoint {@code /api/speaking/ai/*} từng nuốt
 * {@link AiServiceException} thành {@code RuntimeException} ⇒ 500 "ERR-x" kèm nguyên văn
 * {@code e.getMessage()} của upstream. Hệ quả: client không phân biệt nổi "AI sập, thử lại" với
 * "bug server", và chi tiết upstream rò ra ngoài.
 *
 * <p>Bộ test chốt hai nửa hợp đồng cho CẢ SÁU phương thức (trước đây file này chỉ có một case
 * {@code assertNotNull(service)}):
 * <ol>
 *   <li>{@code AiServiceException} bay thẳng lên {@code GlobalExceptionHandler} ⇒ 503 đúng mã;</li>
 *   <li>lỗi khác được bọc lại KHÔNG kèm message gốc — chi tiết chỉ nằm trong log.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
class SpeakingAiHelpersServiceUnitTest {

    private static final String UPSTREAM_SECRET = "api-key sk-live-1234 rejected by Groq at 10.0.0.7";

    @Mock
    OpenAiChatClient openAiChatClient;
    @Mock
    AiUsageLedgerService ledgerService;

    @InjectMocks
    SpeakingAiHelpersService service;

    /** Sáu đường public của service — mỗi cái là một endpoint {@code /api/speaking/ai/*}. */
    static List<Arguments> helperCalls() {
        return List.of(
                Arguments.of("conversation",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.generateConversationResponse(1L, "Hallo", "Alltag", "B1")),
                Arguments.of("feedback",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.provideFeedback(1L, "Ich bin müde", "Alltag")),
                Arguments.of("scenario",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.generateScenario(1L, "Arztbesuch", "B1")),
                Arguments.of("errorPractice",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.generateErrorPractice(1L, "Dativ", 3)),
                Arguments.of("culturalContext",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.provideCulturalContext(1L, "Pünktlichkeit")),
                Arguments.of("rolePlay",
                        (Consumer<SpeakingAiHelpersService>)
                                s -> s.generateRolePlay(1L, "Bewerbung", "Kandidat", "HR")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("helperCalls")
    @DisplayName("R-B3: AiServiceException bay thẳng lên handler (→503), không hoá 500")
    void aiServiceExceptionPropagates(String name, Consumer<SpeakingAiHelpersService> call) {
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), anyInt()))
                .thenThrow(new AiServiceException(AiErrorCode.AI_BUSY,
                        "Trợ lý AI đang bận, vui lòng thử lại sau ít giây.", 15));

        assertThatThrownBy(() -> call.accept(service))
                .isInstanceOfSatisfying(AiServiceException.class, ex -> {
                    assertThat(ex.getCode()).isEqualTo(AiErrorCode.AI_BUSY);
                    assertThat(ex.getRetryAfterSeconds()).isEqualTo(15);
                });
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("helperCalls")
    @DisplayName("R-B3: lỗi không phải AI được bọc lại, KHÔNG mang theo message upstream")
    void otherFailuresDoNotLeakUpstreamMessage(String name, Consumer<SpeakingAiHelpersService> call) {
        when(openAiChatClient.chatCompletion(any(), any(), anyDouble(), anyInt()))
                .thenThrow(new IllegalArgumentException(UPSTREAM_SECRET));

        assertThatThrownBy(() -> call.accept(service))
                .isInstanceOf(RuntimeException.class)
                .isNotInstanceOf(AiServiceException.class)
                .hasMessageNotContaining("sk-live-1234")
                .hasMessageNotContaining("Groq")
                .hasMessageNotContaining("10.0.0.7");
    }
}
