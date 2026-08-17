package com.deutschflow.vocabulary.galerie.controller;

import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.vocabulary.galerie.GaleriePromptFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serve artwork Galerie công khai qua backend — bucket S3 đang private (bucket-policy public
 * cho prefix {@code galerie/} là món nợ hạ tầng từ 14/07), nên {@code <img>} phía admin grid
 * và mobile sau này (mục 3.4) đọc qua đây thay vì URL S3 trần.
 *
 * <p>Nằm dưới {@code /api/public/**} (permitAll sẵn trong SecurityConfig + PublicApiRateLimitFilter):
 * artwork từ vựng là học liệu công khai, tương tự media by-tag. Key S3 dựng từ wordId số —
 * không nhận path từ client nên không có cửa traversal. Nếu sau này owner mở bucket-policy /
 * CloudFront thì endpoint này thành fallback, không cần gỡ.
 */
@Slf4j
@RestController
@RequestMapping("/api/public/galerie")
@RequiredArgsConstructor
public class GaleriePublicArtworkController {

    private static final MediaType SVG = MediaType.valueOf("image/svg+xml");

    private final S3StorageService s3StorageService;

    @GetMapping(value = "/artwork/{wordId}.svg")
    public ResponseEntity<byte[]> artwork(@PathVariable long wordId) {
        String key = "galerie/" + GaleriePromptFactory.VERSION + "/" + wordId + ".svg";
        try {
            byte[] bytes = s3StorageService.downloadBytes(key);
            return ResponseEntity.ok()
                    // Artwork bất biến theo key (regenerate ghi đè cùng key — TTL 1h là trần chờ chấp nhận được)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                    .contentType(SVG)
                    .body(bytes);
        } catch (Exception e) {
            log.debug("[Galerie] artwork miss key={}: {}", key, e.toString());
            return ResponseEntity.notFound().build();
        }
    }
}
