package com.deutschflow.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * Sends push notifications via the Expo Push API.
 * Endpoint: https://exp.host/--/api/v2/push/send
 *
 * Tokens are stored in users.push_token (registered via POST /api/profile/me/push-token).
 * Callers should invoke sendAsync(token, title, body) and ignore errors — push is best-effort.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExpoPushSenderService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper;

    /**
     * Fire-and-forget push to a single Expo push token.
     * Does NOT throw; any failure is logged at WARN level.
     *
     * @param expoPushToken Expo push token (starts with "ExponentPushToken[" or "ExpoPushToken[")
     * @param title         Notification title
     * @param body          Notification body text
     * @param data          Optional extra data (may be null)
     */
    public void sendAsync(String expoPushToken, String title, String body, Map<String, Object> data) {
        if (!isExpoPushToken(expoPushToken)) {
            log.debug("[Push] skip send: not an Expo push token (len={})",
                    expoPushToken == null ? 0 : expoPushToken.length());
            return;
        }

        var message = Map.of(
                "to", expoPushToken,
                "title", title,
                "body", body,
                "data", data != null ? data : Map.of(),
                "sound", "default"
        );

        webClientBuilder.build()
                .post()
                .uri(EXPO_PUSH_URL)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .bodyValue(List.of(message))
                .retrieve()
                .bodyToMono(String.class)
                .doOnSuccess(resp -> log.debug("[Push] sent to {} → {}", expoPushToken, resp))
                .doOnError(err -> log.warn("[Push] failed for token={}: {}", expoPushToken, err.getMessage()))
                .onErrorComplete()
                .subscribe();
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
