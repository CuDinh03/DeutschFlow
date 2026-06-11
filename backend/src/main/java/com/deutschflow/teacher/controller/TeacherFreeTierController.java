package com.deutschflow.teacher.controller;

import com.deutschflow.teacher.dto.FreeTierStatusDto;
import com.deutschflow.teacher.service.TeacherFreeTierService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The current teacher's plan status (free tier vs org) and today's expensive-AI allowance (D6²). */
@RestController
@RequestMapping("/api/v2/teacher")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class TeacherFreeTierController {

    private final TeacherFreeTierService teacherFreeTierService;

    @GetMapping("/free-tier-status")
    public FreeTierStatusDto status(@AuthenticationPrincipal User teacher) {
        return teacherFreeTierService.status(teacher.getId());
    }
}
