package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamSessionRepository extends JpaRepository<SpeakingExamSession, Long> {

    Optional<SpeakingExamSession> findByIdAndUserId(Long id, Long userId);

    List<SpeakingExamSession> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    /** Phiên còn giữ audio của một người — dùng khi họ rút lại đồng ý hiệu chuẩn (purge). */
    List<SpeakingExamSession> findByUserIdAndRetainAudioTrue(Long userId);
}
