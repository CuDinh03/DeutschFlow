package com.deutschflow.payment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SyncMomoOrderRequest {
    @NotBlank
    private String orderId;
}
