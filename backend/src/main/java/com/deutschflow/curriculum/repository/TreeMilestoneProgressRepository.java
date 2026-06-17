package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeMilestoneProgress;
import com.deutschflow.curriculum.entity.TreeMilestoneProgressId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeMilestoneProgressRepository extends JpaRepository<TreeMilestoneProgress, TreeMilestoneProgressId> {

    List<TreeMilestoneProgress> findByIdUserId(Long userId);
}
