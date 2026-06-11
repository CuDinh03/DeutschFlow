package com.deutschflow.grammar.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.grammar.dto.MockExamPackDetailDto;
import com.deutschflow.grammar.service.MockExamPackService;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Auth + behaviour for {@code GET /api/mock-exams/packs/{id}} (D3). The endpoint is
 * authenticated-only (it falls through to {@code anyRequest().authenticated()}); the per-user
 * paid-gate is enforced in the service, so a locked pack surfaces as 403 and a missing one as 404
 * via the {@code @ResponseStatus} exceptions.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("MockExamPackController")
class MockExamPackControllerTest {

    @Mock MockExamPackService mockExamPackService;
    @InjectMocks MockExamPackController controller;

    private final User student = User.builder()
            .id(9L).email("hs@deutschflow.com").role(User.Role.STUDENT)
            .displayName("Học Viên").passwordHash("hashed").build();

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, student);
    }

    @Test
    @DisplayName("accessible pack: 200 with the pack's exams")
    void getPack_accessible_returnsDetail() throws Exception {
        when(mockExamPackService.getPack(anyLong(), eq(1L))).thenReturn(new MockExamPackDetailDto(
                1L, "Goethe B1", "desc", "B1", "GOETHE",
                List.of(new MockExamPackDetailDto.PackExamDto(10L, "Đề 1", 100, 60, 165))));

        mvc.perform(get("/api/mock-exams/packs/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cefrLevel").value("B1"))
                .andExpect(jsonPath("$.exams[0].title").value("Đề 1"));
    }

    @Test
    @DisplayName("pack locked for this user (paid-gate): 403")
    void getPack_locked_returns403() throws Exception {
        when(mockExamPackService.getPack(anyLong(), eq(2L)))
                .thenThrow(new ForbiddenException("Nâng cấp gói để mở khoá bộ đề luyện thi này."));

        mvc.perform(get("/api/mock-exams/packs/2")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("unknown pack: 404")
    void getPack_missing_returns404() throws Exception {
        when(mockExamPackService.getPack(anyLong(), eq(99L)))
                .thenThrow(new NotFoundException("Không tìm thấy bộ đề"));

        mvc.perform(get("/api/mock-exams/packs/99")).andExpect(status().isNotFound());
    }
}
