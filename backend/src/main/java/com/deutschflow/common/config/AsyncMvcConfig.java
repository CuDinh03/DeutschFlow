package com.deutschflow.common.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * Bounded executor for {@code Callable}-returning controller methods (P1-6 tail).
 *
 * <p>Spring MVC's default async executor is an <em>unbounded</em> {@code SimpleAsyncTaskExecutor}
 * (a new thread per request). The blocking LLM endpoints (e.g. non-streaming chat) return a
 * {@code Callable} so the Tomcat request thread is released during the upstream model I/O and
 * re-attached only to write the response — but they must run on a bounded pool, not spawn unbounded
 * threads. This wires that pool for all async controller methods.
 *
 * <p>Backpressure: {@link ThreadPoolExecutor.CallerRunsPolicy} — when the pool + queue are saturated,
 * the task runs on the dispatching thread instead of being rejected. Under extreme load this degrades
 * gracefully to the old in-line (blocking) behavior rather than dropping requests. Actual upstream
 * concurrency is further capped by the Groq semaphores, so this pool mostly parks on those.
 */
@Configuration
@Slf4j
public class AsyncMvcConfig implements WebMvcConfigurer {

    private final AsyncTaskExecutor aiBlockingExecutor;
    private final long asyncTimeoutMs;

    public AsyncMvcConfig(
            @Value("${app.ai.blocking-executor.core-pool-size:16}") int corePoolSize,
            @Value("${app.ai.blocking-executor.max-pool-size:48}") int maxPoolSize,
            @Value("${app.ai.blocking-executor.queue-capacity:64}") int queueCapacity,
            @Value("${app.ai.blocking-executor.async-timeout-ms:120000}") long asyncTimeoutMs) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("ai-blocking-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        this.aiBlockingExecutor = executor;
        this.asyncTimeoutMs = asyncTimeoutMs;
        log.info("[AsyncMvc] aiBlockingExecutor core={} max={} queue={} timeoutMs={}",
                corePoolSize, maxPoolSize, queueCapacity, asyncTimeoutMs);
    }

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setTaskExecutor(aiBlockingExecutor);
        configurer.setDefaultTimeout(asyncTimeoutMs);
    }

    @Bean("aiBlockingExecutor")
    public AsyncTaskExecutor aiBlockingExecutor() {
        return aiBlockingExecutor;
    }
}
