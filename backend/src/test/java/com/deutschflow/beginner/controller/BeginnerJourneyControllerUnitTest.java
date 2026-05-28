package com.deutschflow.beginner.controller;

import com.deutschflow.beginner.dto.BeginnerSessionResponse;
import com.deutschflow.beginner.service.BeginnerJourneyService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BeginnerJourneyControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private BeginnerJourneyService beginnerJourneyService;

    @InjectMocks
    private BeginnerJourneyController controller;

    private final User mockUser = User.builder().id(1L).build();

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, mockUser);
    }

    @Test
    void getFirstSession_returnsOkWithWelcomeMessage() throws Exception {
        var response = new BeginnerSessionResponse("Willkommen!", List.of(), "Hallo!", "Viel Erfolg!");
        when(beginnerJourneyService.getFirstSession()).thenReturn(response);

        mvc.perform(get("/api/beginner/first-session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.welcomeMessage").value("Willkommen!"))
                .andExpect(jsonPath("$.encouragement").value("Viel Erfolg!"));
    }

    @Test
    void completeFirstSession_returnsNoContent() throws Exception {
        mvc.perform(post("/api/beginner/first-session/complete"))
                .andExpect(status().isNoContent());
    }
}
