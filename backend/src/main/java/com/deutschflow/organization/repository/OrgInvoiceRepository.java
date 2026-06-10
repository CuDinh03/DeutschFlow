package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrgInvoiceRepository extends JpaRepository<OrgInvoice, Long> {
    List<OrgInvoice> findByOrgIdOrderByCreatedAtDesc(Long orgId);
}
