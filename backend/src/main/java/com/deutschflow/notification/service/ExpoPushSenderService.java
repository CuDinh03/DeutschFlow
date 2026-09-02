package com.deutschflow.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends push notifications via the Expo Push API.
 * Endpoint: https://exp.host/--/api/v2/push/send
 *
 * Tokens are stored in users.push_token (registered via POST /api/profile/me/push-token).
 * Callers should invoke sendAsync/sendBatchAsync and ignore errors — push is best-effort.
 *
 * B3 audit lag 02/09:
 *  - WebClient build MỘT lần (trước: {@code webClientBuilder.build()} MỖI call) và có
 *    responseTimeout 5s — trước đây không timeout, một exp.host treo là reactor thread
 *    giữ kết nối vô hạn.
 *  - {@link #sendBatchAsync}: Expo nhận tới 100 message/request — fan-out cả lớp giờ là
 *    1–2 POST thay vì N POST.
 */
@Slf4j
@Service
public class ExpoPushSenderService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    /** Trần chính thức của Expo Push API cho một request. */
    private static final int EXPO_BATCH_LIMIT = 100;
    private static final Duration RESPONSE_TIMEOUT = Duration.ofSeconds(5);

    private final WebClient webClient;

    public ExpoPushSenderService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
                .clientConnector(new ReactorClientHttpConnector(
                        HttpClient.create().responseTimeout(RESPONSE_TIMEOUT)))
                .build();
    }

    /** Một push đã render xong, chờ gửi — dùng cho đường batch. */
    public record PushMessage(String token, String title, String body, Map<String, Object> data) {}

    /**
     * Fire-and-forget push to a single Expo push token.
     * Does NOT throw; any failure is logged at WARN level.
     */
    public void sendAsync(String expoPushToken, String title, String body, Map<String, Object> data) {
        sendBatchAsync(List.of(new PushMessage(expoPushToken, title, body, data)));
    }

    /**
     * Fire-and-forget push cho cả loạt message — cắt theo trần 100 message/request của Expo.
     * Token không hợp lệ bị lọc êm (như sendAsync cũ); danh sách rỗng là no-op.
     */
    public void sendBatchAsync(List<PushMessage> messages) {
        if (messages == null || messages.isEmpty()) return;
        List<Map<String, Object>> valid = new ArrayList<>(messages.size());
        for (PushMessage m : messages) {
            if (!isExpoPushToken(m.token())) {
                log.debug("[Push] skip send: not an Expo push token (len={})",
                        m.token() == null ? 0 : m.token().length());
                continue;
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("to", m.token());
            body.put("title", m.title());
            body.put("body", m.body());
            body.put("data", m.data() != null ? m.data() : Map.of());
            body.put("sound", "default");
            valid.add(body);
        }
        if (valid.isEmpty()) return;

        for (int from = 0; from < valid.size(); from += EXPO_BATCH_LIMIT) {
            List<Map<String, Object>> chunk = valid.subList(from, Math.min(from + EXPO_BATCH_LIMIT, valid.size()));
            webClient.post()
                    .uri(EXPO_PUSH_URL)
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .bodyValue(chunk)
                    .retrieve()
                    .bodyToMono(String.class)
                    .doOnSuccess(resp -> log.debug("[Push] sent batch of {} → {}", chunk.size(), resp))
                    .doOnError(err -> log.warn("[Push] batch of {} failed: {}", chunk.size(), err.getMessage()))
                    .onErrorComplete()
                    .subscribe();
        }
    }

    /**
     * True if the token is an Expo push token — the only kind {@code exp.host} accepts.
     * Raw APNs/FCM device tokens (e.g. from the legacy Capacitor build) are rejected so they are
     * never stored or sent: forwarding them to the Expo Push API only produces errors.
     */
    public static boolean isExpoPushToken(String token) {
        if (token == null) return false;
        String t = token.trim();
        return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
    }
}
