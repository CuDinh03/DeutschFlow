package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.WordCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordCoverageResponse;
import com.deutschflow.vocabulary.dto.WordListResponse;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageHistoryResponse;
import com.deutschflow.vocabulary.dto.WordTranslationCoverageResponse;
import com.deutschflow.vocabulary.service.WordQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/words")
@RequiredArgsConstructor
public class WordController {

    private final WordQueryService wordQueryService;

    @GetMapping
    public WordListResponse list(
            @RequestParam(required = false) String cefr,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String dtype,
            @RequestParam(required = false) String gender,
            @RequestParam(required = false) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return wordQueryService.listWords(cefr, q, tag, dtype, gender, locale, page, size);
    }

    @GetMapping("/coverage")
    public WordCoverageResponse coverage() {
        return wordQueryService.coverage();
    }

    @GetMapping("/coverage/history")
    public WordCoverageHistoryResponse coverageHistory(
            @RequestParam(defaultValue = "30") int days
    ) {
        return wordQueryService.coverageHistory(days);
    }

    @GetMapping("/coverage/translation")
    public WordTranslationCoverageResponse translationCoverage() {
        return wordQueryService.translationCoverage();
    }

    @GetMapping("/coverage/translation/history")
    public WordTranslationCoverageHistoryResponse translationCoverageHistory(
            @RequestParam(defaultValue = "30") int days
    ) {
        return wordQueryService.translationCoverageHistory(days);
    }
}

