package com.deutschflow.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

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
}
