package com.deutschflow.common.security;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.AuthenticationEntryPoint;

@Configuration
public class SecurityExceptionLoggingHandler {
    private static final Logger log = LoggerFactory.getLogger(SecurityExceptionLoggingHandler.class);

    @Bean
    public AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            log.warn("403 Forbidden: method={} path={} user={} authorities={} remoteAddr={} message={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    auth != null ? auth.getName() : "anonymous",
                    auth != null ? auth.getAuthorities() : "[]",
                    request.getRemoteAddr(),
                    accessDeniedException.getMessage());
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Forbidden");
        };
    }

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> {
            log.warn("401 Unauthorized: method={} path={} remoteAddr={} message={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    request.getRemoteAddr(),
                    authException.getMessage());
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
        };
    }
}