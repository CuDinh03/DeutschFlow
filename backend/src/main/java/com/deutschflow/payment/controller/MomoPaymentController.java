package com.deutschflow.payment.controller;

import com.deutschflow.payment.dto.CreateMomoOrderRequest;
import com.deutschflow.payment.dto.CreateMomoOrderResponse;
import com.deutschflow.payment.service.MomoPaymentService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments/momo")
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentController {

    private final MomoPaymentService momoPaymentService;

    /**
     * Học viên tạo đơn thanh toán. Trả về payUrl để redirect tới MoMo.
     */
    @PostMapping("/create-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<CreateMomoOrderResponse> createOrder(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody CreateMomoOrderRequest request) {

        CreateMomoOrderResponse response = momoPaymentService.createOrder(currentUser.getId(), request);
        return ResponseEntity.ok(response);
    }

    /**
     * Webhook IPN từ server MoMo (không cần JWT).
     * MoMo sẽ gọi POST về endpoint này sau khi giao dịch hoàn tất.
     * QUAN TRỌNG: Phải bỏ endpoint này ra khỏi Spring Security filter JWT
     *             bằng cách thêm vào SecurityConfig: .requestMatchers("/api/payments/momo/ipn").permitAll()
     */
    @PostMapping("/ipn")
    public ResponseEntity<Map<String, Object>> handleIpn(@RequestBody Map<String, Object> ipnPayload) {
        log.info("[MOMO IPN] Received payload keys: {}", ipnPayload.keySet());
        momoPaymentService.handleIpn(ipnPayload);
        // MoMo yêu cầu backend phải trả về 200 OK với resultCode=0 khi nhận IPN thành công
        return ResponseEntity.ok(Map.of("resultCode", 0, "message", "Success"));
    }
}
