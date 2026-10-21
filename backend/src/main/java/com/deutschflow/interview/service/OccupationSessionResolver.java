package com.deutschflow.interview.service;

import com.deutschflow.interview.dto.OccupationDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Nối danh mục nghề vào lúc tạo phiên phỏng vấn (đợt 2b A + B + E): mã nghề → cặp
 * nhân vật + vị trí mà phiên dùng, và kích lần sinh lớp nghề đầu tiên cho nghề dùng bộ chung.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OccupationSessionResolver {

    private final OccupationCatalogService catalogService;
    private final OccupationContentGenerator contentGenerator;

    /** Nghề của phiên. {@code curated} = nghề có bộ viết tay của nhân vật (không sinh lớp nghề). */
    public record SessionOccupation(String code, String personaCode, String interviewPosition, boolean curated) {}

    public Optional<SessionOccupation> resolve(String occupationCode) {
        return catalogService.detail(occupationCode)
                .map(d -> new SessionOccupation(
                        d.occupation().code(),
                        d.personaCode(),
                        d.interviewPosition(),
                        OccupationDto.CURATED.equals(d.occupation().questionSet())));
    }

    /**
     * Nghề dùng bộ chung mà chưa có lớp nghề → sinh nền. Không bao giờ làm hỏng việc tạo phiên:
     * hàng đợi AI đầy thì bỏ qua, phiên vẫn chạy với lớp chung + câu sinh tại chỗ.
     */
    public void prepareContent(SessionOccupation occupation) {
        if (occupation.curated()) {
            return;
        }
        try {
            contentGenerator.generateIfMissingAsync(occupation.code());
        } catch (RuntimeException e) {
            log.warn("[OccupationGen] Could not schedule generation for {}: {}", occupation.code(), e.getMessage());
        }
    }
}
