package com.deutschflow.curriculum.repository;

import com.deutschflow.curriculum.entity.TreeSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TreeSkillRepository extends JpaRepository<TreeSkill, String> {
    List<TreeSkill> findAllByOrderByOrderIndexAsc();
}
