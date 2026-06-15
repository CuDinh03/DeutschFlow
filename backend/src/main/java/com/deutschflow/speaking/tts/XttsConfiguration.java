package com.deutschflow.speaking.tts;

import com.deutschflow.common.http.RestTemplates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.Executor;

/**
 * Wires the XTTS streaming-TTS subsystem: registers {@link XttsProperties}, the timeout-bounded
 * {@code RestTemplate}, and a dedicated executor so per-sentence synthesis never starves the
 * LLM SSE pump ({@code speakingStreamExecutor}).
 */
@Configuration
@EnableConfigurationProperties(XttsProperties.class)
public class XttsConfiguration {

    /** Dedicated client with connect/read timeouts — a hung XTTS call must not pin a thread. */
    @Bean("xttsRestTemplate")
    public RestTemplate xttsRestTemplate(XttsProperties props) {
        return RestTemplates.withTimeouts(props.getConnectTimeoutMs(), props.getReadTimeoutMs());
    }

    /** Per-sentence TTS synthesis pool — separate from the LLM stream executor. */
    @Bean(name = "xttsTtsExecutor", destroyMethod = "shutdown")
    public Executor xttsTtsExecutor(
            @Value("${app.ai.xtts.executor.core-pool-size:4}") int corePoolSize,
            @Value("${app.ai.xtts.executor.max-pool-size:12}") int maxPoolSize,
            @Value("${app.ai.xtts.executor.queue-capacity:48}") int queueCapacity) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(corePoolSize);
        executor.setMaxPoolSize(maxPoolSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setKeepAliveSeconds(60);
        executor.setThreadNamePrefix("xtts-tts-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
