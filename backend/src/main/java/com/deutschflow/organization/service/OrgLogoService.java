package com.deutschflow.organization.service;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Logo trung tâm in trên chứng nhận và phiếu đánh giá (đợt 4A A+B+E). Giám đốc tải lên ở trang cấu
 * hình; {@code organizations.logo_url} giữ URL dạng chuẩn, chứng nhận và phiếu chụp lại URL đó lúc cấp.
 *
 * <p>Bucket PRIVATE nên mọi chỗ trả logo cho client phải đi qua {@link #viewUrl}, cùng cách với
 * {@code UserAvatarService}.
 *
 * <p>Đổi hay gỡ logo KHÔNG xoá object cũ: giấy đã cấp vẫn trỏ tới nó qua cột snapshot, xoá đi thì giấy
 * cũ mất logo. Không nhận SVG (audit SEC-9), và kiểm chữ ký tệp chứ không tin Content-Type client gửi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrgLogoService {

    /** Vết: giám đốc đổi hoặc gỡ logo. */
    public static final String EVENT_UPDATED = "org.logo.updated";
    public static final String EVENT_REMOVED = "org.logo.removed";
    private static final String AUDIT_TARGET_TYPE = "ORGANIZATION";

    static final long MAX_LOGO_BYTES = 1024L * 1024;
    static final String LOGO_KEY_PREFIX = "org-logo/";

    /** Dưới trần 7 ngày của SigV4; trang công khai đọc no-store nên mỗi lượt mở có URL mới. */
    static final Duration VIEW_URL_TTL = Duration.ofDays(6);

    private final S3StorageService s3StorageService;
    private final OrganizationRepository organizationRepository;
    private final AuditLogService auditLogService;

    /**
     * URL để client hiển thị — ký từ URL đang lưu. URL ngoài bucket của mình hoặc ngoài {@code org-logo/}
     * (dữ liệu cũ) trả nguyên; ký hỏng thì trả nguyên và ghi log: logo không hiện chứ không làm hỏng trang.
     */
    public String viewUrl(String storedUrl) {
        if (storedUrl == null || storedUrl.isBlank()) {
            return null;
        }
        String key = s3StorageService.objectKeyFromOwnUrl(storedUrl);
        if (key == null || !key.startsWith(LOGO_KEY_PREFIX)) {
            return storedUrl;
        }
        try {
            return s3StorageService.presignedGetUrl(key, VIEW_URL_TTL);
        } catch (RuntimeException e) {
            log.warn("Failed to presign org logo {}: {}", key, e.getMessage());
            return storedUrl;
        }
    }

    @Transactional(readOnly = true)
    public String currentViewUrl(Long orgId) {
        return viewUrl(requireOrg(orgId).getLogoUrl());
    }

    /** Thay logo; trả URL đã ký để giao diện hiện ngay. Quyền do controller kiểm trước. */
    @Transactional
    public String update(AuditActor actor, Long orgId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Chưa chọn tệp logo");
        }
        if (file.getSize() > MAX_LOGO_BYTES) {
            throw new BadRequestException("Logo tối đa 1 MB");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new BadRequestException("Không đọc được tệp logo");
        }
        ImageKind kind = ImageKind.detect(data);
        if (kind == null) {
            throw new BadRequestException("Logo chỉ nhận PNG, JPEG hoặc WebP");
        }

        Organization org = requireOrg(orgId);
        String key = LOGO_KEY_PREFIX + orgId + "/" + UUID.randomUUID() + kind.extension;
        String url = s3StorageService.uploadBytes(data, key, kind.contentType).getUrl();
        org.setLogoUrl(url);
        organizationRepository.save(org);
        auditLogService.log(EVENT_UPDATED, actor, AUDIT_TARGET_TYPE, String.valueOf(orgId), orgId, Map.of());
        return viewUrl(url);
    }

    /** Gỡ logo khỏi giấy cấp SAU này; giấy đã cấp giữ nguyên bản chụp. */
    @Transactional
    public void remove(AuditActor actor, Long orgId) {
        Organization org = requireOrg(orgId);
        if (org.getLogoUrl() == null) {
            return;
        }
        org.setLogoUrl(null);
        organizationRepository.save(org);
        auditLogService.log(EVENT_REMOVED, actor, AUDIT_TARGET_TYPE, String.valueOf(orgId), orgId, Map.of());
    }

    private Organization requireOrg(Long orgId) {
        return organizationRepository.findById(orgId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tổ chức"));
    }

    /** Chữ ký đầu tệp của ba định dạng được nhận. */
    private enum ImageKind {
        PNG("image/png", ".png"),
        JPEG("image/jpeg", ".jpg"),
        WEBP("image/webp", ".webp");

        private final String contentType;
        private final String extension;

        ImageKind(String contentType, String extension) {
            this.contentType = contentType;
            this.extension = extension;
        }

        static ImageKind detect(byte[] d) {
            if (startsWith(d, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
                return PNG;
            }
            if (startsWith(d, 0, 0xFF, 0xD8, 0xFF)) {
                return JPEG;
            }
            if (startsWith(d, 0, 'R', 'I', 'F', 'F') && startsWith(d, 8, 'W', 'E', 'B', 'P')) {
                return WEBP;
            }
            return null;
        }

        private static boolean startsWith(byte[] data, int offset, int... signature) {
            if (data.length < offset + signature.length) {
                return false;
            }
            for (int i = 0; i < signature.length; i++) {
                if ((data[offset + i] & 0xFF) != signature[i]) {
                    return false;
                }
            }
            return true;
        }
    }
}
