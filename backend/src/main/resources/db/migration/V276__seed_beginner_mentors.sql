-- Mentor nhập môn (BEGINNER) cho các họ ngành chưa có — QA 2026-08-20, F-15.
--
-- Bối cảnh: FixedMentorResolver lọc cứng tier FREE chỉ còn persona BEGINNER, mà
-- catalog chỉ có 5 persona BEGINNER trên tổng 9 họ ngành. Hệ quả đo được trên
-- prod: /api/onboarding/preview/mentor trả ANNA cho 5/6 lĩnh vực ở MỌI cấp độ,
-- nên thẻ "Mentor của bạn" trong onboarding bất động dù người dùng chọn gì.
--
-- Sáu persona dưới đây đều là VAI NHẬP MÔN thật sự — cùng tinh thần với
-- LENA/THOMAS/NIKLAS đã có: đồng nghiệp mới vào nghề nói tiếng Đức A1-A2, không
-- phải sếp hay chuyên gia. Mã phải khớp hằng của enum SpeakingPersona.
--
-- difficulty ở bảng này dùng cho khoá tính năng phía client (persona ADVANCED bị
-- khoá với tài khoản free), nên phải là BEGINNER để mở cho người vừa đăng ký.

INSERT INTO interview_persona (code, label, industry, role_title, tone, difficulty, question_style, follow_up_style, evaluation_bias) VALUES
('JONAS', 'Jonas — IT-Support',            'IT / Helpdesk',              'IT-Support-Mitarbeiter',      'friendly', 'BEGINNER', 'situational', 'deepen', 'clear explanation, patience, ticket handling'),
('MARIE', 'Marie — Pflegehelferin',        'Healthcare / Altenpflege',   'Pflegehelferin',              'warm',     'BEGINNER', 'situational', 'deepen', 'empathy, daily routine, teamwork'),
('TIM',   'Tim — Küchenhilfe',             'Gastronomy / Küche',         'Küchenhilfe',                 'friendly', 'BEGINNER', 'situational', 'deepen', 'hygiene, speed, following instructions'),
('JULIA', 'Julia — Produktionshelferin',   'Operations / Fertigung',     'Produktionshelferin',         'direct',   'BEGINNER', 'situational', 'deepen', 'safety, accuracy, shift work'),
('FELIX', 'Felix — Bürokaufmann (Azubi)',  'Business / Büro',            'Bürokaufmann in Ausbildung',  'friendly', 'BEGINNER', 'situational', 'deepen', 'politeness, phone handling, organisation'),
('MIA',   'Mia — Social-Media-Assistentin','Media / Social Media',       'Social-Media-Assistentin',    'energetic','BEGINNER', 'situational', 'deepen', 'creativity, deadlines, audience awareness')
ON CONFLICT (code) DO NOTHING;
