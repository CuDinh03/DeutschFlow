package com.deutschflow.aiimage.controller;

import com.deutschflow.aiimage.dto.AiImageGenerateRequest;
import com.deutschflow.aiimage.dto.AiImageGenerateResponse;
import com.deutschflow.aiimage.service.AiImageGenerationService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v2/ai-images")
@RequiredArgsConstructor
public class AiImageGenerationController {

    private final AiImageGenerationService aiImageGenerationService;

    @PostMapping("/generate")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<AiImageGenerateResponse> generate(
            @Valid @RequestBody AiImageGenerateRequest request,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(aiImageGenerationService.generate(request, user));
    }
}
