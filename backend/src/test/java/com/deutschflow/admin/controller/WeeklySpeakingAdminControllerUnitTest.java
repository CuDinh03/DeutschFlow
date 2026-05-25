package com.deutschflow.admin.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.deutschflow.admin.service.WeeklySpeakingAdminService;

@ExtendWith(MockitoExtension.class)
class WeeklySpeakingAdminControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.admin.service.WeeklySpeakingAdminService weeklySpeakingAdminService;

    @InjectMocks
    WeeklySpeakingAdminController controller;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }
}
