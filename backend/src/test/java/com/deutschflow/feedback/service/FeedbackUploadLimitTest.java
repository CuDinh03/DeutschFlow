package com.deutschflow.feedback.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.feedback.repository.FeedbackAttachmentRepository;
import com.deutschflow.feedback.repository.FeedbackItemRepository;
import com.deutschflow.feedback.repository.FeedbackReplyRepository;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.moderation.service.ModerationRateLimiterService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.PlatformTransactionManager;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Tải ảnh góp ý: ảnh hỏng vẫn tính vào hạn mức (không trả lượt)")
class FeedbackUploadLimitTest {

    @Test
    void decodeFailure_doesNotRefundTheSlot() {
        ModerationRateLimiterService uploadLimiter = mock(ModerationRateLimiterService.class);
        when(uploadLimiter.decide(anyLong())).thenReturn(ModerationRateLimiterService.Decision.allow());
        FeedbackRateLimits limits = mock(FeedbackRateLimits.class);
        when(limits.upload()).thenReturn(uploadLimiter);
        FeedbackDecodeGate gate = mock(FeedbackDecodeGate.class);
        when(gate.decode(any())).thenThrow(new BadRequestException(FeedbackImageProcessor.WRONG_TYPE));
        S3StorageService storage = mock(S3StorageService.class);
        FeedbackService service = new FeedbackService(mock(FeedbackItemRepository.class),
                mock(FeedbackAttachmentRepository.class), mock(FeedbackReplyRepository.class), limits, storage, gate,
                mock(PlatformTransactionManager.class));
        User student = User.builder().id(7L).email("s@test.local").passwordHash("x").displayName("S")
                .role(User.Role.STUDENT).build();

        assertThatThrownBy(() -> service.upload(student,
                new MockMultipartFile("file", "a.png", "image/png", "fake".getBytes())))
                .isInstanceOf(BadRequestException.class);

        verify(uploadLimiter, never()).refund(anyLong(), any());
        verify(storage, never()).uploadBytes(any(), any(), any());
    }
}
