package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserAvatarServiceTest {

    private static final String NEW_KEY = "avatar/new-uuid.webp";
    private static final String NEW_URL = "https://media.example.com/avatar/new-uuid.webp";
    private static final String OLD_URL = "https://media.example.com/avatar/old-uuid.png";

    @Mock S3StorageService s3StorageService;
    @Mock UserRepository userRepository;

    @InjectMocks UserAvatarService service;

    private static MockMultipartFile pngFile() {
        return new MockMultipartFile("file", "me.png", "image/png", new byte[]{1, 2, 3});
    }

    private static User userWithAvatar(String url) {
        User user = User.builder().id(7L).email("hv@x.vn").displayName("Học Viên").avatarUrl(url).build();
        return user;
    }

    // ── updateAvatar: validation ─────────────────────────────────────────────

    @Test
    void updateAvatar_emptyFile_throwsBadRequest() {
        MockMultipartFile empty = new MockMultipartFile("file", "a.png", "image/png", new byte[0]);
        assertThrows(BadRequestException.class, () -> service.updateAvatar(userWithAvatar(null), empty));
        verifyNoInteractions(s3StorageService, userRepository);
    }

    @Test
    void updateAvatar_svgRejected() {
        // SEC-9: SVG có thể mang <script> → stored XSS trên bucket public-read.
        MockMultipartFile svg = new MockMultipartFile("file", "a.svg", "image/svg+xml", new byte[]{1});
        assertThrows(BadRequestException.class, () -> service.updateAvatar(userWithAvatar(null), svg));
        verifyNoInteractions(s3StorageService);
    }

    @Test
    void updateAvatar_over5Mb_throwsBadRequest() {
        MockMultipartFile big = new MockMultipartFile("file", "a.png", "image/png", new byte[5 * 1024 * 1024 + 1]);
        assertThrows(BadRequestException.class, () -> service.updateAvatar(userWithAvatar(null), big));
        verifyNoInteractions(s3StorageService);
    }

    // ── updateAvatar: happy path + dọn ảnh cũ ────────────────────────────────

    @Test
    void updateAvatar_uploadsSavesAndDeletesPreviousOwnObject() throws IOException {
        User user = userWithAvatar(OLD_URL);
        when(s3StorageService.uploadFile(any(), eq("avatar")))
                .thenReturn(new S3StorageService.S3UploadResult(NEW_KEY, NEW_URL));
        when(s3StorageService.objectKeyFromOwnUrl(OLD_URL)).thenReturn("avatar/old-uuid.png");

        String url = service.updateAvatar(user, pngFile());

        assertEquals(NEW_URL, url);
        assertEquals(NEW_URL, user.getAvatarUrl());
        verify(userRepository).save(user);
        verify(s3StorageService).deleteFile("avatar/old-uuid.png");
    }

    @Test
    void updateAvatar_firstAvatar_noDelete() throws IOException {
        User user = userWithAvatar(null);
        when(s3StorageService.uploadFile(any(), eq("avatar")))
                .thenReturn(new S3StorageService.S3UploadResult(NEW_KEY, NEW_URL));

        service.updateAvatar(user, pngFile());

        verify(s3StorageService, never()).deleteFile(anyString());
    }

    @Test
    void updateAvatar_previousUrlNotOurs_noDelete() throws IOException {
        User user = userWithAvatar("https://evil.example.com/x.png");
        when(s3StorageService.uploadFile(any(), eq("avatar")))
                .thenReturn(new S3StorageService.S3UploadResult(NEW_KEY, NEW_URL));
        when(s3StorageService.objectKeyFromOwnUrl("https://evil.example.com/x.png")).thenReturn(null);

        service.updateAvatar(user, pngFile());

        verify(s3StorageService, never()).deleteFile(anyString());
    }

    @Test
    void updateAvatar_previousKeyOutsideAvatarPrefix_noDelete() throws IOException {
        // Guard: dù URL là bucket của mình, key ngoài avatar/ (vd lesson/…) tuyệt đối không xoá.
        User user = userWithAvatar("https://media.example.com/lesson/l1.png");
        when(s3StorageService.uploadFile(any(), eq("avatar")))
                .thenReturn(new S3StorageService.S3UploadResult(NEW_KEY, NEW_URL));
        when(s3StorageService.objectKeyFromOwnUrl("https://media.example.com/lesson/l1.png"))
                .thenReturn("lesson/l1.png");

        service.updateAvatar(user, pngFile());

        verify(s3StorageService, never()).deleteFile(anyString());
    }

    @Test
    void updateAvatar_deleteOldFails_requestStillSucceeds() throws IOException {
        User user = userWithAvatar(OLD_URL);
        when(s3StorageService.uploadFile(any(), eq("avatar")))
                .thenReturn(new S3StorageService.S3UploadResult(NEW_KEY, NEW_URL));
        when(s3StorageService.objectKeyFromOwnUrl(OLD_URL)).thenReturn("avatar/old-uuid.png");
        doThrow(new RuntimeException("s3 down")).when(s3StorageService).deleteFile("avatar/old-uuid.png");

        String url = service.updateAvatar(user, pngFile());

        assertEquals(NEW_URL, url);
        assertEquals(NEW_URL, user.getAvatarUrl());
    }

    @Test
    void updateAvatar_s3UploadFails_throwsAndKeepsOldUrl() throws IOException {
        User user = userWithAvatar(OLD_URL);
        when(s3StorageService.uploadFile(any(), eq("avatar"))).thenThrow(new IOException("boom"));

        assertThrows(RuntimeException.class, () -> service.updateAvatar(user, pngFile()));

        assertEquals(OLD_URL, user.getAvatarUrl());
        verify(userRepository, never()).save(any());
        verify(s3StorageService, never()).deleteFile(anyString());
    }

    // ── removeAvatar ─────────────────────────────────────────────────────────

    @Test
    void removeAvatar_clearsUrlAndDeletesObject() {
        User user = userWithAvatar(OLD_URL);
        when(s3StorageService.objectKeyFromOwnUrl(OLD_URL)).thenReturn("avatar/old-uuid.png");

        service.removeAvatar(user);

        assertNull(user.getAvatarUrl());
        verify(userRepository).save(user);
        verify(s3StorageService).deleteFile("avatar/old-uuid.png");
    }

    @Test
    void removeAvatar_noAvatar_noop() {
        service.removeAvatar(userWithAvatar(null));
        verifyNoInteractions(userRepository, s3StorageService);
    }
}
