package com.deutschflow.speaking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Thread pool for AI speaking SSE streams — keeps Tomcat servlet threads free during Groq/LLM I/O.
 */
@Configuration
public class SpeakingConfig {

    @Bean(name = "speakingStreamExecutor", destroyMethod = "shutdown")
    public ThreadPoolTaskExecutor speakingStreamExecutor(
            @Value("${app.speaking.stream-executor.core-pool-size:8}") int corePoolSize,
            @Value("${app.speaking.stream-executor.max-pool-size:20}") int maxPoolSize,
            @Value("${app.speaking.stream-executor.queue-capacity:40}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("sse-speak-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
