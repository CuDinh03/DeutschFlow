package com.deutschflow.organization.dto;

/** Cập nhật gói/ghế/trạng thái tổ chức (platform-admin). */
public record UpdateOrgRequest(
        String planCode,
        Integer seatLimit,
        String status
) {}
