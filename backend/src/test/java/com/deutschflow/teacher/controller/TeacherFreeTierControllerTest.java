package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.FreeTierStatusDto;
import com.deutschflow.teacher.service.TeacherFreeTierService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Behaviour for {@code GET /api/v2/teacher/free-tier-status} (D6²) via standalone MockMvc.
 *
 * <p>The runtime {@code @PreAuthorize("hasRole('TEACHER')")} role-gate (STUDENT → 403,
 * anonymous → 401) is locked through the real security chain by
 * {@code com.deutschflow.security.MockExamPackRbacTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("TeacherFreeTierController")
class TeacherFreeTierControllerTest {

    @Mock TeacherFreeTierService teacherFreeTierService;
    @InjectMocks TeacherFreeTierController controller;

    private final User teacher = User.builder()
            .id(5L).email("gv@deutschflow.com").role(User.Role.TEACHER)
            .displayName("Cô Giáo").passwordHash("hashed").build();

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, teacher);
    }

    @Test
    @DisplayName("authenticated teacher: 200 with daily-allowance body")
    void status_returnsBody() throws Exception {
        when(teacherFreeTierService.status(anyLong()))
                .thenReturn(new FreeTierStatusDto(true, 3, 1, 5, 0));

        mvc.perform(get("/api/v2/teacher/free-tier-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.freeTier").value(true))
                .andExpect(jsonPath("$.pptxDaily").value(3))
                .andExpect(jsonPath("$.ocrUsedToday").value(0));
    }
}
