package com.deutschflow.common.quota;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

public final class RequestContext {
    private RequestContext() {}

    public static String requestIdOrNull() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (attrs == null) return null;
        Object value = attrs.getAttribute("requestId", RequestAttributes.SCOPE_REQUEST);
        String s = value == null ? null : String.valueOf(value).trim();
        return (s == null || s.isBlank()) ? null : s;
    }
}

