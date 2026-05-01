package com.deutschflow.speaking.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Thread pool for AI speaking SSE streams (replaces unbounded {@code new Thread()} per request).
 */
@Configuration
public class SpeakingConfig {

    @Bean(name = "speakingStreamExecutor", destroyMethod = "shutdown")
    public ThreadPoolTaskExecutor speakingStreamExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(64);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("sse-speak-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
