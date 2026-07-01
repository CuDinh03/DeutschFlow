package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    /** Lịch tuần của một lớp. */
    List<ClassSession> findByClassIdAndStartAtBetweenOrderByStartAt(
            Long classId, LocalDateTime from, LocalDateTime to);

    /** Toàn bộ lịch buổi của một lớp (cho học viên xem, P5). */
    List<ClassSession> findByClassIdOrderByStartAt(Long classId);

    /** Lịch tuần gộp của nhiều lớp (các lớp một giáo viên dạy). */
    @Query("""
            SELECT cs FROM ClassSession cs
            WHERE cs.classId IN :classIds AND cs.startAt BETWEEN :from AND :to
            ORDER BY cs.startAt
            """)
    List<ClassSession> findForClassesInRange(@Param("classIds") List<Long> classIds,
                                             @Param("from") LocalDateTime from,
                                             @Param("to") LocalDateTime to);

    /** Buổi (tương lai) do một pattern sinh ra — dùng khi regenerate. */
    List<ClassSession> findByPatternIdAndStartAtGreaterThanEqual(Long patternId, LocalDateTime from);

    /**
     * Cảnh báo trùng phòng: buổi SCHEDULED khác cùng phòng giao thời gian với [start, end).
     * Native vì cần số học interval của Postgres (duration_minutes * INTERVAL '1 minute').
     * selfId có thể null (buổi mới chưa lưu) → khi đó không loại trừ chính nó.
     */
    @Query(value = """
            SELECT * FROM class_sessions cs
            WHERE cs.room = :room
              AND cs.status = 'SCHEDULED'
              AND (:selfId IS NULL OR cs.id <> :selfId)
              AND cs.start_at < :end
              AND :start < cs.start_at + (cs.duration_minutes * INTERVAL '1 minute')
            ORDER BY cs.start_at
            """, nativeQuery = true)
    List<ClassSession> findRoomConflicts(@Param("room") String room,
                                         @Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end,
                                         @Param("selfId") Long selfId);
}
