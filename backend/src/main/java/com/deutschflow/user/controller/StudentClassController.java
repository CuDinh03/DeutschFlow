package com.deutschflow.user.controller;

import com.deutschflow.teacher.service.TeacherService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v2/student/classes")
@PreAuthorize("hasRole('STUDENT')")
@RequiredArgsConstructor
public class StudentClassController {

    private final TeacherService teacherService;

    @PostMapping("/join")
    public ResponseEntity<Void> joinClass(@AuthenticationPrincipal User user, @RequestBody Map<String, String> payload) {
        String inviteCode = payload.get("inviteCode");
        teacherService.joinClass(user.getId(), inviteCode);
        return ResponseEntity.ok().build();
    }
}
