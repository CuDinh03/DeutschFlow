package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.InterviewPersonaDto;
import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.service.PersonaRegistryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewControllerPersonasTest {

    @Mock
    private PersonaRegistryService personaRegistryService;

    @InjectMocks
    private InterviewController controller;

    private static InterviewPersonaEntity persona(String code) {
        return InterviewPersonaEntity.builder().code(code).label(code).build();
    }

    @Test
    void listPersonas_hidesWorkplaceInterviewers_soOldAppsNeverSeeUnknownCodes() {
        when(personaRegistryService.listActive()).thenReturn(
                List.of(persona("LUKAS"), persona("KRUEGER"), persona("KLAUS"), persona("BRANDT")));

        List<InterviewPersonaDto> body = controller.listPersonas().getBody();

        assertThat(body).extracting(InterviewPersonaDto::code).containsExactly("LUKAS", "KLAUS");
    }
}
