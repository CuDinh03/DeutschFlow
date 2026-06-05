package com.deutschflow.video.dto;

/**
 * Status of an async .mp4 render job.
 *
 * @param status   one of PENDING / PROCESSING / COMPLETED / FAILED
 * @param videoUrl S3 URL of the rendered .mp4 (only when COMPLETED)
 * @param error    failure message (only when FAILED)
 */
public record RenderStatusDto(String status, String videoUrl, String error) {}
