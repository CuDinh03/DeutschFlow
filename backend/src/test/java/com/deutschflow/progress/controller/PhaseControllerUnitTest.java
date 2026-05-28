package com.deutschflow.progress.controller;

import com.deutschflow.progress.entity.LearnerPhaseState;
import com.deutschflow.progress.entity.PhaseType;
import com.deutschflow.progress.service.PhaseEngineService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PhaseControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private PhaseEngineService phaseEngineService;

    @InjectMocks
    private PhaseController controller;

    private final User mockUser = User.builder().id(1L).build();

    private LearnerPhaseState foundationState;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, mockUser);
        foundationState = LearnerPhaseState.builder()
                .currentPhase(PhaseType.FOUNDATION)
                .phaseStartedAt(LocalDateTime.now())
                .build();
    }

    @Test
    void getCurrentPhase_returnsOkWithPhase() throws Exception {
        when(phaseEngineService.getOrCreatePhaseState(any())).thenReturn(foundationState);
        when(phaseEngineService.isReadyToAdvance(any())).thenReturn(false);

        mvc.perform(get("/api/phase/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPhase").value("FOUNDATION"))
                .andExpect(jsonPath("$.readyToAdvance").value(false));
    }

    @Test
    void getNextActions_returnsOkWithActions() throws Exception {
        when(phaseEngineService.getOrCreatePhaseState(any())).thenReturn(foundationState);
        when(phaseEngineService.getNextActions(any())).thenReturn(
                List.of("Complete vocabulary", "Practice speaking"));

        mvc.perform(get("/api/phase/next-action"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentPhase").value("FOUNDATION"))
                .andExpect(jsonPath("$.nextActions.length()").value(2));
    }
}
