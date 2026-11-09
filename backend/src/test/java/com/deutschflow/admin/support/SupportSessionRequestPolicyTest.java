package com.deutschflow.admin.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("SupportSessionRequestPolicy — luật method/đường dẫn của phiên hỗ trợ")
class SupportSessionRequestPolicyTest {

    @Test
    void readMethodsAllowedOnOrdinaryPaths() {
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/srs/due")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("HEAD", "/api/today/me")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("OPTIONS", "/api/anything")).isTrue();
    }

    @Test
    void onlyTheEndEndpointMayWrite() {
        assertThat(SupportSessionRequestPolicy.isAllowed("POST", "/api/support-session/end")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("POST", "/api/support-session/end/")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("PUT", "/api/support-session/end")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("POST", "/api/support-session/other")).isFalse();
        assertThat(SupportSessionRequestPolicy.isEndRequest("POST", "/api/support-session/end")).isTrue();
        assertThat(SupportSessionRequestPolicy.isEndRequest("GET", "/api/support-session/end")).isFalse();
    }

    @Test
    void authNamespaceOnlyMe() {
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/auth/me")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/auth/me/plan")).isTrue();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/auth/activate")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("POST", "/api/auth/refresh")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("POST", "/api/auth/logout")).isFalse();
    }

    @Test
    void normalizationCannotSmuggleADeniedPath() {
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/v2/admin/x/")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api//admin/users")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/admin;x=1/users")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/phase/current?x=1")).isFalse();
        assertThat(SupportSessionRequestPolicy.isAllowed("GET", "/api/v2/students/assignments/5;a/scenario")).isFalse();
    }
}
