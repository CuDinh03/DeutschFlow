package com.deutschflow.quiz.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.jdbc.core.JdbcTemplate;
import com.deutschflow.user.repository.UserRepository;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class TeacherClassroomServiceUnitTest {
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
    @Mock com.deutschflow.user.repository.UserRepository userRepository;

    @InjectMocks
    TeacherClassroomService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
