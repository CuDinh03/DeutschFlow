package com.deutschflow.notification.service;

import com.deutschflow.notification.NotificationType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tiêu đề và thân thông báo do máy chủ dựng không mang emoji (owner 11/11/2026; cùng luật "không
 * emoji giao diện" của dự án). Biểu tượng của từng loại thông báo do giao diện vẽ bằng glyph.
 * Emoji trong dữ liệu người dùng nhập (tên huy hiệu, tin nhắn) không thuộc phạm vi test này.
 */
@DisplayName("Thông báo — nội dung do máy chủ dựng không có emoji")
class NotificationTitleNoEmojiTest {

    private final NotificationContentRenderer renderer = new NotificationContentRenderer();

    @Test
    @DisplayName("mọi NotificationType, payload rỗng và các biến thể kind/updated")
    void khongEmoji() {
        List<Map<String, Object>> payloads = List.of(
                Map.of(),
                Map.of("updated", true),
                Map.of("addedBy", "ORG"),
                Map.of("kind", "SCHEDULED"), Map.of("kind", "UPDATED"), Map.of("kind", "REMINDER"),
                Map.of("kind", "STARTED"), Map.of("kind", "COMPLETED"), Map.of("kind", "CANCELLED"));
        for (NotificationType type : NotificationType.values()) {
            for (Map<String, Object> payload : payloads) {
                var content = renderer.render(type, payload);
                assertThat(hasEmoji(content.title())).as("tiêu đề %s %s: %s", type, payload, content.title()).isFalse();
                assertThat(hasEmoji(content.body())).as("thân %s %s: %s", type, payload, content.body()).isFalse();
            }
        }
    }

    private static boolean hasEmoji(String s) {
        return s != null && s.codePoints().anyMatch(cp ->
                (cp >= 0x1F000 && cp <= 0x1FAFF) || (cp >= 0x2300 && cp <= 0x23FF)
                        || (cp >= 0x2600 && cp <= 0x27BF) || (cp >= 0x2B00 && cp <= 0x2BFF) || cp == 0xFE0F);
    }
}
