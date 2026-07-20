package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.ClassLessonLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ClassLessonLogRepository extends JpaRepository<ClassLessonLog, Long> {
    List<ClassLessonLog> findByClassIdOrderBySessionDateAscSessionNumberAsc(Long classId);
    List<ClassLessonLog> findByClassIdOrderBySessionDateDesc(Long classId);
    int countByClassId(Long classId);

    /**
     * Nhật ký đã ghi cho cùng một buổi của lớp. Dùng để chặn ghi trùng: số buổi là căn cứ tính
     * công giáo viên, nên một lần bấm Lưu hai lần (double-click / mạng chập) là trả thừa công.
     * Trả về List thay vì boolean để {@code updateLog} loại chính bản ghi đang sửa ra khỏi phép so.
     */
    List<ClassLessonLog> findByClassIdAndSessionDate(Long classId, LocalDate sessionDate);
}
