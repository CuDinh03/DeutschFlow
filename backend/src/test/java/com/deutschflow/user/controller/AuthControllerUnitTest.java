package com.deutschflow.user.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.user.service.AuthService authService;
    @Mock
    com.deutschflow.user.service.AuthRateLimiterService authRateLimiterService;

    @InjectMocks
    AuthController controller;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }

    /**
     * The per-IP login cap must be enforced BEFORE anything expensive happens. A login attempt costs
     * a full BCrypt hash even when the email does not exist (Spring's DaoAuthenticationProvider runs
     * mitigateAgainstTimingAttack on unknown users), so the guard is worthless if AuthService is
     * still reached. verifyNoInteractions(authService) is the assertion that actually pins that.
     */
    @Test
    void login_perIpCapExceeded_returns429AndNeverReachesAuthService() throws Exception {
        when(authRateLimiterService.allowLoginPerIp(anyString())).thenReturn(false);
        when(authRateLimiterService.loginIpRetryAfterSeconds()).thenReturn(60);

        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        // An email nobody has ever used: the (IP+email) bucket is empty, so ONLY the
                        // per-IP cap can stop this request.
                        .content("{\"email\":\"never-seen-before@x.com\",\"password\":\"whatever\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"));

        verifyNoInteractions(authService);
    }

    @Test
    void register_invalidPayload_returns400() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
