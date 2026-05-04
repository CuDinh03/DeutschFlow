package com.deutschflow.unittest.support;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.user.entity.User;
import org.springframework.core.MethodParameter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.lang.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * MockMvc không nâng cả Spring context — không JDBC/Testcontainers — phù hợp kiểm thử controller thuần.
 */
public final class MockMvcWithValidation {

    private MockMvcWithValidation() {
    }

    public static MockMvc standalone(Object controller, @Nullable GlobalExceptionHandler advice,
                                     @Nullable User authenticationPrincipalUser) {

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        var builder = MockMvcBuilders.standaloneSetup(controller)
                .setValidator(validator)
                .setMessageConverters(new MappingJackson2HttpMessageConverter());

        if (advice != null) {
            builder.setControllerAdvice(advice);
        }
        if (authenticationPrincipalUser != null) {
            builder.setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                @Override
                public boolean supportsParameter(MethodParameter parameter) {
                    return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                            && User.class.isAssignableFrom(parameter.getParameterType());
                }

                @Override
                public Object resolveArgument(MethodParameter parameter,
                                              ModelAndViewContainer mavContainer,
                                              NativeWebRequest webRequest,
                                              WebDataBinderFactory binderFactory) {
                    return authenticationPrincipalUser;
                }
            });
        }
        return builder.build();
    }

    /** Controller không có {@code @AuthenticationPrincipal}. */
    public static MockMvc standalone(Object controller) {
        return standalone(controller, new GlobalExceptionHandler(), null);
    }

    /** Kèm xử lý lỗi Problem+JSON. */
    public static MockMvc standaloneWithAdvice(Object controller) {
        return standalone(controller, new GlobalExceptionHandler(), null);
    }
}
