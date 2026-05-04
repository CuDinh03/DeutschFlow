package com.deutschflow.common.quota;

public class QuotaExceededException extends RuntimeException {
    private final QuotaSnapshot snapshot;

    public QuotaExceededException(String message, QuotaSnapshot snapshot) {
        super(message);
        this.snapshot = snapshot;
    }

    public QuotaSnapshot getSnapshot() {
        return snapshot;
    }
}

