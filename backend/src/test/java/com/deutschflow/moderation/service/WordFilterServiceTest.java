package com.deutschflow.moderation.service;

import com.deutschflow.common.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WordFilterServiceTest {

    private final WordFilterService filter = new WordFilterService();

    @ParameterizedTest
    @DisplayName("flags clear slurs / sexual terms — whole-token, case- and diacritic-insensitive")
    @ValueSource(strings = {
            "you are a fuck",
            "shit happens here",
            "Đụ má mày",              // Vietnamese multi-word, with diacritics → normalized "du ma"
            "dit me",
            "du bist ein Hurensohn",  // German
            "was für ein wichser",    // German
            "stop, you bitch!",       // punctuation around the word (still whole-token)
            "BITCH",                  // case-insensitive
    })
    void flagsSevere(String body) {
        assertThat(filter.isSevere(body)).isTrue();
        assertThatThrownBy(() -> filter.assertClean(body)).isInstanceOf(BadRequestException.class);
    }

    @ParameterizedTest
    @DisplayName("does NOT flag legitimate German/Vietnamese learning vocabulary (no false positives)")
    @ValueSource(strings = {
            "Das Buch ist dick.",              // German 'dick' = thick (must NOT match)
            "Ich habe die Grapefruit gegessen", // contains 'rape' as a substring — must NOT match
            "Các bạn học tốt nhé",             // Vietnamese 'các' = plural (must NOT match)
            "Cái bàn này lớn",                 // 'lớn' = big (must NOT match)
            "Guten Morgen, wie geht es dir?",
            "Ich lerne Deutsch mit DeutschFlow",
            "The cockpit of the plane",        // 'cock' substring — must NOT match
            "",
    })
    void doesNotFlagLegitimate(String body) {
        assertThat(filter.isSevere(body)).isFalse();
        assertThatCode(() -> filter.assertClean(body)).doesNotThrowAnyException();
    }
}
