package com.deutschflow.payment.service;

import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@DisplayName("StripePaymentService — webhook handling")
@ExtendWith(MockitoExtension.class)
class StripePaymentServiceTest {

    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock JdbcTemplate jdbcTemplate;
    @Mock SubscriptionActivationService subscriptionActivationService;

    private StripePaymentService service;

    @BeforeEach
    void setUp() {
        service = new StripePaymentService(paymentTransactionRepository, jdbcTemplate, subscriptionActivationService);
        ReflectionTestUtils.setField(service, "webhookSecret", "whsec_test_secret");
    }

    @Test
    @DisplayName("checkout.session.completed saves status=SUCCESS — required for getMonthlyRevenue() WHERE status='SUCCESS'")
    void handleWebhook_completedSession_savesSuccessStatus() throws SignatureVerificationException {
        String sessionId = "cs_test_abc123";

        Session session = mock(Session.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.getMetadata()).thenReturn(Map.of("userId", "7", "planCode", "B1_MONTHLY", "durationMonths", "1"));
        when(session.getPaymentIntent()).thenReturn("pi_abc123");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.<StripeObject>of(session));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        PaymentTransaction pending = PaymentTransaction.builder()
                .orderId(sessionId).userId(7L).planCode("B1_MONTHLY")
                .amount(199_000L).durationMonths(1).provider("STRIPE").status("PENDING")
                .build();
        when(paymentTransactionRepository.findByOrderId(sessionId)).thenReturn(Optional.of(pending));
        when(paymentTransactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                       .thenReturn(event);

            service.handleWebhook("payload", "sig-header");
        }

        ArgumentCaptor<PaymentTransaction> saved = ArgumentCaptor.forClass(PaymentTransaction.class);
        verify(paymentTransactionRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus())
                .as("Stripe transaction status must be 'SUCCESS' to be counted by getMonthlyRevenue()")
                .isEqualTo("SUCCESS");
        assertThat(saved.getValue().getProvider()).isEqualTo("STRIPE");
    }

    @Test
    @DisplayName("already-SUCCESS transaction is not re-activated (idempotent replay)")
    void handleWebhook_alreadySuccess_isIdempotent() throws SignatureVerificationException {
        String sessionId = "cs_test_replay";

        Session session = mock(Session.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.getMetadata()).thenReturn(Map.of("userId", "3", "planCode", "B1_MONTHLY", "durationMonths", "1"));

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.<StripeObject>of(session));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        PaymentTransaction already = PaymentTransaction.builder()
                .orderId(sessionId).userId(3L).planCode("B1_MONTHLY")
                .amount(199_000L).durationMonths(1).provider("STRIPE").status("SUCCESS")
                .build();
        when(paymentTransactionRepository.findByOrderId(sessionId)).thenReturn(Optional.of(already));

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                       .thenReturn(event);

            service.handleWebhook("payload", "sig-header");
        }

        verify(paymentTransactionRepository, never()).save(any());
        verify(subscriptionActivationService, never()).activatePlan(anyLong(), anyString(), anyInt());
    }

    @Test
    @DisplayName("non-checkout events are ignored")
    void handleWebhook_ignoresNonCheckoutEvent() throws SignatureVerificationException {
        Event event = mock(Event.class);
        when(event.getType()).thenReturn("payment_intent.created");

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                       .thenReturn(event);

            service.handleWebhook("payload", "sig-header");
        }

        verify(paymentTransactionRepository, never()).findByOrderId(anyString());
        verify(paymentTransactionRepository, never()).save(any());
    }

    @Test
    @DisplayName("SECURITY: a blank webhook secret is rejected — no forged-event activation")
    void handleWebhook_blankSecret_rejected() {
        ReflectionTestUtils.setField(service, "webhookSecret", "");

        assertThatThrownBy(() -> service.handleWebhook("payload", "sig-header"))
                .isInstanceOf(IllegalStateException.class);

        verify(paymentTransactionRepository, never()).save(any());
        verify(subscriptionActivationService, never()).activatePlan(anyLong(), anyString(), anyInt());
    }
}
