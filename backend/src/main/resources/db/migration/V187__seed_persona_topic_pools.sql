-- V187 (R1): Consolidate scattered interview-persona config into the DB.
--
-- Part A: add interview_persona.topic_pools_json and seed it from
--         PersonaInterviewRegistry.topicPools() (the in-memory switch).
-- Part B: migrate the persona-specific HARD_SKILLS questions from the in-memory
--         InterviewQuestionBank.forPersona() into interview_question.
--
-- Behaviour-preserving: the in-memory switch + question bank are kept as a fallback
-- for one transition release (see PersonaInterviewRegistry). Selection order is
-- preserved because these rows are inserted AFTER the existing V164/V171 rows, so
-- pickQuestion() still returns curated rows first and bank rows only on exhaustion.
-- Parity is asserted by PersonaTopicPoolParityTest + InterviewQuestionBankSeedParityTest.

-- ─── Part A: topic_pools_json column + seed ──────────────────────────────────
ALTER TABLE interview_persona ADD COLUMN IF NOT EXISTS topic_pools_json jsonb;

-- One UPDATE per persona; the JSON is the exact array-of-arrays from topicPools().
-- (Single-line, fixed shape: the parity test parses `code` and the JSON literal.)
UPDATE interview_persona SET topic_pools_json = '[["Systemdesign und Architektur","API und Microservices"],["Testing und CI/CD","Performance und Monitoring"],["Debugging Produktion","Datenbank und Skalierung"],["Security","Cloud und Migration"]]'::jsonb WHERE code = 'LUKAS';
UPDATE interview_persona SET topic_pools_json = '[["Akquise und Pitch","CRM und Pipeline"],["Verhandlung und Abschluss","KPI und Reporting"],["Stakeholder-Kommunikation","Account Management"]]'::jsonb WHERE code = 'EMMA';
UPDATE interview_persona SET topic_pools_json = '[["Zeitmanagement","Studien- und Karriereplanung"],["Interkulturelle Kompetenz","Teamdynamik"],["Stress und Work-Life-Balance","Peer-Learning"]]'::jsonb WHERE code = 'ANNA';
UPDATE interview_persona SET topic_pools_json = '[["Kochtechniken und Garstufen","Mise en Place"],["HACCP und Allergenmanagement","Rush-Hour-Organisation"],["Menükalkulation","Brigade und Qualität"],["Saisonale Küche","Food-Waste"]]'::jsonb WHERE code = 'KLAUS';
UPDATE interview_persona SET topic_pools_json = '[["Hautanamnese und Proben","Hygiene und SOP im Labor"],["Patientenkommunikation Dermatologie","Notfall und Allergie"],["Dokumentation KIS/LIS","Unklare Diagnose und Befundweitergabe"]]'::jsonb WHERE code = 'WEBER';
UPDATE interview_persona SET topic_pools_json = '[["Patientenaufnahme und Termine","Hygiene und Genauigkeit"],["Dokumentation und Datenschutz","Kommunikation mit ängstlichen Patienten"]]'::jsonb WHERE code = 'SARAH';
UPDATE interview_persona SET topic_pools_json = '[["Patientenaufnahme und Termine","Hygiene und Genauigkeit"],["Dokumentation und Datenschutz","Kommunikation mit ängstlichen Patienten"]]'::jsonb WHERE code = 'SCHNEIDER';
UPDATE interview_persona SET topic_pools_json = '[["Maschinensicherheit","Wartung und Störungssuche"],["Qualitätskontrolle","Schichtarbeit und Zuverlässigkeit"]]'::jsonb WHERE code = 'MAX';
UPDATE interview_persona SET topic_pools_json = '[["Maschinensicherheit","Wartung und Störungssuche"],["Qualitätskontrolle","Schichtarbeit und Zuverlässigkeit"]]'::jsonb WHERE code = 'OLIVER';
UPDATE interview_persona SET topic_pools_json = '[["Gast- und Beschwerdemanagement","Tempo und Teamkoordination"],["Kasse/Reservierung","Upselling und Servicequalität"]]'::jsonb WHERE code = 'NIKLAS';
UPDATE interview_persona SET topic_pools_json = '[["Gast- und Beschwerdemanagement","Tempo und Teamkoordination"],["Kasse/Reservierung","Upselling und Servicequalität"]]'::jsonb WHERE code = 'NINA';
UPDATE interview_persona SET topic_pools_json = '[["Kundenberatung","Hygiene und Warenpflege"],["Reklamation","Inventar und Teamarbeit"]]'::jsonb WHERE code = 'LENA';
UPDATE interview_persona SET topic_pools_json = '[["Kundenberatung","Hygiene und Warenpflege"],["Reklamation","Inventar und Teamarbeit"]]'::jsonb WHERE code = 'THOMAS';
UPDATE interview_persona SET topic_pools_json = '[["Kundenberatung","Hygiene und Warenpflege"],["Reklamation","Inventar und Teamarbeit"]]'::jsonb WHERE code = 'PETRA';
UPDATE interview_persona SET topic_pools_json = '[["Live-Moderation","Skript und Improvisation"],["Publikumsreaktion","Professionelles Auftreten"]]'::jsonb WHERE code = 'HANNIE';

-- ─── Part B: persona-specific HARD_SKILLS questions from InterviewQuestionBank ──
-- Text matches the bank with position rendered as its blank-default ("diese Position"),
-- so blank-position sessions are byte-identical and only the rare exhaustion-tail of a
-- named-position session sees a generic phrasing. difficulty is left at INTERMEDIATE;
-- per-level calibration is owned by the interview redesign Phase 1.

-- LUKAS — IT / Tech
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('tech_project', 'LUKAS', 'HARD_SKILLS', 'projekt', 'Welches technische Projekt für diese Position war Ihr wichtigster Beitrag — Architektur, Ihre Rolle, Trade-off?', 'INTERMEDIATE'),
('tech_debug',   'LUKAS', 'HARD_SKILLS', 'debug',   'Beschreiben Sie einen schweren Produktionsfehler: Ursache, Debugging-Schritte, Fix und Prävention.', 'INTERMEDIATE'),
('tech_api',     'LUKAS', 'HARD_SKILLS', 'api',     'Wie haben Sie API-Design und Fehlerbehandlung in einem echten System umgesetzt?', 'INTERMEDIATE'),
('tech_test',    'LUKAS', 'HARD_SKILLS', 'test',    'Welche Testing-Strategie nutzen Sie, und wo hat sie versagt — konkretes Beispiel.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- EMMA — Business
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('biz_pipeline',    'EMMA', 'HARD_SKILLS', 'crm',         'Beschreiben Sie einen Deal oder Kunden, den Sie für diese Position gewonnen haben — KPI und Vorgehen.', 'INTERMEDIATE'),
('biz_negotiation', 'EMMA', 'HARD_SKILLS', 'verhandlung', 'Nennen Sie eine schwierige Verhandlung mit messbarem Ergebnis.', 'INTERMEDIATE'),
('biz_kpi',         'EMMA', 'HARD_SKILLS', 'kpi',         'Welche KPIs haben Sie verbessert, und welche Entscheidung hat das ausgelöst?', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- ANNA — Education / Career
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('edu_planning', 'ANNA', 'HARD_SKILLS', 'planung', 'Wie planen Sie Lern- oder Studienziele für diese Position — konkretes Beispiel mit Zeitrahmen.', 'INTERMEDIATE'),
('edu_conflict', 'ANNA', 'HARD_SKILLS', 'team',    'Wie moderieren Sie Konflikte in einer Gruppe? STAR-Beispiel.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- KLAUS — Gastronomy
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('gas_haccp', 'KLAUS', 'HARD_SKILLS', 'hygiene',     'Nennen Sie einen HACCP-/Hygiene-Vorfall in der Küche und Ihre sofortigen Maßnahmen.', 'INTERMEDIATE'),
('gas_rush',  'KLAUS', 'HARD_SKILLS', 'stress',      'Wie organisieren Sie die Station in der Rush Hour für diese Position? Konkretes Beispiel.', 'INTERMEDIATE'),
('gas_menu',  'KLAUS', 'HARD_SKILLS', 'kalkulation', 'Beschreiben Sie Menüplanung oder Kalkulation, die Sie selbst durchgeführt haben.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- WEBER — Dermatology
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('web_hygiene_case',  'WEBER', 'HARD_SKILLS', 'hygiene',  'Nennen Sie einen konkreten Vorfall in der Klinik/Praxis, bei dem Hygiene oder Qualität gefährdet war — Ihre Maßnahmen und das Ergebnis.', 'INTERMEDIATE'),
('web_sample_prep',   'WEBER', 'HARD_SKILLS', 'labor',    'Wie bereiten Sie Hautproben für mikrobiologische oder histologische Untersuchungen vor? Bitte mit einem echten Ablauf aus Ihrer Erfahrung.', 'INTERMEDIATE'),
('web_patient_comm',  'WEBER', 'HARD_SKILLS', 'patient',  'Wie sprechen Sie mit einem Patienten, der sich wegen sichtbarer Hautveränderungen schämt? Ein konkretes Beispiel.', 'INTERMEDIATE'),
('web_emergency',     'WEBER', 'HARD_SKILLS', 'notfall',  'Beschreiben Sie, wie Sie bei einer allergischen Reaktion im Labor/Praxis vorgegangen sind — Schritte und Eskalation.', 'INTERMEDIATE'),
('web_anamnese',      'WEBER', 'HARD_SKILLS', 'anamnese', 'Wie führen Sie eine Hautanamnese strukturiert durch, bevor der Arzt die Untersuchung übernimmt?', 'INTERMEDIATE'),
('web_documentation', 'WEBER', 'HARD_SKILLS', 'doku',     'Welches KIS/LIS haben Sie genutzt, und wie vermeiden Sie Verwechslungen bei Proben und Befunden?', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- SARAH — Medical Assistant
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('ma_appointment',   'SARAH', 'HARD_SKILLS', 'termin',  'Wie organisieren Sie Termine und Patientenaufnahme unter Zeitdruck? Ein Beispiel aus der Praxis.', 'INTERMEDIATE'),
('ma_hygiene',       'SARAH', 'HARD_SKILLS', 'hygiene', 'Welche Hygienemaßnahmen sind für diese Position kritisch — und wann haben Sie sie verletzt gesehen und reagiert?', 'INTERMEDIATE'),
('ma_documentation', 'SARAH', 'HARD_SKILLS', 'doku',    'Wie dokumentieren Sie Befunde und Datenschutz im Alltag? Nennen Sie System und einen Ablauf.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- SCHNEIDER — Ophthalmology
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('oph_sehtest',      'SCHNEIDER', 'HARD_SKILLS', 'sehtest',     'Welche Sehtests führen Sie selbstständig durch, und wie dokumentieren Sie die Werte für diese Position?', 'INTERMEDIATE'),
('oph_contact_lens', 'SCHNEIDER', 'HARD_SKILLS', 'linsen',      'Beschreiben Sie die Anpassung oder Beratung zu Kontaktlinsen — ein konkreter Patientenfall.', 'INTERMEDIATE'),
('oph_accuracy',     'SCHNEIDER', 'HARD_SKILLS', 'genauigkeit', 'Nennen Sie einen Fehler bei Messung oder Dokumentation und wie Sie ihn behoben haben.', 'INTERMEDIATE'),
('oph_patient_calm', 'SCHNEIDER', 'HARD_SKILLS', 'patient',     'Wie beruhigen Sie einen ängstlichen Patienten vor einer Untersuchung? Konkretes Beispiel.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- LENA / THOMAS / PETRA — Retail / Food
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('lena_customer',   'LENA',   'HARD_SKILLS', 'kunde',   'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für diese Position.', 'INTERMEDIATE'),
('lena_hygiene',    'LENA',   'HARD_SKILLS', 'hygiene', 'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.', 'INTERMEDIATE'),
('lena_team',       'LENA',   'HARD_SKILLS', 'team',    'Beschreiben Sie Teamarbeit in Stoßzeiten und Ihre Verantwortung.', 'INTERMEDIATE'),
('thomas_customer', 'THOMAS', 'HARD_SKILLS', 'kunde',   'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für diese Position.', 'INTERMEDIATE'),
('thomas_hygiene',  'THOMAS', 'HARD_SKILLS', 'hygiene', 'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.', 'INTERMEDIATE'),
('thomas_team',     'THOMAS', 'HARD_SKILLS', 'team',    'Beschreiben Sie Teamarbeit in Stoßzeiten und Ihre Verantwortung.', 'INTERMEDIATE'),
('petra_customer',  'PETRA',  'HARD_SKILLS', 'kunde',   'Wie gehen Sie mit einer schwierigen Kundenreklamation um? Konkretes Beispiel für diese Position.', 'INTERMEDIATE'),
('petra_hygiene',   'PETRA',  'HARD_SKILLS', 'hygiene', 'Welche Hygiene- und Qualitätsstandards sind in Ihrem Bereich kritisch — Praxisbeispiel.', 'INTERMEDIATE'),
('petra_team',      'PETRA',  'HARD_SKILLS', 'team',    'Beschreiben Sie Teamarbeit in Stoßzeiten und Ihre Verantwortung.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- MAX / OLIVER — Operations / Maschinenbau
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('max_safety',         'MAX',    'HARD_SKILLS', 'sicherheit', 'Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für diese Position.', 'INTERMEDIATE'),
('max_maintenance',    'MAX',    'HARD_SKILLS', 'wartung',    'Wie führen Sie Wartung oder Störungssuche an einer Maschine durch — konkreter Ablauf.', 'INTERMEDIATE'),
('max_quality',        'MAX',    'HARD_SKILLS', 'qualitaet',  'Beschreiben Sie Qualitätskontrolle mit Toleranzen oder Messwerten aus Ihrer Erfahrung.', 'INTERMEDIATE'),
('oliver_safety',      'OLIVER', 'HARD_SKILLS', 'sicherheit', 'Nennen Sie einen Sicherheitsvorfall oder Beinahe-Unfall und Ihre Maßnahmen für diese Position.', 'INTERMEDIATE'),
('oliver_maintenance', 'OLIVER', 'HARD_SKILLS', 'wartung',    'Wie führen Sie Wartung oder Störungssuche an einer Maschine durch — konkreter Ablauf.', 'INTERMEDIATE'),
('oliver_quality',     'OLIVER', 'HARD_SKILLS', 'qualitaet',  'Beschreiben Sie Qualitätskontrolle mit Toleranzen oder Messwerten aus Ihrer Erfahrung.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- NIKLAS / NINA — Service
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('niklas_guest', 'NIKLAS', 'HARD_SKILLS', 'gast',  'Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für diese Position.', 'INTERMEDIATE'),
('niklas_rush',  'NIKLAS', 'HARD_SKILLS', 'tempo', 'Beschreiben Sie einen Abend mit hohem Gästeaufkommen — Priorisierung und Team.', 'INTERMEDIATE'),
('niklas_cash',  'NIKLAS', 'HARD_SKILLS', 'kasse', 'Nennen Sie einen Fehler an Kasse/Reservierung und wie Sie ihn korrigiert haben.', 'INTERMEDIATE'),
('nina_guest',   'NINA',   'HARD_SKILLS', 'gast',  'Wie behandeln Sie einen unzufriedenen Gast? STAR-Beispiel für diese Position.', 'INTERMEDIATE'),
('nina_rush',    'NINA',   'HARD_SKILLS', 'tempo', 'Beschreiben Sie einen Abend mit hohem Gästeaufkommen — Priorisierung und Team.', 'INTERMEDIATE'),
('nina_cash',    'NINA',   'HARD_SKILLS', 'kasse', 'Nennen Sie einen Fehler an Kasse/Reservierung und wie Sie ihn korrigiert haben.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- HANNIE — Media / MC
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('mc_live', 'HANNIE', 'HARD_SKILLS', 'live',         'Beschreiben Sie eine Live-Situation oder Moderation für diese Position — was lief schief und wie reagierten Sie?', 'INTERMEDIATE'),
('mc_prep', 'HANNIE', 'HARD_SKILLS', 'vorbereitung', 'Wie bereiten Sie Skript und Improvisation vor? Konkretes Event.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- DEFAULT — general fallback questions (used by the generic interviewer persona)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('gen_responsibility', 'DEFAULT', 'HARD_SKILLS', 'verantwortung', 'Welche Verantwortung hatten Sie zuletzt für diese Position — messbares Ergebnis?', 'INTERMEDIATE'),
('gen_quality',        'DEFAULT', 'HARD_SKILLS', 'qualitaet',     'Wie sichern Sie Qualität im Alltag? Ein konkreter Ablauf, kein Theorieblock.', 'INTERMEDIATE'),
('gen_team',           'DEFAULT', 'HARD_SKILLS', 'team',          'Wie arbeiten Sie mit anderen Rollen zusammen? Nennen Sie Namen/Rollen und einen Konflikt oder Erfolg.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;
