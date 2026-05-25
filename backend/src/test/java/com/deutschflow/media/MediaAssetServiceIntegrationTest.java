
package com.deutschflow.media;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.media.repository.MediaAssetRepository;
import com.deutschflow.media.service.MediaAssetService;
import com.deutschflow.media.service.S3StorageService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.jdbc.Sql;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

@SpringBootTest
@Sql(statements = "DELETE FROM media_assets WHERE s3_key LIKE 'media-it/%'")
class MediaAssetServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private MediaAssetService mediaAssetService;

    @Autowired
    private MediaAssetRepository mediaAssetRepository;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private S3StorageService s3StorageService;

    private User admin;
    private User teacherA;
    private User teacherB;

    @BeforeEach
    void setUp() throws Exception {
        admin = userRepository.save(User.builder()
                .email("media-it-admin@test.com")
                .passwordHash("$2a$10$h")
                .displayName("Media Admin")
                .role(User.Role.ADMIN)
                .build());
        teacherA = userRepository.save(User.builder()
                .email("media-it-teacher-a@test.com")
                .passwordHash("$2a$10$h")
                .displayName("Teacher A")
                .role(User.Role.TEACHER)
                .build());
        teacherB = userRepository.save(User.builder()
                .email("media-it-teacher-b@test.com")
                .passwordHash("$2a$10$h")
                .displayName("Teacher B")
                .role(User.Role.TEACHER)
                .build());

        when(s3StorageService.uploadFile(any(), anyString()))
                .thenAnswer(inv -> {
                    String cat = inv.getArgument(1, String.class).toLowerCase();
                    String key = "media-it/" + cat + "/test-uuid.png";
                    return new S3StorageService.S3UploadResult(
                            key, "https://bucket.s3.ap-southeast-1.amazonaws.com/" + key);
                });
        doNothing().when(s3StorageService).deleteFile(anyString());
    }

    @AfterEach
    void tearDown() {
        mediaAssetRepository.findAll().stream()
                .filter(a -> a.getS3Key() != null && a.getS3Key().startsWith("media-it/"))
                .forEach(mediaAssetRepository::delete);
        userRepository.deleteAllById(java.util.List.of(admin.getId(), teacherA.getId(), teacherB.getId()));
    }

    @Test
    void upload_withTag_replacesPreviousAssetInSameCategoryTag() {
        MockMultipartFile file = png("hero.png");
        mediaAssetService.uploadMedia(file, "LANDING", "hero", "Hero", admin);
        mediaAssetService.uploadMedia(png("hero-v2.png"), "LANDING", "hero", "Hero v2", admin);

        assertThat(mediaAssetRepository.findByCategoryAndTag("LANDING", "hero")).isPresent();
        assertThat(mediaAssetRepository.findAll().stream().filter(a -> "LANDING".equals(a.getCategory())).count())
                .isEqualTo(1);
    }

    @Test
    void teacherCannotUploadLanding() {
        MockMultipartFile file = png("x.png");
        assertThatThrownBy(() -> mediaAssetService.uploadMedia(file, "LANDING", "x", null, teacherA))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void teacherList_onlyShowsOwnUploads() {
        mediaAssetService.uploadMedia(png("a.png"), "ASSIGNMENT", "a1", null, teacherA);
        mediaAssetService.uploadMedia(png("b.png"), "ASSIGNMENT", "b1", null, teacherB);

        var pageA = mediaAssetService.getMediaByCategory("ASSIGNMENT", PageRequest.of(0, 20), teacherA);
        var pageB = mediaAssetService.getMediaByCategory("ASSIGNMENT", PageRequest.of(0, 20), teacherB);

        assertThat(pageA.getTotalElements()).isEqualTo(1);
        assertThat(pageB.getTotalElements()).isEqualTo(1);
        assertThat(pageA.getContent().get(0).getUploadedBy().getId()).isEqualTo(teacherA.getId());
    }

    @Test
    void teacherCannotDeleteLandingUploadedByAdmin() {
        MediaAsset landing = mediaAssetService.uploadMedia(png("hero.png"), "LANDING", "hero", null, admin);
        assertThatThrownBy(() -> mediaAssetService.deleteMedia(landing.getId(), teacherA))
                .isInstanceOf(ForbiddenException.class);
    }

    private static MockMultipartFile png(String name) {
        return new MockMultipartFile("file", name, "image/png", new byte[]{1, 2, 3, 4});
    }
}
