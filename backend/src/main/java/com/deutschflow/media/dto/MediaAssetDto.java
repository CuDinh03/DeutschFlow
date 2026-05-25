package com.deutschflow.media.dto;

import com.deutschflow.media.entity.MediaAsset;
import lombok.Value;

import java.time.LocalDateTime;

@Value
public class MediaAssetDto {
    Long id;
    String s3Key;
    String url;
    String originalName;
    String contentType;
    Long fileSize;
    String category;
    String scope;
    String source;
    String style;
    String tag;
    String altText;
    Long uploadedById;
    String uploadedByName;
    LocalDateTime createdAt;

    public static MediaAssetDto fromEntity(MediaAsset asset) {
        if (asset == null) return null;
        return new MediaAssetDto(
                asset.getId(),
                asset.getS3Key(),
                asset.getUrl(),
                asset.getOriginalName(),
                asset.getContentType(),
                asset.getFileSize(),
                asset.getCategory(),
                asset.getScope(),
                asset.getSource(),
                asset.getStyle(),
                asset.getTag(),
                asset.getAltText(),
                asset.getUploadedBy() != null ? asset.getUploadedBy().getId() : null,
                asset.getUploadedBy() != null ? asset.getUploadedBy().getDisplayName() : null,
                asset.getCreatedAt()
        );
    }
}
