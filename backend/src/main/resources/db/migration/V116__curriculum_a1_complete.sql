-- V116: Complete A1 Curriculum — Goethe Start Deutsch 1
-- Adds 20 new nodes (11-30) organized into Weeks 3-7
-- Total A1 curriculum: 30 nodes across 7 weeks

-- ═══════════════ WEEK 3: Alltag (Cuộc sống hàng ngày) ═══════════════

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- Node 11: Wohnen
('CORE_TRUNK',
 'Wohnen & Wohnung',
 'Nhà ở & Căn hộ',
 'Từ vựng về các loại nhà, phòng, và mô tả nơi ở.',
 '🏠', 'CORE_A1', 11, 3, 11, 'A1', 2, 130, 1,
 2, 'Cuộc sống hàng ngày', 'Alltag', 'LESSON',
 ARRAY['#Wohnen','#Wohnung'],
 '{"title":{"de":"Wohnen & Wohnung","vi":"Nhà ở & Căn hộ"},"overview":{"de":"Wo wohnst du? Beschreibe deine Wohnung.","vi":"Mô tả nơi ở, các phòng trong nhà."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 12: Möbel & Einrichtung
('CORE_TRUNK',
 'Möbel & Einrichtung',
 'Nội thất & Trang trí',
 'Tên các đồ nội thất, giới từ chỉ vị trí (auf, unter, neben).',
 '🛋️', 'CORE_A1', 12, 3, 12, 'A1', 2, 130, 1,
 2, 'Cuộc sống hàng ngày', 'Alltag', 'LESSON',
 ARRAY['#Moebel','#Wohnen'],
 '{"title":{"de":"Möbel & Einrichtung","vi":"Nội thất"},"overview":{"de":"Der Tisch steht in der Küche.","vi":"Tên đồ nội thất và giới từ chỉ vị trí."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 13: Tagesablauf & Uhrzeit
('CORE_TRUNK',
 'Tagesablauf & Uhrzeit',
 'Thời gian & Lịch trình ngày',
 'Đọc giờ, mô tả hoạt động hàng ngày theo thứ tự thời gian.',
 '⏰', 'CORE_A1', 13, 3, 13, 'A1', 2, 140, 1,
 2, 'Cuộc sống hàng ngày', 'Alltag', 'LESSON',
 ARRAY['#Uhrzeit','#Tagesablauf'],
 '{"title":{"de":"Tagesablauf & Uhrzeit","vi":"Thời gian & Lịch trình ngày"},"overview":{"de":"Wie spät ist es? Was machst du um 8 Uhr?","vi":"Cách đọc giờ và mô tả hoạt động hàng ngày."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 14: Termine & Verabredungen
('CORE_TRUNK',
 'Termine & Verabredungen',
 'Lịch hẹn & Cuộc hẹn',
 'Cách đặt lịch hẹn, từ chối, đề nghị thời gian khác.',
 '📅', 'CORE_A1', 14, 3, 14, 'A1', 3, 150, 1,
 2, 'Cuộc sống hàng ngày', 'Alltag', 'LESSON',
 ARRAY['#Termine','#Verabredung'],
 '{"title":{"de":"Termine & Verabredungen","vi":"Lịch hẹn"},"overview":{"de":"Hast du am Montag Zeit?","vi":"Đặt lịch hẹn, từ chối, đề nghị."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 4: Beruf & Freizeit ═══════════════

-- Node 15: Berufe & Arbeit
('CORE_TRUNK',
 'Berufe & Arbeit',
 'Nghề nghiệp & Công việc',
 'Tên nghề nghiệp, nơi làm việc, mô tả công việc đơn giản.',
 '💼', 'CORE_A1', 15, 4, 15, 'A1', 2, 140, 1,
 3, 'Nghề nghiệp & Giải trí', 'Beruf & Freizeit', 'LESSON',
 ARRAY['#Berufe','#Arbeit'],
 '{"title":{"de":"Berufe & Arbeit","vi":"Nghề nghiệp"},"overview":{"de":"Was bist du von Beruf?","vi":"Các nghề nghiệp phổ biến và nơi làm việc."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 16: Freizeit & Hobbys
('CORE_TRUNK',
 'Freizeit & Hobbys',
 'Thời gian rảnh & Sở thích',
 'Nói về sở thích, hoạt động giải trí, thể thao.',
 '⚽', 'CORE_A1', 16, 4, 16, 'A1', 2, 130, 1,
 3, 'Nghề nghiệp & Giải trí', 'Beruf & Freizeit', 'LESSON',
 ARRAY['#Freizeit','#Hobbys'],
 '{"title":{"de":"Freizeit & Hobbys","vi":"Sở thích"},"overview":{"de":"Was machst du gern in der Freizeit?","vi":"Nói về sở thích và hoạt động giải trí."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 17: Essen & Trinken (Restaurant)
('CORE_TRUNK',
 'Im Restaurant bestellen',
 'Gọi món ở nhà hàng',
 'Đọc menu, gọi món, thanh toán tại nhà hàng.',
 '🍽️', 'CORE_A1', 17, 4, 17, 'A1', 3, 150, 1,
 3, 'Nghề nghiệp & Giải trí', 'Beruf & Freizeit', 'LESSON',
 ARRAY['#Restaurant','#Essen'],
 '{"title":{"de":"Im Restaurant bestellen","vi":"Gọi món nhà hàng"},"overview":{"de":"Ich möchte bestellen. Die Rechnung, bitte.","vi":"Gọi món, hỏi giá, thanh toán."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 18: Kleidung & Farben
('CORE_TRUNK',
 'Kleidung & Farben',
 'Quần áo & Màu sắc',
 'Tên các loại quần áo, màu sắc, mua sắm quần áo.',
 '👕', 'CORE_A1', 18, 4, 18, 'A1', 2, 130, 1,
 3, 'Nghề nghiệp & Giải trí', 'Beruf & Freizeit', 'LESSON',
 ARRAY['#Kleidung','#Farben'],
 '{"title":{"de":"Kleidung & Farben","vi":"Quần áo & Màu sắc"},"overview":{"de":"Die Jacke ist blau. Was kostet das T-Shirt?","vi":"Tên quần áo, màu sắc, mua sắm."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 5: Gesundheit & Mobilität ═══════════════

-- Node 19: Körper & Gesundheit
('CORE_TRUNK',
 'Körper & Gesundheit',
 'Cơ thể & Sức khỏe',
 'Các bộ phận cơ thể, triệu chứng bệnh, đi khám bác sĩ.',
 '🏥', 'CORE_A1', 19, 5, 19, 'A1', 3, 150, 1,
 4, 'Sức khỏe & Di chuyển', 'Gesundheit & Mobilität', 'LESSON',
 ARRAY['#Koerper','#Gesundheit'],
 '{"title":{"de":"Körper & Gesundheit","vi":"Sức khỏe"},"overview":{"de":"Mir tut der Kopf weh. Ich brauche einen Termin.","vi":"Bộ phận cơ thể, triệu chứng, khám bệnh."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 20: Wetter & Jahreszeiten
('CORE_TRUNK',
 'Wetter & Jahreszeiten',
 'Thời tiết & Mùa',
 'Mô tả thời tiết, các mùa trong năm, tháng.',
 '🌤️', 'CORE_A1', 20, 5, 20, 'A1', 2, 120, 1,
 4, 'Sức khỏe & Di chuyển', 'Gesundheit & Mobilität', 'LESSON',
 ARRAY['#Wetter','#Jahreszeiten'],
 '{"title":{"de":"Wetter & Jahreszeiten","vi":"Thời tiết & Mùa"},"overview":{"de":"Wie ist das Wetter heute? Es regnet.","vi":"Mô tả thời tiết, các mùa, tháng."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 21: Verkehr & Wegbeschreibung
('CORE_TRUNK',
 'Verkehr & Wegbeschreibung',
 'Giao thông & Chỉ đường',
 'Phương tiện giao thông, hỏi/chỉ đường, mua vé.',
 '🚌', 'CORE_A1', 21, 5, 21, 'A1', 3, 150, 1,
 4, 'Sức khỏe & Di chuyển', 'Gesundheit & Mobilität', 'LESSON',
 ARRAY['#Verkehr','#Weg'],
 '{"title":{"de":"Verkehr & Wegbeschreibung","vi":"Giao thông & Chỉ đường"},"overview":{"de":"Wie komme ich zum Bahnhof? Nehmen Sie die U-Bahn.","vi":"Hỏi đường, phương tiện giao thông, mua vé."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 22: Reisen & Urlaub
('CORE_TRUNK',
 'Reisen & Urlaub',
 'Du lịch & Kỳ nghỉ',
 'Đặt phòng khách sạn, hỏi thông tin du lịch, kể về kỳ nghỉ.',
 '✈️', 'CORE_A1', 22, 5, 22, 'A1', 3, 160, 1,
 4, 'Sức khỏe & Di chuyển', 'Gesundheit & Mobilität', 'LESSON',
 ARRAY['#Reisen','#Urlaub'],
 '{"title":{"de":"Reisen & Urlaub","vi":"Du lịch & Kỳ nghỉ"},"overview":{"de":"Ich möchte ein Zimmer reservieren.","vi":"Đặt phòng, hỏi thông tin du lịch."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 6: Ngữ pháp nâng cao A1 ═══════════════

-- Node 23: Modalverben
('CORE_TRUNK',
 'Modalverben (können, müssen, wollen)',
 'Động từ khiếm khuyết',
 'Chia và sử dụng können, müssen, wollen, dürfen, sollen, möchten.',
 '🔧', 'A1_GRAMMAR', 23, 6, 23, 'A1', 4, 180, 1,
 5, 'Ngữ pháp nâng cao A1', 'Grammatik A1+', 'LESSON',
 ARRAY['#Modalverben','#Grammatik'],
 '{"title":{"de":"Modalverben","vi":"Động từ khiếm khuyết"},"overview":{"de":"Ich kann schwimmen. Du musst lernen.","vi":"Chia và sử dụng 6 động từ khiếm khuyết."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 24: Trennbare Verben
('CORE_TRUNK',
 'Trennbare Verben',
 'Động từ tách',
 'Quy tắc tách/ghép: aufstehen, einkaufen, anrufen, mitnehmen.',
 '✂️', 'A1_GRAMMAR', 24, 6, 24, 'A1', 4, 170, 1,
 5, 'Ngữ pháp nâng cao A1', 'Grammatik A1+', 'LESSON',
 ARRAY['#TrennbareVerben','#Grammatik'],
 '{"title":{"de":"Trennbare Verben","vi":"Động từ tách"},"overview":{"de":"Ich stehe um 7 Uhr auf.","vi":"Quy tắc tách và ghép động từ."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 25: Perfekt
('CORE_TRUNK',
 'Perfekt (haben + sein)',
 'Thì hoàn thành',
 'Cấu trúc Perfekt với haben/sein, Partizip II có quy tắc và bất quy tắc.',
 '⏪', 'A1_GRAMMAR', 25, 6, 25, 'A1', 4, 200, 1,
 5, 'Ngữ pháp nâng cao A1', 'Grammatik A1+', 'LESSON',
 ARRAY['#Perfekt','#Grammatik'],
 '{"title":{"de":"Perfekt","vi":"Thì hoàn thành"},"overview":{"de":"Ich habe gegessen. Sie ist gefahren.","vi":"Cấu trúc Perfekt, Partizip II, haben vs sein."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 26: Präpositionen
('CORE_TRUNK',
 'Präpositionen (Ort & Zeit)',
 'Giới từ chỉ nơi chốn & Thời gian',
 'in, auf, an, neben, vor, nach, um, am, im — với Dativ/Akkusativ.',
 '📍', 'A1_GRAMMAR', 26, 6, 26, 'A1', 4, 180, 1,
 5, 'Ngữ pháp nâng cao A1', 'Grammatik A1+', 'LESSON',
 ARRAY['#Praepositionen','#Grammatik'],
 '{"title":{"de":"Präpositionen","vi":"Giới từ"},"overview":{"de":"Ich bin in der Schule. Wir treffen uns am Montag.","vi":"Giới từ chỉ nơi chốn và thời gian."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 7: Tổng kết A1 ═══════════════

-- Node 27: Possessivartikel
('CORE_TRUNK',
 'Possessivartikel',
 'Tính từ sở hữu',
 'mein, dein, sein, ihr, unser, euer, ihr — với Nominativ và Akkusativ.',
 '👤', 'A1_GRAMMAR', 27, 7, 27, 'A1', 3, 160, 1,
 6, 'Tổng kết A1', 'A1 Abschluss', 'LESSON',
 ARRAY['#Possessiv','#Grammatik'],
 '{"title":{"de":"Possessivartikel","vi":"Tính từ sở hữu"},"overview":{"de":"Das ist mein Buch. Wo ist dein Handy?","vi":"Tính từ sở hữu trong Nominativ và Akkusativ."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 28: Akkusativ
('CORE_TRUNK',
 'Der Akkusativ',
 'Cách Akkusativ (túc từ trực tiếp)',
 'Khi nào dùng Akkusativ, biến đổi mạo từ: den, einen, keinen.',
 '🎯', 'A1_GRAMMAR', 28, 7, 28, 'A1', 4, 180, 1,
 6, 'Tổng kết A1', 'A1 Abschluss', 'LESSON',
 ARRAY['#Akkusativ','#Grammatik'],
 '{"title":{"de":"Der Akkusativ","vi":"Cách Akkusativ"},"overview":{"de":"Ich kaufe den Kuchen. Hast du einen Bruder?","vi":"Biến đổi mạo từ trong Akkusativ."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 29: Briefe & E-Mails
('CORE_TRUNK',
 'Briefe & E-Mails schreiben',
 'Viết thư & Email',
 'Cấu trúc thư/email tiếng Đức: Anrede, Inhalt, Grußformel.',
 '✉️', 'A1_REVIEW', 29, 7, 29, 'A1', 3, 170, 1,
 6, 'Tổng kết A1', 'A1 Abschluss', 'LESSON',
 ARRAY['#Schreiben','#Brief'],
 '{"title":{"de":"Briefe & E-Mails","vi":"Viết thư & Email"},"overview":{"de":"Liebe Frau Müller, ... Mit freundlichen Grüßen","vi":"Cấu trúc thư/email tiếng Đức chuẩn."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- Node 30: A1 Abschlusstest (Milestone)
('CORE_TRUNK',
 'A1 Abschlusstest',
 'Bài thi tổng kết A1',
 'Kiểm tra toàn diện: Lesen, Hören, Schreiben, Sprechen theo format Goethe Start Deutsch 1.',
 '🏆', 'A1_REVIEW', 30, 7, 30, 'A1', 5, 500, 1,
 6, 'Tổng kết A1', 'A1 Abschluss', 'EXAM',
 ARRAY['#Abschlusstest','#A1','#Goethe'],
 '{"title":{"de":"A1 Abschlusstest","vi":"Bài thi tổng kết A1"},"overview":{"de":"Goethe Start Deutsch 1 — Probeprüfung","vi":"Thi thử theo format Goethe Start Deutsch 1."},"session_type":"EXAM","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb);

-- ═══════════════ DEPENDENCIES ═══════════════
-- Linear chain: each node depends on the previous one (nodes 11-30)
DO $$
DECLARE
    prev_id BIGINT;
    curr_id BIGINT;
    d INTEGER;
BEGIN
    FOR d IN 11..30 LOOP
        SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = d - 1 LIMIT 1;
        SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = d     LIMIT 1;
        IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (curr_id, prev_id, 'HARD', 100)
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
