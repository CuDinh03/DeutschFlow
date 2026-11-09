package com.deutschflow.common.security.support;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.datasource.DelegatingDataSource;

import javax.sql.DataSource;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Bọc DataSource của ứng dụng: connection lấy ra trên một thread đang trong {@link SupportSessionDbGuard} bị ép
 * READ ONLY ở PHÍA POSTGRESQL — lưới chặn cuối của phiên hỗ trợ chỉ-đọc, phòng khi một handler GET nào đó
 * "ghi khi đọc" mà danh sách chặn của {@code SupportSessionReadOnlyFilter} chưa biết.
 *
 * <p><b>Vì sao không chỉ {@code connection.setReadOnly(true)}:</b> pgjdbc (readOnlyMode mặc định
 * {@code transaction}) chỉ đổi cờ cục bộ để gửi {@code BEGIN READ ONLY} cho transaction tường minh; câu lệnh
 * autocommit (JdbcTemplate ngoài {@code @Transactional}) KHÔNG bị chặn. Nên ngoài cờ JDBC, connection được đặt
 * {@code SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY} ({@code default_transaction_read_only=on}):
 * mọi transaction sau đó, kể cả autocommit, đều read-only. Đã đọc bytecode pgjdbc 42.6.2
 * ({@code PgConnection.setReadOnly}) để xác nhận.
 *
 * <p><b>Spring không lật ngược được:</b> {@code DataSourceUtils.resetConnectionAfterTransaction} (JDBC và
 * {@code HibernateJpaDialect}) gọi {@code setReadOnly(false)} sau mỗi {@code @Transactional(readOnly = true)};
 * proxy dưới đây biến mọi {@code setReadOnly(..)} thành {@code setReadOnly(true)}. Transaction không readOnly
 * thì Spring không đụng tới cờ; và biến phiên {@code default_transaction_read_only} không bị
 * {@code setReadOnly} của pgjdbc (chế độ {@code transaction}) động tới.
 *
 * <p><b>Không rò về pool:</b> HikariCP chỉ khôi phục cờ JDBC readOnly ({@code PoolBase.resetConnectionState},
 * đã đọc bytecode HikariCP 5.0.1) chứ không biết biến phiên PostgreSQL. Proxy chặn {@code close()}: rollback
 * transaction dở (nếu có), bật lại autocommit, chạy {@code SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE}
 * rồi mới trả connection. Không đặt lại được (connection hỏng) → đóng connection vật lý bên dưới để Hikari loại
 * nó thay vì cho mượn lại.
 *
 * <p>Đăng ký bằng {@link SupportReadOnlyDataSourceConfig} (BeanPostProcessor bọc bean {@code dataSource}).
 */
@Slf4j
public class SupportReadOnlyDataSource extends DelegatingDataSource {

    static final String SET_READ_ONLY = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY";
    static final String SET_READ_WRITE = "SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE";

    public SupportReadOnlyDataSource(DataSource target) {
        super(target);
    }

    @Override
    public Connection getConnection() throws SQLException {
        Connection c = obtainTargetDataSource().getConnection();
        return SupportSessionDbGuard.isActive() ? enforceReadOnly(c) : c;
    }

    @Override
    public Connection getConnection(String username, String password) throws SQLException {
        Connection c = obtainTargetDataSource().getConnection(username, password);
        return SupportSessionDbGuard.isActive() ? enforceReadOnly(c) : c;
    }

    static Connection enforceReadOnly(Connection target) throws SQLException {
        try {
            if (!target.getAutoCommit()) {
                target.rollback();
                target.setAutoCommit(true);
            }
            target.setReadOnly(true);
            try (Statement st = target.createStatement()) {
                st.execute(SET_READ_ONLY);
            }
        } catch (SQLException | RuntimeException e) {
            // Không ép được READ ONLY → không giao connection (fail-closed), trả lại sạch sẽ.
            resetAndClose(target);
            throw e;
        }
        return (Connection) Proxy.newProxyInstance(
                SupportReadOnlyDataSource.class.getClassLoader(),
                new Class<?>[]{Connection.class},
                new ReadOnlyConnectionHandler(target));
    }

    /** Bật lại READ WRITE cho phiên DB rồi trả connection; thất bại → đóng connection vật lý. */
    static void resetAndClose(Connection target) {
        boolean reset = false;
        try {
            if (!target.isClosed()) {
                if (!target.getAutoCommit()) {
                    target.rollback();
                    target.setAutoCommit(true);
                }
                try (Statement st = target.createStatement()) {
                    st.execute(SET_READ_WRITE);
                }
                reset = true;
            }
        } catch (SQLException | RuntimeException e) {
            log.warn("[SupportReadOnlyDataSource] Không đặt lại READ WRITE cho connection ({}) — đóng connection vật lý",
                    e.getMessage());
        }
        if (!reset) {
            closePhysical(target);
        }
        try {
            target.close();
        } catch (SQLException | RuntimeException e) {
            log.debug("[SupportReadOnlyDataSource] close sau khi bỏ connection: {}", e.getMessage());
        }
    }

    private static void closePhysical(Connection target) {
        try {
            if (target.isWrapperFor(Connection.class)) {
                Connection physical = target.unwrap(Connection.class);
                if (physical != null && physical != target) {
                    physical.close();
                }
            }
        } catch (SQLException | RuntimeException e) {
            log.debug("[SupportReadOnlyDataSource] Không đóng được connection vật lý: {}", e.getMessage());
        }
    }

    /** Proxy giữ READ ONLY tới lúc trả connection. */
    static final class ReadOnlyConnectionHandler implements InvocationHandler {

        private final Connection target;
        private boolean closed;

        ReadOnlyConnectionHandler(Connection target) {
            this.target = target;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            switch (method.getName()) {
                case "setReadOnly":
                    // Spring gọi setReadOnly(false) sau @Transactional(readOnly = true) — không cho hạ cờ.
                    target.setReadOnly(true);
                    return null;
                case "close":
                    if (!closed) {
                        closed = true;
                        resetAndClose(target);
                    }
                    return null;
                case "isClosed":
                    return closed || target.isClosed();
                case "equals":
                    return proxy == args[0];
                case "hashCode":
                    return System.identityHashCode(proxy);
                case "toString":
                    return "SupportReadOnlyConnection[" + target + "]";
                default:
                    try {
                        return method.invoke(target, args);
                    } catch (InvocationTargetException e) {
                        throw e.getTargetException();
                    }
            }
        }
    }
}
