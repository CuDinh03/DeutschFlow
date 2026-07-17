package com.deutschflow.payment.apple;

import com.apple.itunes.storekit.model.JWSTransactionDecodedPayload;
import com.apple.itunes.storekit.verification.SignedDataVerifier;
import com.apple.itunes.storekit.verification.VerificationException;
import com.apple.itunes.storekit.verification.VerificationStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the Production-then-Sandbox environment fallback in {@link AppleJwsVerifier}.
 * The fallback exists so ONE backend serves real App Store buyers (Production JWS) AND TestFlight/sandbox
 * testers (Sandbox JWS) — see {@link AppleJwsVerifier#verifyWithEnvironmentFallback}.
 */
class AppleJwsVerifierTest {

    private final JWSTransactionDecodedPayload payload = mock(JWSTransactionDecodedPayload.class);

    @Test
    @DisplayName("primary verifier succeeds → returns its result, fallback never tried")
    void primarySucceeds() throws Exception {
        SignedDataVerifier primary = mock(SignedDataVerifier.class);
        SignedDataVerifier fallback = mock(SignedDataVerifier.class);
        when(primary.verifyAndDecodeTransaction("jws")).thenReturn(payload);

        var result = AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(primary, fallback), v -> v.verifyAndDecodeTransaction("jws"));

        assertThat(result).isSameAs(payload);
        verify(fallback, never()).verifyAndDecodeTransaction(any());
    }

    @Test
    @DisplayName("primary throws INVALID_ENVIRONMENT → fallback verifier is used (real buyer on a Sandbox-primary box, or vice versa)")
    void environmentMismatchFallsBack() throws Exception {
        SignedDataVerifier primary = mock(SignedDataVerifier.class);
        SignedDataVerifier fallback = mock(SignedDataVerifier.class);
        when(primary.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT));
        when(fallback.verifyAndDecodeTransaction("jws")).thenReturn(payload);

        var result = AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(primary, fallback), v -> v.verifyAndDecodeTransaction("jws"));

        assertThat(result).isSameAs(payload);
        verify(primary).verifyAndDecodeTransaction("jws");
        verify(fallback).verifyAndDecodeTransaction("jws");
    }

    @Test
    @DisplayName("real signature failure is rethrown immediately, fallback NOT tried (never mask a bad JWS)")
    void realFailureNotMasked() throws Exception {
        SignedDataVerifier primary = mock(SignedDataVerifier.class);
        SignedDataVerifier fallback = mock(SignedDataVerifier.class);
        when(primary.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.VERIFICATION_FAILURE));

        assertThatThrownBy(() -> AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(primary, fallback), v -> v.verifyAndDecodeTransaction("jws")))
                .isInstanceOf(VerificationException.class)
                .extracting(e -> ((VerificationException) e).getStatus())
                .isEqualTo(VerificationStatus.VERIFICATION_FAILURE);

        verify(fallback, never()).verifyAndDecodeTransaction(any());
    }

    @Test
    @DisplayName("wrong bundle id is rethrown immediately, fallback NOT tried")
    void invalidAppIdentifierNotMasked() throws Exception {
        SignedDataVerifier primary = mock(SignedDataVerifier.class);
        SignedDataVerifier fallback = mock(SignedDataVerifier.class);
        when(primary.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.INVALID_APP_IDENTIFIER));

        assertThatThrownBy(() -> AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(primary, fallback), v -> v.verifyAndDecodeTransaction("jws")))
                .isInstanceOf(VerificationException.class)
                .extracting(e -> ((VerificationException) e).getStatus())
                .isEqualTo(VerificationStatus.INVALID_APP_IDENTIFIER);

        verify(fallback, never()).verifyAndDecodeTransaction(any());
    }

    @Test
    @DisplayName("all environments mismatch → surfaces INVALID_ENVIRONMENT")
    void allMismatchSurfacesInvalidEnvironment() throws Exception {
        SignedDataVerifier primary = mock(SignedDataVerifier.class);
        SignedDataVerifier fallback = mock(SignedDataVerifier.class);
        when(primary.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT));
        when(fallback.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT));

        assertThatThrownBy(() -> AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(primary, fallback), v -> v.verifyAndDecodeTransaction("jws")))
                .isInstanceOf(VerificationException.class)
                .extracting(e -> ((VerificationException) e).getStatus())
                .isEqualTo(VerificationStatus.INVALID_ENVIRONMENT);
    }

    @Test
    @DisplayName("single sandbox-only verifier still surfaces its environment mismatch")
    void singleVerifierMismatch() throws Exception {
        SignedDataVerifier only = mock(SignedDataVerifier.class);
        when(only.verifyAndDecodeTransaction("jws"))
                .thenThrow(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT));

        assertThatThrownBy(() -> AppleJwsVerifier.verifyWithEnvironmentFallback(
                List.of(only), v -> v.verifyAndDecodeTransaction("jws")))
                .isInstanceOf(VerificationException.class)
                .extracting(e -> ((VerificationException) e).getStatus())
                .isEqualTo(VerificationStatus.INVALID_ENVIRONMENT);
    }
}
