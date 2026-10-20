package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.Occupation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OccupationRepository extends JpaRepository<Occupation, String> {

    List<Occupation> findByActiveTrueOrderBySortRankAscCodeAsc();
}
