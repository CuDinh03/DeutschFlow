package com.deutschflow.user.onboarding;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ClaimResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.CreateRequest;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.SessionResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.UpdateRequest;
import com.deutschflow.user.onboarding.entity.GuestOnboardingSession;
import com.deutschflow.user.onboarding.entity.UserOnboardingProgress;
import com.deutschflow.user.onboarding.repository.GuestOnboardingSessionRepository;
import com.deutschflow.user.onboarding.repository.UserOnboardingProgressRepository;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
import com.deutschflow.user.service.LearningPlanService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Bất biến I-6 (claim idempotent + atomic) và I-7 (câu trả lời chỉ thuộc về đúng
 * một tài khoản) — xem docs/onboarding-flow-spec.md §2.2.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GuestOnboardingServiceTest {

    @Mock private GuestOnboardingSessionRepository sessionRepository;
    @Mock private UserOnboardingProgressRepository progressRepository;
    @Mock private LearningPlanService learningPlanService;

    @InjectMocks private GuestOnboardingService service;

    private static final UUID SID = UUID.fromString("11111111-2222-3333-4444-555555555555");

    private static User user(long id) {
        return User.builder().id(id).email("u" + id + "@local.test").displayName("U" + id)
                .role(User.Role.STUDENT).build();
    }

    private static GuestOnboardingSession session(Long claimedBy, Instant expiresAt, Map<String, Object> answers) {
        return GuestOnboardingSession.builder()
                .id(SID).platform("WEB").locale("vi").flowVersion("onb_v3").currentStep("PROFILE")
                .answers(answers == null ? new LinkedHashMap<>() : answers)
                .claimedByUserId(claimedBy)
                .createdAt(Instant.now()).updatedAt(Instant.now())
                .expiresAt(expiresAt)
                .build();
    }

    // ─── create / update ───────────────────────────────────────────────────────

    @Test
    @DisplayName("create sinh id NGẪU NHIÊN và đặt hạn 72h")
    void createGeneratesRandomIdAndTtl() {
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SessionResponse a = service.create(new CreateRequest("WEB", "vi"));
        SessionResponse b = service.create(new CreateRequest("WEB", "vi"));

        // id là bearer token của phiên — tuần tự nghĩa là đoán được phiên người khác.
        assertThat(a.sessionId()).isNotEqualTo(b.sessionId());
        assertThat(a.flowVersion()).isEqualTo("onb_v3");
        assertThat(ChronoUnit.HOURS.between(Instant.now(), a.expiresAt())).isBetween(71L, 72L);
    }

    @Test
    @DisplayName("update phiên ĐÃ HẾT HẠN trả 404, không phải sửa được")
    void updateRejectsExpired() {
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(null, Instant.now().minusSeconds(1), null)));

        assertThatThrownBy(() -> service.update(SID, new UpdateRequest("PROFILE", null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("update phiên ĐÃ CLAIM bị từ chối — sau claim nguồn chân lý là progress")
    void updateRejectsClaimed() {
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(7L, Instant.now().plusSeconds(3600), null)));

        assertThatThrownBy(() -> service.update(SID, new UpdateRequest("PROFILE", null, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("update: trường null nghĩa là KHÔNG ĐỔI, không phải xoá")
    void updateTreatsNullAsUnchanged() {
        Map<String, Object> answers = new LinkedHashMap<>(Map.of("targetLevel", "B1"));
        GuestOnboardingSession s = session(null, Instant.now().plusSeconds(3600), answers);
        when(sessionRepository.findById(SID)).thenReturn(Optional.of(s));
        when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(SID, new UpdateRequest("PATH_CHOICE", null, null));

        assertThat(s.getCurrentStep()).isEqualTo("PATH_CHOICE");
        assertThat(s.getAnswers()).containsEntry("targetLevel", "B1");
    }

    // ─── claim: I-6 + I-7 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("I-6: claim lần hai của CÙNG user là no-op, KHÔNG phát lại hồ sơ")
    void claimIsIdempotent() {
        User u = user(42L);
        // UPDATE không khớp hàng nào vì phiên đã bị chính user này claim trước đó.
        when(sessionRepository.claim(eq(SID), eq(42L), any())).thenReturn(0);
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(42L, Instant.now().plusSeconds(3600), null)));
        when(progressRepository.findById(42L)).thenReturn(Optional.empty());

        ClaimResponse res = service.claim(u, SID.toString(), "WEB");

        assertThat(res.claimed()).isTrue();
        assertThat(res.alreadyClaimed()).isTrue();
        // Phát lại lần hai sẽ ghi đè hồ sơ mà người dùng có thể đã sửa sau đó.
        verify(learningPlanService, never()).saveProfileAndGeneratePlan(any(), any(), any());
    }

    @Test
    @DisplayName("I-7: phiên của người khác KHÔNG được áp lên user hiện tại")
    void claimRefusesSomeoneElsesSession() {
        User u = user(42L);
        when(sessionRepository.claim(eq(SID), eq(42L), any())).thenReturn(0);
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(99L, Instant.now().plusSeconds(3600), null)));

        assertThatThrownBy(() -> service.claim(u, SID.toString(), "WEB"))
                .isInstanceOf(BadRequestException.class);
        verify(learningPlanService, never()).saveProfileAndGeneratePlan(any(), any(), any());
    }

    @Test
    @DisplayName("claim phiên hết hạn trả 404 — không phân biệt với không tồn tại")
    void claimRejectsExpired() {
        User u = user(42L);
        when(sessionRepository.claim(eq(SID), eq(42L), any())).thenReturn(0);
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(null, Instant.now().minusSeconds(1), null)));

        assertThatThrownBy(() -> service.claim(u, SID.toString(), "WEB"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("claim thắng → phát lại câu trả lời thành hồ sơ và ghi progress")
    void claimReplaysAnswers() {
        User u = user(42L);
        Map<String, Object> answers = new LinkedHashMap<>();
        answers.put("targetLevel", "B1");
        answers.put("goalType", "WORK");
        answers.put("currentLevel", "A1");
        answers.put("industry", "IT");
        answers.put("dailyGoalMinutes", 15);
        answers.put("sessionsPerWeek", 5);

        when(sessionRepository.claim(eq(SID), eq(42L), any())).thenReturn(1);
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(42L, Instant.now().plusSeconds(3600), answers)));
        when(progressRepository.findById(42L)).thenReturn(Optional.empty());
        when(progressRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClaimResponse res = service.claim(u, SID.toString(), "WEB");

        assertThat(res.alreadyClaimed()).isFalse();
        ArgumentCaptor<OnboardingProfileRequest> captor =
                ArgumentCaptor.forClass(OnboardingProfileRequest.class);
        verify(learningPlanService).saveProfileAndGeneratePlan(eq(u), captor.capture(), eq("WEB"));
        assertThat(captor.getValue().targetLevel()).isEqualTo("B1");
        assertThat(captor.getValue().industry()).isEqualTo("IT");
        assertThat(captor.getValue().dailyGoalMinutes()).isEqualTo(15);

        ArgumentCaptor<UserOnboardingProgress> progress =
                ArgumentCaptor.forClass(UserOnboardingProgress.class);
        verify(progressRepository).save(progress.capture());
        assertThat(progress.getValue().getUserId()).isEqualTo(42L);
        assertThat(progress.getValue().getFlowVersion()).isEqualTo("onb_v3");
    }

    @Test
    @DisplayName("claim khi phiên CHƯA có targetLevel: vẫn thành công, chỉ không phát lại hồ sơ")
    void claimWithoutTargetLevelSkipsProfileReplay() {
        User u = user(42L);
        Map<String, Object> answers = new LinkedHashMap<>(Map.of("motivation", "JOB"));

        when(sessionRepository.claim(eq(SID), eq(42L), any())).thenReturn(1);
        when(sessionRepository.findById(SID))
                .thenReturn(Optional.of(session(42L, Instant.now().plusSeconds(3600), answers)));
        when(progressRepository.findById(42L)).thenReturn(Optional.empty());
        when(progressRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ClaimResponse res = service.claim(u, SID.toString(), "WEB");

        assertThat(res.claimed()).isTrue();
        // targetLevel là trường bắt buộc duy nhất của hồ sơ — thiếu nó thì không có
        // gì để lưu, nhưng phiên vẫn phải gắn đúng chủ.
        verify(learningPlanService, never()).saveProfileAndGeneratePlan(any(), any(), any());
        verify(progressRepository).save(any());
    }

    @Test
    @DisplayName("sessionId không phải UUID → 400, không nổ 500")
    void claimRejectsMalformedSessionId() {
        assertThatThrownBy(() -> service.claim(user(1L), "khong-phai-uuid", "WEB"))
                .isInstanceOf(BadRequestException.class);
        verify(sessionRepository, never()).claim(any(), anyLong(), any());
    }

    @Test
    @DisplayName("progress rỗng trả mặc định thay vì 404 — client mới đăng ký chưa có dòng nào")
    void readProgressFallsBackToDefault() {
        when(progressRepository.findById(42L)).thenReturn(Optional.empty());

        var p = service.readProgress(user(42L));

        assertThat(p.flowVersion()).isEqualTo("onb_v3");
        assertThat(p.lastStep()).isEqualTo("INTRO");
        assertThat(p.completedActivities()).isEmpty();
        assertThat(p.activatedAt()).isNull();
    }
}
