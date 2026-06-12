package com.deutschflow.common.http;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Factory helper for {@link RestTemplate} instances that ALWAYS have connect/read timeouts.
 *
 * <p>A bare {@code new RestTemplate()} has NO timeouts: a slow or hung upstream (DeepL, the AI
 * server, Edge TTS, OpenAI embeddings) will hold the calling thread — and any DB connection that
 * thread is also holding — until the OS gives up (can be minutes). Under load that cascades into
 * Hikari pool exhaustion. Every outbound HTTP client in the app must go through here.
 */
public final class RestTemplates {

    private RestTemplates() {
    }

    /**
     * @param connectMs max time to establish the TCP/TLS connection
     * @param readMs    max time to wait for the response once connected
     */
    public static RestTemplate withTimeouts(int connectMs, int readMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectMs);
        factory.setReadTimeout(readMs);
        return new RestTemplate(factory);
    }
}
