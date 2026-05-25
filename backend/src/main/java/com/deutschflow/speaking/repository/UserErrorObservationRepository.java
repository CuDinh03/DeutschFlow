package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.UserErrorObservation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserErrorObservationRepository extends JpaRepository<UserErrorObservation, Long> {
}
