package com.deutschflow.vocabulary.dto;

import java.util.List;

public record WordVerbDetails(
        String auxiliaryVerb,
        String partizip2,
        Boolean isSeparable,
        String prefix,
        Boolean isIrregular,
        List<WordVerbConjugationItem> conjugations
) {}
