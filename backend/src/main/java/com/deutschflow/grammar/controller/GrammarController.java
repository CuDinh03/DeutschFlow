package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.GrammarValidateRequest;
import com.deutschflow.grammar.dto.GrammarValidateResponse;
import com.deutschflow.grammar.service.LegoGrammarValidatorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/grammar")
@RequiredArgsConstructor
public class GrammarController {

    private final LegoGrammarValidatorService legoGrammarValidatorService;

    @PostMapping("/validate")
    public GrammarValidateResponse validate(@Valid @RequestBody GrammarValidateRequest request) {
        return legoGrammarValidatorService.validate(request);
    }
}
