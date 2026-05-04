package com.deutschflow.quiz.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.common.security.JwtService;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class QuizJoinServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock com.deutschflow.common.security.JwtService jwtService;

    @InjectMocks
    QuizJoinService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
