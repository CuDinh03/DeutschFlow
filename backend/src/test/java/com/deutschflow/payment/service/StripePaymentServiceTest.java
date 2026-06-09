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
    @DisplayName("checkout.session.completed atomically claims the transition and activates exactly once")
    void handleWebhook_completedSession_activatesViaAtomicClaim() throws SignatureVerificationException {
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

        // The PENDING→SUCCESS transition is now an atomic conditional UPDATE; the winning delivery
        // (rowcount 1) is the only one that activates. status='SUCCESS' is enforced by that UPDATE, so
        // getMonthlyRevenue()'s WHERE status='SUCCESS' stays correct without a separate save().
        when(paymentTransactionRepository.markSuccessIfNotAlready(sessionId, "pi_abc123")).thenReturn(1);

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString()))
                       .thenReturn(event);

            service.handleWebhook("payload", "sig-header");
        }

        verify(paymentTransactionRepository).markSuccessIfNotAlready(sessionId, "pi_abc123");
        verify(subscriptionActivationService).activatePlan(7L, "B1_MONTHLY", 1);
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

    @Test
    @DisplayName("webhook before the checkout row persisted → inserts SUCCESS and activates once")
    void handleWebhook_rowNotYetPersisted_insertsAndActivates() throws SignatureVerificationException {
        String sessionId = "cs_test_prepersist";

        Session session = mock(Session.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.getMetadata()).thenReturn(Map.of("userId", "9", "planCode", "B1_MONTHLY", "durationMonths", "1"));
        when(session.getPaymentIntent()).thenReturn("pi_pre");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.<StripeObject>of(session));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        // No row claimed the transition AND none exists yet → fallback insert path.
        when(paymentTransactionRepository.markSuccessIfNotAlready(sessionId, "pi_pre")).thenReturn(0);
        when(paymentTransactionRepository.findByOrderId(sessionId)).thenReturn(Optional.empty());

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString())).thenReturn(event);
            service.handleWebhook("payload", "sig-header");
        }

        verify(paymentTransactionRepository).saveAndFlush(any());
        verify(subscriptionActivationService).activatePlan(9L, "B1_MONTHLY", 1);
    }

    @Test
    @DisplayName("concurrent pre-persist delivery loses the unique-orderId insert → does NOT double-activate")
    void handleWebhook_concurrentInsertViolation_doesNotActivate() throws SignatureVerificationException {
        String sessionId = "cs_test_dup";

        Session session = mock(Session.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.getMetadata()).thenReturn(Map.of("userId", "9", "planCode", "B1_MONTHLY", "durationMonths", "1"));
        when(session.getPaymentIntent()).thenReturn("pi_dup");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.<StripeObject>of(session));

        Event event = mock(Event.class);
        when(event.getType()).thenReturn("checkout.session.completed");
        when(event.getDataObjectDeserializer()).thenReturn(deserializer);

        when(paymentTransactionRepository.markSuccessIfNotAlready(sessionId, "pi_dup")).thenReturn(0);
        when(paymentTransactionRepository.findByOrderId(sessionId)).thenReturn(Optional.empty());
        // The competing delivery already inserted the unique order_id → saveAndFlush violates the constraint.
        when(paymentTransactionRepository.saveAndFlush(any()))
                .thenThrow(new org.springframework.dao.DataIntegrityViolationException("duplicate order_id"));

        try (MockedStatic<Webhook> webhookMock = mockStatic(Webhook.class)) {
            webhookMock.when(() -> Webhook.constructEvent(anyString(), anyString(), anyString())).thenReturn(event);
            service.handleWebhook("payload", "sig-header");
        }

        verify(subscriptionActivationService, never()).activatePlan(anyLong(), anyString(), anyInt());
    }
}
