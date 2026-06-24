package com.deutschflow.payment.service;

import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * PAY-1: MoMo IPN must fail closed when credentials are unconfigured (blank or the default "dummy").
 * Otherwise an attacker who knows a deploy is unconfigured could forge a valid IPN signature with the
 * known "dummy" key and activate a subscription for free.
 */
@ExtendWith(MockitoExtension.class)
class MomoPaymentServiceIpnTest {

    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ObjectMapper objectMapper;
    @Mock SubscriptionActivationService subscriptionActivationService;
    @Mock PlatformTransactionManager transactionManager;

    @InjectMocks MomoPaymentService service;

    @Test
    void handleIpn_failsClosed_whenSecretIsDummy() {
        ReflectionTestUtils.setField(service, "accessKey", "dummy");
        ReflectionTestUtils.setField(service, "secretKey", "dummy");

        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", "MOMO_TEST");
        payload.put("resultCode", "0");
        payload.put("amount", 199000);
        payload.put("signature", "forged-with-known-dummy-key");

        assertThrows(SecurityException.class, () -> service.handleIpn(payload));
        // Rejected before any DB lookup of the order.
        verifyNoInteractions(paymentTransactionRepository);
    }

    @Test
    void handleIpn_failsClosed_whenCredentialsBlank() {
        ReflectionTestUtils.setField(service, "accessKey", "");
        ReflectionTestUtils.setField(service, "secretKey", "");

        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", "MOMO_TEST2");
        payload.put("resultCode", "0");
        payload.put("signature", "anything");

        assertThrows(SecurityException.class, () -> service.handleIpn(payload));
        verifyNoInteractions(paymentTransactionRepository);
    }
}
