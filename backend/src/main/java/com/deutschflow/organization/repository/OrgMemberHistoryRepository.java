package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgMemberHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrgMemberHistoryRepository extends JpaRepository<OrgMemberHistory, Long> {

    /** Sổ của cả trung tâm, mới nhất trước — khớp index {@code idx_org_member_history_org_created}. */
    List<OrgMemberHistory> findByOrgIdOrderByCreatedAtDescIdDesc(Long orgId, Pageable pageable);

    /** Sổ của một người trong trung tâm — dùng cho trang chi tiết thành viên. */
    List<OrgMemberHistory> findByOrgIdAndUserIdOrderByCreatedAtDescIdDesc(Long orgId, Long userId,
                                                                          Pageable pageable);
}
