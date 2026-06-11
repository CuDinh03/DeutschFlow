package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgPaymentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrgPaymentEventRepository extends JpaRepository<OrgPaymentEvent, Long> {
    boolean existsBySepayId(String sepayId);
}
