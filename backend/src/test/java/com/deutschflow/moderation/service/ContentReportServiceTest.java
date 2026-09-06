package com.deutschflow.moderation.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.messaging.entity.ClassChannelMessage;
import com.deutschflow.messaging.repository.ClassChannelMessageRepository;
import com.deutschflow.messaging.repository.MessageRepository;
import com.deutschflow.moderation.dto.ModerationDtos.ReportRequest;
import com.deutschflow.moderation.entity.ContentReport;
import com.deutschflow.moderation.repository.ContentReportRepository;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * GAP-12: report tin nhắn lớp chỉ dành cho thành viên lớp. Report sao chép nội dung tin vào
 * snapshot, nên thiếu bước kiểm này là một đường đọc tin của lớp khác chỉ bằng ID.
 */
@ExtendWith(MockitoExtension.class)
class ContentReportServiceTest {

    private static final long CLASS_ID = 7L;
    private static final long SENDER = 99L;
    private static final long REPORTER = 5L;
    private static final long MSG = 123L;

    @Mock ContentReportRepository reportRepository;
    @Mock MessageRepository messageRepository;
    @Mock ClassChannelMessageRepository classChannelMessageRepository;
    @Mock ClassStudentRepository classStudentRepository;
    @Mock ClassTeacherRepository classTeacherRepository;
    @InjectMocks ContentReportService service;

    private static ReportRequest classReport() {
        return new ReportRequest(ContentReport.Context.CLASS_MESSAGE, ContentReport.Reason.HARASSMENT,
                null, null, MSG, null, "chi tiết");
    }

    private void stubMessage() {
        when(classChannelMessageRepository.findById(MSG)).thenReturn(Optional.of(ClassChannelMessage.builder()
                .id(MSG).classId(CLASS_ID).senderId(SENDER).body("tin trong lớp").build()));
    }

    private void stubSaveAssigningId(long id) {
        when(reportRepository.save(any())).thenAnswer(inv -> {
            ContentReport r = inv.getArgument(0);
            r.setId(id);
            return r;
        });
    }

    @Test
    @DisplayName("người ngoài lớp report tin lớp → 400 và KHÔNG có report/snapshot nào được lưu")
    void outsiderCannotReportClassMessage() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, REPORTER)).thenReturn(false);

        assertThrows(BadRequestException.class, () -> service.report(REPORTER, classReport()));

        verify(reportRepository, never()).save(any());
    }

    @Test
    @DisplayName("học viên trong lớp report được; snapshot và người bị báo lấy từ chính tin")
    void classStudentCanReport() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(true);
        stubSaveAssigningId(42L);

        Long id = service.report(REPORTER, classReport());

        assertEquals(42L, id);
        ArgumentCaptor<ContentReport> saved = ArgumentCaptor.forClass(ContentReport.class);
        verify(reportRepository).save(saved.capture());
        assertEquals("tin trong lớp", saved.getValue().getSnapshotBody());
        assertEquals(SENDER, saved.getValue().getReportedUserId());
        assertEquals(REPORTER, saved.getValue().getReporterId());
    }

    @Test
    @DisplayName("giáo viên của lớp (không nằm trong class_students) cũng report được")
    void classTeacherCanReport() {
        stubMessage();
        when(classStudentRepository.existsByIdClassIdAndIdStudentId(CLASS_ID, REPORTER)).thenReturn(false);
        when(classTeacherRepository.existsByIdClassIdAndIdTeacherId(CLASS_ID, REPORTER)).thenReturn(true);
        stubSaveAssigningId(1L);

        assertEquals(1L, service.report(REPORTER, classReport()));
    }
}
