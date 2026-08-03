package com.deutschflow.teacher.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Ranh giới "lịch sử dạy học" (chặn xoá lớp) và "cấu hình" (chỉ ghi vết).
 *
 * <p>Tài liệu đính kèm từng bị xếp nhầm vào nhóm chặn: {@code class_materials} chỉ là bảng liên
 * kết — tài liệu vẫn nằm trong thư viện sau khi lớp biến mất — nhưng lại không có API nào gỡ được
 * liên kết đó, nên một lớp lỡ gắn tài liệu là kẹt vĩnh viễn, không bao giờ xoá nổi (QA 03/08).
 */
class ClassDeletionGuardContentTest {

    private static ClassDeletionGuard.ClassContent content(
            long sessions, long lessonLogs, long attendance, long channelMessages,
            long materials, long submissions, long teachingRecords) {
        return new ClassDeletionGuard.ClassContent(
                sessions, lessonLogs, attendance, channelMessages, materials, submissions,
                teachingRecords, 0, 0, 0, 0);
    }

    @Test
    @DisplayName("chỉ có tài liệu đính kèm → KHÔNG chặn xoá lớp")
    void materialsAlone_doNotBlockDeletion() {
        ClassDeletionGuard.ClassContent c = content(0, 0, 0, 0, 3, 0, 0);

        assertFalse(c.hasHistory());
        assertEquals("", c.describeHistory());
    }

    @Test
    @DisplayName("tài liệu vẫn được kiểm kê trong audit dù không chặn")
    void materialsStillAudited() {
        assertEquals(3L, content(0, 0, 0, 0, 3, 0, 0).toAuditMetadata().get("materials"));
    }

    @Test
    @DisplayName("mỗi loại dấu vết dạy học thật đều chặn xoá")
    void realTeachingHistoryBlocks() {
        assertTrue(content(1, 0, 0, 0, 0, 0, 0).hasHistory(), "buổi học");
        assertTrue(content(0, 1, 0, 0, 0, 0, 0).hasHistory(), "nhật ký");
        assertTrue(content(0, 0, 1, 0, 0, 0, 0).hasHistory(), "điểm danh");
        assertTrue(content(0, 0, 0, 1, 0, 0, 0).hasHistory(), "tin nhắn kênh lớp");
        assertTrue(content(0, 0, 0, 0, 0, 1, 0).hasHistory(), "bài đã nộp");
        assertTrue(content(0, 0, 0, 0, 0, 0, 1).hasHistory(), "bản ghi công");
    }

    @Test
    @DisplayName("lớp trắng tinh vẫn xoá được")
    void emptyClassIsDeletable() {
        assertFalse(content(0, 0, 0, 0, 0, 0, 0).hasHistory());
    }

    @Test
    @DisplayName("thông điệp lỗi liệt kê đúng phần lịch sử, không nhắc tài liệu")
    void describeHistory_listsOnlyBlockingRecords() {
        String message = content(12, 0, 96, 0, 5, 0, 0).describeHistory();

        assertEquals("12 buổi học, 96 lượt điểm danh", message);
    }
}
