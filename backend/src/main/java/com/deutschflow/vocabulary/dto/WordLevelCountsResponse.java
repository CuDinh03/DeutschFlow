package com.deutschflow.vocabulary.dto;

import java.util.Map;

/**
 * Số từ theo từng cấp CEFR. Khoá {@code UNGRADED} = từ chưa có trong wordlist chính thức
 * ({@code words.cefr_level IS NULL}).
 */
public record WordLevelCountsResponse(Map<String, Long> counts, long total) {}
