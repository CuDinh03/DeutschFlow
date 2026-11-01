package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Logo trung tâm — đợt 4A A+B+E")
class OrgLogoServiceTest {

    private static final Long ORG_ID = 5L;
    private static final AuditActor OWNER = new AuditActor(77L, "giamdoc@tt.vn", "OWNER");
    private static final String STORED = "https://r2.test/bucket/org-logo/5/cu.png";

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

    @Mock S3StorageService s3StorageService;
    @Mock OrganizationRepository organizationRepository;
    @Mock AuditLogService auditLogService;

    @InjectMocks OrgLogoService service;

    private MockMultipartFile file(byte[] data, String declaredType) {
        return new MockMultipartFile("file", "logo", declaredType, data);
    }

    private Organization stubOrg(String logoUrl) {
        Organization org = Organization.builder().id(ORG_ID).name("TT").slug("tt").logoUrl(logoUrl).build();
        lenient().when(organizationRepository.findById(ORG_ID)).thenReturn(Optional.of(org));
        return org;
    }

    private void stubUpload() {
        lenient().when(s3StorageService.uploadBytes(any(), anyString(), anyString())).thenAnswer(inv ->
                new S3StorageService.S3UploadResult(inv.getArgument(1), "https://r2.test/bucket/" + inv.getArgument(1)));
        lenient().when(s3StorageService.objectKeyFromOwnUrl(anyString())).thenAnswer(inv ->
                inv.<String>getArgument(0).replace("https://r2.test/bucket/", ""));
        lenient().when(s3StorageService.presignedGetUrl(anyString(), any())).thenReturn("https://signed");
    }

    private String uploadedKey(byte[] data, String contentType) {
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(s3StorageService).uploadBytes(eq(data), key.capture(), eq(contentType));
        return key.getValue();
    }

    @Test
    @DisplayName("PNG: nhận theo chữ ký tệp, key dưới org-logo/{orgId}/, trả URL đã ký, lưu URL chuẩn")
    void update_png() {
        Organization org = stubOrg(null);
        stubUpload();

        String view = service.update(OWNER, ORG_ID, file(PNG, "image/png"));

        assertThat(view).isEqualTo("https://signed");
        String key = uploadedKey(PNG, "image/png");
        assertThat(key).startsWith("org-logo/5/").endsWith(".png");
        assertThat(org.getLogoUrl()).isEqualTo("https://r2.test/bucket/" + key);
        verify(organizationRepository).save(org);
        verify(auditLogService).log(eq(OrgLogoService.EVENT_UPDATED), eq(OWNER), anyString(), anyString(),
                eq(ORG_ID), any());
    }

    @Test
    @DisplayName("JPEG, WebP: định dạng lấy từ chữ ký, không tin Content-Type client gửi")
    void update_jpegAndWebp_ignoreDeclaredType() {
        stubOrg(null);
        stubUpload();

        service.update(OWNER, ORG_ID, file(JPEG, "application/octet-stream"));
        service.update(OWNER, ORG_ID, file(WEBP, "image/png"));

        assertThat(uploadedKey(JPEG, "image/jpeg")).endsWith(".jpg");
        assertThat(uploadedKey(WEBP, "image/webp")).endsWith(".webp");
    }

    @Test
    @DisplayName("SVG khai là image/png → từ chối, không tải gì lên (audit SEC-9)")
    void update_svg_rejected() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>x</script></svg>"
                .getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> service.update(OWNER, ORG_ID, file(svg, "image/png")))
                .isInstanceOf(BadRequestException.class);
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("Quá 1 MB hoặc tệp rỗng → từ chối, không tải gì lên")
    void update_tooLargeOrEmpty_rejected() {
        byte[] big = Arrays.copyOf(PNG, (int) OrgLogoService.MAX_LOGO_BYTES + 1);

        assertThatThrownBy(() -> service.update(OWNER, ORG_ID, file(big, "image/png")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.update(OWNER, ORG_ID, file(new byte[0], "image/png")))
                .isInstanceOf(BadRequestException.class);
        verify(s3StorageService, never()).uploadBytes(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("Đổi logo KHÔNG xoá object cũ: giấy đã cấp còn trỏ tới nó qua snapshot")
    void update_keepsPreviousObject() {
        stubOrg(STORED);
        stubUpload();

        service.update(OWNER, ORG_ID, file(PNG, "image/png"));

        verify(s3StorageService, never()).deleteFile(anyString());
    }

    @Test
    @DisplayName("Gỡ logo: cột về null, không xoá object; chưa có logo thì không ghi vết")
    void remove() {
        Organization org = stubOrg(STORED);

        service.remove(OWNER, ORG_ID);
        service.remove(OWNER, ORG_ID);

        assertThat(org.getLogoUrl()).isNull();
        verify(s3StorageService, never()).deleteFile(anyString());
        verify(auditLogService).log(eq(OrgLogoService.EVENT_REMOVED), eq(OWNER), anyString(), anyString(),
                eq(ORG_ID), any());
    }

    @Test
    @DisplayName("viewUrl: ký URL của mình, dưới trần 7 ngày")
    void viewUrl_signsOwnObject() {
        stubUpload();

        assertThat(service.viewUrl(STORED)).isEqualTo("https://signed");
        verify(s3StorageService).presignedGetUrl("org-logo/5/cu.png", OrgLogoService.VIEW_URL_TTL);
        assertThat(OrgLogoService.VIEW_URL_TTL.toDays()).isLessThan(7);
    }

    @Test
    @DisplayName("viewUrl: trống → null; URL ngoài bucket hoặc ngoài org-logo/ trả nguyên, không ký")
    void viewUrl_foreignUrl_returnedAsIs() {
        when(s3StorageService.objectKeyFromOwnUrl("https://cdn/abc.png")).thenReturn(null);
        when(s3StorageService.objectKeyFromOwnUrl("https://r2.test/bucket/avatar/a.png")).thenReturn("avatar/a.png");

        assertThat(service.viewUrl(null)).isNull();
        assertThat(service.viewUrl("  ")).isNull();
        assertThat(service.viewUrl("https://cdn/abc.png")).isEqualTo("https://cdn/abc.png");
        assertThat(service.viewUrl("https://r2.test/bucket/avatar/a.png"))
                .isEqualTo("https://r2.test/bucket/avatar/a.png");
        verify(s3StorageService, never()).presignedGetUrl(anyString(), any());
    }

    @Test
    @DisplayName("viewUrl: ký hỏng → trả URL lưu, không làm hỏng trang công khai")
    void viewUrl_presignFailure_fallsBack() {
        when(s3StorageService.objectKeyFromOwnUrl(STORED)).thenReturn("org-logo/5/cu.png");
        when(s3StorageService.presignedGetUrl(anyString(), any())).thenThrow(new RuntimeException("r2 down"));

        assertThat(service.viewUrl(STORED)).isEqualTo(STORED);
    }
}
