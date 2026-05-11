-- ============================================================
-- V72: Subscription Plans V2 — Tier Redesign
-- DEFAULT (0) | FREE (9K/7d) | PRO (400K/30d/299K) | ULTRA (2M/30d/699K) | INTERNAL (∞)
-- ============================================================

-- 1. Update DEFAULT: 0 tokens, basic features only (swipe cards, lego, vocab lookup)
UPDATE subscription_plans
SET daily_token_grant = 0,
    wallet_cap_days   = 0,
    features_json     = '{
      "streaming": false,
      "interview": false,
      "mockExam": false,
      "voiceClone": false,
      "quickAiToolbar": false,
      "vocabAiTabs": 0,
      "maxPersonas": 0,
      "maxReviewCards": -1,
      "vocabAnalytics": false,
      "customPersona": false,
      "evaluatorStrictness": false,
      "advancedAnalytics": false,
      "crashCourse": false,
      "customVocabDecks": false,
      "priorityQueue": false,
      "leaderboardBadge": null
    }'
WHERE code = 'DEFAULT';

-- 2. Update FREE: 9K tokens/day, 7-day trial, Emma + Anna only
UPDATE subscription_plans
SET daily_token_grant = 9000,
    wallet_cap_days   = 0,
    features_json     = '{
      "streaming": false,
      "interview": false,
      "mockExam": false,
      "voiceClone": false,
      "quickAiToolbar": false,
      "vocabAiTabs": 2,
      "maxPersonas": 2,
      "allowedPersonas": ["EMMA", "ANNA"],
      "maxReviewCards": 20,
      "vocabAnalytics": false,
      "customPersona": false,
      "evaluatorStrictness": false,
      "advancedAnalytics": false,
      "crashCourse": false,
      "customVocabDecks": false,
      "priorityQueue": false,
      "leaderboardBadge": null
    }'
WHERE code = 'FREE';

-- 3. Update PRO: 400K tokens/day, 30-day wallet, all 4 personas, interview, 299K VND
UPDATE subscription_plans
SET daily_token_grant = 400000,
    wallet_cap_days   = 30,
    features_json     = '{
      "streaming": true,
      "interview": true,
      "mockExam": false,
      "voiceClone": true,
      "quickAiToolbar": true,
      "vocabAiTabs": 6,
      "maxPersonas": 4,
      "maxReviewCards": -1,
      "vocabAnalytics": true,
      "customPersona": false,
      "evaluatorStrictness": false,
      "advancedAnalytics": false,
      "crashCourse": false,
      "customVocabDecks": false,
      "priorityQueue": false,
      "leaderboardBadge": null,
      "priceVnd": 299000
    }'
WHERE code = 'PRO';

-- 4. Update ULTRA: 2M tokens/day, 90-day wallet, all features, 699K VND
UPDATE subscription_plans
SET daily_token_grant = 2000000,
    wallet_cap_days   = 90,
    features_json     = '{
      "streaming": true,
      "interview": true,
      "mockExam": true,
      "voiceClone": true,
      "quickAiToolbar": true,
      "vocabAiTabs": 6,
      "maxPersonas": -1,
      "maxReviewCards": -1,
      "vocabAnalytics": true,
      "customPersona": true,
      "evaluatorStrictness": true,
      "advancedAnalytics": true,
      "crashCourse": true,
      "customVocabDecks": true,
      "priorityQueue": true,
      "leaderboardBadge": "ULTRA_GOLD",
      "priceVnd": 699000
    }'
WHERE code = 'ULTRA';

-- 5. Update INTERNAL: unlimited, all features, permanent
UPDATE subscription_plans
SET daily_token_grant = 0,
    wallet_cap_days   = 0,
    monthly_token_limit = 999999999,
    features_json     = '{
      "streaming": true,
      "interview": true,
      "mockExam": true,
      "voiceClone": true,
      "quickAiToolbar": true,
      "vocabAiTabs": 6,
      "maxPersonas": -1,
      "maxReviewCards": -1,
      "vocabAnalytics": true,
      "customPersona": true,
      "evaluatorStrictness": true,
      "advancedAnalytics": true,
      "crashCourse": true,
      "customVocabDecks": true,
      "priorityQueue": true,
      "leaderboardBadge": "INTERNAL"
    }'
WHERE code = 'INTERNAL';

-- 6. Ensure FREE subscriptions have 7-day expiry set
UPDATE user_subscriptions
SET ends_at = starts_at + INTERVAL '7 days',
    updated_at = CURRENT_TIMESTAMP
WHERE plan_code = 'FREE'
  AND status = 'ACTIVE'
  AND ends_at IS NULL;
