package com.deutschflow.vocabulary.dto;

import java.util.Collections;
import java.util.List;

public record GlosbeLexicalEntry(
        String baseForm,
        String dtype,
        String cefrLevel,
        String phonetic,
        String usageNote,
        String meaningVi,
        String meaningDe,
        String exampleDe,
        String exampleVi,
        String gender,
        String nounPlural,
        String nounGenitive,
        String nounType,
        List<WordNounDeclensionItem> nounDeclensions,
        String verbAuxiliary,
        String verbPartizip2,
        Boolean verbSeparable,
        String verbPrefix,
        Boolean verbIrregular,
        List<WordVerbConjugationItem> verbConjugations,
        List<String> missingFields,
        String sourceUrl
) {
    public GlosbeLexicalEntry {
        nounDeclensions = nounDeclensions == null ? Collections.emptyList() : nounDeclensions;
        verbConjugations = verbConjugations == null ? Collections.emptyList() : verbConjugations;
        missingFields = missingFields == null ? Collections.emptyList() : missingFields;
    }
}
