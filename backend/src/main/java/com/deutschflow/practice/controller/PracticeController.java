package com.deutschflow.practice.controller;

import com.deutschflow.practice.dto.PracticeExerciseDto;
import com.deutschflow.practice.dto.PracticeSubmitRequest;
import com.deutschflow.practice.service.PracticeService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/practice")
@RequiredArgsConstructor
public class PracticeController {

    private final PracticeService practiceService;

    @GetMapping("/exercises")
    public ResponseEntity<Page<PracticeExerciseDto>> getExercises(
            @RequestParam(required = false) String exerciseType,
            @RequestParam(required = false) String cefrLevel,
            @RequestParam(required = false) String skillType,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(practiceService.getExercises(exerciseType, cefrLevel, skillType, pageable));
    }

    @GetMapping("/exercises/{id}")
    public ResponseEntity<PracticeExerciseDto> getExerciseById(@PathVariable Long id) {
        return ResponseEntity.ok(practiceService.getExerciseById(id));
    }

    @PostMapping("/submit")
    public ResponseEntity<Void> submitPracticeResult(
            @AuthenticationPrincipal User user,
            @RequestBody PracticeSubmitRequest request) {
        practiceService.submitPracticeResult(user.getId(), request);
        return ResponseEntity.ok().build();
    }
}
