package com.deutschflow.vocabulary.saved;

import java.time.OffsetDateTime;
import java.util.List;

/** DTO của sổ từ riêng ({@code /api/my-words}). */
public final class SavedWordDtos {

    private SavedWordDtos() {}

    /**
     * Lưu chữ đã bôi đen.
     *
     * @param text     chữ bôi đen (1–5 từ)
     * @param sentence câu chứa chữ đó — để AI hiểu đúng nghĩa và làm ví dụ cho thẻ ôn
     * @param examId   đề đang luyện (tuỳ chọn)
     * @param teilKey  Teil đang luyện, vd. {@code LESEN-2}
     * @param block    khối chữ trong bài ({@code ctx} hoặc {@code q:<id>}) — để sau mở lại đúng chỗ
     * @param start    vị trí ký tự đầu trong khối
     * @param end      vị trí ký tự cuối (không gồm) trong khối
     */
    public record SaveRequest(String text, String sentence, Long examId, String teilKey,
                              String block, Integer start, Integer end) {}

    public record SavedWord(
            long id,
            String lemma,
            String article,
            String pos,
            String meaning,
            String topic,
            String topicLabel,
            String surface,
            String sentence,
            Long examId,
            String examTitle,
            String teilKey,
            OffsetDateTime createdAt,
            /** Từ đã có trong sổ từ trước — lần lưu này không thêm gì. */
            boolean alreadySaved
    ) {}

    public record SavedWordList(List<SavedWord> items, int total) {}
}
