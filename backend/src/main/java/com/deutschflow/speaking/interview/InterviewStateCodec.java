package com.deutschflow.speaking.interview;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class InterviewStateCodec {

    private final ObjectMapper objectMapper;

    public InterviewSessionState decode(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, InterviewSessionState.class);
        } catch (Exception e) {
            log.warn("Failed to decode interview state, using fresh state: {}", e.getMessage());
            return null;
        }
    }

    public String encode(InterviewSessionState state) {
        if (state == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(state);
        } catch (Exception e) {
            log.warn("Failed to encode interview state: {}", e.getMessage());
            return null;
        }
    }
}
