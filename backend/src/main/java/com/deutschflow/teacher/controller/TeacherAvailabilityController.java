package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TeacherAvailabilityDto;
import com.deutschflow.teacher.service.TeacherAvailabilityService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Teacher weekly-recurring availability ("Lịch dạy"). A teacher reads/writes only their own slots,
 * stored in {@code teacher_profiles.available_slots_json}. Both org and free teachers may set a
 * schedule (unlike the marketplace profile, which is free-teacher only).
 */
@RestController
@RequestMapping("/api/v2/teacher/availability")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherAvailabilityController {

    private final TeacherAvailabilityService availabilityService;

    @GetMapping
    public TeacherAvailabilityDto get(@AuthenticationPrincipal User teacher) {
        return new TeacherAvailabilityDto(availabilityService.getSlots(teacher.getId()));
    }

    @PutMapping
    public TeacherAvailabilityDto set(@AuthenticationPrincipal User teacher,
                                      @RequestBody TeacherAvailabilityDto body) {
        return new TeacherAvailabilityDto(availabilityService.setSlots(teacher.getId(), body.slots()));
    }
}
