package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeTopic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeTopicRepository extends JpaRepository<TreeTopic, Long> {

    /** All topics for a set of levels, ordered for deterministic tree assembly. */
    List<TreeTopic> findByLevelCodeInOrderByLevelCodeAscSkillCodeAscUnlockOrderAsc(List<String> levelCodes);
}
