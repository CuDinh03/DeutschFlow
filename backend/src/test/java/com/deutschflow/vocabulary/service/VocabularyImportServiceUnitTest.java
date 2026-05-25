package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;


import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class VocabularyImportServiceUnitTest {
    @Mock WiktionaryScraperService wiktionaryService;
    @Mock DeepLTranslationService deeplService;

    @InjectMocks
    VocabularyImportService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
