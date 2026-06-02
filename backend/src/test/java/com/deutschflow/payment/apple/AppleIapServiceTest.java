package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.deutschflow.payment.entity.PaymentTransaction;
import com.deutschflow.payment.repository.PaymentTransactionRepository;
import com.deutschflow.payment.service.SubscriptionActivationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("AppleIapService — purchase verification & account binding")
@ExtendWith(MockitoExtension.class)
class AppleIapServiceTest {

    @Mock AppleJwsVerifier verifier;
    @Mock AppleProductCatalog productCatalog;
    @Mock AppleSubscriptionStore store;
    @Mock SubscriptionActivationService activationService;
    @Mock PaymentTransactionRepository paymentTransactionRepository;
    @Mock PlatformTransactionManager transactionManager;

    @InjectMocks AppleIapService service;

    private static final String JWS = "signed.jws.token";
    private static final String PRODUCT = "com.deutschflow.app.pro.monthly";
    private static final long USER = 2L;

    private JWSTransactionDecodedPayload payload(UUID appAccountToken) {
        JWSTransactionDecodedPayload p = new JWSTransactionDecodedPayload();
        p.setTransactionId("txn-1");
        p.setOriginalTransactionId("orig-1");
        p.setProductId(PRODUCT);
        p.setAppAccountToken(appAccountToken);
        p.setPurchaseDate(1_700_000_000_000L);
        p.setExpiresDate(1_800_000_000_000L);
        return p;
    }

    @Test
    @DisplayName("rejects a JWS whose appAccountToken belongs to a different account (cross-user replay)")
    void verify_appAccountTokenMismatch_rejected() throws Exception {
        UUID attackerToken = UUID.fromString("00000000-0000-0000-0000-0000000000bb");
        UUID jwsToken = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        when(verifier.isEnabled()).thenReturn(true);
        when(verifier.verifyTransaction(JWS)).thenReturn(payload(jwsToken));
        when(productCatalog.find(PRODUCT))
                .thenReturn(Optional.of(new AppleProductCatalog.AppleProduct(PRODUCT, "PRO", 1)));
        when(store.getOrCreateAppAccountToken(USER)).thenReturn(attackerToken);

        assertThatThrownBy(() -> service.verifyAndActivate(USER, JWS))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");

        verify(activationService, never()).extendOrActivateApple(anyLong(), anyString(), any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("rejects replay of a transaction already recorded against another user")
    void verify_transactionOwnedByAnotherUser_rejected() throws Exception {
        when(verifier.isEnabled()).thenReturn(true);
        when(verifier.verifyTransaction(JWS)).thenReturn(payload(null)); // no token → falls through to ownership check
        when(productCatalog.find(PRODUCT))
                .thenReturn(Optional.of(new AppleProductCatalog.AppleProduct(PRODUCT, "PRO", 1)));
        when(paymentTransactionRepository.findByOrderId("txn-1"))
                .thenReturn(Optional.of(PaymentTransaction.builder().userId(99L).status("SUCCESS").build()));

        assertThatThrownBy(() -> service.verifyAndActivate(USER, JWS))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");

        verify(activationService, never()).extendOrActivateApple(anyLong(), anyString(), any(), any(), anyBoolean());
    }

    @Test
    @DisplayName("activates the entitlement on a valid first-time purchase and notifies admins")
    void verify_validNewPurchase_activates() throws Exception {
        when(verifier.isEnabled()).thenReturn(true);
        when(verifier.verifyTransaction(JWS)).thenReturn(payload(null));
        when(productCatalog.find(PRODUCT))
                .thenReturn(Optional.of(new AppleProductCatalog.AppleProduct(PRODUCT, "PRO", 1)));
        when(paymentTransactionRepository.findByOrderId("txn-1")).thenReturn(Optional.empty());

        AppleIapService.AppleActivationResult result = service.verifyAndActivate(USER, JWS);

        assertThat(result.planCode()).isEqualTo("PRO");
        verify(paymentTransactionRepository).save(any(PaymentTransaction.class));
        verify(store).upsert(eq("orig-1"), eq(USER), eq(PRODUCT), eq("PRO"), eq("ACTIVE"), any(), eq(Boolean.TRUE), any(), eq("txn-1"));
        verify(activationService).extendOrActivateApple(eq(USER), eq("PRO"), any(), any(), eq(true));
    }

    @Test
    @DisplayName("rejects a blank transaction before touching Apple")
    void verify_blankTransaction_rejected() {
        when(verifier.isEnabled()).thenReturn(true);

        assertThatThrownBy(() -> service.verifyAndActivate(USER, "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
