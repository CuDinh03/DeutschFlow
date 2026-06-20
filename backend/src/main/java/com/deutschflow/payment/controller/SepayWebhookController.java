package com.deutschflow.payment.controller;

import com.deutschflow.payment.dto.SepayWebhookPayload;
import com.deutschflow.payment.dto.SepayWebhookResponse;
import com.deutschflow.payment.service.SepayWebhookService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * SePay bank-transfer webhook (checklist C3). SePay POSTs every incoming transfer here; we settle
 * the matching org invoice and activate the plan. Authenticated by a shared {@code Apikey} header
 * (SePay config), NOT JWT — the path is permitAll in SecurityConfig. Fails closed when no key is set.
 */
@RestController
@RequestMapping("/api/payments/sepay")
@RequiredArgsConstructor
@Slf4j
public class SepayWebhookController {

    private final SepayWebhookService sepayWebhookService;

    @Value("${app.payment.sepay.api-key:}")
    private String apiKey;

    @PostMapping("/webhook")
    public ResponseEntity<SepayWebhookResponse> webhook(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody SepayWebhookPayload payload) {
        if (!authorized(authorization)) {
            log.warn("[SePay] webhook rejected: missing/invalid Apikey");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new SepayWebhookResponse(false));
        }
        try {
            sepayWebhookService.handle(payload);
        } catch (org.springframework.dao.DataIntegrityViolationException duplicate) {
            // Concurrent redelivery of the same transaction lost the UNIQUE(sepay_id) race —
            // already processed by the winning request. Ack 200 so SePay does not keep retrying.
            log.info("[SePay] concurrent duplicate webhook — treated as already processed");
        }
        return ResponseEntity.ok(new SepayWebhookResponse(true));
    }

    /**
     * SePay sends {@code Authorization: Apikey <key>}. Constant-time compare against the configured
     * key. When no key is configured the endpoint fails closed (rejects all) so an unconfigured
     * deploy never processes unauthenticated payment events.
     */
    private boolean authorized(String authorization) {
        if (apiKey == null || apiKey.isBlank() || authorization == null) {
            return false;
        }
        byte[] provided = authorization.trim().getBytes(StandardCharsets.UTF_8);
        byte[] expected = ("Apikey " + apiKey).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(provided, expected);
    }
}
