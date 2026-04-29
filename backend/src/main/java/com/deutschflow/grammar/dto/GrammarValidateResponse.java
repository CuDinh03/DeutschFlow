package com.deutschflow.grammar.dto;

import java.util.List;

public record GrammarValidateResponse(
        boolean valid,
        int scorePercent,
        List<ValidationError> errors
) {
    public record ValidationError(
            String code,
            String message,
            Integer position,
            String expectedToken,
            String actualToken
    ) {}
}
