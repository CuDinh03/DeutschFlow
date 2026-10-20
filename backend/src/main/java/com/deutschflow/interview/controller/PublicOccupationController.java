package com.deutschflow.interview.controller;

import com.deutschflow.interview.dto.OccupationDetailDto;
import com.deutschflow.interview.dto.OccupationDto;
import com.deutschflow.interview.service.OccupationCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;

/**
 * Danh mục nghề công khai cho trang chủ, trang {@code /phong-van/[nghe]} và onboarding (đợt 2a).
 *
 * <p>Nằm dưới {@code /api/public/**}: permitAll trong SecurityConfig và có throttle theo IP của
 * {@code PublicApiRateLimitFilter}. Chỉ đọc, không gọi AI; trả {@code Cache-Control: public} để
 * Next.js và CDN giữ bản sao — danh mục chỉ đổi khi có migration.
 */
@RestController
@RequestMapping("/api/public/occupations")
@RequiredArgsConstructor
public class PublicOccupationController {

    static final CacheControl CACHE = CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic();

    private final OccupationCatalogService catalogService;

    @GetMapping
    public ResponseEntity<List<OccupationDto>> list() {
        return ResponseEntity.ok().cacheControl(CACHE).body(catalogService.list());
    }

    @GetMapping("/{code}")
    public ResponseEntity<OccupationDetailDto> detail(@PathVariable String code) {
        return catalogService.detail(code)
                .map(d -> ResponseEntity.ok().cacheControl(CACHE).body(d))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
