package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamBlueprint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SpeakingExamBlueprintRepository extends JpaRepository<SpeakingExamBlueprint, Long> {

    Optional<SpeakingExamBlueprint> findFirstByProviderAndLevelAndActiveTrueOrderByVersionDesc(String provider, String level);

    List<SpeakingExamBlueprint> findByActiveTrueOrderByProviderAscLevelAsc();
}
