package com.deutschflow.ai.trace;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.slf4j.LoggerFactory;

import java.util.List;

/** Bắt các dòng {@code AI_CALL} và metric {@code ai.call} trong test. Nhớ {@link #close()}. */
public final class AiTraceCapture implements AutoCloseable {

    private final Logger logger = (Logger) LoggerFactory.getLogger(AiCallTrace.LOGGER_NAME);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    public final SimpleMeterRegistry meters = new SimpleMeterRegistry();

    public AiTraceCapture() {
        appender.start();
        logger.addAppender(appender);
        Metrics.addRegistry(meters);
    }

    public List<ILoggingEvent> events() {
        return List.copyOf(appender.list);
    }

    /** Các dòng log đã điền tham số. */
    public List<String> lines() {
        return events().stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    public String single() {
        List<String> l = lines();
        if (l.size() != 1) throw new AssertionError("Cần đúng 1 dòng AI_CALL, có " + l.size() + ": " + l);
        return l.get(0);
    }

    @Override
    public void close() {
        logger.detachAppender(appender);
        Metrics.removeRegistry(meters);
    }
}
