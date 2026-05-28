package com.deutschflow.beginner.repository;

import com.deutschflow.beginner.entity.BeginnerJourneyItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BeginnerJourneyItemRepository extends JpaRepository<BeginnerJourneyItem, Long> {

    List<BeginnerJourneyItem> findByWeekNumberOrderBySequenceOrderAsc(int weekNumber);

    List<BeginnerJourneyItem> findByPhaseOrderBySequenceOrderAsc(String phase);
}
