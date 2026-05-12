package com.deutschflow.news.controller;

import com.deutschflow.news.dto.NewsItemDto;
import com.deutschflow.news.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService newsService;

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<NewsItemDto>> getLatestNews() {
        return ResponseEntity.ok(newsService.getLatestNews());
    }
}
