package com.deutschflow.common.security.support;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * JdbcTemplate trên DataSource GỐC (không qua {@link SupportReadOnlyDataSource}): mỗi câu lấy connection riêng,
 * autocommit, không bao giờ dùng chung connection của transaction đang mở (khoá đăng ký của Spring là
 * DataSource bọc, không phải DataSource gốc).
 *
 * <p>Chỉ dùng cho vết audit phát sinh BÊN TRONG một request hỗ trợ, khi connection của request đã READ ONLY
 * ({@code AuditLogService}). Không phải cửa sau cho nghiệp vụ.
 */
@Component
public class SupportUnguardedJdbc {

    private final JdbcTemplate jdbcTemplate;

    public SupportUnguardedJdbc(DataSource dataSource) {
        DataSource raw = dataSource instanceof SupportReadOnlyDataSource s && s.getTargetDataSource() != null
                ? s.getTargetDataSource()
                : dataSource;
        this.jdbcTemplate = new JdbcTemplate(raw);
    }

    public JdbcTemplate jdbc() {
        return jdbcTemplate;
    }
}
