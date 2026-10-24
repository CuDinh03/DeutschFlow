-- ============================================================
-- V336: Người tuyển dụng theo nơi làm việc (20/10/2026, đợt 2c định hướng A + B + E)
--
-- Tám nhân vật phỏng vấn, mỗi nhóm occupation.workplace (V334) một người; nghề là tham số
-- (interview_position). Nghề có bộ câu hỏi viết tay (legacy_persona_code) vẫn dùng nhân vật cũ;
-- nghề dùng bộ chung trước đây rơi về DEFAULT, nay nhận người tuyển dụng của nhóm
-- (OccupationCatalogService.personaFor). Không xoá hay đổi nhân vật cũ ⇒ phiên cũ giữ nguyên.
--
-- Mã phải khớp hằng của enum SpeakingPersona. Không phải mentor (FixedMentorResolver không
-- chọn), và InterviewController./personas lọc bỏ để bản app cũ không gặp mã lạ.
--
-- industry khớp đúng tên rubric có sẵn (interview_rubric_template, so khớp chính xác) khi có;
-- bau/logistik/buero chưa có rubric riêng ⇒ rơi về rubric chung "Education / Career".
-- difficulty INTERMEDIATE: phỏng vấn đã có sàn B1 (AiSpeakingServiceImpl).
-- Phụ thuộc V334 (danh mục nghề), V335. Cần #700 (V333) lên prod trước.
-- ============================================================

INSERT INTO interview_persona (code, label, industry, role_title, tone, difficulty, question_style, follow_up_style, evaluation_bias) VALUES
('HOFFMANN', 'Frau Hoffmann — Restaurantleiterin',    'Gastronomy',                'Restaurantleiterin',           'friendly', 'INTERMEDIATE', 'situational', 'deepen', 'guest orientation, hygiene, teamwork under pressure'),
('KRUEGER',  'Frau Krüger — Pflegedienstleitung',      'Healthcare',                'Pflegedienstleitung',          'warm',     'INTERMEDIATE', 'situational', 'probe',  'patient care, hygiene, documentation, shift work'),
('BRANDT',   'Herr Brandt — Bauleiter',                'Construction / Bau',        'Bauleiter / Handwerksmeister', 'direct',   'INTERMEDIATE', 'situational', 'probe',  'safety, tools and materials, quality, deadlines'),
('WAGNER',   'Herr Wagner — Produktionsleiter',        'Operations / Maschinenbau', 'Produktionsleiter / Meister',  'direct',   'INTERMEDIATE', 'technical',   'probe',  'safety, machines, quality control, shift work'),
('YILMAZ',   'Herr Yılmaz — Lagerleiter',              'Logistics / Verkehr',       'Lagerleiter',                  'friendly', 'INTERMEDIATE', 'situational', 'deepen', 'safety, punctuality, warehouse and delivery processes'),
('SCHULZ',   'Frau Schulz — Filialleiterin',           'Retail / Verkauf',          'Filialleiterin',               'friendly', 'INTERMEDIATE', 'situational', 'deepen', 'customer service, accuracy, complaints, teamwork'),
('BECKER',   'Frau Becker — Personalreferentin (HR)',  'Business / Office',         'Personalreferentin (HR)',      'formal',   'INTERMEDIATE', 'behavioral',  'deepen', 'role knowledge, organisation, communication'),
('RICHTER',  'Herr Richter — Kita-/Schulleitung',      'Education',                 'Kita-/Schulleitung',           'warm',     'INTERMEDIATE', 'behavioral',  'deepen', 'pedagogy, parents, child protection, teamwork')
ON CONFLICT (code) DO NOTHING;

-- topic_pools_json: đúng mảng của PersonaInterviewRegistry.topicPools() (PersonaTopicPoolParityTest đối chiếu).
-- (Mỗi câu một dòng, cùng khuôn V187: test đọc `code` và chuỗi JSON.)
UPDATE interview_persona SET topic_pools_json = '[["Gästeorientierung","Hygiene und HACCP"],["Stoßzeiten und Tempo","Zusammenarbeit Küche und Service"],["Schicht- und Wochenendarbeit","Beschwerden von Gästen"]]'::jsonb WHERE code = 'HOFFMANN';
UPDATE interview_persona SET topic_pools_json = '[["Umgang mit Patienten und Angehörigen","Hygiene und Infektionsschutz"],["Dokumentation und Übergabe","Notfälle und Prioritäten"],["Schichtdienst und Belastung","Anerkennung und Weiterbildung"]]'::jsonb WHERE code = 'KRUEGER';
UPDATE interview_persona SET topic_pools_json = '[["Arbeitssicherheit und Schutzausrüstung","Werkzeuge und Material"],["Pläne und Aufträge","Qualität und Abnahme"],["Termindruck und Wetter","Umgang mit Kunden"]]'::jsonb WHERE code = 'BRANDT';
UPDATE interview_persona SET topic_pools_json = '[["Arbeitssicherheit","Maschinen und Anlagen"],["Qualitätskontrolle","Störungen und Fehlersuche"],["Schichtarbeit","Technische Unterlagen"]]'::jsonb WHERE code = 'WAGNER';
UPDATE interview_persona SET topic_pools_json = '[["Sicherheit und Vorschriften","Lager- und Lieferprozesse"],["Pünktlichkeit und Planung","Fahrzeuge und Berechtigungen"],["Kontakt mit Kunden","Schichtarbeit und Belastung"]]'::jsonb WHERE code = 'YILMAZ';
UPDATE interview_persona SET topic_pools_json = '[["Kundenberatung","Kasse und Genauigkeit"],["Reklamation","Warenpflege und Inventur"],["Teamarbeit","Stoßzeiten im Laden"]]'::jsonb WHERE code = 'SCHULZ';
UPDATE interview_persona SET topic_pools_json = '[["Fachkenntnisse für die Position","Arbeitsorganisation"],["Kommunikation mit Kunden und Kollegen","Digitale Werkzeuge"],["Teamarbeit im Büro","Lernbereitschaft und Weiterbildung"]]'::jsonb WHERE code = 'BECKER';
UPDATE interview_persona SET topic_pools_json = '[["Pädagogische Haltung","Umgang mit Eltern"],["Kinderschutz","Teamarbeit im Kollegium"],["Konflikte in der Gruppe","Dokumentation und Beobachtung"]]'::jsonb WHERE code = 'RICHTER';
