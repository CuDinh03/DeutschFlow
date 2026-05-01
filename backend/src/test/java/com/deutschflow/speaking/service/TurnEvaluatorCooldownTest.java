package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.entity.SpeakingUserState;
import com.deutschflow.speaking.repository.SpeakingUserStateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.speaking.adaptive.enabled=true"
})
class TurnEvaluatorCooldownTest {

    @Autowired TurnEvaluatorService turnEvaluatorService;
    @Autowired SpeakingUserStateRepository stateRepository;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;

    @Test
    void recordTurn_afterThreeCleanTurns_cooldownsFocusCode() {
        User u = userRepository.save(User.builder()
                .email("cooldown_test+" + UUID.randomUUID() + "@example.com")
                .passwordHash("x")
                .displayName("Cooldown Test")
                .role(User.Role.STUDENT)
                .build());
        long userId = u.getId();
        stateRepository.save(SpeakingUserState.builder().userId(userId).build());

        SpeakingPolicy policy = new SpeakingPolicy(
                true, "B1", 0,
                List.of("CASE.PREP_DAT_MIT"),
                List.of(),
                List.of(),
                null,
                false,
                null,
                "test"
        );

        AiResponseDto clean = new AiResponseDto("Ok", null, null, null, null, null, List.of());

        turnEvaluatorService.recordTurn(userId, 1L, 101L, clean, policy);
        turnEvaluatorService.recordTurn(userId, 1L, 102L, clean, policy);
        turnEvaluatorService.recordTurn(userId, 1L, 103L, clean, policy);

        SpeakingUserState state = stateRepository.findById(userId).orElseThrow();
        String json = state.getCooldownCodesJson();
        assertThat(json).isNotBlank();
        assertThat(json).contains("CASE.PREP_DAT_MIT");
    }
}

