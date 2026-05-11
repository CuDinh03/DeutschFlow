-- V121: Curriculum A2 — Goethe-Zertifikat A2
-- 20 nodes across 5 weeks (Week 8-12)
-- Prerequisite: Node 30 (A1 Abschlusstest) must be completed

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══════════════ WEEK 8: Grammatik A2 Basis ═══════════════

('CORE_TRUNK',
 'Dativ (Wem-Fall)',
 'Cách Dativ (túc từ gián tiếp)',
 'Khi nào dùng Dativ, biến đổi mạo từ: dem, einem, keinem.',
 '🎁', 'CORE_A2', 31, 8, 31, 'A2', 4, 220, 1,
 7, 'Ngữ pháp A2', 'Grammatik A2', 'LESSON',
 ARRAY['#Dativ','#Grammatik','#A2'],
 '{"title":{"de":"Der Dativ","vi":"Cách Dativ"},"overview":{"de":"Ich helfe dem Mann. Ich gebe dem Kind ein Buch.","vi":"Dativ: biến đổi mạo từ và sử dụng sau một số động từ và giới từ."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Wechselpräpositionen',
 'Giới từ hai hướng (Akk/Dat)',
 'in, auf, an, über, unter, neben, vor, hinter, zwischen — Akkusativ (hướng) vs Dativ (vị trí).',
 '↔️', 'CORE_A2', 32, 8, 32, 'A2', 5, 240, 1,
 7, 'Ngữ pháp A2', 'Grammatik A2', 'LESSON',
 ARRAY['#Praepositionen','#Dativ','#Akkusativ','#A2'],
 '{"title":{"de":"Wechselpräpositionen","vi":"Giới từ hai hướng"},"overview":{"de":"Das Buch liegt auf dem Tisch (Dat). Ich lege das Buch auf den Tisch (Akk).","vi":"Phân biệt Akkusativ (hướng đi) và Dativ (vị trí)"},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Adjektivdeklination',
 'Biến đổi tính từ',
 'Tính từ thay đổi hình dạng tùy theo mạo từ và cách (Nom/Akk/Dat).',
 '🎨', 'CORE_A2', 33, 8, 33, 'A2', 5, 230, 1,
 7, 'Ngữ pháp A2', 'Grammatik A2', 'LESSON',
 ARRAY['#Adjektiv','#Deklination','#A2'],
 '{"title":{"de":"Adjektivdeklination","vi":"Biến đổi tính từ"},"overview":{"de":"Ein großer Mann. Die nette Frau. Das kleine Kind.","vi":"Tính từ biến đổi theo giống, số và cách."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Komparativ und Superlativ',
 'So sánh hơn & So sánh nhất',
 'Tạo dạng so sánh hơn (-er) và so sánh nhất (am -sten / -ste).',
 '📈', 'CORE_A2', 34, 8, 34, 'A2', 4, 200, 1,
 7, 'Ngữ pháp A2', 'Grammatik A2', 'LESSON',
 ARRAY['#Komparativ','#Superlativ','#A2'],
 '{"title":{"de":"Komparativ und Superlativ","vi":"So sánh"},"overview":{"de":"Berlin ist groß. München ist größer. Frankfurt ist am größten.","vi":"Cách tạo dạng so sánh hơn và nhất."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 9: Alltag A2 ═══════════════

('CORE_TRUNK',
 'Nebensätze mit weil/dass/wenn',
 'Mệnh đề phụ (weil/dass/wenn)',
 'Cấu trúc câu ghép: động từ ra cuối câu phụ.',
 '🔗', 'CORE_A2', 35, 9, 35, 'A2', 5, 250, 1,
 8, 'Cuộc sống A2', 'Alltag A2', 'LESSON',
 ARRAY['#Nebensatz','#weil','#dass','#A2'],
 '{"title":{"de":"Nebensätze","vi":"Mệnh đề phụ"},"overview":{"de":"Ich lerne Deutsch, weil ich in Deutschland arbeiten möchte.","vi":"Động từ trong mệnh đề phụ đứng cuối câu."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Kommunikation am Telefon',
 'Giao tiếp qua điện thoại',
 'Gọi điện, để lại tin nhắn, hỏi thông tin qua điện thoại.',
 '📞', 'CORE_A2', 36, 9, 36, 'A2', 3, 180, 1,
 8, 'Cuộc sống A2', 'Alltag A2', 'LESSON',
 ARRAY['#Telefon','#Kommunikation','#A2'],
 '{"title":{"de":"Kommunikation am Telefon","vi":"Giao tiếp qua điện thoại"},"overview":{"de":"Guten Tag, hier spricht... Kann ich eine Nachricht hinterlassen?","vi":"Cách gọi điện, nhắn tin, hỏi thông tin lịch sự."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Behörden und Formulare',
 'Cơ quan hành chính & Thủ tục',
 'Đăng ký hộ khẩu, mở tài khoản ngân hàng, điền form.',
 '🏛️', 'CORE_A2', 37, 9, 37, 'A2', 4, 200, 1,
 8, 'Cuộc sống A2', 'Alltag A2', 'LESSON',
 ARRAY['#Behoerde','#Formular','#A2'],
 '{"title":{"de":"Behörden und Formulare","vi":"Cơ quan & Thủ tục"},"overview":{"de":"Ich möchte mich anmelden. Wo finde ich das Formular?","vi":"Thủ tục hành chính, điền form, đăng ký."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Einkaufen und Reklamieren',
 'Mua sắm & Khiếu nại',
 'Trả hàng, khiếu nại sản phẩm lỗi, yêu cầu hoàn tiền.',
 '🛍️', 'CORE_A2', 38, 9, 38, 'A2', 4, 190, 1,
 8, 'Cuộc sống A2', 'Alltag A2', 'LESSON',
 ARRAY['#Einkaufen','#Reklamation','#A2'],
 '{"title":{"de":"Einkaufen und Reklamieren","vi":"Mua sắm & Khiếu nại"},"overview":{"de":"Das Gerät ist kaputt. Ich möchte es umtauschen.","vi":"Cách khiếu nại, trả hàng, yêu cầu sửa chữa."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 10: Ngữ pháp A2 Nâng cao ═══════════════

('CORE_TRUNK',
 'Konjunktiv II (würde + Infinitiv)',
 'Điều kiện giả định (Konjunktiv II)',
 'Diễn đạt điều ước, lời đề nghị lịch sự: ich würde, ich könnte, ich hätte.',
 '🌟', 'CORE_A2', 39, 10, 39, 'A2', 6, 280, 1,
 9, 'Ngữ pháp nâng cao A2', 'Grammatik A2+', 'LESSON',
 ARRAY['#KonjunktivII','#wuerde','#A2'],
 '{"title":{"de":"Konjunktiv II","vi":"Điều kiện giả định"},"overview":{"de":"Ich würde gern nach Deutschland reisen. Könnten Sie mir helfen?","vi":"Diễn đạt điều ước và lời đề nghị lịch sự."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Passiv Präsens',
 'Thể bị động thì hiện tại',
 'Cấu trúc Passiv: werden + Partizip II.',
 '🔄', 'CORE_A2', 40, 10, 40, 'A2', 6, 280, 1,
 9, 'Ngữ pháp nâng cao A2', 'Grammatik A2+', 'LESSON',
 ARRAY['#Passiv','#Grammatik','#A2'],
 '{"title":{"de":"Passiv Präsens","vi":"Bị động thì hiện tại"},"overview":{"de":"Das Auto wird repariert. Die Tür wird geöffnet.","vi":"Cấu trúc werden + Partizip II."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Relativsätze (Nominativ)',
 'Mệnh đề quan hệ (Nominativ)',
 'Dùng der/die/das làm đại từ quan hệ: Das ist der Mann, der...',
 '🔍', 'CORE_A2', 41, 10, 41, 'A2', 6, 270, 1,
 9, 'Ngữ pháp nâng cao A2', 'Grammatik A2+', 'LESSON',
 ARRAY['#Relativsatz','#Grammatik','#A2'],
 '{"title":{"de":"Relativsätze","vi":"Mệnh đề quan hệ"},"overview":{"de":"Das ist die Frau, die in Berlin wohnt. Das ist das Buch, das mir gefällt.","vi":"Mệnh đề quan hệ với der/die/das làm đại từ."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Genitiv',
 'Cách sở hữu (Genitiv)',
 'Diễn đạt sự sở hữu: das Auto meines Vaters.',
 '👑', 'CORE_A2', 42, 10, 42, 'A2', 5, 240, 1,
 9, 'Ngữ pháp nâng cao A2', 'Grammatik A2+', 'LESSON',
 ARRAY['#Genitiv','#Grammatik','#A2'],
 '{"title":{"de":"Genitiv","vi":"Cách Genitiv"},"overview":{"de":"Das ist das Auto meines Vaters. Die Tasche meiner Mutter.","vi":"Dùng Genitiv để diễn đạt sự sở hữu."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 11: Themas A2 ═══════════════

('CORE_TRUNK',
 'Kultur und Medien',
 'Văn hóa & Truyền thông',
 'Nói về phim, âm nhạc, sách, tin tức.',
 '🎭', 'CORE_A2', 43, 11, 43, 'A2', 3, 190, 1,
 10, 'Chủ đề A2', 'Themen A2', 'LESSON',
 ARRAY['#Kultur','#Medien','#A2'],
 '{"title":{"de":"Kultur und Medien","vi":"Văn hóa & Truyền thông"},"overview":{"de":"Ich sehe gern Filme. Welche Musik magst du?","vi":"Thảo luận về phim, nhạc, sách và tin tức."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Umwelt und Natur',
 'Môi trường & Thiên nhiên',
 'Nói về ô nhiễm, tiết kiệm năng lượng, bảo vệ môi trường.',
 '🌍', 'CORE_A2', 44, 11, 44, 'A2', 4, 200, 1,
 10, 'Chủ đề A2', 'Themen A2', 'LESSON',
 ARRAY['#Umwelt','#Natur','#A2'],
 '{"title":{"de":"Umwelt und Natur","vi":"Môi trường & Thiên nhiên"},"overview":{"de":"Wir müssen die Umwelt schützen. Recycling ist wichtig.","vi":"Ô nhiễm, tiết kiệm năng lượng, bảo vệ môi trường."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Gesundheit und Sport',
 'Sức khỏe & Thể thao',
 'Nói về thói quen lành mạnh, tập thể thao, chế độ ăn uống.',
 '💪', 'CORE_A2', 45, 11, 45, 'A2', 3, 180, 1,
 10, 'Chủ đề A2', 'Themen A2', 'LESSON',
 ARRAY['#Gesundheit','#Sport','#A2'],
 '{"title":{"de":"Gesundheit und Sport","vi":"Sức khỏe & Thể thao"},"overview":{"de":"Ich treibe zweimal pro Woche Sport. Ich ernähre mich gesund.","vi":"Thói quen lành mạnh, ăn uống và thể thao."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Schule und Bildung',
 'Trường học & Giáo dục',
 'Hệ thống giáo dục Đức, bàn về học tập, thi cử.',
 '🎓', 'CORE_A2', 46, 11, 46, 'A2', 3, 190, 1,
 10, 'Chủ đề A2', 'Themen A2', 'LESSON',
 ARRAY['#Schule','#Bildung','#A2'],
 '{"title":{"de":"Schule und Bildung","vi":"Trường học & Giáo dục"},"overview":{"de":"Ich gehe in die Grundschule. Nach dem Abitur studiere ich.","vi":"Hệ thống giáo dục Đức, bàn về học tập."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

-- ═══════════════ WEEK 12: Tổng kết A2 ═══════════════

('CORE_TRUNK',
 'Beruf und Bewerbung',
 'Nghề nghiệp & Xin việc',
 'Viết CV đơn giản, thư xin việc, nói về kinh nghiệm làm việc.',
 '📋', 'A2_REVIEW', 47, 12, 47, 'A2', 4, 220, 1,
 11, 'Tổng kết A2', 'A2 Abschluss', 'LESSON',
 ARRAY['#Beruf','#Bewerbung','#A2'],
 '{"title":{"de":"Beruf und Bewerbung","vi":"Nghề nghiệp & Xin việc"},"overview":{"de":"Ich bewerbe mich für die Stelle als... Ich habe Erfahrung in...","vi":"CV, thư xin việc, phỏng vấn đơn giản."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Indirekte Rede',
 'Lời nói gián tiếp',
 'Thuật lại lời người khác: Er sagt, dass... / Er fragt, ob...',
 '💬', 'A2_REVIEW', 48, 12, 48, 'A2', 5, 240, 1,
 11, 'Tổng kết A2', 'A2 Abschluss', 'LESSON',
 ARRAY['#IndirekteRede','#Grammatik','#A2'],
 '{"title":{"de":"Indirekte Rede","vi":"Lời nói gián tiếp"},"overview":{"de":"Er sagt, dass er Hunger hat. Sie fragt, ob ich kommen kann.","vi":"Thuật lại lời nói dùng dass/ob + động từ cuối câu."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'Meinungen ausdrücken',
 'Diễn đạt quan điểm',
 'Đưa ra, bảo vệ và phản biện ý kiến một cách lịch sự.',
 '🗣️', 'A2_REVIEW', 49, 12, 49, 'A2', 4, 210, 1,
 11, 'Tổng kết A2', 'A2 Abschluss', 'LESSON',
 ARRAY['#Meinung','#Diskussion','#A2'],
 '{"title":{"de":"Meinungen ausdrücken","vi":"Diễn đạt quan điểm"},"overview":{"de":"Ich denke, dass... Ich bin der Meinung, dass... Ich stimme zu/nicht zu.","vi":"Cách đưa ra, ủng hộ và phản biện ý kiến."},"session_type":"LESSON","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb),

('CORE_TRUNK',
 'A2 Abschlusstest',
 'Bài thi tổng kết A2',
 'Kiểm tra toàn diện A2: Lesen, Hören, Schreiben, Sprechen theo format Goethe-Zertifikat A2.',
 '🏆', 'A2_REVIEW', 50, 12, 50, 'A2', 6, 600, 1,
 11, 'Tổng kết A2', 'A2 Abschluss', 'EXAM',
 ARRAY['#Abschlusstest','#A2','#Goethe'],
 '{"title":{"de":"A2 Abschlusstest","vi":"Bài thi tổng kết A2"},"overview":{"de":"Goethe-Zertifikat A2 — Probeprüfung","vi":"Thi thử theo format Goethe-Zertifikat A2."},"session_type":"EXAM","theory_cards":[],"vocabulary":[],"phrases":[],"examples":[],"exercises":{"theory_gate":[],"practice":[]}}'::jsonb);

-- Dependencies: linear chain 31-50
DO $$
DECLARE
    prev_id BIGINT;
    curr_id BIGINT;
    d INTEGER;
BEGIN
    -- Node 31 depends on Node 30 (A1 completion)
    SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = 30 LIMIT 1;
    SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = 31 LIMIT 1;
    IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
        INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
        VALUES (curr_id, prev_id, 'HARD', 100)
        ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
    END IF;

    -- Nodes 32-50 each depend on previous
    FOR d IN 32..50 LOOP
        SELECT id INTO prev_id FROM skill_tree_nodes WHERE day_number = d - 1 LIMIT 1;
        SELECT id INTO curr_id FROM skill_tree_nodes WHERE day_number = d LIMIT 1;
        IF prev_id IS NOT NULL AND curr_id IS NOT NULL THEN
            INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
            VALUES (curr_id, prev_id, 'HARD', 100)
            ON CONFLICT (node_id, depends_on_node_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;
