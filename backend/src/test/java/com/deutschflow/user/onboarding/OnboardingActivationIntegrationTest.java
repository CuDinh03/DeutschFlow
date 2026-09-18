package com.deutschflow.user.onboarding;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.dto.ActivationDtos.ActivationResponse;
import com.deutschflow.user.onboarding.dto.ActivationDtos.CoreDoneResponse;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
import com.deutschflow.user.onboarding.service.OnboardingActivationService;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ACTIVATION trên Postgres thật (Đợt 1 kế hoạch onboarding 17/09, bất biến I-3 + I-12):
 * {@code activated_at} ghi đúng một lần, từ một endpoint, an toàn đua.
 */
@SpringBootTest
class OnboardingActivationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private OnboardingActivationService service;
    @Autowired private GuestOnboardingService guestService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    private User newUser() {
        return userRepository.save(User.builder()
                .email("act-" + System.nanoTime() + "@local.test")
                .passwordHash("$2a$10$h")
                .displayName("Activation IT")
                .role(User.Role.STUDENT)
                .build());
    }

    @Test
    @DisplayName("Lần đầu ghi activated_at (firstTime=true); lần sau kind khác chỉ nối activity, mốc không đổi")
    void firstLessonIsRecordedOnce() {
        User u = newUser();

        ActivationResponse first = service.recordFirstLesson(u.getId(), FirstLessonKind.FIRST_SENTENCE);
        assertThat(first.firstTime()).isTrue();
        assertThat(first.activatedAt()).isNotNull();
        assertThat(first.completedActivities()).containsExactly("FIRST_LESSON:FIRST_SENTENCE");

        ActivationResponse second = service.recordFirstLesson(u.getId(), FirstLessonKind.ROADMAP_NODE);
        assertThat(second.firstTime()).isFalse();
        assertThat(second.activatedAt()).isEqualTo(first.activatedAt());
        assertThat(second.completedActivities())
                .containsExactly("FIRST_LESSON:FIRST_SENTENCE", "FIRST_LESSON:ROADMAP_NODE");

        // Gọi lại cùng kind → không nhân đôi activity.
        ActivationResponse again = service.recordFirstLesson(u.getId(), FirstLessonKind.ROADMAP_NODE);
        assertThat(again.completedActivities()).hasSize(2);

        // Dòng tiến độ tồn tại dù chưa từng claim guest session (người đăng ký thẳng).
        String flow = jdbc.queryForObject(
                "SELECT flow_version FROM user_onboarding_progress WHERE user_id = ?", String.class, u.getId());
        assertThat(flow).isEqualTo("onb_v3");
        assertThat(guestService.readProgress(u).activatedAt()).isEqualTo(first.activatedAt());
        assertThat(guestService.readProgress(u).lastStep()).isEqualTo("FIRST_LESSON");
    }

    @Test
    @DisplayName("core-done idempotent; sau đó activation không đè last_step=CORE_DONE")
    void coreDoneIsIdempotentAndKeepsLastStep() {
        User u = newUser();

        CoreDoneResponse a = service.recordCoreDone(u.getId());
        CoreDoneResponse b = service.recordCoreDone(u.getId());
        assertThat(a.firstTime()).isTrue();
        assertThat(b.firstTime()).isFalse();
        assertThat(b.coreCompletedAt()).isEqualTo(a.coreCompletedAt());

        service.recordFirstLesson(u.getId(), FirstLessonKind.BEGINNER_SESSION);
        assertThat(guestService.readProgress(u).lastStep()).isEqualTo("CORE_DONE");
        assertThat(guestService.readProgress(u).activatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Tám lời gọi song song → ĐÚNG MỘT firstTime=true, activated_at duy nhất")
    void concurrentActivationHasExactlyOneFirstTime() throws Exception {
        User u = newUser();
        int n = 8;
        CyclicBarrier barrier = new CyclicBarrier(n);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        AtomicInteger firsts = new AtomicInteger();
        try {
            List<Future<ActivationResponse>> futures = java.util.stream.IntStream.range(0, n)
                    .mapToObj(i -> pool.submit((Callable<ActivationResponse>) () -> {
                        barrier.await(10, TimeUnit.SECONDS);
                        ActivationResponse r = service.recordFirstLesson(u.getId(),
                                FirstLessonKind.values()[i % FirstLessonKind.values().length]);
                        if (r.firstTime()) firsts.incrementAndGet();
                        return r;
                    }))
                    .toList();
            for (Future<ActivationResponse> f : futures) {
                f.get(30, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(firsts.get()).isEqualTo(1);
        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_onboarding_progress WHERE user_id = ?", Integer.class, u.getId());
        assertThat(rows).isEqualTo(1);
    }

    @Test
    @DisplayName("recordFirstLessonQuietly không ném dù userId không tồn tại (FK) — hook không đổ việc học")
    void quietVariantSwallowsErrors() {
        service.recordFirstLessonQuietly(-999_999L, FirstLessonKind.PLACEMENT);
        service.recordFirstLessonQuietly(null, FirstLessonKind.PLACEMENT);
        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_onboarding_progress WHERE user_id = -999999", Integer.class);
        assertThat(rows).isZero();
    }
}
