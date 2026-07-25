package com.deutschflow.speaking.service;

import com.deutschflow.speaking.dto.SpeakingPolicy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TurnEvaluatorServiceUnitTest {
    @Mock com.deutschflow.speaking.repository.SpeakingTurnEvaluationRepository evaluationRepository;
    @Mock com.deutschflow.speaking.repository.SpeakingUserStateRepository stateRepository;
    @Mock com.deutschflow.speaking.metrics.SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    TurnEvaluatorService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }

    /**
     * Audit R-G2(a): một lượt parse-fail (JSON hỏng → errors=[] KHÔNG phải vì "sạch") phải bị BỎ QUA
     * khỏi adaptive engine — nếu không, nó bị lưu như turn 0-lỗi và làm accuracy 100% ảo + đóng cooldown
     * + boost độ khó. Với reliableParse=false, recordTurn không được chạm repository/policy nào.
     */
    @Test
    @DisplayName("recordTurn: parse-fail (reliableParse=false) KHÔNG lưu evaluation/state, không đụng adaptive")
    void recordTurn_parseUnreliable_skipsAllAdaptiveRecording() {
        ReflectionTestUtils.setField(service, "adaptiveEnabled", true);
        SpeakingPolicy policy = mock(SpeakingPolicy.class);
        when(policy.enabled()).thenReturn(true);

        // parsed=null an toàn: gate reliableParse=false trả về TRƯỚC khi đọc parsed.errors().
        service.recordTurn(1L, 2L, 3L, null, false, policy);

        verify(evaluationRepository, never()).save(any());
        verify(stateRepository, never()).save(any());
        verifyNoInteractions(adaptivePolicyService);
    }
}
