package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamCalibrationParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpeakingExamCalibrationParticipantRepository
        extends JpaRepository<SpeakingExamCalibrationParticipant, Long> {

    List<SpeakingExamCalibrationParticipant> findAllByOrderByConsentedAtDesc();
}
