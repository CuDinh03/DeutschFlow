package com.deutschflow.vocabulary.galerie;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class GalerieFamilyTest {

    @ParameterizedTest
    @CsvSource({
            "OBJEKT, OBJEKT",
            "objekt, OBJEKT",
            "Leben, LEBEN",
            "HANDLUNG, HANDLUNG",
            "ort, ORT",
            "GEFUEHL_IDEE, GEFUEHL_IDEE",
            "'GEFÜHL & IDEE', GEFUEHL_IDEE",
            "gefühl_idee, GEFUEHL_IDEE",
            "Gefuehl-Idee, GEFUEHL_IDEE",
            "ABSTRACT, GEFUEHL_IDEE",
    })
    @DisplayName("fromLlm chấp nhận các biến thể LLM hay trả")
    void fromLlm_acceptsVariants(String raw, GalerieFamily expected) {
        assertThat(GalerieFamily.fromLlm(raw)).isEqualTo(expected);
    }

    @Test
    @DisplayName("fromLlm trả null cho giá trị lạ / null — caller coi là lỗi parse")
    void fromLlm_rejectsUnknown() {
        assertThat(GalerieFamily.fromLlm("LANDSCAPE")).isNull();
        assertThat(GalerieFamily.fromLlm("")).isNull();
        assertThat(GalerieFamily.fromLlm(null)).isNull();
    }
}
