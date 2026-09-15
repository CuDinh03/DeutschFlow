package com.deutschflow.organization.dto;

import java.time.Instant;
import java.util.List;

/**
 * Chi tiết một học viên thuộc tổ chức (B1.2) — membership + các lớp đang theo học
 * (lọc theo org). Read-only, org-admin.
 *
 * <p>Bốn trường cuối (D1/R11, owner chốt 10/09/2026) là tóm tắt tình trạng chưa-thành-niên cho màn
 * "Người giám hộ &amp; đồng ý". ⛔ KHÔNG trả ngày sinh thô: màn chi tiết mở được với mọi OWNER/MANAGER,
 * còn ngày sinh là dữ liệu danh tính của trẻ — nhóm tuổi đã đủ để giải thích vì sao phần nói đang
 * khoá.
 *
 * @param minorStatus       {@code UNKNOWN} (chưa khai ngày sinh) · {@code MINOR_LEGAL} (dưới 16) ·
 *                          {@code MINOR_CENTER_POLICY} (16–17) · {@code ADULT}
 * @param birthDateRecorded {@code users.birth_date} đã có giá trị
 * @param audioConsentState {@code NEVER_RECORDED} · {@code GRANTED} · {@code REVOKED} cho phạm vi
 *                          {@code AUDIO_RECORDING} — đúng trạng thái mà {@code MinorGate} đang đọc
 * @param guardianCount     số người giám hộ đã ghi
 */
public record OrgStudentDetailDto(
        Long userId,
        String email,
        String displayName,
        String role,
        String status,
        Instant joinedAt,
        List<OrgStudentClassDto> classes,
        String minorStatus,
        boolean birthDateRecorded,
        String audioConsentState,
        int guardianCount
) {}
