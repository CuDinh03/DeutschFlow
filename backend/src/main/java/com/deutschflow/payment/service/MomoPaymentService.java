package com.deutschflow.payment.service;

import com.deutschflow.payment.dto.CreateMomoOrderRequest;
import com.deutschflow.payment.dto.CreateMomoOrderResponse;
import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Service xử lý luồng thanh toán MoMo (môi trường Sandbox).
 * <p>
 * Flow: create-order → lưu PENDING → redirect đến payUrl → IPN webhook → activate subscription
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentService {

    // --- MoMo Sandbox Credentials (inject từ application.yml / environment variables) ---
    @Value("${payment.momo.partner-code:MOMO}")
    private String partnerCode;

    @Value("${payment.momo.access-key:F8BBA842ECF85}")
    private String accessKey;

    @Value("${payment.momo.secret-key:K951B6PE1waDMi640xX08PD3vg6EkVlz}")
    private String secretKey;

    @Value("${payment.momo.api-endpoint:https://test-payment.momo.vn/v2/gateway/api/create}")
    private String momoApiEndpoint;

    @Value("${payment.momo.ipn-url:http://api.mydeutschflow.com/api/payments/momo/ipn}")
    private String ipnUrl;

    @Value("${payment.momo.return-url:https://mydeutschflow.com/payment/success}")
    private String returnUrl;

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SubscriptionActivationService subscriptionActivationService;

    // ==================== CREATE ORDER ====================

    @Transactional
    public CreateMomoOrderResponse createOrder(Long userId, CreateMomoOrderRequest req) {
        // 1. Lấy giá từ subscription_plans
        Long priceVnd = jdbcTemplate.queryForObject(
                "SELECT price_vnd FROM subscription_plans WHERE code = ? AND is_active = TRUE",
                Long.class, req.getPlanCode()
        );
        if (priceVnd == null || priceVnd <= 0) {
            throw new IllegalArgumentException("Gói " + req.getPlanCode() + " không có giá thanh toán hợp lệ.");
        }

        // 2. Tạo orderId duy nhất (không trùng lặp)
        String orderId = partnerCode + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        String requestId = UUID.randomUUID().toString();
        String orderInfo = "DeutschFlow " + req.getPlanCode() + " subscription";

        // 3. Lưu transaction với trạng thái PENDING vào DB
        PaymentTransaction tx = PaymentTransaction.builder()
                .orderId(orderId)
                .userId(userId)
                .planCode(req.getPlanCode())
                .amount(priceVnd)
                .provider("MOMO")
                .status("PENDING")
                .build();
        paymentTransactionRepository.save(tx);

        // 4. Tạo chữ ký HMAC-SHA256 theo spec của MoMo
        String rawSignature = "accessKey=" + accessKey
                + "&amount=" + priceVnd
                + "&extraData="
                + "&ipnUrl=" + ipnUrl
                + "&orderId=" + orderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + partnerCode
                + "&redirectUrl=" + returnUrl
                + "&requestId=" + requestId
                + "&requestType=captureWallet";

        String signature = hmacSHA256(secretKey, rawSignature);

        // 5. Gọi API MoMo để lấy payUrl
        Map<String, Object> momoPayload = new HashMap<>();
        momoPayload.put("partnerCode", partnerCode);
        momoPayload.put("accessKey", accessKey);
        momoPayload.put("requestId", requestId);
        momoPayload.put("amount", priceVnd);
        momoPayload.put("orderId", orderId);
        momoPayload.put("orderInfo", orderInfo);
        momoPayload.put("redirectUrl", returnUrl);
        momoPayload.put("ipnUrl", ipnUrl);
        momoPayload.put("extraData", "");
        momoPayload.put("requestType", "captureWallet");
        momoPayload.put("signature", signature);
        momoPayload.put("lang", "vi");

        String payUrl = callMomoCreateOrder(momoPayload, orderId);

        log.info("[MOMO] Created order orderId={} userId={} plan={} amount={}", orderId, userId, req.getPlanCode(), priceVnd);

        return CreateMomoOrderResponse.builder()
                .payUrl(payUrl)
                .orderId(orderId)
                .amount(priceVnd)
                .planCode(req.getPlanCode())
                .build();
    }

    // ==================== IPN WEBHOOK ====================

    @Transactional
    public void handleIpn(Map<String, Object> ipnPayload) {
        String orderId   = (String) ipnPayload.get("orderId");
        int resultCode   = Integer.parseInt(String.valueOf(ipnPayload.getOrDefault("resultCode", "-1")));
        String momoTxId  = (String) ipnPayload.get("transId");
        String message   = (String) ipnPayload.get("message");

        log.info("[MOMO IPN] orderId={} resultCode={} transId={}", orderId, resultCode, momoTxId);

        // 1. Xác thực chữ ký IPN để chống giả mạo
        if (!verifyIpnSignature(ipnPayload)) {
            log.warn("[MOMO IPN] Signature verification FAILED for orderId={}", orderId);
            throw new SecurityException("Invalid MoMo IPN signature");
        }

        // 2. Tìm transaction trong DB
        PaymentTransaction tx = paymentTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalStateException("OrderId không tìm thấy: " + orderId));

        // 3. Cập nhật raw payload và provider info
        tx.setRawIpnPayload(ipnPayload);
        tx.setProviderTransactionId(momoTxId);
        tx.setProviderMessage(message);

        if (resultCode == 0) {
            // 4. THÀNH CÔNG: kích hoạt gói subscription cho user
            tx.setStatus("SUCCESS");
            paymentTransactionRepository.save(tx);
            subscriptionActivationService.activatePlan(tx.getUserId(), tx.getPlanCode(), 1);
            log.info("[MOMO IPN] SUCCESS — Activated plan={} for userId={}", tx.getPlanCode(), tx.getUserId());
        } else {
            // 5. THẤT BẠI: đánh dấu FAILED
            tx.setStatus("FAILED");
            paymentTransactionRepository.save(tx);
            log.warn("[MOMO IPN] FAILED resultCode={} for orderId={}", resultCode, orderId);
        }
    }

    // ==================== PRIVATE HELPERS ====================

    private String callMomoCreateOrder(Map<String, Object> payload, String orderId) {
        try {
            String body = objectMapper.writeValueAsString(payload);
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(momoApiEndpoint))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            Map<?, ?> responseMap = objectMapper.readValue(response.body(), Map.class);
            String payUrl = (String) responseMap.get("payUrl");

            if (payUrl == null || payUrl.isBlank()) {
                log.error("[MOMO] No payUrl returned for orderId={}. Response: {}", orderId, response.body());
                throw new RuntimeException("MoMo không trả về payUrl. Vui lòng thử lại.");
            }
            return payUrl;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi gọi API MoMo: " + e.getMessage(), e);
        }
    }

    private boolean verifyIpnSignature(Map<String, Object> payload) {
        try {
            // MoMo IPN v2 rawHash format
            String rawHash = "accessKey=" + accessKey
                    + "&amount=" + payload.get("amount")
                    + "&extraData=" + payload.getOrDefault("extraData", "")
                    + "&message=" + payload.getOrDefault("message", "")
                    + "&orderId=" + payload.get("orderId")
                    + "&orderInfo=" + payload.getOrDefault("orderInfo", "")
                    + "&orderType=" + payload.getOrDefault("orderType", "")
                    + "&partnerCode=" + payload.get("partnerCode")
                    + "&payType=" + payload.getOrDefault("payType", "")
                    + "&requestId=" + payload.getOrDefault("requestId", "")
                    + "&responseTime=" + payload.getOrDefault("responseTime", "")
                    + "&resultCode=" + payload.get("resultCode")
                    + "&transId=" + payload.getOrDefault("transId", "");

            String expectedSignature = hmacSHA256(secretKey, rawHash);
            String receivedSignature = (String) payload.get("signature");
            return expectedSignature.equals(receivedSignature);
        } catch (Exception e) {
            log.error("[MOMO] Error verifying IPN signature", e);
            return false;
        }
    }

    private String hmacSHA256(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("HMAC-SHA256 error", e);
        }
    }
}
