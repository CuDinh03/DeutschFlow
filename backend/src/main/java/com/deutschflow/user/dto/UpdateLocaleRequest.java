package com.deutschflow.user.dto;

import jakarta.validation.constraints.Pattern;

public record UpdateLocaleRequest(
        @Pattern(regexp = "vi|en|de", message = "locale must be vi, en, or de")
        String locale
) {}
