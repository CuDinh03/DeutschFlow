package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
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
     * Buổi của một pattern còn "sống" với cửa sổ regenerate: hoặc còn ở tương lai, hoặc ĐÃ BỊ DỜI
     * ra khỏi tương lai nhưng ô lịch GỐC vẫn nằm trong tương lai (V262).
     *
     * <p>Vế thứ hai là bắt buộc: chỉ lọc theo {@code startAt} thì một buổi bị dời LÙI (dạy bù sớm,
     * ví dụ Thứ Hai 27/07 kéo về Thứ Bảy 18/07) sẽ tuột khỏi tập ứng viên, {@code originalDate} của
     * nó không bao giờ vào {@code keptDates}, và ô gốc 27/07 bị sinh lại thành buổi ma — đúng lỗi
     * mà cột {@code original_date} sinh ra để diệt, chỉ khác chiều dời.
     *
     * <p>Bản ghi trước V262 có {@code originalDate} NULL nên chỉ lọt qua vế {@code startAt} — giữ
     * nguyên hành vi cũ, không đổi cách xử lý dữ liệu sẵn có.
     */
    @Query("""
            SELECT cs FROM ClassSession cs
            WHERE cs.patternId = :patternId
              AND (cs.startAt >= :from OR cs.originalDate >= :fromDate)
            """)
    List<ClassSession> findLiveForPattern(@Param("patternId") Long patternId,
                                          @Param("from") LocalDateTime from,
                                          @Param("fromDate") LocalDate fromDate);

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

    /**
     * Teacher double-booking guard: SCHEDULED sessions in any of the given classes (the classes a
     * teacher teaches) whose time window overlaps [start, end). Used to HARD-block scheduling the
     * same teacher into two places at once. Interval math mirrors {@link #findRoomConflicts}.
     * {@code selfId} excludes the session being edited (null when creating a not-yet-persisted one).
     */
    @Query(value = """
            SELECT * FROM class_sessions cs
            WHERE cs.class_id IN (:classIds)
              AND cs.status = 'SCHEDULED'
              AND (:selfId IS NULL OR cs.id <> :selfId)
              AND cs.start_at < :end
              AND :start < cs.start_at + (cs.duration_minutes * INTERVAL '1 minute')
            ORDER BY cs.start_at
            """, nativeQuery = true)
    List<ClassSession> findTeacherTimeConflicts(@Param("classIds") List<Long> classIds,
                                                @Param("start") LocalDateTime start,
                                                @Param("end") LocalDateTime end,
                                                @Param("selfId") Long selfId);
}
