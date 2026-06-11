package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.TeacherCenterDto;
import com.deutschflow.teacher.service.TeacherCenterService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Teacher self-declares the center they teach at (checklist D11). The org-sales cluster signal in
 * the admin growth dashboard is built from these values for non-org teachers.
 */
@RestController
@RequestMapping("/api/v2/teacher/center")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherCenterController {

    private final TeacherCenterService teacherCenterService;

    @GetMapping
    public TeacherCenterDto get(@AuthenticationPrincipal User teacher) {
        return new TeacherCenterDto(teacherCenterService.getCenter(teacher.getId()));
    }

    @PutMapping
    public TeacherCenterDto set(@AuthenticationPrincipal User teacher, @Valid @RequestBody TeacherCenterDto body) {
        return new TeacherCenterDto(teacherCenterService.setCenter(teacher.getId(), body.centerName()));
    }
}
