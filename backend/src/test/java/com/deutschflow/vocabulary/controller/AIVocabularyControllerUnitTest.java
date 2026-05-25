package com.deutschflow.vocabulary.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.deutschflow.vocabulary.service.AIVocabularyService;

@ExtendWith(MockitoExtension.class)
class AIVocabularyControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.vocabulary.service.AIVocabularyService aiVocabularyService;

    @InjectMocks
    AIVocabularyController controller;

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
