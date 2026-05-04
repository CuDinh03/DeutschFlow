package com.deutschflow.common.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(VocabularyEnrichmentProperties.class)
public class VocabularyEnrichmentConfiguration {
}
