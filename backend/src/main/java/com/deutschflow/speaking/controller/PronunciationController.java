package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.service.PronunciationScorerService;
import com.deutschflow.speaking.service.PronunciationScorerService.PronunciationScore;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * POST /api/speaking/pronunciation-check
 *
 * Accepts a multipart audio file + expected text, returns per-word pronunciation scores.
 */
@RestController
@RequestMapping("/api/speaking")
@RequiredArgsConstructor
public class PronunciationController {

    private final PronunciationScorerService scorerService;

    @PostMapping("/pronunciation-check")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PronunciationScore> check(
            @RequestPart("audio") MultipartFile audio,
            @RequestPart("expectedText") @NotBlank @Size(max = 500) String expectedText) throws IOException {

        byte[] bytes = audio.getBytes();
        if (bytes.length == 0) {
            return ResponseEntity.badRequest().build();
        }

        PronunciationScore result = scorerService.score(bytes, expectedText);
        return ResponseEntity.ok(result);
    }
}
