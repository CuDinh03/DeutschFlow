package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.OrgCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrgCertificateRepository extends JpaRepository<OrgCertificate, Long> {

    Optional<OrgCertificate> findByVerifyToken(String verifyToken);

    List<OrgCertificate> findByClassIdOrderByCreatedAtDesc(Long classId);
}
