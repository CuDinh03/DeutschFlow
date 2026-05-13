package com.deutschflow.payment.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;

@Data
public class CreateMomoOrderRequest {
    @NotBlank
    private String planCode;   // "PRO" | "ULTRA"
    @Min(1)
    private int durationMonths = 1;
}
