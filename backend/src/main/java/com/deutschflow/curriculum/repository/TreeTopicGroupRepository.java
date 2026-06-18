package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeTopicGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TreeTopicGroupRepository extends JpaRepository<TreeTopicGroup, String> {
}
