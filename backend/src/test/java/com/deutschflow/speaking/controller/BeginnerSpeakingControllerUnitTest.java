package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.BeginnerSpeakingResponse;
import com.deutschflow.speaking.service.BeginnerSpeakingService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BeginnerSpeakingControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private BeginnerSpeakingService beginnerSpeakingService;

    @InjectMocks
    private BeginnerSpeakingController controller;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void getDay1Prompt_returnsOkWithTemplate() throws Exception {
        var response = new BeginnerSpeakingResponse(
                1L, "Begrüßung", "Wie geht es Ihnen?",
                "Antworten Sie auf Deutsch.", "Super!", List.of("Gut, danke!"));
        when(beginnerSpeakingService.getDay1SpeakingPrompt()).thenReturn(response);

        mvc.perform(get("/api/speaking/beginner/day1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.templateName").value("Begrüßung"))
                .andExpect(jsonPath("$.userPrompt").value("Wie geht es Ihnen?"));
    }

    @Test
    void getAllBeginnerTemplates_returnsOkWithList() throws Exception {
        var t1 = new BeginnerSpeakingResponse(1L, "Begrüßung", "Wie geht es?", "system", "Super!", List.of());
        var t2 = new BeginnerSpeakingResponse(2L, "Vorstellung", "Wie heißen Sie?", "system", "Toll!", List.of());
        when(beginnerSpeakingService.getAllBeginnerTemplates()).thenReturn(List.of(t1, t2));

        mvc.perform(get("/api/speaking/beginner/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].templateName").value("Begrüßung"));
    }
}
