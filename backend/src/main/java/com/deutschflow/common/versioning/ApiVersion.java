package com.deutschflow.common.versioning;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to define the API version for a REST Controller.
 * The version will be automatically prefixed to the path: /api/v{version}/...
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface ApiVersion {
    /**
     * The API version string, e.g., "1", "2".
     * Default is "1".
     */
    String value() default "1";
}
