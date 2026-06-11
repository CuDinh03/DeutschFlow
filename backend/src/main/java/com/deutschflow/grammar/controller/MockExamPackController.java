package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.MockExamPackDetailDto;
import com.deutschflow.grammar.dto.MockExamPackDto;
import com.deutschflow.grammar.service.MockExamPackService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Mock-exam pack catalog for students (checklist D3). Authenticated; paid plans unlock locked packs.
 */
@RestController
@RequestMapping("/api/mock-exams/packs")
@RequiredArgsConstructor
public class MockExamPackController {

    private final MockExamPackService mockExamPackService;

    @GetMapping
    public List<MockExamPackDto> listPacks(@AuthenticationPrincipal User user) {
        return mockExamPackService.listPacks(user.getId());
    }

    @GetMapping("/{packId}")
    public MockExamPackDetailDto getPack(@AuthenticationPrincipal User user, @PathVariable Long packId) {
        return mockExamPackService.getPack(user.getId(), packId);
    }
}
