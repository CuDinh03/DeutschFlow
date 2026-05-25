package com.deutschflow.common.transaction;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Runs a callback after the current Spring transaction commits (or immediately when no txn is active).
 */
@Component
public class RunAfterCommitService {

    private static final Logger log = LoggerFactory.getLogger(RunAfterCommitService.class);

    /**
     * @param runnable work that must observe committed rows from outer transaction (avoid inner visibility races)
     */
    public void run(Runnable runnable) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            invoke(runnable);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) {
                    invoke(runnable);
                }
            }
        });
    }

    private static void invoke(Runnable runnable) {
        try {
            runnable.run();
        } catch (RuntimeException ex) {
            log.error("[tx] RunAfterCommit runnable failed", ex);
        }
    }
}
