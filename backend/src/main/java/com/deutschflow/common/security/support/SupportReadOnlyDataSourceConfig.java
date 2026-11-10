package com.deutschflow.common.security.support;

import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

/**
 * Bọc bean {@code dataSource} (Hikari do Spring Boot dựng) bằng {@link SupportReadOnlyDataSource}, để JPA,
 * JdbcTemplate, transaction manager… đều đi qua lưới chặn READ ONLY của phiên hỗ trợ. Ngoài phiên hỗ trợ,
 * wrapper chỉ chuyển tiếp — không thêm round-trip nào.
 *
 * <p>{@code static} để BeanPostProcessor được dựng sớm mà không kéo theo bean thường.
 */
@Configuration(proxyBeanMethods = false)
public class SupportReadOnlyDataSourceConfig {

    @Bean
    static BeanPostProcessor supportReadOnlyDataSourcePostProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName) {
                if ("dataSource".equals(beanName) && bean instanceof DataSource ds
                        && !(bean instanceof SupportReadOnlyDataSource)) {
                    return new SupportReadOnlyDataSource(ds);
                }
                return bean;
            }
        };
    }
}
