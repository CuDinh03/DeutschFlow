package com.deutschflow.user.onboarding;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.entity.GuestOnboardingSession;
import com.deutschflow.user.onboarding.job.GuestOnboardingSessionCleanupJob;
import com.deutschflow.user.onboarding.repository.GuestOnboardingSessionRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bất biến I-6 — claim ATOMIC — kiểm trên Postgres thật, không phải mock.
 *
 * <p>Test đơn vị chỉ chứng minh được "service gọi đúng câu query". Việc "hai
 * request song song thì đúng một bên thắng" là tính chất của CHÍNH câu UPDATE
 * dưới mức cô lập giao dịch thật, nên nó phải chạy trên DB thật mới có ý nghĩa.
 */
@SpringBootTest
class GuestOnboardingClaimIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private GuestOnboardingSessionRepository sessionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private GuestOnboardingSessionCleanupJob cleanupJob;

    private User newUser() {
        return userRepository.save(User.builder()
                .email("guest-onb-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h")
                .displayName("Guest Onb IT")
                .role(User.Role.STUDENT)
                .build());
    }

    private GuestOnboardingSession newSession(Instant expiresAt) {
        Instant now = Instant.now();
        return sessionRepository.save(GuestOnboardingSession.builder()
                .id(UUID.randomUUID())
                .platform("WEB").locale("vi").flowVersion("onb_v3").currentStep("PROFILE")
                .answers(new LinkedHashMap<>())
                .createdAt(now).updatedAt(now)
                .expiresAt(expiresAt)
                .build());
    }

    @Test
    @DisplayName("I-6: tám request claim song song → ĐÚNG MỘT bên thắng")
    void concurrentClaimHasExactlyOneWinner() throws Exception {
        GuestOnboardingSession session = newSession(Instant.now().plusSeconds(3600));
        List<User> contenders = List.of(newUser(), newUser(), newUser(), newUser(),
                newUser(), newUser(), newUser(), newUser());

        int n = contenders.size();
        // Barrier để cả 8 luồng chạm câu UPDATE gần nhau nhất có thể — chạy tuần tự
        // thì test xanh cả khi code là check-then-act, tức là không chứng minh gì.
        CyclicBarrier barrier = new CyclicBarrier(n);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        AtomicInteger winners = new AtomicInteger();
        try {
            List<Future<Integer>> futures = contenders.stream()
                    .map(u -> pool.submit((Callable<Integer>) () -> {
                        barrier.await(10, TimeUnit.SECONDS);
                        int updated = sessionRepository.claim(session.getId(), u.getId(), Instant.now());
                        if (updated == 1) winners.incrementAndGet();
                        return updated;
                    }))
                    .toList();
            for (Future<Integer> f : futures) {
                f.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(winners.get())
                .as("đúng một request được phép gắn phiên vào tài khoản")
                .isEqualTo(1);

        GuestOnboardingSession after = sessionRepository.findById(session.getId()).orElseThrow();
        assertThat(after.getClaimedByUserId()).isNotNull();
        assertThat(after.getClaimedAt()).isNotNull();
    }

    @Test
    @DisplayName("claim phiên ĐÃ HẾT HẠN không đổi được hàng nào")
    void expiredSessionCannotBeClaimed() {
        GuestOnboardingSession expired = newSession(Instant.now().minusSeconds(1));
        User u = newUser();

        int updated = sessionRepository.claim(expired.getId(), u.getId(), Instant.now());

        assertThat(updated).isZero();
        assertThat(sessionRepository.findById(expired.getId()).orElseThrow().getClaimedByUserId()).isNull();
    }

    @Test
    @DisplayName("claim lần hai trên phiên đã có chủ trả 0 — cửa vào của nhánh idempotent")
    void secondClaimChangesNothing() {
        GuestOnboardingSession session = newSession(Instant.now().plusSeconds(3600));
        User first = newUser();
        User second = newUser();

        assertThat(sessionRepository.claim(session.getId(), first.getId(), Instant.now())).isEqualTo(1);
        assertThat(sessionRepository.claim(session.getId(), second.getId(), Instant.now())).isZero();

        assertThat(sessionRepository.findById(session.getId()).orElseThrow().getClaimedByUserId())
                .isEqualTo(first.getId());
    }

    @Test
    @DisplayName("job dọn rác xoá phiên hết hạn và GIỮ phiên còn hạn")
    void cleanupRemovesOnlyExpired() {
        GuestOnboardingSession expired = newSession(Instant.now().minusSeconds(60));
        GuestOnboardingSession alive = newSession(Instant.now().plusSeconds(3600));

        cleanupJob.purgeExpiredSessions();

        assertThat(sessionRepository.findById(expired.getId())).isEmpty();
        assertThat(sessionRepository.findById(alive.getId())).isPresent();
    }
}
