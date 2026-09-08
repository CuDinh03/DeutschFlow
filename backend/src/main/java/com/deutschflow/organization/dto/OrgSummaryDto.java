package com.deutschflow.organization.dto;

/**
 * Tổng quan "org của tôi" cho org-admin (GET /api/org).
 *
 * <p>{@code classCount} và {@code classesWithoutTeacher} đếm trên TOÀN trung tâm (PR-A3). Trước đợt
 * này bảng điều khiển tự đếm bằng cách tải trang đầu 50 lớp rồi cộng tay, nên trung tâm có 60 lớp
 * hiện "50 lớp" và cảnh báo thiếu giáo viên chỉ soi được 50 lớp đầu — số sai mà không ai biết là sai.
 */
public record OrgSummaryDto(
        String name,
        String planCode,
        long seatUsed,
        int seatLimit,
        long teacherCount,
        long studentCount,
        long classCount,
        long classesWithoutTeacher
) {}
