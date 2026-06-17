package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeNodeProgress;
import com.deutschflow.curriculum.entity.TreeNodeProgressId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeNodeProgressRepository extends JpaRepository<TreeNodeProgress, TreeNodeProgressId> {

    List<TreeNodeProgress> findByIdUserId(Long userId);
}
