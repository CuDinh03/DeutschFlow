package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.SpeakingUserState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpeakingUserStateRepository extends JpaRepository<SpeakingUserState, Long> {
}
