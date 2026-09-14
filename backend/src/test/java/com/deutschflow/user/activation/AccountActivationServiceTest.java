package com.deutschflow.user.activation;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Luật của liên kết đặt mật khẩu lần đầu (Q-09, owner chốt 14/09/2026). Bốn thứ dễ trôi nhất khi có
 * người sửa vào sau này:
 *
 * <ol>
 *   <li>cơ sở dữ liệu chỉ giữ HASH — token thô không bao giờ nằm lại;</li>
 *   <li>dùng một lần: đặt mật khẩu xong là liên kết chết;</li>
 *   <li>hết hạn và đã dùng là hai câu báo KHÁC nhau, vì lối thoát của người dùng khác nhau;</li>
 *   <li>phát liên kết mới thì giết liên kết cũ — một tài khoản chỉ có đúng một liên kết sống.</li>
 * </ol>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("AccountActivationService — liên kết đặt mật khẩu lần đầu (Q-09)")
class AccountActivationServiceTest {

    private static final Long USER = 7L;
    private static final Long ORG = 3L;

    @Mock private AccountActivationTokenRepository tokenRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JdbcTemplate jdbcTemplate;

    private AccountActivationService service;

    @BeforeEach
    void setUp() {
        service = new AccountActivationService(tokenRepository, userRepository, organizationRepository,
                refreshTokenRepository, passwordEncoder, jdbcTemplate);
        ReflectionTestUtils.setField(service, "ttlDays", 14);
    }

    private static AccountActivationToken token(String rawToken, Instant expiresAt, Instant usedAt) {
        return AccountActivationToken.builder()
                .id(1L).userId(USER).orgId(ORG)
                .tokenHash(AccountActivationService.hash(rawToken))
                .expiresAt(expiresAt).usedAt(usedAt)
                .build();
    }

    private static User activeStudent() {
        return User.builder().id(USER).email("hocvien@tt.vn").displayName("Em Bảy")
                .role(User.Role.STUDENT).passwordHash("cũ").active(true).build();
    }

    @Nested
    @DisplayName("issue — phát liên kết")
    class Issue {

        @Test
        @DisplayName("⛔ chỉ HASH vào cơ sở dữ liệu; token thô không nằm lại ở bất kỳ trường nào")
        void persistsOnlyTheHash() {
            String raw = service.issue(USER, ORG);

            ArgumentCaptor<AccountActivationToken> captor =
                    ArgumentCaptor.forClass(AccountActivationToken.class);
            verify(tokenRepository).save(captor.capture());
            AccountActivationToken saved = captor.getValue();

            assertThat(saved.getTokenHash())
                    .isEqualTo(AccountActivationService.hash(raw))
                    .hasSize(64)
                    .isNotEqualTo(raw);
            assertThat(raw).isNotBlank().doesNotContain(saved.getTokenHash());
            assertThat(saved.getUserId()).isEqualTo(USER);
            assertThat(saved.getOrgId()).isEqualTo(ORG);
        }

        @Test
        @DisplayName("hai lượt phát ra hai token KHÁC nhau (không tái dùng giá trị)")
        void issuesDistinctTokens() {
            assertThat(service.issue(USER, ORG)).isNotEqualTo(service.issue(USER, ORG));
        }

        @Test
        @DisplayName("phát liên kết mới ⇒ GIẾT mọi liên kết chưa dùng trước đó của cùng học viên")
        void invalidatesPreviousLiveTokens() {
            service.issue(USER, ORG);
            // Không có bước này thì thu hồi một liên kết chẳng có nghĩa gì: cái cũ vẫn mở được.
            verify(tokenRepository).invalidateLiveTokens(USER);
        }

        @Test
        @DisplayName("hạn tính từ ttlDays của cấu hình")
        void honoursConfiguredTtl() {
            Instant before = Instant.now();
            service.issue(USER, ORG);

            ArgumentCaptor<AccountActivationToken> captor =
                    ArgumentCaptor.forClass(AccountActivationToken.class);
            verify(tokenRepository).save(captor.capture());
            assertThat(captor.getValue().getExpiresAt())
                    .isAfter(before.plus(13, ChronoUnit.DAYS))
                    .isBefore(before.plus(15, ChronoUnit.DAYS));
        }
    }

    @Nested
    @DisplayName("activate — đặt mật khẩu")
    class Activate {

        @Test
        @DisplayName("liên kết còn sống ⇒ đổi mật khẩu, ĐỐT liên kết, thu hồi phiên cũ")
        void setsPasswordAndBurnsTheLink() {
            String raw = "tok";
            AccountActivationToken row = token(raw, Instant.now().plus(1, ChronoUnit.DAYS), null);
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(row));
            when(userRepository.findById(USER)).thenReturn(Optional.of(activeStudent()));
            when(passwordEncoder.encode("MatKhauMoi123")).thenReturn("băm-mới");

            service.activate(raw, "MatKhauMoi123");

            assertThat(row.getUsedAt()).as("dùng rồi thì chết").isNotNull();
            verify(tokenRepository).save(row);
            verify(jdbcTemplate).update("UPDATE users SET password_hash = ? WHERE id = ?", "băm-mới", USER);
            verify(refreshTokenRepository).revokeAllByUserId(USER);
        }

        @Test
        @DisplayName("🔴 liên kết ĐÃ DÙNG ⇒ báo riêng (mời đăng nhập), KHÔNG đổi mật khẩu")
        void refusesUsedLink() {
            String raw = "tok";
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(token(raw, Instant.now().plus(1, ChronoUnit.DAYS), Instant.now())));

            assertThatThrownBy(() -> service.activate(raw, "MatKhauMoi123"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("đã được dùng");
            verify(jdbcTemplate, never()).update(anyString(), any(), any());
        }

        @Test
        @DisplayName("🔴 liên kết HẾT HẠN ⇒ báo riêng (mời Quên mật khẩu), KHÔNG đổi mật khẩu")
        void refusesExpiredLink() {
            String raw = "tok";
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(token(raw, Instant.now().minus(1, ChronoUnit.DAYS), null)));

            assertThatThrownBy(() -> service.activate(raw, "MatKhauMoi123"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("hết hạn");
            verify(refreshTokenRepository, never()).revokeAllByUserId(anyLong());
        }

        @Test
        @DisplayName("token không tồn tại / rỗng ⇒ cùng MỘT câu, không nói gì thêm cho người đang dò")
        void refusesUnknownToken() {
            when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.activate("khong-co-that", "MatKhauMoi123"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("không hợp lệ");
            assertThatThrownBy(() -> service.activate("  ", "MatKhauMoi123"))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("không hợp lệ");
        }

        @Test
        @DisplayName("tài khoản đã bị vô hiệu hoá ⇒ chặn, dù liên kết còn sống")
        void refusesInactiveAccount() {
            String raw = "tok";
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(token(raw, Instant.now().plus(1, ChronoUnit.DAYS), null)));
            User inactive = activeStudent();
            inactive.setActive(false);
            when(userRepository.findById(USER)).thenReturn(Optional.of(inactive));

            assertThatThrownBy(() -> service.activate(raw, "MatKhauMoi123"))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested
    @DisplayName("preview — màn web biết trước mình ở ca nào")
    class Preview {

        @Test
        @DisplayName("liên kết sống ⇒ VALID + email ĐÃ CHE + tên trung tâm")
        void validLinkMasksEmail() {
            String raw = "tok";
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(token(raw, Instant.now().plus(1, ChronoUnit.DAYS), null)));
            when(userRepository.findById(USER)).thenReturn(Optional.of(activeStudent()));
            when(organizationRepository.findById(ORG))
                    .thenReturn(Optional.of(Organization.builder().id(ORG).name("TT Sao Mai").build()));

            AccountActivationService.Preview p = service.preview(raw);

            assertThat(p.state()).isEqualTo(AccountActivationService.State.VALID);
            assertThat(p.maskedEmail()).isEqualTo("hoc***@tt.vn");
            assertThat(p.orgName()).isEqualTo("TT Sao Mai");
        }

        @Test
        @DisplayName("⛔ liên kết chết KHÔNG kèm email — người cầm nó không cần biết nó từng của ai")
        void deadLinkRevealsNothing() {
            String raw = "tok";
            when(tokenRepository.findByTokenHash(AccountActivationService.hash(raw)))
                    .thenReturn(Optional.of(token(raw, Instant.now().minus(1, ChronoUnit.DAYS), null)));

            AccountActivationService.Preview p = service.preview(raw);

            assertThat(p.state()).isEqualTo(AccountActivationService.State.EXPIRED);
            assertThat(p.maskedEmail()).isEmpty();
            assertThat(p.orgName()).isEmpty();
        }

        @Test
        @DisplayName("token lạ ⇒ UNKNOWN, không ném (đây là màn mở từ email, không phải API nội bộ)")
        void unknownTokenIsNotAnError() {
            when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

            assertThatCode(() -> assertThat(service.preview("gi-do").state())
                    .isEqualTo(AccountActivationService.State.UNKNOWN))
                    .doesNotThrowAnyException();
            assertThat(service.preview(null).state()).isEqualTo(AccountActivationService.State.UNKNOWN);
        }
    }

    @Nested
    @DisplayName("maskEmail")
    class Masking {

        @Test
        @DisplayName("giữ tối đa 3 ký tự đầu, luôn giữ tên miền")
        void masksLocalPart() {
            assertThat(AccountActivationService.maskEmail("nguyen.van.a@tt.vn")).isEqualTo("ngu***@tt.vn");
            assertThat(AccountActivationService.maskEmail("ab@tt.vn")).isEqualTo("ab***@tt.vn");
            assertThat(AccountActivationService.maskEmail("khong-co-cha")).isEqualTo("***");
        }
    }
}
