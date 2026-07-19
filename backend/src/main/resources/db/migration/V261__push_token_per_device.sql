-- V261: a push token identifies a DEVICE, not an account — enforce one owner per token.
--
-- An Expo push token is minted per app-install. users.push_token stored it per ACCOUNT and
-- savePushToken never removed the token from accounts that had registered it earlier, so every
-- account that ever logged in on a device kept that device's token. Result: the device received
-- push notifications addressed to ALL of those accounts, not just the one currently logged in.
-- AuthService.savePushToken now strips the token from other users on every registration and
-- logout clears it; this migration repairs the rows that are already duplicated.
--
-- Null out every token held by more than one account. We cannot tell which of the sharers is the
-- device's current user, so drop it from all of them — the app re-registers the token for the
-- logged-in user on its next launch (usePushNotifications). Idempotent — safe to re-run.
UPDATE users
SET push_token = NULL, push_platform = NULL
WHERE push_token IN (
    SELECT push_token FROM users
    WHERE push_token IS NOT NULL
    GROUP BY push_token
    HAVING COUNT(*) > 1
);

-- Guarantee the invariant at the DB level: one device token belongs to at most one account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_push_token
    ON users (push_token)
    WHERE push_token IS NOT NULL;
