package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.GrammarArticleDto;
import com.deutschflow.grammar.dto.GrammarCaseDto;
import com.deutschflow.grammar.dto.GrammarCaseExampleDto;
import com.deutschflow.grammar.dto.GrammarCaseExerciseDto;
import com.deutschflow.grammar.service.GrammarCaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/grammar/cases")
public class GrammarCasesController {
    public GrammarCasesController(GrammarCaseService grammarCaseService) {
        this.grammarCaseService = grammarCaseService;
    }


    private final GrammarCaseService grammarCaseService;

    @GetMapping
    public ResponseEntity<List<GrammarCaseDto>> getAllCases() {
        return ResponseEntity.ok(grammarCaseService.getAllCases());
    }

    @GetMapping("/{caseName}")
    public ResponseEntity<GrammarCaseDto> getCaseByName(@PathVariable String caseName) {
        return ResponseEntity.ok(grammarCaseService.getCaseByName(caseName));
    }

    @GetMapping("/{caseId}/examples")
    public ResponseEntity<List<GrammarCaseExampleDto>> getExamples(@PathVariable Long caseId) {
        return ResponseEntity.ok(grammarCaseService.getExamplesByCase(caseId));
    }

    @GetMapping("/{caseId}/exercises")
    public ResponseEntity<List<GrammarCaseExerciseDto>> getExercises(@PathVariable Long caseId) {
        return ResponseEntity.ok(grammarCaseService.getExercisesByCase(caseId));
    }

    @GetMapping("/{caseId}/exercises/difficulty/{level}")
    public ResponseEntity<List<GrammarCaseExerciseDto>> getExercisesByDifficulty(
            @PathVariable Long caseId,
            @PathVariable Integer level) {
        return ResponseEntity.ok(grammarCaseService.getExercisesByCaseAndDifficulty(caseId, level));
    }

    @GetMapping("/articles")
    public ResponseEntity<GrammarArticleDto> getArticle(
            @RequestParam String gender,
            @RequestParam String kasus) {
        return ResponseEntity.ok(grammarCaseService.getArticle(gender, kasus));
    }
}
