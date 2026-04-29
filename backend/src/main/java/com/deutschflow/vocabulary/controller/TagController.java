package com.deutschflow.vocabulary.controller;

import com.deutschflow.vocabulary.dto.TagItem;
import com.deutschflow.vocabulary.service.TagQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagQueryService tagQueryService;

    @GetMapping
    public List<TagItem> list(
            @RequestParam(required = false, defaultValue = "de") String locale) {
        return tagQueryService.listTags(locale);
    }
}

