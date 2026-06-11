package com.deutschflow.marketing.dto;

import com.deutschflow.marketing.entity.MarketingLead;

import java.time.Instant;

/** Một lead cho admin follow-up (KHÔNG lộ ipHash). */
public record MarketingLeadDto(
        Long id,
        String name,
        String contact,
        String contactType,
        String source,
        String topic,
        int essayChars,
        Integer score,
        Instant createdAt
) {
    public static MarketingLeadDto from(MarketingLead l) {
        return new MarketingLeadDto(
                l.getId(),
                l.getName(),
                l.getContact(),
                l.getContactType(),
                l.getSource(),
                l.getTopic(),
                l.getEssayChars(),
                l.getScore(),
                l.getCreatedAt());
    }
}
