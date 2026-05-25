package com.deutschflow.common.transaction;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class RunAfterCommitServiceUnitTest {

    private final RunAfterCommitService service = new RunAfterCommitService();

    @Test
    void instantiated() {
        assertNotNull(service);
    }
}
