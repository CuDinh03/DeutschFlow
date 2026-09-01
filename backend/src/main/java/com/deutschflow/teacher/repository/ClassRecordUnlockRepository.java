package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassRecordUnlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ClassRecordUnlockRepository extends JpaRepository<ClassRecordUnlock, Long> {

    /** Mở khóa còn hiệu lực cho (lớp, giáo viên) — session_id null phủ mọi buổi của lớp. */
    @Query("""
            SELECT u FROM ClassRecordUnlock u
            WHERE u.classId = :classId AND u.grantedTo = :teacherId AND u.expiresAt > :now
              AND (u.sessionId IS NULL OR u.sessionId = :sessionId)
            """)
    List<ClassRecordUnlock> findActive(@Param("classId") Long classId,
                                       @Param("teacherId") Long teacherId,
                                       @Param("sessionId") Long sessionId,
                                       @Param("now") LocalDateTime now);

    List<ClassRecordUnlock> findByClassIdAndExpiresAtAfterOrderByGrantedAtDesc(Long classId, LocalDateTime now);
}
