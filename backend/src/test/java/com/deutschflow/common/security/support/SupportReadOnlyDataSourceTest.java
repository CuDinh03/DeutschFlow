package com.deutschflow.common.security.support;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hợp đồng JDBC của lưới READ ONLY (connection giả). Hành vi phía PostgreSQL thật (ghi bị từ chối, connection trả
 * về pool không còn READ ONLY) kiểm ở {@code SupportSessionFlowIntegrationTest}.
 */
@DisplayName("SupportReadOnlyDataSource — ép READ ONLY cho thread phiên hỗ trợ")
class SupportReadOnlyDataSourceTest {

    @AfterEach
    void cleanup() {
        SupportSessionDbGuard.exit();
    }

    private static Connection connection(Statement st) throws SQLException {
        Connection c = mock(Connection.class);
        when(c.getAutoCommit()).thenReturn(true);
        when(c.createStatement()).thenReturn(st);
        return c;
    }

    @Test
    @DisplayName("ngoài lưới: trả nguyên connection, không chạy SQL nào")
    void passThroughOutsideGuard() throws Exception {
        DataSource raw = mock(DataSource.class);
        Connection c = mock(Connection.class);
        when(raw.getConnection()).thenReturn(c);

        assertThat(new SupportReadOnlyDataSource(raw).getConnection()).isSameAs(c);
        verify(c, never()).createStatement();
        verify(c, never()).setReadOnly(org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    @DisplayName("trong lưới: setReadOnly(true) + SET SESSION … READ ONLY; Spring hạ cờ cũng không được; close đặt lại READ WRITE rồi mới trả")
    void enforcesAndResets() throws Exception {
        DataSource raw = mock(DataSource.class);
        Statement st = mock(Statement.class);
        Connection c = connection(st);
        when(raw.getConnection()).thenReturn(c);
        SupportSessionDbGuard.enter();

        Connection proxy = new SupportReadOnlyDataSource(raw).getConnection();
        assertThat(proxy).isNotSameAs(c);
        verify(c).setReadOnly(true);
        verify(st).execute(SupportReadOnlyDataSource.SET_READ_ONLY);

        // DataSourceUtils.resetConnectionAfterTransaction sau @Transactional(readOnly = true)
        proxy.setReadOnly(false);
        verify(c, never()).setReadOnly(false);

        proxy.close();
        proxy.close(); // idempotent
        InOrder order = inOrder(st, c);
        order.verify(st).execute(SupportReadOnlyDataSource.SET_READ_WRITE);
        order.verify(c).close();
        assertThat(proxy.isClosed()).isTrue();
    }

    @Test
    @DisplayName("đặt lại READ WRITE thất bại → đóng connection vật lý (Hikari loại bỏ), không trả connection bẩn")
    void resetFailureClosesPhysical() throws Exception {
        DataSource raw = mock(DataSource.class);
        Statement st = mock(Statement.class);
        Connection c = connection(st);
        Connection physical = mock(Connection.class);
        when(c.isWrapperFor(Connection.class)).thenReturn(true);
        when(c.unwrap(Connection.class)).thenReturn(physical);
        when(raw.getConnection()).thenReturn(c);
        SupportSessionDbGuard.enter();

        Connection proxy = new SupportReadOnlyDataSource(raw).getConnection();
        when(st.execute(SupportReadOnlyDataSource.SET_READ_WRITE)).thenThrow(new SQLException("broken", "08006"));
        proxy.close();

        verify(physical).close();
        verify(c).close();
    }

    @Test
    @DisplayName("không ép được READ ONLY → ném lỗi, không giao connection (fail-closed)")
    void enforceFailureIsFailClosed() throws Exception {
        DataSource raw = mock(DataSource.class);
        Statement st = mock(Statement.class);
        Connection c = connection(st);
        when(raw.getConnection()).thenReturn(c);
        when(st.execute(SupportReadOnlyDataSource.SET_READ_ONLY)).thenThrow(new SQLException("nope"));
        SupportSessionDbGuard.enter();

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> new SupportReadOnlyDataSource(raw).getConnection())
                .isInstanceOf(SQLException.class);
        verify(c).close();
        verify(st, never()).executeUpdate(anyString());
    }
}
