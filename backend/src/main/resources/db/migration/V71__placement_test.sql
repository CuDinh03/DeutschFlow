-- ============================================================
-- V71: Placement Test system + onboarding enhancements
-- Bài test 10 câu (4 kỹ năng: Nghe, Nói, Đọc, Viết)
-- ============================================================

-- ── 1. Bảng câu hỏi Placement ──
CREATE TABLE IF NOT EXISTS placement_questions (
    id              BIGSERIAL PRIMARY KEY,
    cefr_level      VARCHAR(5)  NOT NULL,                -- A1, A2, B1, B2
    skill_section   VARCHAR(20) NOT NULL,                -- HOEREN, SPRECHEN, LESEN, SCHREIBEN
    module_number   INTEGER     NOT NULL,
    question_type   VARCHAR(20) NOT NULL,                -- MULTIPLE_CHOICE, FILL_BLANK, REORDER, SPEAKING, FREE_WRITE
    question_de     TEXT        NOT NULL,
    question_vi     TEXT,
    audio_transcript TEXT,                                -- Cho Hören: transcript audio
    options_json    JSONB,                                -- MCQ options
    correct_answer  TEXT        NOT NULL,
    alternative_answers TEXT[],                           -- câu trả lời hợp lệ khác
    grading_keywords TEXT[],                              -- keywords cho Sprechen
    weak_nodes      TEXT[] DEFAULT '{}',                  -- node IDs yếu nếu sai
    difficulty      INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    tags            TEXT[] DEFAULT '{}',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pq_level_skill ON placement_questions (cefr_level, skill_section, is_active);

-- ── 2. Bảng session test ──
CREATE TABLE IF NOT EXISTS placement_test_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    claimed_level   VARCHAR(5)  NOT NULL,
    question_ids    BIGINT[]    NOT NULL,
    answers_json    JSONB,
    score_percent   INTEGER,
    passed          BOOLEAN,
    weak_modules    INTEGER[],
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    submitted_at    TIMESTAMPTZ,
    next_retry_at   TIMESTAMPTZ,                         -- NULL nếu pass, started_at + 3 days nếu fail
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pts_user ON placement_test_sessions (user_id, claimed_level);

-- ── 3. Mở rộng user_learning_profiles ──
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS weekly_target INTEGER DEFAULT 5;
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS placement_result_json JSONB;

-- ============================================================
-- SEED: 10 câu hỏi Placement A1 (4 kỹ năng Goethe-chuẩn)
-- ============================================================

-- ──────────── PHẦN 1: HÖREN (Nghe) ────────────

-- Câu 1: MCQ - Nghe thông báo ga tàu
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer,
    weak_nodes, difficulty, tags)
VALUES ('A1', 'HOEREN', 7, 'MULTIPLE_CHOICE',
    'Wann fährt der Zug ab?',
    'Tàu khởi hành lúc mấy giờ?',
    'Achtung am Gleis 3. Der Zug nach München fährt heute 10 Minuten später ab. Die neue Abfahrtszeit ist 14:30 Uhr.',
    '["14:20","14:30","14:40"]'::jsonb,
    '14:30',
    ARRAY['Uhrzeit_und_Alltag','Hoerverstehen_Zahlen'],
    3, ARRAY['#Uhrzeit','#Hörverstehen','#Zahlen']);

-- Câu 2: MCQ - Nghe hội thoại
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, audio_transcript, options_json, correct_answer,
    weak_nodes, difficulty, tags)
VALUES ('A1', 'HOEREN', 8, 'MULTIPLE_CHOICE',
    'Warum kann Thomas heute nicht ins Kino gehen?',
    'Tại sao hôm nay Thomas không thể đi xem phim?',
    'Hallo Maria, ich bin''s, Thomas. Ich habe heute Abend leider keine Zeit für das Kino. Ich muss arbeiten. Wollen wir am Samstag gehen?',
    '["Er ist krank.","Er muss arbeiten.","Er hat keine Lust."]'::jsonb,
    'Er muss arbeiten.',
    ARRAY['Modalverben','Alltagsgespraeche'],
    3, ARRAY['#Modalverben','#Hörverstehen','#Alltag']);

-- ──────────── PHẦN 2: SPRECHEN (Nói) ────────────

-- Câu 3: Speaking - Gọi món
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES ('A1', 'SPRECHEN', 5, 'SPEAKING',
    'Sie sind in einem Café. Bestellen Sie einen Kaffee und ein Stück Kuchen.',
    'Bạn đang ở một quán cà phê. Hãy ghi âm một câu gọi một cốc cà phê và một miếng bánh ngọt.',
    NULL,
    'Ich möchte einen Kaffee und ein Stück Kuchen, bitte.',
    ARRAY['Einen Kaffee und einen Kuchen, bitte.','Ich hätte gern einen Kaffee und ein Stück Kuchen.'],
    ARRAY['möchte','hätte gern','einen Kaffee','Kuchen'],
    ARRAY['Im_Cafe_bestellen','Akkusativ_Endungen'],
    3, ARRAY['#Bestellen','#Akkusativ','#Sprechen']);

-- Câu 4: Speaking - W-Fragen + Perfekt
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    alternative_answers, grading_keywords, weak_nodes, difficulty, tags)
VALUES ('A1', 'SPRECHEN', 9, 'SPEAKING',
    'Was hast du gestern am Wochenende gemacht? (Benutzen Sie das Perfekt)',
    'Trả lời câu hỏi: "Cuối tuần qua bạn đã làm gì?" (Hãy dùng thì quá khứ Perfekt).',
    NULL,
    'Ich habe Fußball gespielt.',
    ARRAY['Ich bin ins Kino gegangen.','Ich habe ein Buch gelesen.','Ich bin spazieren gegangen.'],
    ARRAY['habe','bin','gespielt','gegangen','gelesen','gemacht','gesehen'],
    ARRAY['Perfekt_Vergangenheit'],
    4, ARRAY['#Perfekt','#Sprechen','#WFragen']);

-- ──────────── PHẦN 3: LESEN (Đọc) ────────────

-- Câu 5: Fill-blank - Wechselpräpositionen + Dativ
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    weak_nodes, difficulty, tags)
VALUES ('A1', 'LESEN', 6, 'MULTIPLE_CHOICE',
    'Das Buch liegt auf ___ Tisch (m).',
    'Quyển sách nằm trên ___ bàn.',
    '["der","den","dem","das"]'::jsonb,
    'dem',
    ARRAY['Dativ_Praepositionen','Lokale_Praepositionen'],
    4, ARRAY['#Dativ','#Präpositionen','#Wechselpräpositionen']);

-- Câu 6: Đọc hiểu thư tín
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    weak_nodes, difficulty, tags)
VALUES ('A1', 'LESEN', 8, 'MULTIPLE_CHOICE',
    E'Lesen Sie den Brief:\n"Liebe Anna, danke für die Einladung zu deiner Party! Ich komme sehr gerne. Soll ich einen Salat oder Getränke mitbringen? Liebe Grüße, Lukas."\n\nWas möchte Lukas wissen?',
    'Lukas muốn biết điều gì?',
    '["Ob Anna eine Party macht.","Was er zur Party mitbringen soll.","Wann die Party beginnt."]'::jsonb,
    'Was er zur Party mitbringen soll.',
    ARRAY['Leseverstehen_Briefe'],
    3, ARRAY['#Leseverstehen','#Briefe','#Einladung']);

-- Câu 7: Possessivartikel
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    weak_nodes, difficulty, tags)
VALUES ('A1', 'LESEN', 3, 'MULTIPLE_CHOICE',
    'Das ist meine Freundin. ___ Name ist Laura.',
    'Đây là bạn gái tôi. ___ cô ấy là Laura.',
    '["Sein","Ihr","Mein","Dein"]'::jsonb,
    'Ihr',
    ARRAY['Possessivartikel'],
    3, ARRAY['#Possessivartikel','#Genus','#Artikel']);

-- ──────────── PHẦN 4: SCHREIBEN (Viết) ────────────

-- Câu 8: Sắp xếp câu - Satzbau
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, options_json, correct_answer,
    alternative_answers, weak_nodes, difficulty, tags)
VALUES ('A1', 'SCHREIBEN', 7, 'REORDER',
    'Ordnen Sie die Wörter: am Wochenende / ich / spiele / mit Freunden / Fußball',
    'Sắp xếp các từ thành câu hoàn chỉnh.',
    '["am Wochenende","ich","spiele","mit Freunden","Fußball"]'::jsonb,
    'Ich spiele am Wochenende mit Freunden Fußball.',
    ARRAY['Am Wochenende spiele ich mit Freunden Fußball.'],
    ARRAY['Satzbau_Hauptsatz','Position_2_Verb'],
    3, ARRAY['#Satzbau','#V2Regel','#Schreiben']);

-- Câu 9: Fill-blank - Trennbare Verben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer,
    alternative_answers, weak_nodes, difficulty, tags)
VALUES ('A1', 'SCHREIBEN', 9, 'FILL_BLANK',
    'Der Zug ___ um 8 Uhr ___. (abfahren)',
    'Tàu ___ lúc 8 giờ ___. (abfahren)',
    'fährt ... ab',
    ARRAY['fährt ab','fährt um 8 Uhr ab'],
    ARRAY['Trennbare_Verben'],
    4, ARRAY['#TrennbareVerben','#Schreiben']);

-- Câu 10: Viết lại câu - Modalverben
INSERT INTO placement_questions (cefr_level, skill_section, module_number, question_type,
    question_de, question_vi, correct_answer,
    alternative_answers, weak_nodes, difficulty, tags)
VALUES ('A1', 'SCHREIBEN', 10, 'FREE_WRITE',
    'Schreiben Sie den Satz mit "müssen" um: "Es ist Pflicht, hier Deutsch zu sprechen."',
    'Viết lại câu sau dùng động từ "müssen": "Ở đây bắt buộc phải nói tiếng Đức."',
    'Man muss hier Deutsch sprechen.',
    ARRAY['Hier muss man Deutsch sprechen.','Wir müssen hier Deutsch sprechen.'],
    ARRAY['Modalverben_Satzbau'],
    4, ARRAY['#Modalverben','#Satzbau','#Schreiben']);
