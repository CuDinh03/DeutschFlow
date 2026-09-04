package com.deutschflow.organization.repository;

import com.deutschflow.organization.entity.OrgSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrgSettingRepository extends JpaRepository<OrgSetting, OrgSetting.Id> {

    List<OrgSetting> findByIdOrgId(Long orgId);
}
