package com.deutschflow.vocabulary.dto;

/**
 * Admin request to attach a manually-chosen Unsplash image to a word.
 * The image is downloaded from {@code imageUrl} and re-hosted on S3.
 *
 * @param baseForm the word's base form (used to label the stored asset)
 * @param imageUrl the chosen Unsplash photo URL (must be on an unsplash.com host)
 */
public record UnsplashAttachRequest(String baseForm, String imageUrl) {}
