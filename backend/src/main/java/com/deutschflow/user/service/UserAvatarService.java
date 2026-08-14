package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Ảnh đại diện tự tải lên của user (mọi role — trang /v2/profile dùng chung).
 *
 * <p>Tách khỏi {@link com.deutschflow.media.service.MediaAssetService} có chủ đích: avatar thuộc
 * sở hữu user và sống trên {@code users.avatar_url}, KHÔNG tạo bản ghi {@code media_assets} —
 * tránh làm rác thư viện media của admin/teacher và tránh nới quyền upload media chung cho STUDENT.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAvatarService {

    /** Cùng allowlist với MediaAssetService (audit SEC-9: không SVG — nguy cơ stored XSS trên bucket public-read). */
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"
    );
    private static final long MAX_AVATAR_BYTES = 5L * 1024 * 1024;
    /** S3StorageService.uploadFile(category="avatar") sinh key dạng avatar/{uuid}.{ext}. */
    private static final String AVATAR_KEY_PREFIX = "avatar/";

    private final S3StorageService s3StorageService;
    private final UserRepository userRepository;

    /**
     * Upload ảnh mới, gán vào {@code users.avatar_url} và xoá object cũ (nếu là object của mình).
     *
     * @return URL public của ảnh mới
     */
    @Transactional
    public String updateAvatar(User user, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File cannot be empty");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Invalid file type. Only standard image files are allowed.");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new BadRequestException("File size exceeds the limit of 5MB");
        }

        String previousUrl = user.getAvatarUrl();
        S3StorageService.S3UploadResult uploaded;
        try {
            uploaded = s3StorageService.uploadFile(file, "avatar");
        } catch (IOException e) {
            log.error("Failed to upload avatar to S3 for user {}", user.getId(), e);
            throw new RuntimeException("Could not upload avatar: " + e.getMessage());
        }

        user.setAvatarUrl(uploaded.getUrl());
        userRepository.save(user);
        // Xoá SAU khi đã lưu URL mới: nếu delete lỗi thì chỉ orphan 1 file cũ, không mất avatar mới.
        deleteOwnAvatarObject(previousUrl);
        return uploaded.getUrl();
    }

    /** Gỡ avatar: xoá object trên S3 (nếu là của mình) và set {@code avatar_url = null}. */
    @Transactional
    public void removeAvatar(User user) {
        String previousUrl = user.getAvatarUrl();
        if (previousUrl == null) {
            return;
        }
        user.setAvatarUrl(null);
        userRepository.save(user);
        deleteOwnAvatarObject(previousUrl);
    }

    /**
     * Chỉ xoá khi URL trỏ về bucket của mình VÀ key nằm dưới prefix avatar/ — giá trị cột là dữ liệu
     * lịch sử nên phải coi như untrusted (xem javadoc {@code objectKeyFromOwnUrl}); tuyệt đối không
     * để một URL lạ/di trú cũ khiến ta xoá nhầm object ngoài phạm vi avatar.
     */
    private void deleteOwnAvatarObject(String url) {
        String key = s3StorageService.objectKeyFromOwnUrl(url);
        if (key == null || !key.startsWith(AVATAR_KEY_PREFIX)) {
            return;
        }
        try {
            s3StorageService.deleteFile(key);
        } catch (RuntimeException e) {
            // Không chặn luồng chính vì file rác: log để dọn tay nếu tích tụ.
            log.warn("Failed to delete previous avatar object {}: {}", key, e.getMessage());
        }
    }
}
