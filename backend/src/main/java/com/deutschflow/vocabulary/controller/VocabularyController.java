package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.WordDto;
import com.deutschflow.vocabulary.dto.GrammarContextDto;
import com.deutschflow.vocabulary.service.VocabularyService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vocabulary")
@CrossOrigin(origins = "${app.cors.allowed-origins:*}")
public class VocabularyController {

    private final VocabularyService vocabularyService;

    public VocabularyController(VocabularyService vocabularyService) {
        this.vocabularyService = vocabularyService;
    }

    @GetMapping("/words")
    public ResponseEntity<List<WordDto>> getWordsByCefr(
            @RequestParam(required = false) String cefrLevel) {
        List<WordDto> words = vocabularyService.getWordsByCefr(cefrLevel);
        return ResponseEntity.ok(words);
    }

    @GetMapping("/{wordId}/grammar-context")
    public ResponseEntity<GrammarContextDto> getGrammarContext(
            @PathVariable Long wordId) {
        GrammarContextDto context = vocabularyService.getGrammarContext(wordId);
        return ResponseEntity.ok(context);
    }

    @GetMapping("/{wordId}")
    public ResponseEntity<WordDto> getWordById(@PathVariable Long wordId) {
        WordDto word = vocabularyService.getWordById(wordId);
        return ResponseEntity.ok(word);
    }
}
