package com.deutschflow.curriculum.controller;

import com.deutschflow.curriculum.dto.CurriculumCourse;
import com.deutschflow.curriculum.service.CurriculumService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/curriculum")
@RequiredArgsConstructor
public class CurriculumController {

    private final CurriculumService curriculumService;

    @GetMapping("/netzwerk-neu/a1")
    public CurriculumCourse netzwerkNeuA1() {
        return curriculumService.getNetzwerkNeuA1();
    }
}

