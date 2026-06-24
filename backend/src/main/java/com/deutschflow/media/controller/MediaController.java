package com.deutschflow.media.controller;

import com.deutschflow.media.dto.MediaAssetDto;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping
@RequiredArgsConstructor
public class MediaController {

    private final MediaAssetService mediaAssetService;

    // Legacy endpoint kept for backward-compat but hardened (audit SEC-8): ADMIN-only, and routed
    // through the validated upload path (content-type allowlist + size cap) instead of a raw,
    // unvalidated write to a public-read bucket that any authenticated user (incl. STUDENT) could hit.
    @PostMapping("/api/media/upload")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> uploadMediaLegacy(@RequestParam("file") MultipartFile file,
                                                                 @AuthenticationPrincipal User user) {
        MediaAsset asset = mediaAssetService.uploadMedia(file, "GENERAL", null, null, user);
        return ResponseEntity.ok(Map.of("url", asset.getUrl()));
    }

    // V2 Enhanced API
    @PostMapping("/api/v2/media/upload")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<MediaAssetDto> uploadMedia(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", defaultValue = "GENERAL") String category,
            @RequestParam(value = "tag", required = false) String tag,
            @RequestParam(value = "altText", required = false) String altText,
            @AuthenticationPrincipal User user) {
        
        MediaAsset asset = mediaAssetService.uploadMedia(file, category, tag, altText, user);
        return ResponseEntity.ok(MediaAssetDto.fromEntity(asset));
    }

    @GetMapping("/api/v2/media")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Page<MediaAssetDto>> listMedia(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @AuthenticationPrincipal User user) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<MediaAsset> assetPage = mediaAssetService.getMediaByCategory(category, pageable, user);
        Page<MediaAssetDto> dtoPage = assetPage.map(MediaAssetDto::fromEntity);
        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/api/v2/media/by-tag")
    public ResponseEntity<MediaAssetDto> getMediaByTag(
            @RequestParam("category") String category,
            @RequestParam("tag") String tag) {
        
        MediaAsset asset = mediaAssetService.getMediaByTag(category, tag);
        return ResponseEntity.ok(MediaAssetDto.fromEntity(asset));
    }

    @GetMapping("/api/v2/media/{id}")
    public ResponseEntity<MediaAssetDto> getMediaById(@PathVariable("id") Long id) {
        MediaAsset asset = mediaAssetService.getMediaById(id);
        return ResponseEntity.ok(MediaAssetDto.fromEntity(asset));
    }

    @DeleteMapping("/api/v2/media/{id}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> deleteMedia(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal User user) {
        
        mediaAssetService.deleteMedia(id, user);
        return ResponseEntity.ok(Map.of("message", "Media asset successfully deleted"));
    }

    @PatchMapping("/api/v2/media/{id}")
    @PreAuthorize("hasRole('TEACHER') or hasRole('ADMIN')")
    public ResponseEntity<MediaAssetDto> updateMediaMetadata(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {
        
        String altText = body.get("altText");
        String tag = body.get("tag");
        MediaAsset updated = mediaAssetService.updateMediaMetadata(id, altText, tag, user);
        return ResponseEntity.ok(MediaAssetDto.fromEntity(updated));
    }
}
