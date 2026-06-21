package com.deutschflow.organization.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Một học viên trong roster của lớp (org class-detail).
 * skill_* là điểm 4 kỹ năng giáo viên chấm trên {@code class_students} (nullable nếu chưa chấm).
 */
public record OrgClassStudentDto(
        Long userId,
        String email,
        String displayName,
        LocalDateTime joinedAt,
        BigDecimal skillHoren,
        BigDecimal skillLesen,
        BigDecimal skillSchreiben,
        BigDecimal skillSprechen
) {}
