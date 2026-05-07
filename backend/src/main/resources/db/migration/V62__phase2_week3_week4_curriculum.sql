-- ============================================================
-- V62: Phase 2 — Tuần 3 & Tuần 4 (Ngày 15 - 28)
-- Mô hình "Khung Xương & Đắp Thịt":
--   CORE_TRUNK  = Khung xương ngữ pháp (cố định, bắt buộc)
--   SATELLITE_LEAF = Thịt chuyên ngành (AI sinh theo ngành user)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CORE_TRUNK — Tuần 3: Thể hiện Nhu cầu & Khả năng
--    Trọng tâm: Modalverben (können, müssen, wollen, möchten)
--    Quy tắc: Modalverb = V2, Hauptverb = cuối câu (Infinitiv)
-- ─────────────────────────────────────────────────────────────
INSERT INTO skill_tree_nodes (
    node_type, title_de, title_vi, description_vi, emoji,
    phase, day_number, week_number, sort_order,
    cefr_level, difficulty, xp_reward, energy_cost,
    industry_vocab_percent, vocab_strategy,
    core_topics, grammar_points
) VALUES

-- ═══ TUẦN 3: Nhu cầu & Khả năng — Modalverben ═══

('CORE_TRUNK',
 'müssen & können — Pflicht und Fähigkeit',
 'müssen & können — Bắt buộc và Khả năng',
 'Hai Modalverben quan trọng nhất: müssen (phải) và können (có thể). Chia theo đại từ. Quy tắc: Modalverb ở V2, động từ chính ở cuối câu dạng nguyên thể. Ví dụ: Ich muss den Server starten.',
 '💪', 'MODALVERBEN', 15, 3, 15, 'A1', 5, 180, 1, 25, 'CONTEXT',
 ARRAY['MODALVERBEN_MUESSEN','MODALVERBEN_KOENNEN','SATZKLAMMER'],
 ARRAY['müssen Konjugation','können Konjugation','Satzklammer: Modalverb V2 + Infinitiv am Ende']),

('CORE_TRUNK',
 'wollen & möchten — Wunsch und Höflichkeit',
 'wollen & möchten — Mong muốn và Lịch sự',
 'wollen (muốn - mạnh) vs möchten (muốn - lịch sự). Phân biệt sắc thái: wollen cho ý chí mạnh, möchten cho yêu cầu lịch sự. Chia theo tất cả đại từ.',
 '🙏', 'MODALVERBEN', 16, 3, 16, 'A1', 5, 180, 1, 28, 'CONTEXT',
 ARRAY['MODALVERBEN_WOLLEN','MODALVERBEN_MOECHTEN','HOEFLICHKEIT'],
 ARRAY['wollen Konjugation','möchten Konjugation','wollen vs. möchten Unterschied']),

('CORE_TRUNK',
 'dürfen & sollen — Erlaubnis und Empfehlung',
 'dürfen & sollen — Được phép và Nên',
 'dürfen (được phép) và sollen (nên). Hoàn thiện bộ 6 Modalverben. Bài tập: Đặt câu hỏi xin phép và đưa lời khuyên.',
 '🚦', 'MODALVERBEN', 17, 3, 17, 'A1', 5, 190, 1, 30, 'CONTEXT',
 ARRAY['MODALVERBEN_DUERFEN','MODALVERBEN_SOLLEN','ALLE_MODALVERBEN'],
 ARRAY['dürfen Konjugation','sollen Konjugation','6 Modalverben Übersicht']),

('CORE_TRUNK',
 'Modalverben im Kontext — Alltagssituationen',
 'Modalverben trong ngữ cảnh — Tình huống hàng ngày',
 'Luyện tập 6 Modalverben trong các tình huống thực tế: tại văn phòng, tại trường, tại bệnh viện. Satzklammer: Ich muss heute den Bericht schreiben.',
 '🏢', 'MODALVERBEN', 18, 3, 18, 'A1', 6, 200, 1, 30, 'CONTEXT',
 ARRAY['MODALVERBEN_PRAXIS','SATZKLAMMER','ALLTAGSSITUATIONEN'],
 ARRAY['Satzklammer Vertiefung','Modalverben + Zeitangabe','Modalverben + Objekt']),

('CORE_TRUNK',
 'Negation mit Modalverben — nicht & kein',
 'Phủ định với Modalverben — nicht & kein',
 'Cách phủ định Modalverben. nicht đứng trước Infinitiv cuối câu: Ich kann das nicht machen. kein thay thế unbestimmter Artikel.',
 '🚫', 'MODALVERBEN', 19, 3, 19, 'A1', 6, 200, 1, 30, 'CONTEXT',
 ARRAY['NEGATION_NICHT','NEGATION_KEIN','MODALVERBEN_NEGATION'],
 ARRAY['nicht Position bei Modalverben','kein/keine + Nomen','Ich muss nicht vs. Ich darf nicht']),

('CORE_TRUNK',
 'Fragen mit Modalverben — Ja/Nein & W-Fragen',
 'Câu hỏi với Modalverben — Có/Không & W-Fragen',
 'Câu hỏi Ja/Nein: Modalverb đứng V1 (Können Sie mir helfen?). W-Fragen: W-Wort V1, Modalverb V2. Bài tập hỏi-đáp với AI.',
 '❓', 'MODALVERBEN', 20, 3, 20, 'A1', 6, 200, 1, 30, 'CONTEXT',
 ARRAY['MODALVERBEN_FRAGEN','JA_NEIN_FRAGEN','W_FRAGEN_MODALVERBEN'],
 ARRAY['Ja/Nein-Frage: Modalverb V1','W-Frage + Modalverb','Können Sie...? / Darf ich...?']),

('CORE_TRUNK',
 'Woche-3-Wiederholung & Modalverben-Test',
 'Ôn tập Tuần 3 & Kiểm tra Modalverben',
 'Ôn tập toàn bộ 6 Modalverben, Satzklammer, phủ định, câu hỏi. Mini-Test xác nhận năng lực diễn đạt nhu cầu cơ bản.',
 '🏆', 'MODALVERBEN', 21, 3, 21, 'A1', 6, 300, 1, 30, 'CONTEXT',
 ARRAY['REVIEW_WEEK3','MODALVERBEN_TEST'],
 ARRAY['Gesamtwiederholung Modalverben','Satzklammer Kontrolle','Kompetenzcheck W3']),

-- ═══ TUẦN 4: Sự tác động & Lịch trình hàng ngày ═══
-- Trọng tâm: Akkusativ + Trennbare Verben

('CORE_TRUNK',
 'Akkusativ — Den direkten Fall verstehen',
 'Akkusativ — Hiểu Tân ngữ trực tiếp',
 'Quy tắc Akkusativ: giống đực der→den, ein→einen. Giống cái và trung KHÔNG đổi. Câu hỏi: Wen? Was? Ví dụ: Ich sehe den Mann. Ich kaufe einen Computer.',
 '🎯', 'AKKUSATIV', 22, 4, 22, 'A1', 6, 200, 1, 30, 'CONTEXT',
 ARRAY['AKKUSATIV_GRUNDLAGEN','ARTIKEL_AKKUSATIV','WEN_WAS'],
 ARRAY['der→den, ein→einen','die/das bleiben gleich','Wen? Was? Fragewörter']),

('CORE_TRUNK',
 'Akkusativ mit haben, brauchen, suchen',
 'Akkusativ với haben, brauchen, suchen',
 'Các động từ thông dụng đi với Akkusativ: haben (có), brauchen (cần), suchen (tìm), finden (tìm thấy), kaufen (mua). Bài tập: diễn đạt nhu cầu hàng ngày.',
 '🛒', 'AKKUSATIV', 23, 4, 23, 'A1', 6, 200, 1, 32, 'CONTEXT',
 ARRAY['AKKUSATIV_VERBEN','HABEN_BRAUCHEN','EINKAUFEN'],
 ARRAY['haben + Akk.','brauchen + Akk.','suchen/finden/kaufen + Akk.']),

('CORE_TRUNK',
 'Akkusativ + Modalverben — Kombination',
 'Akkusativ + Modalverben — Kết hợp',
 'Kết hợp Tuần 3 + Tuần 4: Ich muss den Server starten. Ich kann einen Bericht schreiben. Modalverb V2 + Akk.-Objekt + Infinitiv cuối.',
 '⚡', 'AKKUSATIV', 24, 4, 24, 'A1', 7, 220, 1, 33, 'CONTEXT',
 ARRAY['AKKUSATIV_MODALVERBEN','SATZKLAMMER_ERWEITERT'],
 ARRAY['Modalverb + Akk. + Infinitiv','Ich muss den/einen... V-Inf','Satzklammer mit Objekt']),

('CORE_TRUNK',
 'Trennbare Verben — Grundlagen',
 'Động từ tách — Khái niệm cơ bản',
 'Đặc sản tiếng Đức: aufstehen (thức dậy), anrufen (gọi điện), einkaufen (đi mua sắm), anfangen (bắt đầu). Tiền tố tách ra cuối câu: Ich stehe um 7 Uhr auf.',
 '✂️', 'TRENNBARE_VERBEN', 25, 4, 25, 'A1', 7, 220, 1, 35, 'CONTEXT',
 ARRAY['TRENNBARE_VERBEN','PRAEFIX_TRENNUNG','TAGESABLAUF'],
 ARRAY['Präfix geht ans Satzende','auf|stehen, an|rufen, ein|kaufen','Tagesablauf beschreiben']),

('CORE_TRUNK',
 'Trennbare Verben — Tagesablauf beschreiben',
 'Động từ tách — Mô tả lịch trình hàng ngày',
 'Luyện mô tả một ngày: aufstehen, frühstücken, losfahren, ankommen, anfangen, aufhören, zurückkommen. Kết hợp với Zeitangaben (um 7 Uhr, am Morgen).',
 '📅', 'TRENNBARE_VERBEN', 26, 4, 26, 'A1', 7, 220, 1, 35, 'CONTEXT',
 ARRAY['TAGESABLAUF','ZEITANGABEN','TRENNBARE_VERBEN_PRAXIS'],
 ARRAY['um + Uhrzeit','am Morgen/Abend','Trennbare Verben im Tagesablauf']),

('CORE_TRUNK',
 'Trennbare Verben + Modalverben — KEIN Trennung!',
 'Động từ tách + Modalverben — KHÔNG tách!',
 'Quy tắc vàng: Khi có Modalverb, động từ tách KHÔNG bị tách. Nó về cuối câu dạng nguyên thể liền nhau: Ich muss um 6 Uhr aufstehen (KHÔNG phải: Ich muss um 6 Uhr auf stehen).',
 '🔗', 'TRENNBARE_VERBEN', 27, 4, 27, 'A1', 7, 230, 1, 35, 'CONTEXT',
 ARRAY['TRENNBARE_VERBEN_MODAL','KEIN_TRENNUNG_MODAL','SATZKLAMMER_KOMPLEX'],
 ARRAY['Modalverb + trennbares Verb = Infinitiv','Ich muss aufstehen (nicht: auf stehen)','Komplexe Satzklammer']),

('CORE_TRUNK',
 'Woche-4-Wiederholung & Checkpoint Phase 2',
 'Ôn tập Tuần 4 & Checkpoint Giai đoạn 2',
 'Ôn tập toàn diện: Akkusativ, Trennbare Verben, kết hợp với Modalverben. Bài kiểm tra Checkpoint kết thúc Phase 2 — xác nhận A1.2.',
 '🎯', 'TRENNBARE_VERBEN', 28, 4, 28, 'A1', 8, 400, 1, 35, 'CONTEXT',
 ARRAY['REVIEW_WEEK4','CHECKPOINT_PHASE2','AKKUSATIV_TRENNBAR_MODAL'],
 ARRAY['Gesamtwiederholung Phase 2','Akkusativ + Modal + Trennbar','Kompetenzcheck A1.2']);


-- ─────────────────────────────────────────────────────────────
-- 2. SATELLITE_LEAF — Nhánh phụ cá nhân hóa theo ngành
--    Mỗi CORE_TRUNK quan trọng có 3 SATELLITE_LEAF template:
--    IT, Medizin, Bildung (content_json = NULL → AI sẽ sinh)
-- ─────────────────────────────────────────────────────────────

-- ── Satellite cho Ngày 15 (müssen & können) ──
INSERT INTO skill_tree_nodes (
    node_type, title_de, title_vi, description_vi, emoji,
    phase, day_number, week_number, sort_order,
    cefr_level, difficulty, xp_reward, energy_cost,
    industry, industry_vocab_percent, vocab_strategy,
    core_topics, grammar_points
) VALUES
('SATELLITE_LEAF',
 'müssen & können im IT-Alltag',
 'müssen & können trong IT hàng ngày',
 'Luyện Modalverben trong ngữ cảnh IT: Ich muss den Server neu starten. Das System kann die Daten verarbeiten.',
 '💻', 'MODALVERBEN', 15, 3, 1501, 'A1', 5, 150, 0,
 'IT', 40, 'CONTEXT',
 ARRAY['MODALVERBEN_IT','SERVER','DATEN'],
 ARRAY['müssen + IT-Verben','können + Systemverben']),

('SATELLITE_LEAF',
 'müssen & können in der Medizin',
 'müssen & können trong Y tế',
 'Luyện Modalverben trong ngữ cảnh Y tế: Der Patient muss das Medikament nehmen. Die Ärztin kann die Diagnose stellen.',
 '🏥', 'MODALVERBEN', 15, 3, 1502, 'A1', 5, 150, 0,
 'Medizin', 40, 'CONTEXT',
 ARRAY['MODALVERBEN_MEDIZIN','PATIENT','MEDIKAMENT'],
 ARRAY['müssen + Medizinverben','können + Diagnose']),

('SATELLITE_LEAF',
 'müssen & können in der Bildung',
 'müssen & können trong Giáo dục',
 'Luyện Modalverben trong ngữ cảnh Giáo dục: Ich muss den Unterricht vorbereiten. Der Schüler kann die Aufgabe lösen.',
 '📚', 'MODALVERBEN', 15, 3, 1503, 'A1', 5, 150, 0,
 'Bildung', 40, 'CONTEXT',
 ARRAY['MODALVERBEN_BILDUNG','UNTERRICHT','AUFGABE'],
 ARRAY['müssen + Lehrverben','können + Lernverben']),

-- ── Satellite cho Ngày 18 (Modalverben im Kontext) ──
('SATELLITE_LEAF',
 'Modalverben im IT-Büro',
 'Modalverben tại văn phòng IT',
 'Ngữ cảnh: Sprint planning, code review, deployment. Ich muss den Bug fixen. Wir können das Feature testen. Der Chef will den Release planen.',
 '🖥️', 'MODALVERBEN', 18, 3, 1801, 'A1', 6, 160, 0,
 'IT', 45, 'CONTEXT',
 ARRAY['MODALVERBEN_IT_PRAXIS','BUG','RELEASE','DEPLOYMENT'],
 ARRAY['Alle Modalverben + IT-Verben','Satzklammer im IT-Kontext']),

('SATELLITE_LEAF',
 'Modalverben im Krankenhaus',
 'Modalverben tại bệnh viện',
 'Ngữ cảnh: Khám bệnh, kê đơn, chăm sóc. Der Patient muss die Tabletten nehmen. Die Krankenschwester soll den Blutdruck messen.',
 '🩺', 'MODALVERBEN', 18, 3, 1802, 'A1', 6, 160, 0,
 'Medizin', 45, 'CONTEXT',
 ARRAY['MODALVERBEN_KRANKENHAUS','TABLETTEN','BLUTDRUCK'],
 ARRAY['Alle Modalverben + Medizinverben','Satzklammer im Krankenhaus']),

('SATELLITE_LEAF',
 'Modalverben in der Schule',
 'Modalverben tại trường học',
 'Ngữ cảnh: Giảng dạy, chuẩn bị bài, kiểm tra. Ich muss die Prüfung korrigieren. Die Schüler wollen den Code testen.',
 '🏫', 'MODALVERBEN', 18, 3, 1803, 'A1', 6, 160, 0,
 'Bildung', 45, 'CONTEXT',
 ARRAY['MODALVERBEN_SCHULE','PRUEFUNG','CODE_TESTEN'],
 ARRAY['Alle Modalverben + Lehrverben','Satzklammer in der Schule']),

-- ── Satellite cho Ngày 22 (Akkusativ) ──
('SATELLITE_LEAF',
 'Akkusativ im IT-Bereich',
 'Akkusativ trong lĩnh vực IT',
 'Luyện Akkusativ với từ vựng IT: Ich brauche einen Monitor. Ich suche den Bug. Ich starte den Server.',
 '🔍', 'AKKUSATIV', 22, 4, 2201, 'A1', 6, 170, 0,
 'IT', 40, 'CONTEXT',
 ARRAY['AKKUSATIV_IT','MONITOR','BUG','SERVER'],
 ARRAY['den Server/Monitor/Bug','einen Computer/Account']),

('SATELLITE_LEAF',
 'Akkusativ in der Medizin',
 'Akkusativ trong Y tế',
 'Luyện Akkusativ với từ vựng Y tế: Ich brauche den Befund. Der Arzt untersucht den Patienten. Die Schwester holt einen Verband.',
 '💊', 'AKKUSATIV', 22, 4, 2202, 'A1', 6, 170, 0,
 'Medizin', 40, 'CONTEXT',
 ARRAY['AKKUSATIV_MEDIZIN','BEFUND','PATIENT','VERBAND'],
 ARRAY['den Patienten/Befund','einen Verband/Termin']),

('SATELLITE_LEAF',
 'Akkusativ in der Bildung',
 'Akkusativ trong Giáo dục',
 'Luyện Akkusativ với từ vựng Giáo dục: Ich korrigiere den Test. Der Lehrer erklärt den Stoff. Ich brauche einen Beamer.',
 '📝', 'AKKUSATIV', 22, 4, 2203, 'A1', 6, 170, 0,
 'Bildung', 40, 'CONTEXT',
 ARRAY['AKKUSATIV_BILDUNG','TEST','STOFF','BEAMER'],
 ARRAY['den Test/Stoff/Unterricht','einen Beamer/Stift']),

-- ── Satellite cho Ngày 25 (Trennbare Verben) ──
('SATELLITE_LEAF',
 'Trennbare Verben im IT-Job',
 'Động từ tách trong công việc IT',
 'Ngữ cảnh IT hàng ngày: Ich rufe den Kunden an. Ich lade die Daten herunter. Ich fahre den Server herunter. Ich frage die Datenbank ab.',
 '⚙️', 'TRENNBARE_VERBEN', 25, 4, 2501, 'A1', 7, 180, 0,
 'IT', 45, 'CONTEXT',
 ARRAY['TRENNBARE_VERBEN_IT','ANRUFEN','HERUNTERLADEN','ABFRAGEN'],
 ARRAY['an|rufen den Kunden','herunter|laden die Daten','ab|fragen die Datenbank']),

('SATELLITE_LEAF',
 'Trennbare Verben im Krankenhaus',
 'Động từ tách tại bệnh viện',
 'Ngữ cảnh Y tế hàng ngày: Die Schwester nimmt den Verband ab. Der Arzt schreibt das Rezept auf. Der Patient steht früh auf.',
 '🏥', 'TRENNBARE_VERBEN', 25, 4, 2502, 'A1', 7, 180, 0,
 'Medizin', 45, 'CONTEXT',
 ARRAY['TRENNBARE_VERBEN_MEDIZIN','ABNEHMEN','AUFSCHREIBEN','AUFSTEHEN'],
 ARRAY['ab|nehmen den Verband','auf|schreiben das Rezept','auf|stehen der Patient']),

('SATELLITE_LEAF',
 'Trennbare Verben — Tagesablauf & Routine',
 'Động từ tách — Lịch trình & Thói quen hàng ngày',
 'Mô tả một ngày: Ich stehe um 7 Uhr auf. Ich mache den Computer an. Ich fange um 9 Uhr an. Ich höre um 17 Uhr auf.',
 '🌅', 'TRENNBARE_VERBEN', 25, 4, 2503, 'A1', 7, 180, 0,
 'Allgemein', 20, 'CONTEXT',
 ARRAY['TAGESABLAUF','AUFSTEHEN','ANFANGEN','AUFHOEREN'],
 ARRAY['auf|stehen um 7 Uhr','an|fangen um 9 Uhr','auf|hören um 17 Uhr']);


-- ─────────────────────────────────────────────────────────────
-- 3. DAG DEPENDENCIES — Tuần 3 & Tuần 4
-- ─────────────────────────────────────────────────────────────

-- ── 3a. CORE_TRUNK tuyến tính: Ngày 14 → 15 → 16 → ... → 28 ──
DO $$
DECLARE
    prev_id BIGINT;
    curr_id BIGINT;
    d INTEGER;
BEGIN
    FOR d IN 15..28 LOOP
        SELECT id INTO prev_id FROM skill_tree_nodes
            WHERE day_number = d - 1 AND node_type = 'CORE_TRUNK' LIMIT 1;
        SELECT id INTO curr_id FROM skill_tree_nodes
            WHERE day_number = d AND node_type = 'CORE_TRUNK' LIMIT 1;
        IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies
                (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (curr_id, prev_id, 'HARD', 60)
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- ── 3b. SATELLITE_LEAF phụ thuộc CORE_TRUNK cùng day_number (SOFT, 50%) ──
-- User chỉ cần đạt 50% trên CORE_TRUNK để mở khóa SATELLITE_LEAF tương ứng
DO $$
DECLARE
    trunk_id BIGINT;
    leaf_rec RECORD;
BEGIN
    FOR leaf_rec IN
        SELECT id, day_number FROM skill_tree_nodes
        WHERE node_type = 'SATELLITE_LEAF' AND day_number >= 15
    LOOP
        SELECT id INTO trunk_id FROM skill_tree_nodes
            WHERE day_number = leaf_rec.day_number
              AND node_type = 'CORE_TRUNK'
            LIMIT 1;
        IF trunk_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies
                (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (leaf_rec.id, trunk_id, 'SOFT', 50)
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
