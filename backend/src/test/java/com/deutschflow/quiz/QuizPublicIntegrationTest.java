package com.deutschflow.quiz;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class QuizPublicIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void loggedInUser_cannotSubmitScoreForAnotherParticipantsSession() throws Exception {
        User teacher = userRepository.save(teacher("t-quiz-" + System.nanoTime() + "@test.local", "T"));
        User alice = userRepository.save(student("a-quiz-" + System.nanoTime() + "@test.local", "Alice"));
        User bob = userRepository.save(student("b-quiz-" + System.nanoTime() + "@test.local", "Bob"));
        userRepository.flush();

        String pin = pinCode();
        Long quizId = jdbcTemplate.queryForObject("""
                INSERT INTO quizzes (teacher_id, classroom_id, title, quiz_type, pin_code, status, created_at)
                VALUES (?, NULL, 'IT Quiz', 'COLOR_RACE', ?, 'ACTIVE', NOW())
                RETURNING id
                """, Long.class, teacher.getId(), pin);

        mockMvc.perform(post("/api/quiz/{pin}/join", pin)
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"AliceNick\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/quiz/{quizId}/submit", quizId)
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participant\":\"AliceNick\",\"totalScore\":10}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/quiz/{quizId}/submit", quizId)
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(bob))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participant\":\"AliceNick\",\"totalScore\":99}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void guest_canSubmit_ownNickname_only() throws Exception {
        User teacher = userRepository.save(teacher("t-guest-" + System.nanoTime() + "@test.local", "TG"));
        userRepository.flush();

        String pin = pinCode();
        Long quizId = jdbcTemplate.queryForObject("""
                INSERT INTO quizzes (teacher_id, classroom_id, title, quiz_type, pin_code, status, created_at)
                VALUES (?, NULL, 'IT Guest Quiz', 'COLOR_RACE', ?, 'WAITING', NOW())
                RETURNING id
                """, Long.class, teacher.getId(), pin);

        String joinBody = mockMvc.perform(post("/api/quiz/{pin}/join", pin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"GuestOne\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.guestAccessToken").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode node = objectMapper.readTree(joinBody);
        String guestToken = node.path("guestAccessToken").asText();

        mockMvc.perform(post("/api/quiz/{quizId}/submit", quizId)
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participant\":\"GuestOne\",\"totalScore\":7}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/quiz/{quizId}/submit", quizId)
                        .header("Authorization", "Bearer " + guestToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"participant\":\"SomeoneElse\",\"totalScore\":3}"))
                .andExpect(status().isBadRequest());
    }

    private static String pinCode() {
        long n = Math.abs(System.nanoTime() % 900_000_000L) + 100_000_000L;
        return String.valueOf(n);
    }

    private static User student(String email, String name) {
        return User.builder()
                .email(email)
                .passwordHash("$2a$10$hashhashhashhashhashhashhashhash")
                .displayName(name)
                .role(User.Role.STUDENT)
                .build();
    }

    private static User teacher(String email, String name) {
        return User.builder()
                .email(email)
                .passwordHash("$2a$10$hashhashhashhashhashhashhashhash")
                .displayName(name)
                .role(User.Role.TEACHER)
                .build();
    }
}
