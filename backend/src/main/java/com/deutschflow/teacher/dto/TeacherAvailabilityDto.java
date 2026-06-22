package com.deutschflow.teacher.dto;

import java.util.List;

/** A teacher's weekly availability — used for both the GET response and the PUT request body. */
public record TeacherAvailabilityDto(List<AvailabilitySlot> slots) {}
