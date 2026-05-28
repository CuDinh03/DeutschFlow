package com.deutschflow.speaking.dto;

public record SubmitResponseRequest(
        String userInput,
        Integer confidence
) {}
