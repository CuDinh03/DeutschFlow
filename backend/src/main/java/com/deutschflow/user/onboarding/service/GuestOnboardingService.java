package com.deutschflow.user.onboarding.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ClaimResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.CreateRequest;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ProgressResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.SessionResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.UpdateRequest;
import com.deutschflow.user.onboarding.entity.GuestOnboardingSession;
import com.deutschflow.user.onboarding.entity.UserOnboardingProgress;
import com.deutschflow.user.onboarding.repository.GuestOnboardingSessionRepository;
import com.deutschflow.user.onboarding.repository.UserOnboardingProgressRepository;
import com.deutschflow.user.service.LearningPlanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Phiên onboarding của khách + tiến độ server-side.
 *
 * <p>Đặc tả: {@code docs/onboarding-flow-spec.md} §4.3. Ba bất biến được thi hành ở đây:
 * <ul>
 *   <li><b>I-2</b> — mọi state sau AUTH có bản ghi server-side ({@code user_onboarding_progress}).</li>
 *   <li><b>I-6</b> — claim idempotent và atomic.</li>
 *   <li><b>I-7</b> — câu trả lời của khách chỉ áp cho user đã claim đúng phiên đó,
 *       không phải "ai đang ngồi trước máy".</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GuestOnboardingService {

    /** Phiên bản luồng — gắn vào mọi bản ghi để so cohort khi rollout theo %. */
    public static final String FLOW_VERSION = "onb_v3";

    /** Quyết định owner Q-C (28/08): giữ 72h. Đừng tự nới. */
    static final Duration SESSION_TTL = Duration.ofHours(72);

    private static final String STEP_INTRO = "INTRO";
    private static final String STEP_CLAIMED = "CLAIMED";

    private final GuestOnboardingSessionRepository sessionRepository;
    private final UserOnboardingProgressRepository progressRepository;
    private final LearningPlanService learningPlanService;

    // ─── Guest (chưa đăng nhập) ────────────────────────────────────────────────

    @Transactional
    public SessionResponse create(CreateRequest request) {
        Instant now = Instant.now();
        GuestOnboardingSession session = GuestOnboardingSession.builder()
                // randomUUID: id này là bearer token của phiên, tuần tự là đoán được.
                .id(UUID.randomUUID())
                .platform(request.platform())
                .locale(request.locale())
                .flowVersion(FLOW_VERSION)
                .currentStep(STEP_INTRO)
                .answers(new LinkedHashMap<>())
                .createdAt(now)
                .updatedAt(now)
                .expiresAt(now.plus(SESSION_TTL))
                .build();
        return toResponse(sessionRepository.save(session));
    }

    /**
     * Cập nhật từng phần. Trường null = "không đổi", KHÔNG phải "xoá".
     *
     * <p>Phiên đã claim hoặc đã hết hạn thì từ chối: sau khi claim, nguồn chân lý
     * là {@code user_onboarding_progress}, cho ghi tiếp vào đây là mở đường cho ai
     * cầm được sessionId đi sửa dữ liệu của một tài khoản đã tồn tại.
     */
    @Transactional
    public SessionResponse update(UUID sessionId, UpdateRequest request) {
        GuestOnboardingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Phiên onboarding không tồn tại hoặc đã hết hạn."));

        Instant now = Instant.now();
        // Hết hạn trả 404 giống hệt không tồn tại: phân biệt hai ca là rò rỉ thông
        // tin cho người đang dò sessionId.
        if (session.isExpiredAt(now)) {
            throw new NotFoundException("Phiên onboarding không tồn tại hoặc đã hết hạn.");
        }
        if (session.isClaimed()) {
            throw new BadRequestException("Phiên onboarding đã được gắn vào một tài khoản, không sửa được nữa.");
        }

        if (request.currentStep() != null) {
            session.setCurrentStep(request.currentStep());
        }
        if (request.answers() != null) {
            session.setAnswers(new LinkedHashMap<>(request.answers()));
        }
        if (request.activityResult() != null) {
            session.setActivityResult(new LinkedHashMap<>(request.activityResult()));
        }
        session.setUpdatedAt(now);
        return toResponse(sessionRepository.save(session));
    }

    // ─── Authed ────────────────────────────────────────────────────────────────

    /**
     * Gắn phiên khách vào user vừa đăng nhập, rồi phát lại câu trả lời thành hồ sơ học.
     *
     * <p><b>I-6 (idempotent).</b> Gọi lần hai với cùng phiên = no-op, trả
     * {@code alreadyClaimed=true} chứ không phải lỗi. Client retry sau timeout là
     * chuyện bình thường, và bắt nó phân biệt "đã claim" với "claim hỏng" là đẩy
     * việc khó sang chỗ ít thông tin nhất.
     *
     * <p><b>I-6 (atomic).</b> Việc giành quyền nằm trong chính câu UPDATE
     * ({@code … WHERE claimed_by_user_id IS NULL}), không phải trong một lần đọc
     * trước đó. Hai request song song đều thấy NULL, nhưng chỉ một câu UPDATE khớp.
     */
    @Transactional
    public ClaimResponse claim(User user, String rawSessionId, String platform) {
        UUID sessionId = parseSessionId(rawSessionId);
        Instant now = Instant.now();

        int updated = sessionRepository.claim(sessionId, user.getId(), now);
        if (updated == 0) {
            // Thua cuộc đua, hoặc phiên không hợp lệ. Đọc lại để phân biệt.
            GuestOnboardingSession existing = sessionRepository.findById(sessionId).orElse(null);
            if (existing == null || existing.isExpiredAt(now)) {
                throw new NotFoundException("Phiên onboarding không tồn tại hoặc đã hết hạn.");
            }
            if (user.getId().equals(existing.getClaimedByUserId())) {
                // Chính user này đã claim trước đó → no-op, KHÔNG phát lại hồ sơ.
                return new ClaimResponse(true, true, readProgress(user));
            }
            // I-7: phiên thuộc về người khác. Không được áp câu trả lời của họ lên user này.
            log.warn("[GUEST_CLAIM_DENIED] userId={} thử claim phiên đã thuộc userId={}",
                    user.getId(), existing.getClaimedByUserId());
            throw new BadRequestException("Phiên onboarding này đã thuộc về một tài khoản khác.");
        }

        GuestOnboardingSession session = sessionRepository.findById(sessionId).orElseThrow();
        replayAnswersIntoProfile(user, session, platform);
        UserOnboardingProgress progress = upsertProgress(user, session, now);
        return new ClaimResponse(true, false, toResponse(progress));
    }

    @Transactional(readOnly = true)
    public ProgressResponse readProgress(User user) {
        return progressRepository.findById(user.getId())
                .map(GuestOnboardingService::toResponse)
                .orElse(new ProgressResponse(FLOW_VERSION, STEP_INTRO, List.of(), null, null));
    }

    // ─── Nội bộ ────────────────────────────────────────────────────────────────

    /**
     * Phát lại câu trả lời khách thành hồ sơ học, dùng lại đúng service của
     * {@code POST /onboarding/profile} (UPSERT, nên gọi lại là cập nhật).
     *
     * <p>Không có {@code targetLevel} thì bỏ qua: đó là trường bắt buộc duy nhất
     * của hồ sơ, thiếu nó nghĩa là khách chưa đi qua bước hồ sơ — claim vẫn thành
     * công (phiên đã gắn đúng chủ), chỉ là chưa có gì để lưu.
     */
    private void replayAnswersIntoProfile(User user, GuestOnboardingSession session, String platform) {
        Map<String, Object> a = session.getAnswers();
        if (a == null || a.isEmpty()) {
            return;
        }
        String targetLevel = str(a.get("targetLevel"));
        if (targetLevel == null || targetLevel.isBlank()) {
            log.info("[GUEST_CLAIM] userId={} phiên chưa có targetLevel — bỏ qua phát lại hồ sơ", user.getId());
            return;
        }
        String goalType = str(a.get("goalType"));
        Integer dailyGoalMinutes = intOrNull(a.get("dailyGoalMinutes"));
        Integer sessionsPerWeek = intOrNull(a.get("sessionsPerWeek"));

        OnboardingProfileRequest req = new OnboardingProfileRequest(
                goalType == null ? "WORK" : goalType,
                targetLevel,
                str(a.get("currentLevel")),
                null,
                null,
                "CERT".equals(goalType) ? null : str(a.get("industry")),
                null,
                "CERT".equals(goalType) ? str(a.get("examType")) : null,
                sessionsPerWeek,
                null,
                str(a.get("learningSpeed")),
                str(a.get("motivation")),
                dailyGoalMinutes);
        learningPlanService.saveProfileAndGeneratePlan(user, req, platform);
    }

    private UserOnboardingProgress upsertProgress(User user, GuestOnboardingSession session, Instant now) {
        UserOnboardingProgress progress = progressRepository.findById(user.getId())
                .orElseGet(() -> UserOnboardingProgress.builder()
                        .userId(user.getId())
                        .flowVersion(session.getFlowVersion())
                        .completedActivities(new ArrayList<>())
                        .createdAt(now)
                        .build());
        progress.setLastStep(STEP_CLAIMED);
        progress.setUpdatedAt(now);
        if (progress.getCompletedActivities() == null) {
            progress.setCompletedActivities(new ArrayList<>());
        }
        String activity = str(session.getCurrentStep());
        if (session.getActivityResult() != null && activity != null
                && !progress.getCompletedActivities().contains(activity)) {
            progress.getCompletedActivities().add(activity);
        }
        return progressRepository.save(progress);
    }

    private static UUID parseSessionId(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("sessionId không hợp lệ.");
        }
    }

    private static SessionResponse toResponse(GuestOnboardingSession s) {
        return new SessionResponse(s.getId(), s.getCurrentStep(), s.getFlowVersion(), s.getExpiresAt());
    }

    private static ProgressResponse toResponse(UserOnboardingProgress p) {
        return new ProgressResponse(
                p.getFlowVersion(),
                p.getLastStep(),
                p.getCompletedActivities() == null ? List.of() : List.copyOf(p.getCompletedActivities()),
                p.getActivatedAt(),
                p.getCoreCompletedAt());
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Integer intOrNull(Object o) {
        if (o instanceof Number n) return n.intValue();
        if (o instanceof String s && !s.isBlank()) {
            try {
                return Integer.valueOf(s.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
