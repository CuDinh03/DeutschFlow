package com.deutschflow.payment.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class SyncMomoOrderResponse {
    /** Local row status after sync: SUCCESS, PENDING, or FAILED */
    String status;
    String orderId;
    /** MoMo query/IPN resultCode, or null if not queried */
    Integer momoResultCode;
    String message;
}
