package com.deutschflow.speaking.controller;

import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.service.OrgPoolGuard;
import com.deutschflow.speaking.AiRateLimiterService;
import com.deutschflow.speaking.service.PronunciationScorerService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit R-B7: pronunciation-check trước đây thiếu rate-limit / quota / cap size (nạp tới trần 25MB
 * vào heap). Test 3 guard mới, và quan trọng: chúng chặn TRƯỚC khi gọi Whisper (scorerService).
 */
@ExtendWith(MockitoExtension.class)
class PronunciationControllerTest {

    @Mock private PronunciationScorerService scorerService;
    @Mock private AiRateLimiterService aiRateLimiterService;
    @Mock private QuotaService quotaService;
    @Mock private OrgPoolGuard orgPoolGuard;

    private PronunciationController controller;
    private User user;

    @BeforeEach
    void setUp() {
        controller = new PronunciationController(scorerService, aiRateLimiterService, quotaService, orgPoolGuard);
        ReflectionTestUtils.setField(controller, "transcribeMaxBytes", 8_388_608L);
        user = new User();
        user.setId(7L);
    }

    private MultipartFile audio(String contentType, int size) {
        return new MockMultipartFile("audio", "rec.webm", contentType, new byte[size]);
    }

    @Test
    @DisplayName("vượt rate-limit (bucket PHONEME) → 429, KHÔNG gọi Whisper")
    void rateLimited_throws429_noWhisper() throws Exception {
        when(aiRateLimiterService.allow(AiRateLimiterService.Bucket.PHONEME, 7L)).thenReturn(false);
        when(aiRateLimiterService.retryAfterSeconds(AiRateLimiterService.Bucket.PHONEME, 7L)).thenReturn(30);

        assertThatThrownBy(() -> controller.check(user, audio("audio/webm", 1000), "Hallo"))
                .isInstanceOf(RateLimitExceededException.class);

        verify(scorerService, never()).score(any(), any(), anyLong());
    }

    @Test
    @DisplayName("audio vượt cap size → 400, KHÔNG gọi Whisper (chặn TRƯỚC getBytes)")
    void oversize_throws400_noWhisper() throws Exception {
        when(aiRateLimiterService.allow(AiRateLimiterService.Bucket.PHONEME, 7L)).thenReturn(true);

        ResponseEntity<?> res = controller.check(user, audio("audio/webm", 9_000_000), "Hallo");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(scorerService, never()).score(any(), any(), anyLong());
    }

    @Test
    @DisplayName("content-type không hợp lệ → 400, KHÔNG gọi Whisper")
    void badContentType_throws400_noWhisper() throws Exception {
        when(aiRateLimiterService.allow(AiRateLimiterService.Bucket.PHONEME, 7L)).thenReturn(true);

        ResponseEntity<?> res = controller.check(user, audio("application/json", 1000), "Hallo");

        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(scorerService, never()).score(any(), any(), anyLong());
    }
}
