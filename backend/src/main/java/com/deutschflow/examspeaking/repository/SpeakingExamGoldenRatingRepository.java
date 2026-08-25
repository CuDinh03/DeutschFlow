package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamGoldenRating;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SpeakingExamGoldenRatingRepository extends JpaRepository<SpeakingExamGoldenRating, Long> {

    List<SpeakingExamGoldenRating> findBySessionId(Long sessionId);

    List<SpeakingExamGoldenRating> findBySessionIdAndRaterUserId(Long sessionId, Long raterUserId);

    List<SpeakingExamGoldenRating> findBySessionIdIn(Collection<Long> sessionIds);

    void deleteBySessionIdAndRaterUserId(Long sessionId, Long raterUserId);
}
