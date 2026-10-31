package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.organization.service.OrgLicenseState;
import com.deutschflow.organization.service.OrgLogoService;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Đợt 4A: logo là của giám đốc; quyền kiểm TRƯỚC trạng thái trung tâm, và trung tâm chỉ-đọc không ghi được. */
@ExtendWith(MockitoExtension.class)
class OrgLogoControllerTest {

    private static final Long ORG_ID = 7L;
    private static final Long USER_ID = 9L;

    @Mock private OrgLogoService logoService;
    @Mock private OrgGuard orgGuard;

    private final MockMultipartFile file = new MockMultipartFile("file", "logo.png", "image/png", new byte[] {1});

    private OrgLogoController controller() {
        return new OrgLogoController(logoService, orgGuard);
    }

    private static User owner() {
        User u = new User();
        u.setId(USER_ID);
        u.setOrgId(ORG_ID);
        return u;
    }

    @Test
    @DisplayName("tải logo: kiểm OWNER rồi mới kiểm ghi được, trả URL service ký")
    void upload_ownerThenWritable() {
        when(logoService.update(any(), any(), any())).thenReturn("https://signed");

        assertThat(controller().upload(owner(), file).logoUrl()).isEqualTo("https://signed");

        InOrder order = Mockito.inOrder(orgGuard);
        order.verify(orgGuard).assertOrgOwner(USER_ID, ORG_ID);
        order.verify(orgGuard).assertOrgWritable(ORG_ID);
    }

    @Test
    @DisplayName("không phải OWNER: bị chặn, không lộ trạng thái trung tâm, không tải gì lên")
    void upload_notOwner_forbidden() {
        doThrow(new ForbiddenException("x")).when(orgGuard).assertOrgOwner(USER_ID, ORG_ID);

        assertThatThrownBy(() -> controller().upload(owner(), file)).isInstanceOf(ForbiddenException.class);
        verify(orgGuard, never()).assertOrgWritable(any());
        verify(logoService, never()).update(any(), any(), any());
    }

    @Test
    @DisplayName("trung tâm chỉ-đọc: không tải, không gỡ")
    void readOnlyOrg_cannotWrite() {
        doThrow(new com.deutschflow.common.exception.OrgReadOnlyException(ORG_ID, OrgLicenseState.Reason.SUSPENDED))
                .when(orgGuard).assertOrgWritable(ORG_ID);

        assertThatThrownBy(() -> controller().upload(owner(), file))
                .isInstanceOf(com.deutschflow.common.exception.OrgReadOnlyException.class);
        assertThatThrownBy(() -> controller().remove(owner()))
                .isInstanceOf(com.deutschflow.common.exception.OrgReadOnlyException.class);
        verify(logoService, never()).update(any(), any(), any());
        verify(logoService, never()).remove(any(), any());
    }

    @Test
    @DisplayName("không thuộc tổ chức nào → Forbidden")
    void noOrg_forbidden() {
        User u = new User();
        u.setId(USER_ID);

        assertThatThrownBy(() -> controller().get(u)).isInstanceOf(ForbiddenException.class);
    }
}
