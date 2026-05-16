package com.deutschflow.common.versioning;

import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.servlet.mvc.condition.PatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Method;

public class ApiVersionRequestMappingHandlerMapping extends RequestMappingHandlerMapping {

    @Override
    protected RequestMappingInfo getMappingForMethod(Method method, Class<?> handlerType) {
        RequestMappingInfo info = super.getMappingForMethod(method, handlerType);
        if (info == null) {
            return null;
        }

        ApiVersion apiVersion = AnnotatedElementUtils.findMergedAnnotation(method, ApiVersion.class);
        if (apiVersion == null) {
            apiVersion = AnnotatedElementUtils.findMergedAnnotation(handlerType, ApiVersion.class);
        }

        if (apiVersion != null) {
            String prefix = "/api/v" + apiVersion.value();
            // Create a condition for the prefix
            PatternsRequestCondition prefixCondition = new PatternsRequestCondition(prefix);
            // Combine prefix with the existing mapping
            info = RequestMappingInfo.paths(prefix).build().combine(info);
        }

        return info;
    }
}
