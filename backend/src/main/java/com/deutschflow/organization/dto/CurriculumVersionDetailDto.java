package com.deutschflow.organization.dto;

import java.time.LocalDateTime;
import java.util.List;

public record CurriculumVersionDetailDto(
        Long id,
        Long curriculumId,
        String curriculumName,
        String curriculumCefrLevel,
        int versionNo,
        String status,
        String sourceNote,
        LocalDateTime publishedAt,
        long linkedClassCount,
        List<CurriculumLektionDto> lektionen
) {}
