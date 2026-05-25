package com.deutschflow.vocabulary.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.web.client.RestTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class DeepLTranslationServiceUnitTest {
    @Mock org.springframework.web.client.RestTemplate restTemplate;

    @InjectMocks
    DeepLTranslationService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
