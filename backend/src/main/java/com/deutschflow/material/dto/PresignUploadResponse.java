package com.deutschflow.material.dto;

/**
 * Reply to {@code POST /api/v2/materials/presign-upload}. The client PUTs the file bytes straight to
 * {@code uploadUrl} (a presigned S3 PUT), then calls {@code POST /materials/{materialId}/complete} to
 * flip the reserved record from UPLOADING to ACTIVE. {@code objectKey} is returned for debugging/telemetry
 * only — clients upload to {@code uploadUrl}, never construct S3 URLs themselves.
 */
public record PresignUploadResponse(Long materialId, String uploadUrl, String objectKey) {}
