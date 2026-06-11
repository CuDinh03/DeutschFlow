package com.deutschflow.marketing.dto;

/**
 * Số liệu phễu tăng trưởng cho admin (lead magnet C8 + report chia sẻ D6).
 *
 * @param leadsTotal      tổng lead thu được
 * @param leads7d         lead trong 7 ngày
 * @param leadsToday      lead hôm nay (24h)
 * @param reportsTotal    tổng report chấm thử đã tạo
 * @param reports7d       report trong 7 ngày
 * @param avgScore        điểm trung bình các report (0 nếu chưa có)
 * @param emailLeads      số lead để lại email
 * @param zaloLeads       số lead để lại Zalo/điện thoại
 */
public record GrowthStatsDto(
        long leadsTotal,
        long leads7d,
        long leadsToday,
        long reportsTotal,
        long reports7d,
        double avgScore,
        long emailLeads,
        long zaloLeads
) {}
