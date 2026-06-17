package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeLevelRepository extends JpaRepository<TreeLevel, String> {
    List<TreeLevel> findAllByOrderByOrderIndexAsc();
}
