package com.deutschflow.speaking.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(GroqProperties.class)
public class GroqAiConfiguration {
}
