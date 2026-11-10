package com.deutschflow.common.security;

import com.deutschflow.user.entity.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

@DisplayName("JwtService — hình dạng token phiên hỗ trợ")
class JwtServiceSupportTokenTest {

    private final JwtService jwtService = new JwtService("abcdefghijklmnopqrstuvwxyz0123456789abcdef", "", 900_000L,
            "deutschflow-api", "deutschflow-app", false, "HS256", "", "", "");

    private static User teacher() {
        return User.builder().id(42L).email("gv@df.test").displayName("GV").passwordHash("h")
                .role(User.Role.TEACHER).locale(User.Locale.vi).active(true).build();
    }

    @Test
    @DisplayName("claim như access token của đích + typ=support, sup, act, jti; KHÔNG có mfa")
    void claims() {
        Instant sessionExp = Instant.now().plusSeconds(1800);
        Claims c = jwtService.extractClaims(
                jwtService.generateSupportToken(teacher(), 5L, "TEACHER", 1L, 77L, sessionExp));

        assertThat(JwtService.tokenType(c)).isEqualTo(JwtService.TYP_SUPPORT);
        assertThat(c.getSubject()).isEqualTo("gv@df.test");
        assertThat(c.get("role", String.class)).isEqualTo("TEACHER");
        assertThat(JwtService.longClaim(c, "userId")).isEqualTo(42L);
        assertThat(JwtService.longClaim(c, "orgId")).isEqualTo(5L);
        assertThat(c.get("orgRole", String.class)).isEqualTo("TEACHER");
        assertThat(JwtService.longClaim(c, JwtService.CLAIM_SUPPORT_SESSION)).isEqualTo(77L);
        assertThat(JwtService.longClaim(c, JwtService.CLAIM_ACTOR)).isEqualTo(1L);
        assertThat(c.getId()).isNotBlank();
        assertThat(JwtService.hasMfa(c)).isFalse();
    }

    @Test
    @DisplayName("exp = min(now + 30 phút, expires_at của phiên)")
    void expiryCappedBySession() {
        Instant soon = Instant.now().plusSeconds(120);
        Claims early = jwtService.extractClaims(jwtService.generateSupportToken(teacher(), null, null, 1L, 7L, soon));
        assertThat(early.getExpiration().toInstant().getEpochSecond()).isCloseTo(soon.getEpochSecond(), within(1L));

        Claims capped = jwtService.extractClaims(jwtService.generateSupportToken(teacher(), null, null, 1L, 7L,
                Instant.now().plusSeconds(7200)));
        long ttl = capped.getExpiration().toInstant().getEpochSecond() - Instant.now().getEpochSecond();
        assertThat(ttl).isBetween(1795L, 1800L);
        assertThat(capped.get("orgId")).isNull();
    }
}
