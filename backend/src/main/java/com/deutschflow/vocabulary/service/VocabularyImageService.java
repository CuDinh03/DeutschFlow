package com.deutschflow.vocabulary.service;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.repository.MediaAssetRepository;
import com.deutschflow.vocabulary.dto.WordImageUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class VocabularyImageService {

    private final JdbcTemplate jdbcTemplate;
    private final MediaAssetRepository mediaAssetRepository;

    @Transactional
    public void applyGeneratedImage(long wordId, MediaAsset asset, String style, String prompt) {
        if (asset == null) {
            throw new NotFoundException("Generated media asset is required");
        }
        jdbcTemplate.update("""
                UPDATE words
                SET image_url = ?,
                    image_source = 'AUTO_GENERATED',
                    image_style = ?,
                    image_prompt = ?,
                    image_generated_at = ?,
                    image_updated_at = ?
                WHERE id = ?
                """, asset.getUrl(), style, prompt, LocalDateTime.now(), LocalDateTime.now(), wordId);
    }

    @Transactional
    public void overrideImage(long wordId, WordImageUpdateRequest request) {
        jdbcTemplate.update("""
                UPDATE words
                SET image_url = ?,
                    image_source = 'UPLOADED',
                    image_style = ?,
                    image_prompt = NULL,
                    image_generated_at = NULL,
                    image_updated_at = ?
                WHERE id = ?
                """, request.imageUrl(), request.imageStyle(), LocalDateTime.now(), wordId);
    }
}
