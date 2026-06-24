package com.deutschflow.media.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.MediaAssetAccessPolicy;
import com.deutschflow.media.MediaCategory;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.repository.MediaAssetRepository;
import com.deutschflow.user.entity.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaAssetService {

    private final MediaAssetRepository mediaAssetRepository;
    private final S3StorageService s3StorageService;
    private final EntityManager entityManager;

    private static final List<String> ALLOWED_CONTENT_TYPES = Arrays.asList(
            // image/svg+xml intentionally excluded (audit SEC-9): SVG can carry <script> → stored XSS
            // on the public-read media bucket served inline.
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"
    );

    @Transactional
    public MediaAsset uploadMedia(MultipartFile file, String category, String tag, String altText, User user) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File cannot be empty");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Invalid file type. Only standard image files are allowed.");
        }

        if (file.getSize() > 5L * 1024 * 1024) {
            throw new BadRequestException("File size exceeds the limit of 5MB");
        }

        MediaCategory mediaCategory = MediaCategory.parse(category);
        MediaAssetAccessPolicy.requireUploadAllowed(user, mediaCategory);

        String normalizedCategory = mediaCategory.name();
        String normalizedTag = tag != null && !tag.isBlank() ? tag.trim() : null;

        if (normalizedTag != null) {
            mediaAssetRepository.findByCategoryAndTag(normalizedCategory, normalizedTag)
                    .ifPresent(existing -> replaceExistingAsset(existing, user));
        }

        try {
            S3StorageService.S3UploadResult s3Result = s3StorageService.uploadFile(file, normalizedCategory);

            MediaAsset asset = MediaAsset.builder()
                    .s3Key(s3Result.getS3Key())
                    .url(s3Result.getUrl())
                    .originalName(file.getOriginalFilename())
                    .contentType(contentType)
                    .fileSize(file.getSize())
                    .category(normalizedCategory)
                    .scope("SYSTEM")
                    .source("UPLOADED")
                    .style(null)
                    .tag(normalizedTag)
                    .altText(altText != null ? altText.trim() : null)
                    .uploadedBy(user)
                    .build();

            log.info("Saving media asset metadata in database: {}", s3Result.getS3Key());
            return mediaAssetRepository.save(asset);
        } catch (IOException e) {
            log.error("Failed to upload image to S3", e);
            throw new RuntimeException("Could not upload image: " + e.getMessage());
        }
    }

    private void replaceExistingAsset(MediaAsset existing, User user) {
        if (!MediaAssetAccessPolicy.isAdmin(user) && !MediaAssetAccessPolicy.isUploader(user, existing)) {
            throw new ForbiddenException(
                    "Tag \"" + existing.getTag() + "\" is already used in category " + existing.getCategory());
        }
        s3StorageService.deleteFile(existing.getS3Key());
        mediaAssetRepository.delete(existing);
        entityManager.flush();
        log.info("Replaced existing media asset for tag: {} / {}", existing.getCategory(), existing.getTag());
    }

    public MediaAsset getMediaById(Long id) {
        return mediaAssetRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Media asset not found with id: " + id));
    }

    public Page<MediaAsset> getMediaByCategory(String category, Pageable pageable, User user) {
        if (user != null && user.getRole() == User.Role.TEACHER) {
            return listForTeacher(category, pageable, user.getId());
        }
        if (category == null || category.trim().isEmpty()) {
            return mediaAssetRepository.findAll(pageable);
        }
        return mediaAssetRepository.findByCategory(category.trim().toUpperCase(), pageable);
    }

    private Page<MediaAsset> listForTeacher(String category, Pageable pageable, Long userId) {
        if (category == null || category.trim().isEmpty() || "ALL".equalsIgnoreCase(category.trim())) {
            return mediaAssetRepository.findByUploadedById(userId, pageable);
        }
        return mediaAssetRepository.findByUploadedByIdAndCategory(
                userId, category.trim().toUpperCase(), pageable);
    }

    public MediaAsset getMediaByTag(String category, String tag) {
        if (category == null || tag == null) {
            throw new BadRequestException("Category and tag parameters are required");
        }
        return mediaAssetRepository.findByCategoryAndTag(category.trim().toUpperCase(), tag.trim())
                .orElseThrow(() -> new NotFoundException(
                        "No media asset found with category: " + category + " and tag: " + tag));
    }

    @Transactional
    public void deleteMedia(Long id, User user) {
        MediaAsset asset = getMediaById(id);
        MediaAssetAccessPolicy.requireDeleteAllowed(user, asset);
        s3StorageService.deleteFile(asset.getS3Key());
        mediaAssetRepository.delete(asset);
        log.info("Successfully deleted media asset: {} (ID: {})", asset.getS3Key(), id);
    }

    /**
     * Persists metadata for an asset whose bytes were produced externally
     * (e.g. AI image generation). The caller is responsible for uploading
     * bytes to S3 before calling this method.
     */
    @Transactional
    public MediaAsset registerGeneratedAsset(String s3Key, String url, String originalName,
                                             String contentType, long fileSize, String category,
                                             String scope, String source, String style,
                                             String altText, User uploadedBy) {
        MediaAsset asset = MediaAsset.builder()
                .s3Key(s3Key)
                .url(url)
                .originalName(originalName)
                .contentType(contentType)
                .fileSize(fileSize)
                .category(category)
                .scope(scope)
                .source(source)
                .style(style)
                .altText(altText)
                .uploadedBy(uploadedBy)
                .build();
        return mediaAssetRepository.save(asset);
    }

    @Transactional
    public MediaAsset updateMediaMetadata(Long id, String altText, String tag, User user) {
        MediaAsset asset = getMediaById(id);
        MediaAssetAccessPolicy.requireUpdateAllowed(user, asset);

        if (altText != null) {
            asset.setAltText(altText.trim());
        }
        if (tag != null) {
            String newTag = tag.trim().isEmpty() ? null : tag.trim();
            if (newTag != null && !newTag.equals(asset.getTag())) {
                String category = asset.getCategory();
                mediaAssetRepository.findByCategoryAndTag(category, newTag)
                        .filter(other -> !other.getId().equals(asset.getId()))
                        .ifPresent(other -> {
                            throw new BadRequestException(
                                    "Another asset already uses tag \"" + newTag + "\" in category " + category);
                        });
            }
            asset.setTag(newTag);
        }

        return mediaAssetRepository.save(asset);
    }
}
