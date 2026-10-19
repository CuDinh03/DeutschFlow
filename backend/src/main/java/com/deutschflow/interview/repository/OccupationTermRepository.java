package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.OccupationContentStatus;
import com.deutschflow.interview.entity.OccupationTerm;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OccupationTermRepository extends JpaRepository<OccupationTerm, Long> {

    List<OccupationTerm> findByOccupationCodeOrderByIdAsc(String occupationCode);

    List<OccupationTerm> findByStatusOrderByCreatedAtAscIdAsc(OccupationContentStatus status);

    boolean existsByOccupationCodeAndTermDeIgnoreCase(String occupationCode, String termDe);
}
