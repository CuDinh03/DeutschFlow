package com.deutschflow.payment.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CreateMomoOrderResponse {
    private String payUrl;       // URL redirect đến trang thanh toán MoMo
    private String orderId;      // Mã đơn hàng nội bộ
    private Long amount;
    private String planCode;
}
