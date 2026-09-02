package com.deutschflow.system.repository;

import com.deutschflow.system.entity.MaintenanceWindow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MaintenanceWindowRepository extends JpaRepository<MaintenanceWindow, Long> {

    /** Window đang ACTIVE (tối đa một — partial unique index). */
    Optional<MaintenanceWindow> findFirstByStatus(MaintenanceWindow.Status status);

    /** Lịch SCHEDULED gần nhất có starts_at ≤ mốc cho trước (kể cả đã quá giờ chờ bật tay). */
    Optional<MaintenanceWindow> findFirstByStatusAndStartsAtLessThanEqualOrderByStartsAtAsc(
            MaintenanceWindow.Status status, LocalDateTime startsBefore);

    /** Admin list — mới nhất trước. */
    Page<MaintenanceWindow> findAllByOrderByStartsAtDesc(Pageable pageable);

    /** Nhắc trước giờ: SCHEDULED chưa nhắc, bắt đầu trong (now, now+remind]. */
    List<MaintenanceWindow> findByStatusAndNotifiedBeforeAtIsNullAndStartsAtBetween(
            MaintenanceWindow.Status status, LocalDateTime from, LocalDateTime to);

    /** Tự bật: SCHEDULED có auto_activate và đã đến giờ. */
    List<MaintenanceWindow> findByStatusAndAutoActivateTrueAndStartsAtLessThanEqual(
            MaintenanceWindow.Status status, LocalDateTime now);

    /** Tự tắt: ACTIVE có auto_complete và đã quá ends_at. */
    List<MaintenanceWindow> findByStatusAndAutoCompleteTrueAndEndsAtLessThanEqual(
            MaintenanceWindow.Status status, LocalDateTime now);

    /** ACTIVE đã quá ends_at (chuông quên tắt — service tự lọc nhịp lặp theo overdue_alerted_at). */
    List<MaintenanceWindow> findByStatusAndEndsAtLessThanEqual(
            MaintenanceWindow.Status status, LocalDateTime now);

    /**
     * Các window (theo tập status truyền vào — thực tế SCHEDULED/ACTIVE) giao với khoảng
     * [startsAt, endsAt) — cảnh báo mềm khi admin đặt lịch chồng lấn (không chặn).
     * ends_at NULL coi như vô hạn.
     */
    @Query("""
            SELECT w FROM MaintenanceWindow w
            WHERE w.status IN :statuses
              AND w.startsAt < :endsAt
              AND (w.endsAt IS NULL OR w.endsAt > :startsAt)
            """)
    List<MaintenanceWindow> findOverlapping(@Param("startsAt") LocalDateTime startsAt,
                                            @Param("endsAt") LocalDateTime endsAt,
                                            @Param("statuses") Collection<MaintenanceWindow.Status> statuses);
}
