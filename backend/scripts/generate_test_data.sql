-- =============================================================================
-- AI Speaking Module - Test Data Generator
-- Purpose: Create comprehensive test data for pre-deployment testing
-- Usage: psql -U postgres -d deutschflow -f generate_test_data.sql
-- =============================================================================

-- WARNING: This script creates test data. Run on test/staging DB only!
BEGIN TRANSACTION;

-- ============= TEST USERS =============
-- Create 5 test users with different profiles and scenarios

INSERT INTO "user" (email, password_hash, role, created_at, updated_at) VALUES
  ('test-user-1@deutschflow.de', 'hash', 'STUDENT', NOW(), NOW()),
  ('test-user-2@deutschflow.de', 'hash', 'STUDENT', NOW(), NOW()),
  ('test-user-3@deutschflow.de', 'hash', 'STUDENT', NOW(), NOW()),
  ('test-user-no-profile@deutschflow.de', 'hash', 'STUDENT', NOW(), NOW()),
  ('test-user-quota-exceeded@deutschflow.de', 'hash', 'STUDENT', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Get user IDs
DO $$
DECLARE
  user1_id BIGINT;
  user2_id BIGINT;
  user3_id BIGINT;
  user_no_profile_id BIGINT;
  user_quota_exceeded_id BIGINT;
BEGIN
  SELECT id INTO user1_id FROM "user" WHERE email = 'test-user-1@deutschflow.de';
  SELECT id INTO user2_id FROM "user" WHERE email = 'test-user-2@deutschflow.de';
  SELECT id INTO user3_id FROM "user" WHERE email = 'test-user-3@deutschflow.de';
  SELECT id INTO user_no_profile_id FROM "user" WHERE email = 'test-user-no-profile@deutschflow.de';
  SELECT id INTO user_quota_exceeded_id FROM "user" WHERE email = 'test-user-quota-exceeded@deutschflow.de';

  -- ============= LEARNING PROFILES =============
  -- Create profiles for users 1-3, but NOT for user 4 (to test missing profile scenario)

  INSERT INTO user_learning_profiles (user_id, current_level, target_level, practice_band, created_at, updated_at) VALUES
    (user1_id, 'A1', 'C1', 'A1', NOW(), NOW()),
    (user2_id, 'B1', 'B2', 'B1', NOW(), NOW()),
    (user3_id, 'B2', 'C1', 'B2', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ============= SUBSCRIPTIONS =============
  -- Set up subscriptions with different quota levels

  INSERT INTO user_subscriptions (user_id, plan_code, daily_token_grant, status, starts_at, created_at) VALUES
    (user1_id, 'FREE', 10000, 'ACTIVE', NOW(), NOW()),
    (user2_id, 'PRO', 50000, 'ACTIVE', NOW(), NOW()),
    (user3_id, 'ULTRA', 200000, 'ACTIVE', NOW(), NOW()),
    (user_no_profile_id, 'FREE', 10000, 'ACTIVE', NOW(), NOW()),
    (user_quota_exceeded_id, 'FREE', 10000, 'ACTIVE', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ============= TOKEN USAGE (FOR QUOTA TESTING) =============
  -- Simulate quota usage for user 5

  INSERT INTO ai_token_usage_events (user_id, total_tokens, created_at) VALUES
    (user_quota_exceeded_id, 10100, NOW())  -- Exceeds daily limit of 10000
  ON CONFLICT DO NOTHING;

  -- ============= COMMUNICATION SESSIONS =============
  -- Create various COMMUNICATION mode sessions for user 1

  INSERT INTO ai_speaking_sessions
    (user_id, topic, cefr_level, persona, response_schema, session_mode, status, ai_score, ai_feedback, started_at, last_activity_at, ended_at, message_count)
  VALUES
    (user1_id, 'Reise', 'A1', 'DEFAULT', 'V1', 'COMMUNICATION', 'ENDED', 7, 'Good pronunciation', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 5),
    (user1_id, 'Beruf', 'A1', 'LUKAS', 'V1', 'COMMUNICATION', 'ENDED', 8, 'Excellent grammar', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 8),
    (user1_id, 'Hobbys', 'A1', 'EMMA', 'V2', 'COMMUNICATION', 'ACTIVE', NULL, NULL, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '5 minutes', NULL, 3)
  ON CONFLICT DO NOTHING;

  -- ============= INTERVIEW SESSIONS =============
  -- Create INTERVIEW mode sessions for user 2

  INSERT INTO ai_speaking_sessions
    (user_id, topic, cefr_level, persona, response_schema, session_mode, interview_position, experience_level, status, ai_score, ai_feedback, interview_state_json, interview_report_json, started_at, last_activity_at, ended_at, message_count)
  VALUES
    (user2_id, NULL, 'B1', 'LUKAS', 'V1', 'INTERVIEW', 'Backend Developer', '1-2Y', 'ENDED', 7, 'Good technical knowledge',
     '{"seed":1001,"phase":5,"userTurn":12,"challengeCount":3,"weakAnswerStreak":0,"concreteExampleGiven":true,"topicsCovered":["Java","REST"],"askedQuestionIds":["q1","q2"],"lastDirectiveType":"CLOSING","sessionTopicFocus":"IT"}',
     '{"overall_score":"7/10","verdict":"PASS","verdict_label_vi":"Đạt","categories":[{"name_vi":"Kỹ năng","score":7,"green_flags_vi":["Tốt"],"red_flags_vi":[],"comment_vi":"OK"}],"german_language":{"grammar_accuracy_pct":"85%","vocabulary_level":"B1","fluency_vi":"Tốt","common_errors_vi":["Verb order"]},"remediation_vi":["Focus on verb order"],"encouragement_vi":"Great job!"}',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 12),
    (user2_id, NULL, 'B1', 'ANNA', 'V1', 'INTERVIEW', 'Frontend Developer', '2-3Y', 'ACTIVE', NULL, NULL,
     '{"seed":1002,"phase":2,"userTurn":3,"challengeCount":0,"weakAnswerStreak":0,"concreteExampleGiven":false,"topicsCovered":["JavaScript"],"askedQuestionIds":[],"lastDirectiveType":"ICE_BREAKER","sessionTopicFocus":"Web"}',
     NULL,
     NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '10 minutes', NULL, 3)
  ON CONFLICT DO NOTHING;

  -- ============= SESSION MESSAGES =============
  -- Add messages for the COMMUNICATION session (user 1, hobbys session)

  INSERT INTO ai_speaking_messages
    (session_id, role, user_text, ai_speech_de, ai_speech_en, created_at)
  SELECT
    id, 'USER', 'Hallo, ich mag Sport und Lesen', 'Das ist toll! Welche Sportarten magst du?', 'That''s great! What sports do you like?', NOW() - INTERVAL '20 minutes'
  FROM ai_speaking_sessions
  WHERE user_id = user1_id AND topic = 'Hobbys' AND status = 'ACTIVE'
  ON CONFLICT DO NOTHING;

  INSERT INTO ai_speaking_messages
    (session_id, role, user_text, ai_speech_de, ai_speech_en, created_at)
  SELECT
    id, 'ASSISTANT', NULL, 'Hallo! Ich bin dein Deutschlehrer. Heute sprechen wir über Hobbys. Was sind deine Lieblingsbeschäftigungen?', 'Hello! I''m your German teacher. Today we''ll talk about hobbies. What are your favorite activities?', NOW() - INTERVAL '25 minutes'
  FROM ai_speaking_sessions
  WHERE user_id = user1_id AND topic = 'Hobbys' AND status = 'ACTIVE'
  ON CONFLICT DO NOTHING;

  -- ============= INTERVIEW SESSION MESSAGES =============
  -- Add messages for INTERVIEW session (user 2, active interview)

  INSERT INTO ai_speaking_messages
    (session_id, role, user_text, ai_speech_de, created_at)
  SELECT
    id, 'USER', 'Ich habe 2 Jahre Erfahrung mit React und TypeScript', 'Ausgezeichnet! Was sind deine Stärken?', NOW() - INTERVAL '15 minutes'
  FROM ai_speaking_sessions
  WHERE user_id = user2_id AND topic IS NULL AND session_mode = 'INTERVIEW' AND status = 'ACTIVE'
  ON CONFLICT DO NOTHING;

  -- ============= GRAMMAR ERRORS =============
  -- Add some example grammar errors for testing error tracking

  INSERT INTO ai_grammar_errors
    (session_id, user_message_id, error_type, error_code, description, correction, frequency, created_at)
  SELECT
    id, 1, 'GRAMMAR', 'VERB_AUX_ORDER', 'Auxiliary verb word order', 'Correct order', 1, NOW()
  FROM ai_speaking_sessions
  WHERE user_id = user1_id AND topic = 'Reise' AND status = 'ENDED'
  ON CONFLICT DO NOTHING;

  -- ============= TEST DATA SUMMARY =============
  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'Users: 5';
  RAISE NOTICE 'Profiles: 4 (1 user intentionally without profile)';
  RAISE NOTICE 'Subscriptions: 5';
  RAISE NOTICE 'Sessions (COMMUNICATION): 3';
  RAISE NOTICE 'Sessions (INTERVIEW): 2';
  RAISE NOTICE 'Messages: 4';
  RAISE NOTICE 'Grammar Errors: 1';

END $$;

COMMIT;

-- ============= VERIFICATION QUERIES =============
-- Run these to verify test data was created correctly

SELECT '=== TEST USERS ===' as info;
SELECT id, email, role, created_at FROM "user" WHERE email LIKE 'test-user%' ORDER BY id;

SELECT '=== LEARNING PROFILES ===' as info;
SELECT up.id, u.email, up.current_level, up.target_level FROM user_learning_profiles up
JOIN "user" u ON u.id = up.user_id
WHERE u.email LIKE 'test-user%' ORDER BY up.user_id;

SELECT '=== SUBSCRIPTIONS ===' as info;
SELECT us.user_id, u.email, us.plan_code, us.daily_token_grant, us.status FROM user_subscriptions us
JOIN "user" u ON u.id = us.user_id
WHERE u.email LIKE 'test-user%' ORDER BY us.user_id;

SELECT '=== TOKEN USAGE ===' as info;
SELECT ate.user_id, u.email, SUM(ate.total_tokens) as total_used_today FROM ai_token_usage_events ate
JOIN "user" u ON u.id = ate.user_id
WHERE u.email LIKE 'test-user-quota%' AND DATE(ate.created_at) = CURRENT_DATE
GROUP BY ate.user_id, u.email;

SELECT '=== COMMUNICATION SESSIONS ===' as info;
SELECT s.id, u.email, s.topic, s.session_mode, s.status, s.message_count, s.started_at FROM ai_speaking_sessions s
JOIN "user" u ON u.id = s.user_id
WHERE u.email LIKE 'test-user%' AND s.session_mode = 'COMMUNICATION'
ORDER BY s.id;

SELECT '=== INTERVIEW SESSIONS ===' as info;
SELECT s.id, u.email, s.interview_position, s.session_mode, s.status, s.message_count, s.interview_state_json IS NOT NULL as has_state FROM ai_speaking_sessions s
JOIN "user" u ON u.id = s.user_id
WHERE u.email LIKE 'test-user%' AND s.session_mode = 'INTERVIEW'
ORDER BY s.id;

SELECT '=== SESSION MESSAGES ===' as info;
SELECT sm.id, sm.session_id, sm.role, LENGTH(sm.user_text) as user_text_length, sm.created_at FROM ai_speaking_messages sm
WHERE sm.session_id IN (
  SELECT s.id FROM ai_speaking_sessions s
  JOIN "user" u ON u.id = s.user_id
  WHERE u.email LIKE 'test-user%'
)
ORDER BY sm.id;

-- ============= CLEANUP SCRIPT =============
-- Use this to clean up test data after testing
-- psql -U postgres -d deutschflow -f cleanup_test_data.sql

/*
To cleanup test data, create cleanup_test_data.sql with:

BEGIN TRANSACTION;

DELETE FROM ai_grammar_errors WHERE session_id IN (
  SELECT s.id FROM ai_speaking_sessions s
  JOIN "user" u ON u.id = s.user_id
  WHERE u.email LIKE 'test-user%'
);

DELETE FROM ai_speaking_messages WHERE session_id IN (
  SELECT s.id FROM ai_speaking_sessions s
  JOIN "user" u ON u.id = s.user_id
  WHERE u.email LIKE 'test-user%'
);

DELETE FROM ai_speaking_sessions WHERE user_id IN (
  SELECT id FROM "user" WHERE email LIKE 'test-user%'
);

DELETE FROM ai_token_usage_events WHERE user_id IN (
  SELECT id FROM "user" WHERE email LIKE 'test-user%'
);

DELETE FROM user_subscriptions WHERE user_id IN (
  SELECT id FROM "user" WHERE email LIKE 'test-user%'
);

DELETE FROM user_learning_profiles WHERE user_id IN (
  SELECT id FROM "user" WHERE email LIKE 'test-user%'
);

DELETE FROM user_roles WHERE user_id IN (
  SELECT id FROM "user" WHERE email LIKE 'test-user%'
);

DELETE FROM "user" WHERE email LIKE 'test-user%';

COMMIT;
*/
