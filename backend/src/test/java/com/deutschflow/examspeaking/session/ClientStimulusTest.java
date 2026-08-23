package com.deutschflow.examspeaking.session;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Đề riêng tư: lịch của partner (và mọi khóa partner*) không bao giờ đi ra client. */
class ClientStimulusTest {

    @Test
    void stripsPartnerKeysButKeepsCandidateView() {
        Map<String, Object> full = new LinkedHashMap<>();
        full.put("type", "CALENDAR_PAIR");
        full.put("situation", "Kino");
        full.put("candidateCalendar", Map.of("Montag", "frei"));
        full.put("partnerCalendar", Map.of("Montag", "Arbeit"));
        full.put("partnerNotes", "geheim");
        Map<String, Object> client = ExamSessionService.clientStimulus(full);
        assertThat(client).containsKeys("type", "situation", "candidateCalendar");
        assertThat(client).doesNotContainKeys("partnerCalendar", "partnerNotes");
        assertThat(full).containsKey("partnerCalendar"); // bản gốc (cho AI) không bị sửa
    }

    @Test
    void nullStaysNull() {
        assertThat(ExamSessionService.clientStimulus(null)).isNull();
    }
}
