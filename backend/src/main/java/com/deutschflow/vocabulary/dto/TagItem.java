package com.deutschflow.vocabulary.dto;

/**
 * @param id            internal tag PK
 * @param name          canonical German tag name (used for API filtering)
 * @param color         hex colour for UI
 * @param localizedLabel localized display label (falls back to name if no translation)
 */
public record TagItem(
        long id,
        String name,
        String color,
        String localizedLabel
) {}

