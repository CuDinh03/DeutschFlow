package com.deutschflow.user.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.deutschflow.common.quota.PlanBadge;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.dto.MyPlanResponse;
import com.deutschflow.user.entity.User;

import java.util.Optional;

@ExtendWith(MockitoExtension.class)
class AuthMePlanControllerUnitTest {

    private MockMvc mvc;
    @Mock
    QuotaService quotaService;
    @Mock
    OrganizationRepository organizationRepository;

    @InjectMocks
    AuthMePlanController controller;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }

    private static User student(Long orgId) {
        User u = new User();
        u.setId(42L);
        u.setOrgId(orgId);
        return u;
    }

    private void stubBadge(String source) {
        when(quotaService.resolvePlanBadge(anyLong(), any()))
                .thenReturn(new PlanBadge("PRO", "PREMIUM", null, null, false, null, source));
    }

    /**
     * V-06: gói do trung tâm trả tiền phải nói rõ là ORG + tên trung tâm, để app ẩn "huỷ gói"
     * và "yêu cầu hoàn tiền" — học viên không mua gì ở Apple nên không có gì để huỷ.
     */
    @Test
    @DisplayName("gói do trung tâm cấp trả source=ORG kèm tên trung tâm")
    void plan_orgSourceCarriesOrgName() {
        stubBadge("ORG");
        Organization org = new Organization();
        org.setId(7L);
        org.setName("Trung tâm Đức Ngữ ABC");
        when(organizationRepository.findById(7L)).thenReturn(Optional.of(org));

        MyPlanResponse res = controller.plan(student(7L));

        assertThat(res.source()).isEqualTo("ORG");
        assertThat(res.orgName()).isEqualTo("Trung tâm Đức Ngữ ABC");
    }

    @Test
    @DisplayName("gói mua trong app trả source=APPLE và KHÔNG tra tên trung tâm")
    void plan_appleSourceHasNoOrgName() {
        stubBadge("APPLE");

        MyPlanResponse res = controller.plan(student(7L));

        assertThat(res.source()).isEqualTo("APPLE");
        assertThat(res.orgName()).isNull();
        verify(organizationRepository, never()).findById(any());
    }

    @Test
    @DisplayName("người B2C (không thuộc trung tâm) trả source=WEB, orgName null")
    void plan_webSourceForB2c() {
        stubBadge("WEB");

        MyPlanResponse res = controller.plan(student(null));

        assertThat(res.source()).isEqualTo("WEB");
        assertThat(res.orgName()).isNull();
    }
}
