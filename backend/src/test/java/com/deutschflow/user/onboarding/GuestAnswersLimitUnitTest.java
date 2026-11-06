package com.deutschflow.user.onboarding;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.onboarding.service.GuestOnboardingServiceLimits;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Chống bot 07/11/2026: phiên khách công khai không được thành kho chứa JSON miễn phí. */
class GuestAnswersLimitUnitTest {

    @Test
    @DisplayName("câu trả lời thật của phễu (vài trăm byte) đi qua")
    void realAnswersPass() {
        Map<String, Object> a = Map.of(
                "targetLevel", "B1", "goalType", "WORK", "industry", "PFLEGE",
                "sessionsPerWeek", 5, "minutesPerSession", 15,
                "interests", List.of("travel", "work"));
        assertThatCode(() -> GuestOnboardingServiceLimits.check(a, "answers")).doesNotThrowAnyException();
        assertThatCode(() -> GuestOnboardingServiceLimits.check(null, "answers")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("chuỗi khổng lồ / quá nhiều khoá / lồng quá sâu ⇒ 400")
    void oversizedRejected() {
        assertThatThrownBy(() -> GuestOnboardingServiceLimits.check(Map.of("x", "a".repeat(20_000)), "answers"))
                .isInstanceOf(BadRequestException.class);

        Map<String, Object> many = new HashMap<>();
        for (int i = 0; i < 100; i++) many.put("k" + i, i);
        assertThatThrownBy(() -> GuestOnboardingServiceLimits.check(many, "answers"))
                .isInstanceOf(BadRequestException.class);

        Map<String, Object> deep = Map.of("a", Map.of("b", Map.of("c", Map.of("d", Map.of("e", Map.of("f", 1))))));
        assertThatThrownBy(() -> GuestOnboardingServiceLimits.check(deep, "activityResult"))
                .isInstanceOf(BadRequestException.class);
    }
}
