package com.deutschflow.speaking.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.deutschflow.common.http.RestTemplates;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Text-to-Speech via a self-hosted Edge TTS sidecar (free Microsoft Neural voices).
 * <p>
 * Returns MP3 audio bytes; results are cached 24h in "ttsAudio". When no sidecar is
 * configured (or it is unreachable) {@code synthesize} returns {@code null} and the
 * frontend falls back to on-device speech.
 * <p>
 * Premium/cloud voice providers are intentionally NOT integrated here — point
 * {@code app.ai.edge-tts.url} at your own TTS service.
 */
@Slf4j
@Service
public class EdgeTtsService {

    @Value("${app.ai.edge-tts.url:}")
    private String edgeTtsUrl;

    /**
     * Công tắc lùi nhanh của bài nghe mỗi nhân vật một giọng ({@code HOEREN_VOICES_ENABLED}, mặc định bật).
     * Tắt thì backend coi như sidecar chưa có persona {@code HOER_*}: danh sách persona không còn chúng
     * (frontend tự đọc lại bằng ANNA/THOMAS) và yêu cầu {@code HOER_*} bị từ chối — không cần build lại gì.
     */
    @Value("${app.tts.hoeren-voices-enabled:true}")
    private boolean hoerenVoicesEnabled = true;

    // 3s connect, 10s read — TTS sits on the speaking hot path; a hung sidecar must not pin the thread.
    private final RestTemplate restTemplate = RestTemplates.withTimeouts(3000, 10000);

    // ─── Usage tracking (in-memory, resets on restart) ────────────────────
    private final AtomicLong totalRequests   = new AtomicLong(0);
    private final AtomicLong totalCharsSent  = new AtomicLong(0);
    private final AtomicLong totalErrors     = new AtomicLong(0);
    private final AtomicLong totalAudioBytes = new AtomicLong(0);
    private volatile Instant firstRequestAt  = null;
    private volatile Instant lastRequestAt   = null;

    /** True when an Edge TTS sidecar URL is configured. */
    public boolean isConfigured() {
        return edgeTtsUrl != null && !edgeTtsUrl.isBlank();
    }

    /**
     * Synthesize German speech for a persona. Cached 24h by (text, persona) — the same
     * text+persona always yields identical audio.
     *
     * @param text        German text to speak
     * @param personaName e.g. "LUKAS", "EMMA", "KLAUS"
     * @return MP3 audio bytes, or {@code null} when not configured / on failure
     */
    // B5 audit lag 02/09 — hai sửa trong một annotation:
    //  • key chuỗi thay Objects.hash: hash 32-bit ĐỤNG NHAU được giữa hai (text, persona) khác
    //    nhau — đụng là học viên nghe AUDIO CỦA CÂU KHÁC từ cache; key ghép chuỗi thì không thể.
    //    Đổi key = cache cũ tự miss dần rồi đầy lại theo TTL, không cần dọn tay.
    //  • KHÔNG dùng sync=true ở đây (11/11/2026): Spring không cho ghép sync=true với `unless` và
    //    ném IllegalStateException ở MỖI lời gọi ("A sync=true operation does not support the
    //    unless attribute") — /api/ai-speaking/tts trả 500 từ 02/09 và client lặng lẽ rơi về giọng
    //    đọc của thiết bị. `unless` phải giữ: kết quả null (sidecar chưa cấu hình/lỗi) không được
    //    vào cache, nếu không một lần lỗi sẽ bị nhớ 24 giờ. Đánh đổi: lúc cache lạnh, vài request
    //    cùng câu có thể cùng gọi Edge TTS — chấp nhận được. Có test canh: CacheableSyncUnlessGuardTest.
    @Cacheable(value = "ttsAudio", key = "#text + '|' + #personaName",
               unless = "#result == null")
    public byte[] synthesize(String text, String personaName) {
        if (text == null || text.isBlank()) return null;
        if (!isConfigured()) {
            log.debug("Edge TTS URL not configured — no server TTS available");
            return null;
        }

        String safeText = text.length() > 2000 ? text.substring(0, 2000) : text;
        String persona = (personaName != null && !personaName.isBlank()) ? personaName.toUpperCase() : "DEFAULT";

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Accept", "audio/mpeg");

            Map<String, String> body = Map.of("text", safeText, "persona", persona);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(body, headers);

            log.info("[Edge TTS] cache miss — calling sidecar. persona='{}' chars={}", persona, safeText.length());

            ResponseEntity<byte[]> response = restTemplate.exchange(
                edgeTtsUrl + "/tts", HttpMethod.POST, request, byte[].class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                byte[] audio = response.getBody();
                recordSuccess(safeText.length(), audio.length);
                log.info("[Edge TTS] ✅ {} bytes for '{}' ({} chars)", audio.length, persona, safeText.length());
                return audio;
            }
            recordError();
            log.warn("[Edge TTS] Unexpected status {} for '{}'", response.getStatusCode(), persona);
            return null;
        } catch (Exception e) {
            recordError();
            log.warn("[Edge TTS] Synthesis failed for '{}': {}", persona, e.getMessage());
            return null;
        }
    }

    // ─── Persona sidecar hỗ trợ ───────────────────────────────────────────

    /** Tiền tố persona của bài nghe luyện thi (sáu giọng gốc, cao độ tự nhiên — xem sidecar {@code server.py}). */
    public static final String HOEREN_PERSONA_PREFIX = "HOER_";

    private static final long PERSONAS_TTL_OK_MS = 60_000L;
    private static final long PERSONAS_TTL_FAIL_MS = 15_000L;

    private volatile List<String> personasCache = List.of();
    private volatile long personasExpiresAt = 0L;

    /**
     * Tên các persona mà sidecar ĐANG CHẠY biết (đọc {@code GET /voices} của sidecar), viết hoa, xếp
     * theo chữ cái. Rỗng khi chưa cấu hình sidecar hoặc không hỏi được.
     *
     * <p>Vì sao cần: sidecar gặp persona lạ thì lặng lẽ đọc bằng giọng DEFAULT chứ không báo lỗi. Bản
     * frontend mới (bài nghe mỗi nhân vật một giọng) có thể lên trước khi container sidecar được build
     * lại, nên client phải hỏi được "sidecar đã có persona này chưa" để lùi về giọng cũ thay vì phát
     * nhầm giọng. Nhớ 60 giây (lần hỏi lỗi nhớ 15 giây) để không gọi sidecar ở mỗi câu.
     *
     * <p>Công tắc {@code app.tts.hoeren-voices-enabled} tắt thì bỏ mọi persona {@code HOER_*} khỏi danh sách.
     */
    public List<String> supportedPersonas() {
        List<String> names = sidecarPersonas();
        if (hoerenVoicesEnabled) return names;
        return names.stream().filter(n -> !n.startsWith(HOEREN_PERSONA_PREFIX)).toList();
    }

    @SuppressWarnings("rawtypes")
    private List<String> sidecarPersonas() {
        if (!isConfigured()) return List.of();
        long now = System.currentTimeMillis();
        if (now < personasExpiresAt) return personasCache;
        List<String> names = List.of();
        long ttl = PERSONAS_TTL_FAIL_MS;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(edgeTtsUrl + "/voices", Map.class);
            Map<?, ?> body = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && body != null) {
                names = body.keySet().stream()
                        .map(k -> String.valueOf(k).toUpperCase(Locale.ROOT))
                        .sorted()
                        .toList();
                ttl = PERSONAS_TTL_OK_MS;
            }
        } catch (Exception e) {
            log.warn("[Edge TTS] Could not read the sidecar persona list: {}", e.getMessage());
        }
        personasCache = names;
        personasExpiresAt = now + ttl;
        return names;
    }

    /**
     * Persona bài nghe ({@code HOER_*}) mà sidecar đang chạy CHẮC CHẮN chưa có, hoặc đang bị công tắc
     * {@code app.tts.hoeren-voices-enabled} tắt. Không hỏi được danh sách thì trả {@code false}
     * (không chặn oan). Controller dùng để từ chối thay vì để sidecar cũ đọc nhầm giọng DEFAULT rồi bản
     * audio sai đó nằm trong cache 24 giờ.
     */
    public boolean isUnsupportedHoerenPersona(String personaName) {
        if (personaName == null) return false;
        String persona = personaName.trim().toUpperCase(Locale.ROOT);
        if (!persona.startsWith(HOEREN_PERSONA_PREFIX)) return false;
        if (!hoerenVoicesEnabled) return true;
        List<String> known = sidecarPersonas();
        return !known.isEmpty() && !known.contains(persona);
    }

    // ─── Usage tracking ───────────────────────────────────────────────────

    private void recordSuccess(int chars, long audioBytes) {
        Instant now = Instant.now();
        totalRequests.incrementAndGet();
        totalCharsSent.addAndGet(chars);
        totalAudioBytes.addAndGet(audioBytes);
        if (firstRequestAt == null) firstRequestAt = now;
        lastRequestAt = now;
    }

    private void recordError() {
        totalErrors.incrementAndGet();
        totalRequests.incrementAndGet();
    }

    /** Usage statistics for the TTS status endpoint. */
    public Map<String, Object> getUsageStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("provider", "edge-tts");
        stats.put("configured", isConfigured());
        stats.put("edgeTtsUrl", edgeTtsUrl);
        stats.put("totalRequests", totalRequests.get());
        stats.put("totalCharsSent", totalCharsSent.get());
        stats.put("totalErrors", totalErrors.get());
        stats.put("totalAudioBytes", totalAudioBytes.get());
        stats.put("firstRequestAt", firstRequestAt != null ? firstRequestAt.toString() : null);
        stats.put("lastRequestAt", lastRequestAt != null ? lastRequestAt.toString() : null);
        return stats;
    }
}
