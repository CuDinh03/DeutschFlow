package com.deutschflow.media;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.media.entity.MediaAsset;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Ranh giới quyền của media asset. File này trước đây rỗng (bị xoá ruột trong commit "backup file"),
 * nên toàn bộ {@link MediaAssetAccessPolicy} không có test trực tiếp nào — được điền lại cùng bản vá
 * audit F-M6 (03/09/2026) vì bản vá đó thêm nhánh đọc {@code isReadAllowed}.
 *
 * <p>Quy tắc chung: ADMIN làm được mọi thứ; người khác chỉ đụng được asset do chính mình upload, và
 * riêng danh mục admin-only thì kể cả uploader cũng không xoá được.
 */
@DisplayName("MediaAssetAccessPolicy")
class MediaAssetAccessPolicyTest {

    private static User user(long id, User.Role role) {
        return User.builder().id(id).email("u" + id + "@x.com").displayName("U" + id)
                .passwordHash("h").role(role).build();
    }

    private static MediaAsset asset(String category, User uploader) {
        MediaAsset a = new MediaAsset();
        a.setId(1L);
        a.setCategory(category);
        a.setS3Key("k");
        a.setUploadedBy(uploader);
        return a;
    }

    @Nested
    @DisplayName("isReadAllowed (F-M6)")
    class ReadAllowed {

        @Test
        @DisplayName("ADMIN đọc được asset của người khác")
        void adminReadsAnything() {
            User teacher = user(1L, User.Role.TEACHER);
            assertThat(MediaAssetAccessPolicy.isReadAllowed(user(9L, User.Role.ADMIN), asset("ASSIGNMENT", teacher)))
                    .isTrue();
        }

        @Test
        @DisplayName("uploader đọc được asset của chính mình")
        void uploaderReadsOwn() {
            User teacher = user(1L, User.Role.TEACHER);
            assertThat(MediaAssetAccessPolicy.isReadAllowed(teacher, asset("ASSIGNMENT", teacher))).isTrue();
        }

        @Test
        @DisplayName("giáo viên khác KHÔNG đọc được — đây chính là IDOR đã vá")
        void otherTeacherCannotRead() {
            assertThat(MediaAssetAccessPolicy.isReadAllowed(
                    user(2L, User.Role.TEACHER), asset("ASSIGNMENT", user(1L, User.Role.TEACHER)))).isFalse();
        }

        @Test
        @DisplayName("STUDENT KHÔNG đọc được")
        void studentCannotRead() {
            assertThat(MediaAssetAccessPolicy.isReadAllowed(
                    user(3L, User.Role.STUDENT), asset("ASSIGNMENT", user(1L, User.Role.TEACHER)))).isFalse();
        }

        @Test
        @DisplayName("không có principal thì không đọc được")
        void anonymousCannotRead() {
            assertThat(MediaAssetAccessPolicy.isReadAllowed(null, asset("ASSIGNMENT", user(1L, User.Role.TEACHER))))
                    .isFalse();
        }

        @Test
        @DisplayName("asset không có người upload: chỉ ADMIN đọc được (không fail-open)")
        void orphanAssetIsAdminOnly() {
            MediaAsset orphan = asset("ASSIGNMENT", null);
            assertThat(MediaAssetAccessPolicy.isReadAllowed(user(1L, User.Role.TEACHER), orphan)).isFalse();
            assertThat(MediaAssetAccessPolicy.isReadAllowed(user(9L, User.Role.ADMIN), orphan)).isTrue();
        }
    }

    @Nested
    @DisplayName("requireDeleteAllowed — ranh giới mà nhánh đọc noi theo")
    class DeleteAllowed {

        @Test
        @DisplayName("uploader xóa được asset của mình trong danh mục thường")
        void uploaderDeletesOwn() {
            User teacher = user(1L, User.Role.TEACHER);
            assertThatCode(() -> MediaAssetAccessPolicy.requireDeleteAllowed(teacher, asset("ASSIGNMENT", teacher)))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("giáo viên khác bị chặn")
        void otherTeacherBlocked() {
            assertThatThrownBy(() -> MediaAssetAccessPolicy.requireDeleteAllowed(
                    user(2L, User.Role.TEACHER), asset("ASSIGNMENT", user(1L, User.Role.TEACHER))))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("danh mục admin-only: kể cả uploader cũng bị chặn")
        void adminOnlyCategoryBlocksUploader() {
            User teacher = user(1L, User.Role.TEACHER);
            assertThatThrownBy(() -> MediaAssetAccessPolicy.requireDeleteAllowed(teacher, asset("LANDING", teacher)))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        @DisplayName("ADMIN xóa được mọi danh mục")
        void adminDeletesAnything() {
            assertThatCode(() -> MediaAssetAccessPolicy.requireDeleteAllowed(
                    user(9L, User.Role.ADMIN), asset("LANDING", user(1L, User.Role.TEACHER))))
                    .doesNotThrowAnyException();
        }
    }
}
