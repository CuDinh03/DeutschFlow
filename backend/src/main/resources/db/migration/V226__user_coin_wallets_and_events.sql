-- V226 — Student virtual currency ("coin").
-- (Renumbered from V221 → V226 to land AFTER remediation V222–V224 (#125, on main) and
--  M-5 V225 (#126) — keeps Flyway in-order when this merges to main. Assumes #126 merges first;
--  if coin merges before #126, set spring.flyway.out-of-order=true.)
--
-- Bonus-only economy: coins are EARNED 1-per-learning-node-completion and SPENT on bonus access
-- (a single-attempt mock-exam trial pass, or extra AI-speaking tokens for the day). Coins NEVER
-- replace the PRO/ULTRA subscription — the paid tier remains the only path to unlimited/permanent
-- access, retakes, review, and all packs.
--
-- Mirrors the established patterns:
--   * user_ai_token_wallets (V42)  -> user_coin_wallets   (aggregate balance, fast read)
--   * user_xp_events        (V58)  -> user_coin_events    (append-only audit ledger)

-- ── Wallet: authoritative balance, updated atomically under a per-user advisory lock. ──
CREATE TABLE IF NOT EXISTS user_coin_wallets (
  user_id    BIGINT      NOT NULL PRIMARY KEY,
  balance    BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_coin_wallet_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_coin_balance_nonneg CHECK (balance >= 0)
);

-- ── Ledger: append-only audit trail. amount > 0 = EARN, amount < 0 = SPEND. ──
CREATE TABLE IF NOT EXISTS user_coin_events (
  id             BIGSERIAL   PRIMARY KEY,
  user_id        BIGINT      NOT NULL,
  amount         INT         NOT NULL,
  event_type     VARCHAR(48) NOT NULL,        -- NODE_COMPLETE | SPEND_MOCK_TRIAL | SPEND_BONUS_SPEAKING
  ref_node_id    VARCHAR(64),                 -- tree_nodes.id (VARCHAR) or legacy skill_tree id as text
  ref_node_kind  VARCHAR(16),                 -- 'TREE' | 'SKILL_TREE' — disambiguates the two id spaces
  ref_pack_id    BIGINT,                      -- mock_exam_packs.id for a trial-pass purchase
  ref_attempt_id BIGINT,                      -- mock_exam_attempts.id when a trial pass is consumed
  note           VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_coin_event_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ANTI-FARMING: at most ONE earn event per (user, node-kind, node). Re-completing / reviewing a node
-- (RoadmapTreeService.completeNode is idempotent) can never mint a second coin. Partial unique index
-- so only EARN rows are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coin_earn_once_per_node
  ON user_coin_events (user_id, ref_node_kind, ref_node_id)
  WHERE event_type = 'NODE_COMPLETE';

CREATE INDEX IF NOT EXISTS idx_coin_events_user ON user_coin_events (user_id, created_at DESC);

-- ── Mock-exam trial pass: explicit purchase granting exactly ONE attempt on an otherwise-PRO pack. ──
-- status flows PURCHASED -> CONSUMED (consumed at attempt-start). The partial unique index allows at
-- most one un-consumed pass per (user, pack) so repeated "buy" clicks can't stack passes.
CREATE TABLE IF NOT EXISTS user_mock_trial_passes (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      BIGINT      NOT NULL,
  pack_id      BIGINT      NOT NULL,
  status       VARCHAR(16) NOT NULL DEFAULT 'PURCHASED',   -- PURCHASED | CONSUMED
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at  TIMESTAMPTZ,
  attempt_id   BIGINT,                                     -- mock_exam_attempts.id it was spent on
  CONSTRAINT fk_trial_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_pack FOREIGN KEY (pack_id) REFERENCES mock_exam_packs (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_one_active_per_pack
  ON user_mock_trial_passes (user_id, pack_id)
  WHERE status = 'PURCHASED';
CREATE INDEX IF NOT EXISTS idx_trial_user ON user_mock_trial_passes (user_id);

-- ── Bonus AI-speaking tokens: a one-time, TODAY-scoped top-up to the daily free quota. ──
-- Buying adds bonus_tokens for the current VN day; QuotaService adds today's bonus to remaining
-- spendable so an exhausted FREE user can do one extra session. Consumption is implicit via the
-- existing daily usage accounting (no separate debit); unused tokens lapse at day end. Keyed by VN
-- local date so the grant is naturally per-day and never permanently elevates the tier.
CREATE TABLE IF NOT EXISTS user_bonus_speaking_tokens (
  user_id      BIGINT      NOT NULL,
  local_date   DATE        NOT NULL,
  bonus_tokens BIGINT      NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, local_date),
  CONSTRAINT fk_bonus_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_bonus_tokens_nonneg CHECK (bonus_tokens >= 0)
);
