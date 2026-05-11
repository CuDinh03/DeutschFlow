-- V114: Curriculum V3 Redesign
-- Implements Foundation-First Approach & Dynamic A2 Satellites

-- 1. Wipe old curriculum
DELETE FROM skill_tree_node_dependencies;
DELETE FROM skill_tree_nodes;

-- 2. Insert new nodes
INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══════════════ PHASE 1: FOUNDATION ═══════════════

-- ── Node 1: Bảng chữ cái ──
('CORE_TRUNK',
 'Das Alphabet',
 'Bảng chữ cái tiếng Đức',
 'Học bảng chữ cái A-Z và các ký tự đặc trưng của tiếng Đức.',
 '🔤', 'FOUNDATION', 1, 1, 1, 'A1', 1, 100, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Alphabet'],
 '{
   "title": {"de":"Das Alphabet","vi":"Bảng chữ cái tiếng Đức"},
   "overview": {"de":"Das Alphabet hat 26 Buchstaben.","vi":"Bảng chữ cái tiếng Đức cơ bản."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 2: Phát âm & Ghép vần ──
('CORE_TRUNK',
 'Phonetik und Aussprache',
 'Quy tắc phát âm & Ghép vần',
 'Học cách phát âm Umlaut (ä, ö, ü), Eszett (ß) và các nguyên âm kép (ei, ie, eu).',
 '🗣️', 'FOUNDATION', 2, 1, 2, 'A1', 1, 120, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Phonetik'],
 '{
   "title": {"de":"Phonetik und Aussprache","vi":"Phát âm và Ghép vần"},
   "overview": {"de":"Wichtige Laute: ä, ö, ü, ei, ie, eu, sch, ch.","vi":"Các quy tắc phát âm quan trọng nhất."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 3: Số đếm 0 - 1000 ──
('CORE_TRUNK',
 'Zahlen 0 - 1000',
 'Số đếm từ 0 đến 1000',
 'Học đếm số cơ bản, quy tắc đọc ngược (ein-und-zwanzig) và số lớn.',
 '🔢', 'FOUNDATION', 3, 1, 3, 'A1', 2, 150, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Zahlen'],
 '{
   "title": {"de":"Zahlen 0-1000","vi":"Số đếm từ 0 đến 1000"},
   "overview": {"de":"Zahlen auf Deutsch.","vi":"Quy tắc đếm số tiếng Đức."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 4: Giới tính Danh Từ ──
('CORE_TRUNK',
 'Artikel: Der, Die, Das',
 'Giới tính của danh từ',
 'Mạo từ xác định (der/die/das) và không xác định (ein/eine).',
 '🎨', 'FOUNDATION', 4, 1, 4, 'A1', 2, 150, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Artikel'],
 '{
   "title": {"de":"Artikel: Der, Die, Das","vi":"Mạo từ và Giới tính"},
   "overview": {"de":"Nomen haben drei Geschlechter.","vi":"Ba giống danh từ trong tiếng Đức."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 5: Chia Động Từ ──
('CORE_TRUNK',
 'Konjugation der Verben',
 'Chia động từ hiện tại',
 'Cách chia động từ có quy tắc (-e, -st, -t, -en, -t, -en) và động từ sein/haben.',
 '⚡', 'FOUNDATION', 5, 2, 5, 'A1', 3, 160, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Konjugation'],
 '{
   "title": {"de":"Konjugation","vi":"Chia động từ"},
   "overview": {"de":"Verben im Präsens konjugieren.","vi":"Chia động từ thì hiện tại."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 6: Cấu Trúc Câu ──
('CORE_TRUNK',
 'Satzbau (S-V-O)',
 'Cấu trúc câu cơ bản',
 'Quy tắc V2 (động từ đứng vị trí số 2) trong câu trần thuật.',
 '📏', 'FOUNDATION', 6, 2, 6, 'A1', 3, 180, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Satzbau'],
 '{
   "title": {"de":"Satzbau","vi":"Cấu trúc câu"},
   "overview": {"de":"Das Verb steht auf Position 2.","vi":"Động từ luôn đứng vị trí số 2."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 7: Ngữ Pháp (Câu hỏi & Phủ định) ──
('CORE_TRUNK',
 'Fragesätze und Negation',
 'Câu hỏi W-Fragen & Phủ định',
 'Cách đặt câu hỏi với Wer, Was, Wo và phủ định với nicht/kein.',
 '❓', 'FOUNDATION', 7, 2, 7, 'A1', 3, 180, 1,
 0, 'Kiến thức nền tảng', 'Grundlagen', 'LESSON',
 ARRAY['#Grammatik'],
 '{
   "title": {"de":"Fragen und Negation","vi":"Câu hỏi và Phủ định"},
   "overview": {"de":"Wie stellt man Fragen?","vi":"Cách đặt câu hỏi và phủ định."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ═══════════════ PHASE 2: CORE TRUNK (A1) ═══════════════

-- ── Node 8: Chào hỏi ──
('CORE_TRUNK',
 'Begrüßung & Sich vorstellen',
 'Chào hỏi & Giới thiệu bản thân',
 'Cách chào hỏi, nói tên, tuổi, quê quán.',
 '👋', 'CORE_A1', 8, 3, 8, 'A1', 2, 120, 1,
 1, 'Chủ đề A1', 'Themen A1', 'LESSON',
 ARRAY['#Begruessung'],
 '{
   "title": {"de":"Begrüßung","vi":"Chào hỏi"},
   "overview": {"de":"Sich vorstellen.","vi":"Giới thiệu bản thân cơ bản."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 9: Gia đình ──
('CORE_TRUNK',
 'Familie & Freunde',
 'Gia đình và Bạn bè',
 'Từ vựng về các thành viên trong gia đình.',
 '👨‍👩‍👧', 'CORE_A1', 9, 3, 9, 'A1', 2, 130, 1,
 1, 'Chủ đề A1', 'Themen A1', 'LESSON',
 ARRAY['#Familie'],
 '{
   "title": {"de":"Familie","vi":"Gia đình"},
   "overview": {"de":"Meine Familie.","vi":"Gia đình của tôi."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb),

-- ── Node 10: Mua sắm ──
('CORE_TRUNK',
 'Einkaufen & Lebensmittel',
 'Mua sắm & Đồ ăn',
 'Đi siêu thị, gọi món ở nhà hàng.',
 '🛒', 'CORE_A1', 10, 3, 10, 'A1', 3, 150, 1,
 1, 'Chủ đề A1', 'Themen A1', 'LESSON',
 ARRAY['#Einkaufen'],
 '{
   "title": {"de":"Einkaufen","vi":"Mua sắm"},
   "overview": {"de":"Im Supermarkt.","vi":"Mua sắm siêu thị."},
   "session_type": "LESSON",
   "theory_cards": [],
   "vocabulary": [],
   "phrases": [],
   "examples": [],
   "exercises":{"theory_gate":[],"practice":[]}
 }'::jsonb);

-- 3. Set Dependencies (Linear)
DO $$
DECLARE
    prev_id BIGINT;
    curr_id BIGINT;
    d INTEGER;
BEGIN
    FOR d IN 2..10 LOOP
        SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = d - 1 LIMIT 1;
        SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = d     LIMIT 1;
        IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (curr_id, prev_id, 'HARD', 100) -- Strict 100% completion requirement
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
