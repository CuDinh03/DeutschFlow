package com.deutschflow.notification.jobs;

import com.deutschflow.notification.service.UserNotificationService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DailyNotificationJobTest {

    @Mock
    UserRepository userRepository;

    @Mock
    UserNotificationService userNotificationService;

    @Mock
    JdbcTemplate jdbcTemplate;

    @InjectMocks
    DailyNotificationJob job;

    /** Reflectively invoke the package-private logic we need to exercise. */
    private void invokeSendReviewDueIfNeeded(User student) throws Exception {
        Method m = DailyNotificationJob.class.getDeclaredMethod("sendReviewDueIfNeeded", User.class);
        m.setAccessible(true);
        m.invoke(job, student);
    }

    @Test
    @DisplayName("queries the canonical vocab_review_schedule table — not the non-existent review_queue")
    void sendReviewDueIfNeeded_queriesCanonicalSrsTable() throws Exception {
        User student = User.builder().id(7L).build();
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(7L))).thenReturn(0);

        invokeSendReviewDueIfNeeded(student);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate).queryForObject(sql.capture(), eq(Integer.class), eq(7L));
        // Regression guard: the previous SQL "FROM review_queue" referenced a table that has
        // never existed in any migration, so the job threw every hour it ran.
        assertThat(sql.getValue())
                .as("review-due query must target the real canonical SRS table")
                .contains("vocab_review_schedule")
                .doesNotContain("review_queue");
    }

    @Test
    @DisplayName("no due cards → does not send REVIEW_DUE")
    void sendReviewDueIfNeeded_noDueCards_doesNotSend() throws Exception {
        User student = User.builder().id(7L).build();
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(7L))).thenReturn(0);

        invokeSendReviewDueIfNeeded(student);

        verify(userNotificationService, never()).onReviewDue(anyLong(), any(Integer.class));
    }

    @Test
    @DisplayName("due cards + not yet sent today → sends REVIEW_DUE with the actual count")
    void sendReviewDueIfNeeded_dueAndNotYetSent_sends() throws Exception {
        User student = User.builder().id(7L).build();
        // 1st queryForObject(Integer.class) → the due-count query
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(7L))).thenReturn(5);
        // 2nd queryForObject(Long.class)    → the "already sent today?" guard
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7L))).thenReturn(0L);

        invokeSendReviewDueIfNeeded(student);

        verify(userNotificationService).onReviewDue(7L, 5);
    }

    @Test
    @DisplayName("due cards but already sent today → does NOT resend (idempotent per day)")
    void sendReviewDueIfNeeded_alreadySent_skips() throws Exception {
        User student = User.builder().id(7L).build();
        when(jdbcTemplate.queryForObject(anyString(), eq(Integer.class), eq(7L))).thenReturn(5);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7L))).thenReturn(1L);

        invokeSendReviewDueIfNeeded(student);

        verify(userNotificationService, never()).onReviewDue(anyLong(), any(Integer.class));
        verify(jdbcTemplate, times(1)).queryForObject(anyString(), eq(Long.class), eq(7L));
    }
}
