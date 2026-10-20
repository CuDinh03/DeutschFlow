package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.service.OccupationCatalogService;
import com.deutschflow.interview.service.OccupationPublicService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PublicOccupationControllerTest {

    @Mock
    private OccupationCatalogService service;

    @Mock
    private OccupationPublicService publicService;

    private MockMvc mvc;

    private static final OccupationDto KELLNER = new OccupationDto("kellner", "Kellner/in", "Waiter / waitress",
            "Phục vụ bàn", "gastro", List.of("kellner"), OccupationDto.CURATED);

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new PublicOccupationController(service, publicService)).build();
    }

    @Test
    void list_returnsCatalogWithPublicCacheHeader() throws Exception {
        when(service.list()).thenReturn(List.of(KELLNER));

        mvc.perform(get("/api/public/occupations"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("public")))
                .andExpect(header().string("Cache-Control", containsString("max-age=600")))
                .andExpect(jsonPath("$[0].code").value("kellner"))
                .andExpect(jsonPath("$[0].questionSet").value("CURATED"));
    }

    @Test
    void detail_returnsSampleQuestions() throws Exception {
        when(publicService.detail("kellner")).thenReturn(Optional.of(new OccupationDetailDto(KELLNER, "NIKLAS",
                "Kellner/in", List.of(new OccupationDetailDto.SampleQuestion("HARD_SKILLS", "Frage", "BANK")),
                true, List.of(), List.of(new OccupationDetailDto.Term("die Bestellung", "order", "đơn gọi món",
                        null, "AI_GENERATED")))));

        mvc.perform(get("/api/public/occupations/kellner"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personaCode").value("NIKLAS"))
                .andExpect(jsonPath("$.interviewPosition").value("Kellner/in"))
                .andExpect(header().string("Cache-Control", containsString("public")))
                .andExpect(jsonPath("$.sampleQuestions[0].questionDe").value("Frage"))
                .andExpect(jsonPath("$.sampleQuestions[0].source").value("BANK"))
                .andExpect(jsonPath("$.reviewed").value(true))
                .andExpect(jsonPath("$.terms[0].meaningVi").value("đơn gọi món"))
                .andExpect(jsonPath("$.terms[0].status").value("AI_GENERATED"));
    }

    @Test
    void detail_unknownCode_is404() throws Exception {
        when(publicService.detail("astronaut")).thenReturn(Optional.empty());

        mvc.perform(get("/api/public/occupations/astronaut")).andExpect(status().isNotFound());
    }
}
