package com.deutschflow.user.controller;

import com.deutschflow.user.dto.StudentDashboardResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.StudentDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentDashboardController {

    private final StudentDashboardService studentDashboardService;

    @GetMapping("/dashboard")
    public StudentDashboardResponse dashboard(@AuthenticationPrincipal User user) {
        return studentDashboardService.getDashboard(user);
    }
}
