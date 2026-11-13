package com.deutschflow.admin;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lỗi API của trang admin hiện thẳng lên màn hình (toast, khung lỗi), nên phải là câu tiếng Việt nói được chuyện gì
 * và làm gì (owner yêu cầu 13/11/2026). Trước đợt này có khoảng 20 câu kiểu "User not found", "Invalid role".
 * Test quét mã nguồn của package {@code admin} để câu tiếng Anh cụt không quay lại.
 */
class AdminErrorMessagesTest {

    private static final Path ROOT = Path.of("src/main/java/com/deutschflow/admin");
    private static final Pattern THROWN = Pattern.compile(
            "new (?:BadRequestException|NotFoundException|ConflictException)\\(\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    @Test
    @DisplayName("mọi câu lỗi 4xx của package admin là tiếng Việt")
    void adminErrorsAreVietnameseSentences() throws IOException {
        List<String> offenders = new ArrayList<>();
        int seen = 0;
        try (Stream<Path> files = Files.walk(ROOT)) {
            for (Path file : files.filter(p -> p.toString().endsWith(".java")).toList()) {
                Matcher m = THROWN.matcher(Files.readString(file, StandardCharsets.UTF_8));
                while (m.find()) {
                    seen++;
                    // Đoạn chữ đầu của câu (câu ghép biến thì chỉ xét đoạn mở đầu): phải có dấu tiếng Việt.
                    String first = m.group(1);
                    boolean vietnamese = first.chars().anyMatch(c -> c > 0x7F);
                    if (!vietnamese) offenders.add(ROOT.relativize(file) + ": \"" + first + "\"");
                }
            }
        }
        assertThat(seen).as("số câu lỗi quét được").isGreaterThan(30);
        assertThat(offenders).as("câu lỗi chưa phải tiếng Việt đủ ý").isEmpty();
    }
}
