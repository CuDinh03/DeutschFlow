package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.UserErrorSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserErrorSkillRepository extends JpaRepository<UserErrorSkill, Long> {

    long countByUserId(Long userId);

    Optional<UserErrorSkill> findByUserIdAndErrorCode(Long userId, String errorCode);

    @Query("SELECT s FROM UserErrorSkill s WHERE s.userId = :userId ORDER BY s.priorityScore DESC")
    List<UserErrorSkill> findByUserIdOrderByPriorityScoreDesc(@Param("userId") Long userId);
}
