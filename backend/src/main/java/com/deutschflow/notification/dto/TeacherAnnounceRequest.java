package com.deutschflow.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TeacherAnnounceRequest(
        @NotNull Long classId,
        @NotBlank String message
) {}
