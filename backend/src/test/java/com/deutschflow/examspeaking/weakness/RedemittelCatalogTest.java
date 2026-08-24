package com.deutschflow.examspeaking.weakness;

import com.deutschflow.examspeaking.api.model.TaskArchetype;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RedemittelCatalogTest {

    private final RedemittelCatalog catalog = new RedemittelCatalog(new ObjectMapper());

    @Test
    void everyArchetypeHasBothBands() {
        for (TaskArchetype a : TaskArchetype.values()) {
            assertThat(catalog.packsFor("A1", List.of(a.name())))
                    .as("A1_A2 pack cho " + a).isNotEmpty();
            assertThat(catalog.packsFor("B2", List.of(a.name())))
                    .as("B1_B2 pack cho " + a).isNotEmpty();
        }
    }

    @Test
    void bandMapping() {
        assertThat(RedemittelCatalog.bandFor("A1")).isEqualTo("A1_A2");
        assertThat(RedemittelCatalog.bandFor("a2")).isEqualTo("A1_A2");
        assertThat(RedemittelCatalog.bandFor("B1")).isEqualTo("B1_B2");
        assertThat(RedemittelCatalog.bandFor("C1")).isEqualTo("B1_B2");
        assertThat(RedemittelCatalog.bandFor(null)).isEqualTo("B1_B2");
    }

    @Test
    void emptyArchetypesReturnsAllPacksOfBand() {
        List<RedemittelCatalog.Pack> all = catalog.packsFor("B1", List.of());
        assertThat(all).hasSize(TaskArchetype.values().length);
        assertThat(all).allMatch(p -> p.band().equals("B1_B2"));
        assertThat(all).allMatch(p -> !p.phrases().isEmpty());
    }

    @Test
    void filtersByRequestedArchetypes() {
        List<RedemittelCatalog.Pack> packs = catalog.packsFor("B2", Set.of("DISCUSS", "PRESENT"));
        assertThat(packs).hasSize(2);
        assertThat(packs).extracting(RedemittelCatalog.Pack::archetype)
                .containsExactlyInAnyOrder("DISCUSS", "PRESENT");
    }
}
