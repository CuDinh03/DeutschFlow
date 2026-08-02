package com.deutschflow.speaking.dto;

/**
 * Quota hiển thị cho màn Speaking. {@code orgBudget = true} khi số liệu là NGÂN SÁCH TRUNG TÂM
 * (kênh staff org — 2 kênh token 26/07) chứ không phải ví cá nhân: client đổi thông điệp khi
 * chặn ("liên hệ quản trị trung tâm", KHÔNG mời nâng cấp) và ẩn badge khi pool unlimited
 * (sentinel {@code remainingSpendable = 999_999_999}).
 */
public record AiSpeakingQuotaDto(boolean canStartSession, long remainingSpendable, String planCode,
                                 boolean orgBudget) {}
