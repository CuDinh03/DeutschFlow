package com.deutschflow.teacher.dto;

import jakarta.validation.constraints.Size;

/**
 * A teacher's self-declared teaching center (D11). Used for both GET and PUT of the center field.
 *
 * <p>{@code @Size} is enforced on PUT (the controller param is {@code @Valid}); the GET response is
 * constructed directly in Java, so legacy values longer than the cap are still readable.
 */
public record TeacherCenterDto(
        @Size(max = 255, message = "centerName must be at most 255 characters")
        String centerName) {}
