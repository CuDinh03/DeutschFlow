package com.deutschflow.speaking.dto;

import java.util.List;

/**
 * Trả lời của {@code GET /api/ai-speaking/tts/personas}: tên các persona mà sidecar Edge TTS đang
 * chạy biết (viết hoa). Danh sách rỗng = chưa cấu hình sidecar hoặc không hỏi được — client coi như
 * chưa có persona mới và giữ giọng cũ.
 */
public record TtsPersonasDto(List<String> personas) {}
