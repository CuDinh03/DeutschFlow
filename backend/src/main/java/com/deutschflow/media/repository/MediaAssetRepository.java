package com.deutschflow.media.repository;

import com.deutschflow.media.entity.MediaAsset;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Every read fetches {@code uploadedBy} eagerly.
 *
 * <p>{@code MediaAsset.uploadedBy} is {@code LAZY} and {@code MediaAssetDto.fromEntity} reads the
 * uploader's id and display name. With {@code spring.jpa.open-in-view: false} (application.yml) the
 * persistence context is already closed when the controller maps the entity, so every read threw
 * {@code LazyInitializationException} → HTTP 500 the moment the library held a single row: the whole
 * "Thư viện ảnh" screen was dead in production yet rendered a harmless-looking empty state
 * (QA 03/08). Upload was unaffected — it maps inside its own transaction.
 */
@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {

    @Override
    @EntityGraph(attributePaths = "uploadedBy")
    Optional<MediaAsset> findById(Long id);

    @Override
    @EntityGraph(attributePaths = "uploadedBy")
    Page<MediaAsset> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "uploadedBy")
    Page<MediaAsset> findByCategory(String category, Pageable pageable);

    @EntityGraph(attributePaths = "uploadedBy")
    Optional<MediaAsset> findByCategoryAndTag(String category, String tag);

    @EntityGraph(attributePaths = "uploadedBy")
    Page<MediaAsset> findByUploadedById(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = "uploadedBy")
    Page<MediaAsset> findByUploadedByIdAndCategory(Long userId, String category, Pageable pageable);

    boolean existsByS3Key(String s3Key);
}
