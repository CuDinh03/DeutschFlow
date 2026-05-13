package com.deutschflow.teacher.controller;

import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.teacher.service.TeacherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

import com.deutschflow.user.entity.User;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
public class ClassController {

    private final TeacherService teacherService;

    @PostMapping("/join")
    public ResponseEntity<Void> joinClass(@AuthenticationPrincipal User user, @RequestBody Map<String, String> payload) {
        String inviteCode = payload.get("inviteCode");
        teacherService.joinClass(user.getId(), inviteCode);
        return ResponseEntity.ok().build();
    }
}
