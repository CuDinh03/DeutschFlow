package com.deutschflow.gamification.coin.dto;

import com.deutschflow.gamification.coin.entity.UserCoinEvent;

import java.time.LocalDateTime;

/** One row of the coin ledger, for the history view. */
public record CoinEventDto(
        Long id,
        int amount,
        String eventType,
        String note,
        LocalDateTime createdAt) {

    public static CoinEventDto from(UserCoinEvent e) {
        return new CoinEventDto(
                e.getId(),
                e.getAmount(),
                e.getEventType() != null ? e.getEventType().name() : null,
                e.getNote(),
                e.getCreatedAt());
    }
}
