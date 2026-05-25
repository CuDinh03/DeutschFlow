package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordNounDetails(
        String pluralForm,
        String genitiveForm,
        String nounType,
        List<WordNounDeclensionItem> declensions
) {}
