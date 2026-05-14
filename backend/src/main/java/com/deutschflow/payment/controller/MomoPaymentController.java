package com.deutschflow.payment.controller;

import com.deutschflow.payment.dto.CreateMomoOrderRequest;
import com.deutschflow.payment.dto.CreateMomoOrderResponse;
import com.deutschflow.payment.dto.SyncMomoOrderRequest;
import com.deutschflow.payment.dto.SyncMomoOrderResponse;
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
     * Tài liệu MoMo: phản hồi HTTP 204 No Content trong giới hạn thời gian (~15s).
     */
    @PostMapping("/ipn")
    public ResponseEntity<Void> handleIpn(@RequestBody Map<String, Object> ipnPayload) {
        log.info("[MOMO IPN] Received payload keys: {}", ipnPayload.keySet());
        momoPaymentService.handleIpn(ipnPayload);
        return ResponseEntity.noContent().build();
    }

    /**
     * Học viên gọi sau khi MoMo redirect về (dự phòng khi IPN chậm hoặc không tới server).
     */
    @PostMapping("/sync-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SyncMomoOrderResponse> syncOrder(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody SyncMomoOrderRequest request) {
        SyncMomoOrderResponse body = momoPaymentService.syncPendingOrderFromMomo(
                currentUser.getId(), request.getOrderId());
        return ResponseEntity.ok(body);
    }
}
