-- V58: Gamification — XP Events, Achievements, User Badges
-- ============================================================
-- Thiết kế: mỗi hành động (chat turn, session end, streak, vocab review)
-- tạo 1 event trong user_xp_events. Tổng XP = SUM(xp_amount).
-- Achievements được unlock dựa trên milestones (session count, streak, XP).
-- ============================================================

-- ───────────────────────────────────────────
-- 1. XP Events ledger
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_xp_events (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT        NOT NULL,
    xp_amount     INTEGER       NOT NULL DEFAULT 0,
    -- event_type: SPEAKING_TURN | SESSION_COMPLETE | STREAK_BONUS | VOCAB_REVIEW | ERROR_FIXED | FIRST_SESSION | DAILY_GOAL
    event_type    VARCHAR(64)   NOT NULL,
    -- optional reference to speaking session or session attempt
    ref_session_id BIGINT       NULL,
    ref_message_id BIGINT       NULL,
    note          TEXT          NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_events_user_id ON user_xp_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_events_type    ON user_xp_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_user_xp_events_created ON user_xp_events (user_id, created_at DESC);

-- ───────────────────────────────────────────
-- 2. Achievement definitions (seeded below)
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64)   NOT NULL UNIQUE,
    name_vi     VARCHAR(128)  NOT NULL,
    description_vi TEXT        NOT NULL,
    icon_emoji  VARCHAR(8)    NOT NULL DEFAULT '🏆',
    xp_reward   INTEGER       NOT NULL DEFAULT 50,
    -- trigger_type: TOTAL_XP | SESSION_COUNT | STREAK_DAYS | ERRORS_FIXED | SESSIONS_SPEAKING
    trigger_type VARCHAR(64)  NOT NULL,
    trigger_threshold INTEGER NOT NULL,
    rarity      VARCHAR(16)   NOT NULL DEFAULT 'COMMON'  -- COMMON | RARE | EPIC | LEGENDARY
);

-- ───────────────────────────────────────────
-- 3. User achievement unlocks
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT      NOT NULL,
    achievement_id  BIGINT      NOT NULL REFERENCES achievements(id),
    unlocked_at     TIMESTAMP   NOT NULL DEFAULT NOW(),
    notified        BOOLEAN     NOT NULL DEFAULT FALSE,
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_notified ON user_achievements (user_id, notified);

-- ───────────────────────────────────────────
-- 4. User XP summary cache (refreshed via trigger or service)
-- ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_xp_summary (
    user_id       BIGINT  PRIMARY KEY,
    total_xp      INTEGER NOT NULL DEFAULT 0,
    current_level INTEGER NOT NULL DEFAULT 1,
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────
-- 5. Seed: core achievements
-- ───────────────────────────────────────────
INSERT INTO achievements (code, name_vi, description_vi, icon_emoji, xp_reward, trigger_type, trigger_threshold, rarity) VALUES
('FIRST_SPEAK',      'Buổi nói đầu tiên',        'Hoàn thành phiên luyện nói đầu tiên với AI',     '🎙️', 100, 'SESSIONS_SPEAKING', 1,   'COMMON'),
('SPEAK_5',          '5 buổi nói',               'Hoàn thành 5 phiên luyện nói',                   '🗣️', 150, 'SESSIONS_SPEAKING', 5,   'COMMON'),
('SPEAK_20',         'Nhà diễn thuyết',           'Hoàn thành 20 phiên luyện nói',                  '🏅', 300, 'SESSIONS_SPEAKING', 20,  'RARE'),
('SPEAK_50',         'Gia sư ngôn ngữ',           'Hoàn thành 50 phiên luyện nói',                  '🌟', 500, 'SESSIONS_SPEAKING', 50,  'EPIC'),
('XP_100',           'Học viên nhiệt huyết',      'Tích lũy 100 XP đầu tiên',                      '⚡', 50,  'TOTAL_XP',          100,  'COMMON'),
('XP_500',           'Người học chăm chỉ',        'Tích lũy 500 XP',                               '🔥', 100, 'TOTAL_XP',          500,  'COMMON'),
('XP_2000',          'Chuyên gia tiếng Đức',      'Tích lũy 2000 XP',                              '💎', 300, 'TOTAL_XP',          2000, 'RARE'),
('XP_10000',         'Bậc thầy ngôn ngữ',         'Tích lũy 10000 XP',                             '👑', 1000,'TOTAL_XP',          10000,'LEGENDARY'),
('STREAK_3',         'Chuỗi 3 ngày',              'Học liên tục 3 ngày không gián đoạn',            '📅', 75,  'STREAK_DAYS',        3,   'COMMON'),
('STREAK_7',         'Tuần vàng',                 'Học liên tục 7 ngày',                            '🗓️', 150, 'STREAK_DAYS',        7,   'COMMON'),
('STREAK_30',        'Tháng kiên trì',            'Học liên tục 30 ngày',                           '🏆', 500, 'STREAK_DAYS',        30,  'EPIC'),
('STREAK_100',       'Huyền thoại kiên trì',      'Học liên tục 100 ngày',                          '🔱', 2000,'STREAK_DAYS',        100, 'LEGENDARY'),
('ERRORS_FIXED_10',  'Sửa lỗi chăm chỉ',         'Sửa thành công 10 lỗi ngữ pháp',                '✅', 100, 'ERRORS_FIXED',       10,  'COMMON'),
('ERRORS_FIXED_50',  'Thợ sửa lỗi',              'Sửa thành công 50 lỗi ngữ pháp',                '🛠️', 300, 'ERRORS_FIXED',       50,  'RARE')
ON CONFLICT (code) DO NOTHING;
