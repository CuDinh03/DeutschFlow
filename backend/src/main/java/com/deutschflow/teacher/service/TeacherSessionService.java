package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.TeacherSessionDto;
import com.deutschflow.teacher.entity.TeacherProfile;
import com.deutschflow.teacher.entity.TeacherSession;
import com.deutschflow.teacher.entity.TeacherSession.PayoutStatus;
import com.deutschflow.teacher.entity.TeacherSession.Status;
import com.deutschflow.teacher.repository.TeacherProfileRepository;
import com.deutschflow.teacher.repository.TeacherSessionRepository;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TeacherSessionService {

    private final TeacherSessionRepository sessionRepository;
    private final TeacherProfileRepository profileRepository;

    // ── Student: book a session ───────────────────────────────────────────────

    @Transactional
    public TeacherSessionDto bookSession(User student, Long teacherProfileId,
                                         String title, String notes,
                                         LocalDateTime scheduledAt, int durationMinutes) {
        TeacherProfile profile = profileRepository.findByIdWithUser(teacherProfileId)
                .orElseThrow(() -> new NotFoundException("Giáo viên không tồn tại"));

        long price = profile.getHourlyRateVnd() * durationMinutes / 60L;

        TeacherSession session = TeacherSession.builder()
                .student(student)
                .teacherProfile(profile)
                .title(title)
                .notes(notes)
                .scheduledAt(scheduledAt)
                .durationMinutes(durationMinutes)
                .priceVnd(price)
                .status(Status.PENDING)
                .build();

        TeacherSession saved = sessionRepository.save(session);
        log.info("[TeacherSession] booked id={} student={} teacher={} at={} price={}",
                saved.getId(), student.getId(), teacherProfileId, scheduledAt, price);
        return TeacherSessionDto.from(saved);
    }

    // ── Student: list their sessions ─────────────────────────────────────────

    public Page<TeacherSessionDto> getStudentSessions(Long studentId, int page) {
        return sessionRepository.findByStudentId(studentId,
                PageRequest.of(page, 10, Sort.by(Sort.Direction.DESC, "scheduledAt")))
                .map(TeacherSessionDto::from);
    }

    // ── Teacher: list their incoming sessions ────────────────────────────────

    /**
     * IDOR guard: profileId đến từ request param nên không được tin —
     * chỉ chủ hồ sơ (hoặc ADMIN) được xem lịch học/doanh thu của hồ sơ đó.
     */
    private void assertOwnsProfile(User actor, Long teacherProfileId) {
        if (actor.getRole() == User.Role.ADMIN) return;
        TeacherProfile profile = profileRepository.findByIdWithUser(teacherProfileId)
                .orElseThrow(() -> new NotFoundException("Hồ sơ giáo viên không tồn tại"));
        if (!profile.getUser().getId().equals(actor.getId())) {
            throw new ForbiddenException("Bạn không có quyền xem dữ liệu của hồ sơ này");
        }
    }

    public Page<TeacherSessionDto> getTeacherSessions(User actor, Long teacherProfileId, int page) {
        assertOwnsProfile(actor, teacherProfileId);
        return sessionRepository.findByTeacherProfileId(teacherProfileId,
                PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "scheduledAt")))
                .map(TeacherSessionDto::from);
    }

    // ── Teacher: confirm / complete / cancel ─────────────────────────────────

    @Transactional
    public TeacherSessionDto updateStatus(User actor, Long sessionId, String newStatus, String teacherNotes) {
        TeacherSession session = sessionRepository.findByIdFull(sessionId)
                .orElseThrow(() -> new NotFoundException("Phiên học không tồn tại"));

        boolean isTeacher = session.getTeacherProfile().getUser().getId().equals(actor.getId());
        boolean isStudent = session.getStudent().getId().equals(actor.getId());

        if (!isTeacher && !isStudent) {
            throw new ForbiddenException("Bạn không có quyền cập nhật phiên học này");
        }

        Status target = Status.valueOf(newStatus.toUpperCase());

        // Transition guard
        if (target == Status.CONFIRMED && !isTeacher) throw new ForbiddenException("Chỉ giáo viên mới có thể xác nhận");
        if (target == Status.COMPLETED && !isTeacher) throw new ForbiddenException("Chỉ giáo viên mới có thể hoàn thành");

        session.setStatus(target);
        if (teacherNotes != null) session.setTeacherNotes(teacherNotes);

        // Mark payout eligible when completed
        if (target == Status.COMPLETED) {
            session.setPayoutStatus(PayoutStatus.PENDING);
        }

        return TeacherSessionDto.from(sessionRepository.save(session));
    }

    // ── Student: submit review ────────────────────────────────────────────────

    @Transactional
    public TeacherSessionDto submitReview(User student, Long sessionId, short rating, String reviewText) {
        TeacherSession session = sessionRepository.findByIdFull(sessionId)
                .orElseThrow(() -> new NotFoundException("Phiên học không tồn tại"));

        if (!session.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Bạn không có quyền đánh giá phiên học này");
        }
        if (session.getStatus() != Status.COMPLETED) {
            throw new IllegalStateException("Chỉ có thể đánh giá phiên học đã hoàn thành");
        }

        session.setTeacherRating(rating);
        session.setStudentReviewText(reviewText);
        return TeacherSessionDto.from(sessionRepository.save(session));
    }

    // ── Teacher: earnings summary ─────────────────────────────────────────────

    public Map<String, Object> getEarningsSummary(User actor, Long teacherProfileId) {
        assertOwnsProfile(actor, teacherProfileId);
        long totalEarnings = sessionRepository.sumEarningsByTeacherProfile(teacherProfileId);
        long platformFee = (long) (totalEarnings * 0.15);
        return Map.of(
                "totalEarningsVnd", totalEarnings,
                "platformFeeVnd", platformFee,
                "netEarningsVnd", totalEarnings - platformFee
        );
    }

    // ── Admin: payout management ─────────────────────────────────────────────

    public List<TeacherSessionDto> getPendingPayouts() {
        return sessionRepository.findByPayoutStatus(PayoutStatus.PENDING)
                .stream().map(TeacherSessionDto::from).toList();
    }

    @Transactional
    public void markPayoutProcessed(List<Long> sessionIds) {
        for (Long id : sessionIds) {
            sessionRepository.findById(id).ifPresent(s -> {
                s.setPayoutStatus(PayoutStatus.PROCESSED);
                s.setPayoutProcessedAt(LocalDateTime.now());
                sessionRepository.save(s);
            });
        }
    }
}
