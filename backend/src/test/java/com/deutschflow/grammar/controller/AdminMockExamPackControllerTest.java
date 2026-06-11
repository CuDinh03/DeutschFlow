package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.CreateMockExamPackRequest;
import com.deutschflow.grammar.dto.MockExamPackAdminDto;
import com.deutschflow.grammar.service.AdminMockExamPackService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Behaviour for the ADMIN mock-exam-pack CRUD controller (D3) via standalone MockMvc. The runtime
 * {@code @PreAuthorize("hasRole('ADMIN')")} gate (TEACHER → 403, anonymous → 401) is locked through
 * the real security chain by {@code com.deutschflow.security.MockExamPackRbacTest}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AdminMockExamPackController")
class AdminMockExamPackControllerTest {

    @Mock AdminMockExamPackService adminMockExamPackService;
    @InjectMocks AdminMockExamPackController controller;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller);
    }

    /** createdAt = null: standalone MockMvc's Jackson has no JavaTimeModule (Instant would fail). */
    private MockExamPackAdminDto dto(long id, String title) {
        return new MockExamPackAdminDto(id, title, null, "B1", "GOETHE", true, true, 1, 0, null);
    }

    @Test
    @DisplayName("POST — 200 with the created pack")
    void create_returnsDto() throws Exception {
        when(adminMockExamPackService.create(any(CreateMockExamPackRequest.class))).thenReturn(dto(1L, "Goethe B1"));
        CreateMockExamPackRequest req = new CreateMockExamPackRequest("Goethe B1", null, "B1", "GOETHE", true, 1);

        mvc.perform(post("/api/admin/mock-exam-packs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Goethe B1"))
                .andExpect(jsonPath("$.cefrLevel").value("B1"));
    }

    @Test
    @DisplayName("GET — 200 with all packs (active + inactive)")
    void list_returnsPacks() throws Exception {
        when(adminMockExamPackService.list()).thenReturn(List.of(dto(1L, "B1 pack"), dto(2L, "B2 pack")));

        mvc.perform(get("/api/admin/mock-exam-packs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].title").value("B1 pack"));
    }
}
