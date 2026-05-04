package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.ai.AIModelService;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AIVocabularyServiceUnitTest {
    @Mock com.deutschflow.ai.AIModelService aiModelService;

    @InjectMocks
    AIVocabularyService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
