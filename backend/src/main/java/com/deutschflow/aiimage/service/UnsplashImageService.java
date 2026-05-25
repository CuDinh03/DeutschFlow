package com.deutschflow.aiimage.service;

import com.deutschflow.config.UnsplashProperties;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "unsplash", name = "enabled", havingValue = "true")
public class UnsplashImageService {

    private final RestClient unsplashRestClient;
    private final UnsplashProperties unsplashProperties;

    public List<UnsplashImageResult> search(String query, int page, int perPage) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        int attempts = Math.max(1, unsplashProperties.maxRetryAttempts());
        RuntimeException lastError = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                return doSearch(query, page, perPage);
            } catch (RuntimeException e) {
                lastError = e;
                if (i < attempts) {
                    log.warn("Unsplash search failed (attempt {}/{}): {}", i, attempts, e.getMessage());
                }
            }
        }
        throw lastError != null ? lastError : new IllegalStateException("Unsplash search failed unexpectedly");
    }

    private List<UnsplashImageResult> doSearch(String query, int page, int perPage) {
        UnsplashSearchResponse response = unsplashRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search/photos")
                        .queryParam("query", query.trim())
                        .queryParam("page", page)
                        .queryParam("per_page", perPage)
                        .build())
                .retrieve()
                .body(UnsplashSearchResponse.class);

        if (response == null || response.results == null) {
            return List.of();
        }

        return response.results.stream()
                .map(photo -> new UnsplashImageResult(
                        photo.id,
                        photo.alt_description,
                        photo.description,
                        photo.urls.small,
                        photo.urls.regular,
                        photo.urls.full,
                        photo.user.name,
                        photo.links.html))
                .toList();
    }

    public record UnsplashImageResult(
            String id,
            String altText,
            String description,
            String thumbUrl,
            String regularUrl,
            String fullUrl,
            String photographerName,
            String pageUrl
    ) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsplashSearchResponse {
        public List<UnsplashPhoto> results;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsplashPhoto {
        public String id;
        public String alt_description;
        public String description;
        public UnsplashUrls urls;
        public UnsplashUser user;
        public UnsplashLinks links;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsplashUrls {
        public String small;
        public String regular;
        public String full;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsplashUser {
        public String name;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UnsplashLinks {
        public String html;
    }
}
