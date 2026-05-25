package com.deutschflow.vocabulary.service;

import com.deutschflow.aiimage.service.UnsplashImageService;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.service.MediaAssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VocabularyImageGeneratorService {

    private final MediaAssetService mediaAssetService;
    private final VocabularyImageService vocabularyImageService;
    private final ObjectProvider<UnsplashImageService> unsplashImageServiceProvider;

    @Transactional
    public MediaAsset generateAndApply(long wordId, String baseForm, String meaning, String dtype, String personaStyle) {
        String query = buildQuery(baseForm, meaning, dtype, personaStyle);
        String prompt = buildPrompt(baseForm, meaning, dtype, personaStyle);
        return generateAndApply(wordId, baseForm, meaning, dtype, personaStyle, query, null, prompt);
    }

    @Transactional
    public MediaAsset generateAndApply(long wordId,
                                       String baseForm,
                                       String meaning,
                                       String dtype,
                                       String personaStyle,
                                       String queryUsed,
                                       String unsplashId,
                                       String promptContext) {
        String query = normalizeQueryFallback(queryUsed, baseForm, meaning, dtype, personaStyle);
        String prompt = normalizePromptFallback(promptContext, baseForm, meaning, dtype, personaStyle);

        UnsplashImageService unsplashImageService = unsplashImageServiceProvider.getIfAvailable();
        if (unsplashImageService == null) {
            throw new IllegalStateException("Unsplash image service is disabled or not configured.");
        }

        List<UnsplashImageService.UnsplashImageResult> results = unsplashImageService.search(query, 1, 10);
        if (results.isEmpty()) {
            throw new IllegalStateException("No Unsplash images found for query: " + query);
        }

        List<String> failures = new ArrayList<>();
        for (UnsplashImageService.UnsplashImageResult candidate : results) {
            if (unsplashId != null && !unsplashId.isBlank() && !unsplashId.equals(candidate.id())) {
                continue;
            }
            try {
                MediaAsset asset = downloadUploadAndApply(wordId, baseForm, personaStyle, prompt, candidate);
                if (!failures.isEmpty()) {
                    return asset;
                }
                return asset;
            } catch (Exception e) {
                failures.add(candidate.id() + ": " + e.getMessage());
            }
        }

        throw new IllegalStateException("Failed to process all Unsplash candidates for query: " + query + "; failures=" + failures);
    }

    private MediaAsset downloadUploadAndApply(long wordId,
                                              String baseForm,
                                              String personaStyle,
                                              String prompt,
                                              UnsplashImageService.UnsplashImageResult selected) {
        byte[] bytes = downloadImageBytes(selected.fullUrl());
        String contentType = detectContentType(selected.fullUrl(), bytes);

        MultipartFile imageFile = new InMemoryImageFile(
                bytes,
                baseForm + "-unsplash",
                contentType,
                selected.id() + "." + extensionFromContentType(contentType));

        MediaAsset asset = mediaAssetService.uploadMedia(imageFile, "VOCABULARY", "word-" + wordId, baseForm, null);
        vocabularyImageService.applyGeneratedImage(wordId, asset, personaStyle, prompt + "; unsplashId=" + selected.id());
        return asset;
    }

    private String buildQuery(String baseForm, String meaning, String dtype, String personaStyle) {
        return String.join(" ",
                nullToEmpty(baseForm),
                nullToEmpty(meaning),
                nullToEmpty(dtype),
                nullToEmpty(personaStyle)).trim();
    }

    private String buildPrompt(String baseForm, String meaning, String dtype, String personaStyle) {
        return "personaStyle=" + nullToEmpty(personaStyle) + "; dtype=" + nullToEmpty(dtype) + "; baseForm=" + nullToEmpty(baseForm) + "; meaning=" + nullToEmpty(meaning);
    }

    private String normalizeQueryFallback(String queryUsed, String baseForm, String meaning, String dtype, String personaStyle) {
        String fallback = buildQuery(baseForm, meaning, dtype, personaStyle);
        return queryUsed == null || queryUsed.isBlank() ? fallback : queryUsed.trim();
    }

    private String normalizePromptFallback(String promptContext, String baseForm, String meaning, String dtype, String personaStyle) {
        String fallback = buildPrompt(baseForm, meaning, dtype, personaStyle);
        return promptContext == null || promptContext.isBlank() ? fallback : promptContext.trim();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private byte[] downloadImageBytes(String imageUrl) {
        try (var in = URI.create(imageUrl).toURL().openStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to download Unsplash image", e);
        }
    }

    private String detectContentType(String imageUrl, byte[] bytes) {
        String guessed = URLConnection.guessContentTypeFromName(imageUrl);
        if (guessed != null && guessed.startsWith("image/")) {
            return guessed;
        }
        try {
            String detected = URLConnection.guessContentTypeFromStream(new ByteArrayInputStream(bytes));
            if (detected != null && detected.startsWith("image/")) {
                return detected;
            }
        } catch (IOException ignored) {
            // fall back below
        }
        return "image/jpeg";
    }

    private String extensionFromContentType(String contentType) {
        return switch (contentType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            default -> "jpg";
        };
    }

    private static final class InMemoryImageFile implements MultipartFile {
        private final byte[] bytes;
        private final String name;
        private final String contentType;
        private final String originalFilename;

        private InMemoryImageFile(byte[] bytes, String name, String contentType, String originalFilename) {
            this.bytes = bytes;
            this.name = name;
            this.contentType = contentType;
            this.originalFilename = originalFilename;
        }

        @Override public String getName() { return name; }
        @Override public String getOriginalFilename() { return originalFilename; }
        @Override public String getContentType() { return contentType; }
        @Override public boolean isEmpty() { return bytes.length == 0; }
        @Override public long getSize() { return bytes.length; }
        @Override public byte[] getBytes() { return bytes; }
        @Override public ByteArrayInputStream getInputStream() throws IOException { return new ByteArrayInputStream(bytes); }
        @Override public void transferTo(java.io.File dest) throws IOException { throw new IOException("Not supported"); }
    }
}
