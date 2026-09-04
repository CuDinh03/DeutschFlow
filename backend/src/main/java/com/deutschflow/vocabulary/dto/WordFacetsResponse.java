package com.deutschflow.vocabulary.dto;

import java.util.List;
import java.util.Map;

/**
 * Số từ theo từng trục lọc của hub Từ vựng.
 *
 * <p>Mỗi trục đã tính GIAO với các bộ lọc khác đang bật nhưng BỎ bộ lọc của chính nó, nên con số trên
 * mỗi chip trả lời đúng câu "chọn chip này thì còn bao nhiêu từ" — chip không bao giờ dẫn tới danh sách
 * rỗng. Các map trả về đủ khoá đã biết (kể cả khoá 0) để UI tự quyết định ẩn chip rỗng; riêng
 * {@code topics} chỉ chứa chủ đề thực sự có từ vì danh mục chủ đề dài và phần lớn có thể trống.
 */
public record WordFacetsResponse(
        long total,
        /** NEW · LEARNING · MASTERED — theo lịch SRS của chính người dùng đang đăng nhập. */
        Map<String, Long> status,
        /** Noun · Verb · Adjective · Word. */
        Map<String, Long> dtype,
        /** DER · DIE · DAS — chỉ có nghĩa với danh từ. */
        Map<String, Long> gender,
        /** A1…C2 và UNGRADED (chưa có trong wordlist chính thức). */
        Map<String, Long> cefr,
        List<WordTopicFacet> topics
) {}
