package com.deutschflow.ai.trace;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;

/**
 * Nhật ký một LẦN GỌI dịch vụ AI (chat/chấm, nhận diện giọng nói, đọc thành tiếng, sinh đề, embedding…).
 *
 * <p>Sinh ra sau đợt STT hỏng 09–11/11/2026: không có nhật ký các lần gọi AI nên mất nhiều thời gian đoán lỗi nằm
 * ở nhà cung cấp nào, model nào, mã gì. Mỗi lần gọi ghi đúng MỘT dòng (logger {@code ai.trace}):
 *
 * <pre>
 * AI_CALL feature=stt provider=groq model=whisper-large-v3-turbo host=api.groq.com ms=812 result=http_429
 *         attempts=2 fallbacks=1 tokens_in=- tokens_out=- user=u:4f1c9a0e job=-
 * </pre>
 *
 * <p>Thành công ghi INFO, hỏng ghi WARN. Song song là timer Micrometer {@code ai.call}
 * (tag {@code feature, provider, model, result}) — xem trên {@code /actuator/prometheus}.
 *
 * <p><b>Không bao giờ ghi</b>: nội dung prompt, câu trả lời, audio, đường dẫn/query (có thể chứa chữ người học),
 * khoá hay header. Chỉ ghi host. Mã người dùng được băm HMAC với khoá ngẫu nhiên sinh mỗi lần khởi động: cùng một
 * người trong cùng một lần chạy có cùng mã (để thấy "một người bị lỗi liên tục"), nhưng không suy ngược ra id.
 * Muốn biết là ai thì đối chiếu {@code requestId} (đã có sẵn trong mỗi dòng log) với bảng telemetry API.
 *
 * <p>Cách dùng:
 * <pre>
 * AiCallTrace t = AiCallTrace.start("chat", url, model);
 * try { ... t.retry(); ... t.fallback(url2, model2); ... t.tokens(in, out); t.ok(); return r; }
 * catch (RuntimeException e) { t.fail(e); throw e; }
 * </pre>
 * Kết thúc ({@link #ok}, {@link #fail}, {@link #failHttp}, {@link #outcome}) chỉ tính lần đầu; các lần sau bỏ qua.
 */
public final class AiCallTrace {

    static final String LOGGER_NAME = "ai.trace";
    static final String METRIC = "ai.call";
    /** Khoá MDC đặt tên tính năng cho mọi lời gọi AI bên trong (xem {@link #feature(String)}). */
    static final String MDC_FEATURE = "aiFeature";

    private static final Logger log = LoggerFactory.getLogger(LOGGER_NAME);
    private static final byte[] USER_HASH_KEY = randomKey();

    private final String feature;
    private final long startNanos;
    private final AtomicBoolean finished = new AtomicBoolean(false);
    private volatile String provider;
    private volatile String model;
    private volatile String host;
    private volatile int attempts = 1;
    private volatile int fallbacks = 0;
    private volatile Integer tokensIn;
    private volatile Integer tokensOut;
    private final String user;
    private final String job;

    private AiCallTrace(String feature, String url, String model) {
        String ctx = MDC.get(MDC_FEATURE);
        this.feature = clean(ctx != null && !ctx.isBlank() ? ctx : feature);
        this.startNanos = System.nanoTime();
        target(url, model);
        this.user = currentUserTag();
        String jobId = MDC.get("jobId");
        this.job = jobId == null || jobId.isBlank() ? "-" : clean(jobId);
    }

    /**
     * Bắt đầu một lần gọi. {@code feature} là nhãn mặc định của client; nếu nơi gọi đã đặt tên tính năng bằng
     * {@link #feature(String)} thì tên đó thắng.
     */
    public static AiCallTrace start(String feature, String url, String model) {
        return new AiCallTrace(feature, url, model);
    }

    /**
     * Đặt tên tính năng cho mọi lời gọi AI trong khối {@code try}. Ví dụ Xưởng đề đặt
     * {@code EXAM_STUDIO_WRITE_TEXT} để dòng log không chỉ ghi chung chung "chat".
     */
    public static Scope feature(String name) {
        String previous = MDC.get(MDC_FEATURE);
        MDC.put(MDC_FEATURE, name);
        return () -> {
            if (previous == null) MDC.remove(MDC_FEATURE);
            else MDC.put(MDC_FEATURE, previous);
        };
    }

    /** Chạy {@code body} dưới tên tính năng {@code name}. */
    public static <T> T withFeature(String name, Supplier<T> body) {
        try (Scope ignored = feature(name)) {
            return body.get();
        }
    }

    /** Khối đặt tên tính năng; đóng thì trả lại tên cũ. */
    @FunctionalInterface
    public interface Scope extends AutoCloseable {
        @Override
        void close();
    }

    /** Thêm một lần thử lại CÙNG đích. */
    public AiCallTrace retry() {
        attempts++;
        return this;
    }

    /** Thêm một lần thử lại, lần này nhắm {@code url}/{@code model} (ví dụ quay lại model chính sau dự phòng). */
    public AiCallTrace retry(String url, String model) {
        attempts++;
        target(url, model);
        return this;
    }

    /** Đổi model sẽ gọi trước lần gọi đầu (ví dụ model chính đang nghỉ nên đi thẳng dự phòng); không tính lần gọi. */
    public AiCallTrace model(String model) {
        this.model = model == null || model.isBlank() ? "-" : clean(model);
        return this;
    }

    /** Chuyển sang đích dự phòng (host/model khác). Dòng log ghi đích CUỐI CÙNG đã gọi. */
    public AiCallTrace fallback(String url, String model) {
        attempts++;
        fallbacks++;
        target(url, model);
        return this;
    }

    /** Token vào/ra nếu API trả về; null = không biết. */
    public AiCallTrace tokens(Integer in, Integer out) {
        this.tokensIn = in;
        this.tokensOut = out;
        return this;
    }

    public void ok() {
        finish("ok", null);
    }

    public void failHttp(int status) {
        finish("http_" + status, null);
    }

    /** Kết quả tự đặt (ví dụ {@code empty}, {@code refused}, {@code cancelled}). */
    public void outcome(String result) {
        finish(clean(result), null);
    }

    /** Hỏng vì ngoại lệ — tự phân loại: mã HTTP, timeout, hay tên lớp lỗi. */
    public void fail(Throwable error) {
        finish(classify(error), error);
    }

    /** Phân loại lỗi thành một nhãn ngắn: {@code http_503}, {@code timeout}, {@code error_IOException}… */
    static String classify(Throwable error) {
        if (error == null) return "error";
        Throwable t = error;
        for (int depth = 0; t != null && depth < 8; depth++, t = t.getCause()) {
            Integer status = httpStatusOf(t);
            if (status != null) return "http_" + status;
            if (t instanceof SocketTimeoutException || t instanceof HttpTimeoutException
                    || t instanceof TimeoutException) {
                return "timeout";
            }
            String name = t.getClass().getSimpleName();
            if (name.contains("Timeout")) return "timeout";
            if (t.getCause() == t) break;
        }
        // Lỗi tự sinh trong app (hàng chờ đầy, breaker mở, chưa cấu hình…): dùng mã máy-đọc-được của nó.
        if (error instanceof com.deutschflow.speaking.exception.AiServiceException ase && ase.getCode() != null) {
            return ase.getCode().name().toLowerCase(Locale.ROOT);
        }
        return "error_" + error.getClass().getSimpleName();
    }

    private static Integer httpStatusOf(Throwable t) {
        if (t instanceof org.springframework.web.client.RestClientResponseException e) {
            return e.getStatusCode().value();
        }
        if (t instanceof org.springframework.web.reactive.function.client.WebClientResponseException e) {
            return e.getStatusCode().value();
        }
        if (t instanceof HttpStatusCarrier c) {
            return c.httpStatus();
        }
        return null;
    }

    /** Ngoại lệ tự mang mã HTTP của upstream (ví dụ lỗi bọc lại của client STT). */
    public interface HttpStatusCarrier {
        Integer httpStatus();
    }

    private void finish(String result, Throwable error) {
        if (!finished.compareAndSet(false, true)) return;
        long ms = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        boolean ok = "ok".equals(result);
        String line = "AI_CALL feature={} provider={} model={} host={} ms={} result={} attempts={} fallbacks={}"
                + " tokens_in={} tokens_out={} user={} job={}";
        Object[] args = {feature, provider, model, host, ms, result, attempts, fallbacks,
                tokensIn == null ? "-" : tokensIn, tokensOut == null ? "-" : tokensOut, user, job};
        if (ok) log.info(line, args);
        else log.warn(line, args);
        record(result, ms);
    }

    private void record(String result, long ms) {
        try {
            MeterRegistry registry = Metrics.globalRegistry;
            Timer.builder(METRIC)
                    .description("Mỗi lần backend gọi dịch vụ AI")
                    .tag("feature", feature)
                    .tag("provider", provider)
                    .tag("model", model)
                    .tag("result", metricResult(result))
                    .register(registry)
                    .record(ms, TimeUnit.MILLISECONDS);
        } catch (RuntimeException ignored) {
            // Đo đạc không bao giờ được làm hỏng lời gọi AI.
        }
    }

    /** Nhãn metric gom nhóm để không nổ số chuỗi: ok, http_429, http_4xx, http_5xx, timeout, error, hoặc nhãn tự đặt. */
    static String metricResult(String result) {
        if (result.equals("http_429")) return result;
        if (result.startsWith("http_4")) return "http_4xx";
        if (result.startsWith("http_5")) return "http_5xx";
        if (result.startsWith("http_")) return "http_other";
        if (result.startsWith("error")) return "error";
        return result; // ok, timeout, cancelled, empty, refused, hoặc mã AiErrorCode (tập cố định)
    }

    private void target(String url, String model) {
        this.host = hostOf(url);
        this.provider = providerOf(this.host);
        this.model = model == null || model.isBlank() ? "-" : clean(model);
    }

    /** Chỉ lấy host; KHÔNG giữ path/query (có thể chứa chữ của người học). */
    static String hostOf(String url) {
        if (url == null || url.isBlank()) return "-";
        try {
            URI uri = URI.create(url.trim());
            String h = uri.getHost();
            if (h == null) return "-";
            return uri.getPort() > 0 ? h.toLowerCase(Locale.ROOT) + ":" + uri.getPort() : h.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException e) {
            return "-";
        }
    }

    /** Nhãn nhà cung cấp theo host — tập giá trị cố định cho metric. */
    static String providerOf(String host) {
        String h = host == null ? "" : host.replaceFirst(":\\d+$", "");
        if (h.isEmpty() || h.equals("-")) return "unknown";
        if (h.endsWith("groq.com")) return "groq";
        if (h.endsWith("fireworks.ai")) return "fireworks";
        if (h.endsWith("openrouter.ai")) return "openrouter";
        if (h.endsWith("openai.com")) return "openai";
        if (h.endsWith("anthropic.com")) return "anthropic";
        if (h.endsWith("googleapis.com")) return "google";
        if (h.endsWith("deepseek.com")) return "deepseek";
        if (h.endsWith("moonshot.ai") || h.endsWith("moonshot.cn")) return "moonshot";
        if (h.endsWith("cloudflare.com")) return "cloudflare";
        if (h.contains("9router")) return "9router";
        if (h.equals("localhost") || h.equals("127.0.0.1") || !h.contains(".")) return "local";
        return "other";
    }

    private static String currentUserTag() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !(auth.getPrincipal() instanceof com.deutschflow.user.entity.User u) || u.getId() == null) {
                return "-";
            }
            return "u:" + hashUser(u.getId());
        } catch (RuntimeException e) {
            return "-";
        }
    }

    /** HMAC-SHA256 của id với khoá sinh mỗi lần khởi động, lấy 8 ký tự hex đầu. */
    static String hashUser(long userId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(USER_HASH_KEY, "HmacSHA256"));
            byte[] digest = mac.doFinal(Long.toString(userId).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 4; i++) sb.append(String.format("%02x", digest[i]));
            return sb.toString();
        } catch (Exception e) {
            return "?";
        }
    }

    private static byte[] randomKey() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return key;
    }

    /** Bỏ khoảng trắng/ký tự xuống dòng để một lần gọi luôn đúng một dòng log. */
    private static String clean(String v) {
        if (v == null || v.isBlank()) return "-";
        return v.trim().replaceAll("[\\s=]+", "_");
    }

    // ── cho test ──
    String feature() { return feature; }
    String provider() { return provider; }
    String model() { return model; }
    String host() { return host; }
    int attempts() { return attempts; }
    int fallbacks() { return fallbacks; }
    String user() { return user; }
}
