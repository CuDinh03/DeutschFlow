package com.deutschflow.media.controller;

import com.deutschflow.media.service.S3StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final S3StorageService s3StorageService;

    @PostMapping("/upload")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> uploadMedia(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3StorageService.uploadFile(file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to upload file"));
        }
    }
}
