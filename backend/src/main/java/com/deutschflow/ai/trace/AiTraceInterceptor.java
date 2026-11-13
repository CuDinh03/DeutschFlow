package com.deutschflow.ai.trace;

import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.IOException;
import java.net.URI;

/**
 * Gắn vào {@code RestTemplate} của các client AI đơn giản (một request = một lần gọi, không thử lại): ghi một dòng
 * {@link AiCallTrace} cho mỗi request. Chỉ đọc mã HTTP, không đọc thân request/response.
 */
public final class AiTraceInterceptor implements ClientHttpRequestInterceptor {

    private final String feature;
    private final String model;
    private final boolean featureFromPath;

    public AiTraceInterceptor(String feature, String model) {
        this(feature, model, false);
    }

    private AiTraceInterceptor(String feature, String model, boolean featureFromPath) {
        this.feature = feature;
        this.model = model;
        this.featureFromPath = featureFromPath;
    }

    /**
     * Tên tính năng = {@code prefix} + đoạn ĐẦU của path (ví dụ {@code local-ai:generate}, {@code local-ai:grammar}).
     * Chỉ lấy đoạn đầu — các đoạn sau và query có thể chứa chữ của người học.
     */
    public static AiTraceInterceptor byPath(String prefix, String model) {
        return new AiTraceInterceptor(prefix, model, true);
    }

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution)
            throws IOException {
        URI uri = request.getURI();
        // Kiểm tra sức khoẻ không phải lần gọi AI — bỏ qua cho đỡ nhiễu log và metric.
        String path = uri.getPath();
        if (path != null && (path.equals("/health") || path.endsWith("/health"))) {
            return execution.execute(request, body);
        }
        AiCallTrace trace = AiCallTrace.start(featureOf(uri), uri.toString(), model);
        try {
            ClientHttpResponse response = execution.execute(request, body);
            int status = response.getStatusCode().value();
            if (status >= 200 && status < 300) trace.ok();
            else trace.failHttp(status);
            return response;
        } catch (IOException | RuntimeException e) {
            trace.fail(e);
            throw e;
        }
    }

    String featureOf(URI uri) {
        if (!featureFromPath) return feature;
        String path = uri.getPath();
        if (path == null) return feature;
        for (String seg : path.split("/")) {
            if (!seg.isBlank()) return feature + ":" + seg.replaceAll("[^A-Za-z0-9_-]", "");
        }
        return feature;
    }
}
