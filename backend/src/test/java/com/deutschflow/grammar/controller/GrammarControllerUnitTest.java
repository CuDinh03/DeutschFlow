package com.deutschflow.grammar.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.deutschflow.grammar.service.LegoGrammarValidatorService;

@ExtendWith(MockitoExtension.class)
class GrammarControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.grammar.service.LegoGrammarValidatorService legoGrammarValidatorService;

    @InjectMocks
    GrammarController controller;

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
