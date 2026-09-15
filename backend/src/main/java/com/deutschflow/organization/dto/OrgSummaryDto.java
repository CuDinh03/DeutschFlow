package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Tổng quan "org của tôi" cho org-admin (GET /api/org).
 *
 * <p>{@code classCount} và {@code classesWithoutTeacher} đếm trên TOÀN trung tâm (PR-A3). Trước đợt
 * này bảng điều khiển tự đếm bằng cách tải trang đầu 50 lớp rồi cộng tay, nên trung tâm có 60 lớp
 * hiện "50 lớp" và cảnh báo thiếu giáo viên chỉ soi được 50 lớp đầu — số sai mà không ai biết là sai.
 *
 * <p>{@code readOnly} / {@code readOnlyReason} / {@code validUntil} phơi trạng thái giấy phép ra cho
 * giao diện (D5). Không có chúng thì chế độ chỉ-đọc là một BÃI MÌN: người dùng vẫn thấy đủ nút "Tạo
 * lớp", "Mời giáo viên", "Nhập học viên", bấm vào mới ăn 403 — trái hẳn tinh thần D5 là chuyển sang
 * một chế độ NHÌN THẤY ĐƯỢC. {@code validUntil} để giao diện đếm ngược quãng ân hạn.
 */
public record OrgSummaryDto(
        String name,
        String planCode,
        long seatUsed,
        int seatLimit,
        long teacherCount,
        long studentCount,
        long classCount,
        long classesWithoutTeacher,
        boolean readOnly,
        String readOnlyReason,
        Instant validUntil
) {}
