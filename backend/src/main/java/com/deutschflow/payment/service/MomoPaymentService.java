package com.deutschflow.payment.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.payment.dto.CreateMomoOrderRequest;
import com.deutschflow.payment.dto.CreateMomoOrderResponse;
import com.deutschflow.payment.dto.SyncMomoOrderResponse;
import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
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
import java.time.Duration;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Luồng thanh toán MoMo: tích hợp sandbox (dev/test) và có thể chuyển production qua env {@code MOMO_*}
 * (xem {@code application.yml} / profile {@code sandbox}).
 * <p>
 * Flow: create-order → lưu PENDING → redirect đến payUrl → IPN webhook → activate subscription
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentService {

    // --- MoMo: payment.momo.* từ YAML / env (DEV_* hoặc MOMO_* — xem application.yml) ---
    @Value("${payment.momo.partner-code:MOMO}")
    private String partnerCode;

    @Value("${payment.momo.access-key:F8BBA842ECF85}")
    private String accessKey;

    @Value("${payment.momo.secret-key:K951B6PE1waDMi640xX08PD3vg6EkVlz}")
    private String secretKey;

    @Value("${payment.momo.api-endpoint:https://test-payment.momo.vn/v2/gateway/api/create}")
    private String momoApiEndpoint;

    @Value("${payment.momo.ipn-url:https://mydeutschflow.com/api/payments/momo/ipn}")
    private String ipnUrl;

    @Value("${payment.momo.return-url:https://mydeutschflow.com/payment/success}")
    private String returnUrl;

    private final PaymentTransactionRepository paymentTransactionRepository;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SubscriptionActivationService subscriptionActivationService;

    @PostConstruct
    void logMomoIntegrationUrls() {
        log.info("[MOMO] Startup config: ipnUrl={} returnUrl={} createApi={}", ipnUrl, returnUrl, momoApiEndpoint);
    }

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
        String orderId   = ipnPayload.get("orderId") != null ? String.valueOf(ipnPayload.get("orderId")) : null;
        int resultCode   = Integer.parseInt(String.valueOf(ipnPayload.getOrDefault("resultCode", "-1")));
        String momoTxId  = ipnPayload.get("transId") != null ? String.valueOf(ipnPayload.get("transId")) : null;
        String message   = ipnPayload.get("message") != null ? String.valueOf(ipnPayload.get("message")) : null;

        log.info("[MOMO IPN] orderId={} resultCode={} transId={}", orderId, resultCode, momoTxId);

        // 1. Xác thực chữ ký IPN để chống giả mạo
        if (!verifyIpnSignature(ipnPayload)) {
            log.warn("[MOMO IPN] Signature verification FAILED for orderId={}", orderId);
            throw new SecurityException("Invalid MoMo IPN signature");
        }

        // 2. Tìm transaction trong DB
        PaymentTransaction tx = paymentTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalStateException("OrderId không tìm thấy: " + orderId));

        if ("SUCCESS".equals(tx.getStatus())) {
            log.info("[MOMO IPN] Idempotent replay for already-success orderId={}", orderId);
            return;
        }

        if (resultCode == 0) {
            long ipnAmount = parseMomoAmount(ipnPayload.get("amount"));
            if (ipnAmount >= 0 && ipnAmount != tx.getAmount()) {
                log.error("[MOMO IPN] Amount mismatch orderId={} db={} ipn={}", orderId, tx.getAmount(), ipnAmount);
                throw new SecurityException("Số tiền IPN không khớp đơn hàng");
            }
            fulfillSuccessfulPayment(tx, momoTxId, message, ipnPayload);
            log.info("[MOMO IPN] SUCCESS — Activated plan={} for userId={}", tx.getPlanCode(), tx.getUserId());
        } else {
            tx.setRawIpnPayload(ipnPayload);
            tx.setProviderTransactionId(momoTxId);
            tx.setProviderMessage(message);
            tx.setStatus("FAILED");
            paymentTransactionRepository.save(tx);
            log.warn("[MOMO IPN] FAILED resultCode={} for orderId={}", resultCode, orderId);
        }
    }

    /**
     * Khi IPN không tới (URL sai, HTTPS, tường lửa…), học viên vẫn quay về trang success.
     * Gọi API Query của MoMo để đối soát và kích hoạt gói (idempotent với IPN).
     */
    @Transactional
    public SyncMomoOrderResponse syncPendingOrderFromMomo(Long userId, String orderId) {
        PaymentTransaction tx = paymentTransactionRepository.findByOrderIdAndUserId(orderId, userId)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy giao dịch cho đơn hàng này."));

        if ("SUCCESS".equals(tx.getStatus())) {
            return SyncMomoOrderResponse.builder()
                    .status("SUCCESS")
                    .orderId(orderId)
                    .momoResultCode(0)
                    .message("Đã xác nhận trước đó")
                    .build();
        }

        Map<String, Object> queryBody = null;
        int resultCode = -1;
        for (int attempt = 1; attempt <= 5; attempt++) {
            queryBody = callMomoQuery(orderId);
            resultCode = Integer.parseInt(String.valueOf(queryBody.getOrDefault("resultCode", "-1")));
            if (resultCode == 0 || !isRetryableMomoQueryCode(resultCode)) {
                break;
            }
            log.info("[MOMO QUERY] orderId={} attempt={} resultCode={} — MoMo chưa final, chờ rồi thử lại", orderId, attempt, resultCode);
            if (attempt < 5) {
                try {
                    Thread.sleep(1500L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        long momoAmount = parseMomoAmount(queryBody.get("amount"));
        String momoTxId = queryBody.get("transId") != null ? String.valueOf(queryBody.get("transId")) : null;
        String message = queryBody.get("message") != null ? String.valueOf(queryBody.get("message")) : null;

        if (resultCode == 0) {
            if (momoAmount >= 0 && momoAmount != tx.getAmount()) {
                log.error("[MOMO QUERY] Amount mismatch orderId={} db={} momo={}", orderId, tx.getAmount(), momoAmount);
                throw new BadRequestException("Số tiền giao dịch không khớp với đơn hàng");
            }
            fulfillSuccessfulPayment(tx, momoTxId, message, queryBody);
            return SyncMomoOrderResponse.builder()
                    .status("SUCCESS")
                    .orderId(orderId)
                    .momoResultCode(resultCode)
                    .message(message)
                    .build();
        }

        return SyncMomoOrderResponse.builder()
                .status(tx.getStatus())
                .orderId(orderId)
                .momoResultCode(resultCode)
                .message(message != null ? message : "Chưa thanh toán thành công trên MoMo")
                .build();
    }

    private void fulfillSuccessfulPayment(PaymentTransaction tx, String momoTxId, String message,
                                          Map<String, Object> rawPayload) {
        if ("SUCCESS".equals(tx.getStatus())) {
            return;
        }
        tx.setRawIpnPayload(rawPayload);
        tx.setProviderTransactionId(momoTxId);
        tx.setProviderMessage(message);
        tx.setStatus("SUCCESS");
        paymentTransactionRepository.save(tx);
        subscriptionActivationService.activatePlan(tx.getUserId(), tx.getPlanCode(), 1);
    }

    // ==================== PRIVATE HELPERS ====================

    private String callMomoCreateOrder(Map<String, Object> payload, String orderId) {
        try {
            String body = objectMapper.writeValueAsString(payload);
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(momoApiEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(45))
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
            // MoMo IPN v2 rawHash format (string values must match MoMo's concatenation, incl. integer fields)
            String rawHash = "accessKey=" + accessKey
                    + "&amount=" + signatureScalar(payload.get("amount"))
                    + "&extraData=" + signatureScalar(payload.get("extraData"))
                    + "&message=" + signatureScalar(payload.get("message"))
                    + "&orderId=" + signatureScalar(payload.get("orderId"))
                    + "&orderInfo=" + signatureScalar(payload.get("orderInfo"))
                    + "&orderType=" + signatureScalar(payload.get("orderType"))
                    + "&partnerCode=" + signatureScalar(payload.get("partnerCode"))
                    + "&payType=" + signatureScalar(payload.get("payType"))
                    + "&requestId=" + signatureScalar(payload.get("requestId"))
                    + "&responseTime=" + signatureScalar(payload.get("responseTime"))
                    + "&resultCode=" + signatureScalar(payload.get("resultCode"))
                    + "&transId=" + signatureScalar(payload.get("transId"));

            String expectedSignature = hmacSHA256(secretKey, rawHash);
            String receivedSignature = payload.get("signature") != null ? String.valueOf(payload.get("signature")) : "";
            return expectedSignature.equalsIgnoreCase(receivedSignature);
        } catch (Exception e) {
            log.error("[MOMO] Error verifying IPN signature", e);
            return false;
        }
    }

    /**
     * MoMo ký trên chuỗi giá trị thực tế; JSON number có thể deserialize thành Double (699000.0)
     * và làm lệch chữ ký nếu nối chuỗi sai.
     */
    private static String signatureScalar(Object v) {
        if (v == null) {
            return "";
        }
        if (v instanceof Number n) {
            if (n instanceof Double d || n instanceof Float) {
                double dv = n.doubleValue();
                if (!Double.isNaN(dv) && dv == Math.rint(dv) && dv >= Long.MIN_VALUE && dv <= Long.MAX_VALUE) {
                    return String.valueOf((long) dv);
                }
            }
            if (n instanceof Long || n instanceof Integer || n instanceof Short || n instanceof Byte) {
                return String.valueOf(n.longValue());
            }
            // BigInteger / BigDecimal / other
            return String.valueOf(n.longValue());
        }
        return String.valueOf(v);
    }

    private long parseMomoAmount(Object amountField) {
        if (amountField == null) {
            return -1;
        }
        if (amountField instanceof Number n) {
            return n.longValue();
        }
        try {
            String s = String.valueOf(amountField).trim();
            if (s.contains(".")) {
                return (long) Double.parseDouble(s);
            }
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /** MoMo: giao dịch chưa ở trạng thái cuối — có thể thử query lại sau vài giây. */
    private static boolean isRetryableMomoQueryCode(int resultCode) {
        return resultCode == 1000 || resultCode == 7000 || resultCode == 7002;
    }

    private Map<String, Object> callMomoQuery(String orderId) {
        try {
            String requestId = UUID.randomUUID().toString();
            String raw = "accessKey=" + accessKey
                    + "&orderId=" + orderId
                    + "&partnerCode=" + partnerCode
                    + "&requestId=" + requestId;
            String signature = hmacSHA256(secretKey, raw);

            Map<String, Object> body = new HashMap<>();
            body.put("partnerCode", partnerCode);
            body.put("requestId", requestId);
            body.put("orderId", orderId);
            body.put("signature", signature);
            body.put("lang", "vi");

            String json = objectMapper.writeValueAsString(body);
            String queryEndpoint = momoApiEndpoint.replaceFirst("/create/?$", "/query");
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(queryEndpoint))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(45))
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(response.body(), Map.class);
            log.info("[MOMO QUERY] orderId={} http={} resultCode={}", orderId, response.statusCode(), map.get("resultCode"));
            return map;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi gọi API truy vấn MoMo: " + e.getMessage(), e);
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
