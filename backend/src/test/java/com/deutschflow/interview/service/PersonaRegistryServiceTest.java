package com.deutschflow.interview.service;

import com.deutschflow.interview.entity.InterviewPersonaEntity;
import com.deutschflow.interview.repository.InterviewPersonaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class PersonaRegistryServiceTest {

    @Mock
    private InterviewPersonaRepository personaRepository;

    private PersonaRegistryService service;

    @BeforeEach
    void setUp() {
        service = new PersonaRegistryService(personaRepository, new ObjectMapper());
    }

    @Test
    void topicPoolsFor_parsesArrayOfArrays() {
        stubPools("LUKAS", "[[\"A\",\"B\"],[\"C\",\"D\"]]");

        Optional<List<List<String>>> pools = service.topicPoolsFor("LUKAS");

        assertThat(pools).isPresent();
        assertThat(pools.get()).containsExactly(List.of("A", "B"), List.of("C", "D"));
    }

    @Test
    void topicPoolsFor_uppercasesCode() {
        stubPools("LUKAS", "[[\"A\"]]");

        assertThat(service.topicPoolsFor("lukas")).isPresent();
    }

    @Test
    void topicPoolsFor_emptyWhenPersonaNotFound() {
        lenient().when(personaRepository.findByCodeAndActiveTrue("UNKNOWN")).thenReturn(Optional.empty());

        assertThat(service.topicPoolsFor("UNKNOWN")).isEmpty();
    }

    @Test
    void topicPoolsFor_emptyWhenColumnNull() {
        stubPools("LENA", null);

        assertThat(service.topicPoolsFor("LENA")).isEmpty();
    }

    @Test
    void topicPoolsFor_emptyWhenColumnBlank() {
        stubPools("LENA", "   ");

        assertThat(service.topicPoolsFor("LENA")).isEmpty();
    }

    @Test
    void topicPoolsFor_emptyWhenJsonEmptyArray() {
        stubPools("LENA", "[]");

        assertThat(service.topicPoolsFor("LENA")).isEmpty();
    }

    @Test
    void topicPoolsFor_emptyOnMalformedJson_doesNotThrow() {
        stubPools("LENA", "not-json");

        assertThat(service.topicPoolsFor("LENA")).isEmpty();
    }

    @Test
    void topicPoolsFor_emptyForNullOrBlankCode() {
        assertThat(service.topicPoolsFor(null)).isEmpty();
        assertThat(service.topicPoolsFor("  ")).isEmpty();
    }

    private void stubPools(String code, String json) {
        InterviewPersonaEntity entity = InterviewPersonaEntity.builder()
                .code(code)
                .topicPoolsJson(json)
                .build();
        lenient().when(personaRepository.findByCodeAndActiveTrue(code)).thenReturn(Optional.of(entity));
    }
}
