package com.deutschflow.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.beans.factory.annotation.Value;

import java.util.concurrent.Executor;

/**
 * Async task executors.
 *
 * Executors:
 *  - "importExecutor"  : Vocabulary startup imports (Goethe, CEFR curated).
 *                        Isolated so import jobs don't block Tomcat HTTP threads.
 *  - "aiExecutor"      : Groq / ElevenLabs API calls.
 *                        Separate pool so long AI calls don't starve web requests.
 */
@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

    /** Vocabulary import jobs — 2 threads max, queue depth 10. */
    @Bean(name = "importExecutor")
    public Executor importExecutor() {
        var exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(1);
        exec.setMaxPoolSize(2);
        exec.setQueueCapacity(10);
        exec.setThreadNamePrefix("vocab-import-");
        exec.setWaitForTasksToCompleteOnShutdown(false); // imports are best-effort
        exec.initialize();
        return exec;
    }

    /** AI API calls (Groq chat, ElevenLabs TTS) — 10 threads max for 20 CCU. */
    @Bean(name = "aiExecutor")
    public Executor aiExecutor() {
        var exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(5);
        exec.setMaxPoolSize(10);
        exec.setQueueCapacity(30);
        exec.setThreadNamePrefix("ai-call-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(15);
        exec.initialize();
        return exec;
    }
    @Value("${app.async.core-pool-size:10}")
    private int corePoolSize;

    @Value("${app.async.max-pool-size:50}")
    private int maxPoolSize;

    @Value("${app.async.queue-capacity:100}")
    private int queueCapacity;

    /** General async tasks (e.g. background document processing, PPTX generation). */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        var exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(corePoolSize);
        exec.setMaxPoolSize(maxPoolSize);
        exec.setQueueCapacity(queueCapacity);
        exec.setThreadNamePrefix("task-executor-");
        exec.setWaitForTasksToCompleteOnShutdown(true);
        exec.setAwaitTerminationSeconds(30);
        
        // Propagate MDC (e.g. jobId) from parent thread to async thread
        exec.setTaskDecorator(runnable -> {
            var contextMap = org.slf4j.MDC.getCopyOfContextMap();
            return () -> {
                try {
                    if (contextMap != null) {
                        org.slf4j.MDC.setContextMap(contextMap);
                    }
                    runnable.run();
                } finally {
                    org.slf4j.MDC.clear();
                }
            };
        });
        
        exec.initialize();
        return exec;
    }
}
