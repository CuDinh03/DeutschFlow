package com.deutschflow.media.repository;

import com.deutschflow.media.entity.MediaAsset;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {
    
    Page<MediaAsset> findByCategory(String category, Pageable pageable);
    
    Optional<MediaAsset> findByCategoryAndTag(String category, String tag);
    
    Page<MediaAsset> findByUploadedById(Long userId, Pageable pageable);

    Page<MediaAsset> findByUploadedByIdAndCategory(Long userId, String category, Pageable pageable);

    boolean existsByS3Key(String s3Key);
}
