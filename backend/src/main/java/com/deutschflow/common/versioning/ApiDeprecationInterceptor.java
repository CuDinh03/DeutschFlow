package com.deutschflow.common.versioning;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ApiDeprecationInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestUri = request.getRequestURI();
        
        // Add deprecation warning header for all v1 endpoints
        if (requestUri != null && requestUri.startsWith("/api/v1/")) {
            response.addHeader("Warning", "299 - \"API v1 is deprecated and will be removed in future versions. Please migrate to v2.\"");
        }
        
        return true;
    }
}
