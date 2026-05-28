-- V171: Extend interview question bank — Phase 3
-- Adds STAR_SOFT and CLOSING phase questions for all existing persona groups,
-- and adds question coverage for Media and Education industries.

-- ─── IT / Backend (WEBER) — STAR_SOFT ───────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('weber-star-1', 'WEBER', 'STAR_SOFT', 'teamwork',
 'Erzählen Sie von einer Situation, in der Sie in einem schwierigen Teamprojekt eine wichtige Rolle gespielt haben.',
 'IT', 2, true, 1),
('weber-star-2', 'WEBER', 'STAR_SOFT', 'conflict',
 'Wie sind Sie vorgegangen, als Sie mit einem Kollegen eine technische Meinungsverschiedenheit hatten?',
 'IT', 2, true, 1),
('weber-star-3', 'WEBER', 'STAR_SOFT', 'deadline',
 'Beschreiben Sie eine Situation, in der Sie trotz Zeitdruck eine komplexe Aufgabe erfolgreich abgeschlossen haben.',
 'IT', 3, true, 1);

-- ─── IT / Backend (WEBER) — CLOSING ─────────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('weber-close-1', 'WEBER', 'CLOSING', 'motivation',
 'Warum möchten Sie speziell bei unserem Unternehmen als Backend-Entwickler arbeiten?',
 'IT', 1, true, 1),
('weber-close-2', 'WEBER', 'CLOSING', 'salary',
 'Welche Gehaltsvorstellungen haben Sie für diese Position?',
 'IT', 2, true, 1),
('weber-close-3', 'WEBER', 'CLOSING', 'questions',
 'Haben Sie noch Fragen an mich oder an unser Unternehmen?',
 'IT', 1, true, 1);

-- ─── Healthcare (SARAH) — STAR_SOFT ─────────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('sarah-star-1', 'SARAH', 'STAR_SOFT', 'patient_care',
 'Erzählen Sie von einer Situation, in der Sie trotz hohem Stress einem Patienten besonders gut helfen konnten.',
 'Healthcare', 2, true, 1),
('sarah-star-2', 'SARAH', 'STAR_SOFT', 'teamwork',
 'Wie haben Sie in einem interdisziplinären Team eine schwierige Entscheidung mitgetragen?',
 'Healthcare', 3, true, 1),
('sarah-star-3', 'SARAH', 'STAR_SOFT', 'error_handling',
 'Beschreiben Sie eine Situation, in der ein Fehler passiert ist und wie Sie damit umgegangen sind.',
 'Healthcare', 3, true, 1);

-- ─── Healthcare (SARAH) — CLOSING ────────────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('sarah-close-1', 'SARAH', 'CLOSING', 'motivation',
 'Was hat Sie dazu bewogen, in der Pflege zu arbeiten, und was treibt Sie weiter an?',
 'Healthcare', 1, true, 1),
('sarah-close-2', 'SARAH', 'CLOSING', 'availability',
 'Sind Sie bereit, Schichtdienst und Wochenendarbeit zu übernehmen?',
 'Healthcare', 1, true, 1),
('sarah-close-3', 'SARAH', 'CLOSING', 'questions',
 'Gibt es etwas, das Sie über unsere Einrichtung oder das Team noch wissen möchten?',
 'Healthcare', 1, true, 1);

-- ─── Gastronomy (THOMAS / PETRA) — STAR_SOFT ─────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('thomas-star-1', 'THOMAS', 'STAR_SOFT', 'guest_complaint',
 'Schildern Sie eine Situation, in der ein Gast unzufrieden war und wie Sie das gelöst haben.',
 'Gastronomy', 2, true, 1),
('thomas-star-2', 'THOMAS', 'STAR_SOFT', 'rush_hour',
 'Erzählen Sie von einem besonders stressigen Abend und wie Ihr Team die Situation gemeistert hat.',
 'Gastronomy', 2, true, 1),
('petra-star-1', 'PETRA', 'STAR_SOFT', 'menu_knowledge',
 'Wie haben Sie einem Gast geholfen, der besondere Ernährungsbedürfnisse hatte?',
 'Gastronomy', 1, true, 1);

-- ─── Gastronomy — CLOSING ────────────────────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
('thomas-close-1', 'THOMAS', 'CLOSING', 'shift',
 'Können Sie auch Abend- und Wochenenddienste übernehmen?',
 'Gastronomy', 1, true, 1),
('thomas-close-2', 'THOMAS', 'CLOSING', 'motivation',
 'Warum möchten Sie in unserer Restaurantkette arbeiten?',
 'Gastronomy', 1, true, 1),
('petra-close-1', 'PETRA', 'CLOSING', 'growth',
 'Wo sehen Sie sich in zwei Jahren in der Gastronomie?',
 'Gastronomy', 2, true, 1);

-- ─── Media (NIKLAS / NINA) — All phases ──────────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
-- INTRO
('niklas-intro-1', 'NIKLAS', 'INTRO', 'self_intro',
 'Stellen Sie sich kurz vor und erklären Sie, warum Sie sich für Medien und Kommunikation entschieden haben.',
 'Media', 1, true, 1),
('nina-intro-1', 'NINA', 'INTRO', 'self_intro',
 'Guten Tag! Erzählen Sie mir etwas über Ihren Hintergrund im Bereich Marketing oder PR.',
 'Media', 1, true, 1),
-- ICE_BREAKER
('niklas-ice-1', 'NIKLAS', 'ICE_BREAKER', 'media_trend',
 'Welche aktuellen Trends in der Medienbranche finden Sie besonders interessant?',
 'Media', 2, true, 1),
('nina-ice-1', 'NINA', 'ICE_BREAKER', 'campaign',
 'Erinnern Sie sich an eine Marketing-Kampagne, die Sie wirklich beeindruckt hat? Was war daran besonders?',
 'Media', 2, true, 1),
-- HARD_SKILLS
('niklas-hard-1', 'NIKLAS', 'HARD_SKILLS', 'content_creation',
 'Welche Tools nutzen Sie für Content-Erstellung und -Planung?',
 'Media', 2, true, 1),
('niklas-hard-2', 'NIKLAS', 'HARD_SKILLS', 'seo',
 'Wie gehen Sie bei der SEO-Optimierung eines Artikels vor?',
 'Media', 3, true, 1),
('nina-hard-1', 'NINA', 'HARD_SKILLS', 'analytics',
 'Wie messen Sie den Erfolg einer Social-Media-Kampagne?',
 'Media', 2, true, 1),
('nina-hard-2', 'NINA', 'HARD_SKILLS', 'budget',
 'Haben Sie Erfahrung mit der Verwaltung von Werbebudgets? Erklären Sie Ihr Vorgehen.',
 'Media', 3, true, 1),
-- STAR_SOFT
('niklas-star-1', 'NIKLAS', 'STAR_SOFT', 'deadline',
 'Beschreiben Sie, wie Sie einen knappen Abgabetermin für einen wichtigen Content erfüllt haben.',
 'Media', 2, true, 1),
('nina-star-1', 'NINA', 'STAR_SOFT', 'crisis_comm',
 'Haben Sie schon einmal eine Krisenkommunikation gehandhabt? Wie sind Sie vorgegangen?',
 'Media', 3, true, 1),
-- CLOSING
('niklas-close-1', 'NIKLAS', 'CLOSING', 'motivation',
 'Was fasziniert Sie an unserer Redaktion und unserem Content-Ansatz?',
 'Media', 1, true, 1),
('nina-close-1', 'NINA', 'CLOSING', 'questions',
 'Haben Sie Fragen zu unserem Team oder zu den laufenden Kampagnen?',
 'Media', 1, true, 1);

-- ─── Education (LENA / OLIVER) — All phases ──────────────────────────────────
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, industry, difficulty, active, version) VALUES
-- INTRO
('lena-intro-1', 'LENA', 'INTRO', 'self_intro',
 'Hallo! Bitte stellen Sie sich vor und erzählen Sie, was Sie in den Bildungsbereich geführt hat.',
 'Education', 1, true, 1),
('oliver-intro-1', 'OLIVER', 'INTRO', 'self_intro',
 'Schön, Sie kennenzulernen. Erklären Sie Ihren pädagogischen Hintergrund und Ihre bisherigen Erfahrungen.',
 'Education', 1, true, 1),
-- ICE_BREAKER
('lena-ice-1', 'LENA', 'ICE_BREAKER', 'teaching_philosophy',
 'Wie würden Sie Ihren Unterrichtsstil in einem Satz beschreiben?',
 'Education', 1, true, 1),
('oliver-ice-1', 'OLIVER', 'ICE_BREAKER', 'classroom',
 'Was ist Ihrer Meinung nach die größte Herausforderung in einem modernen Klassenzimmer?',
 'Education', 2, true, 1),
-- HARD_SKILLS
('lena-hard-1', 'LENA', 'HARD_SKILLS', 'differentiation',
 'Wie differenzieren Sie Ihren Unterricht für Schülerinnen und Schüler mit unterschiedlichem Lernstand?',
 'Education', 3, true, 1),
('lena-hard-2', 'LENA', 'HARD_SKILLS', 'assessment',
 'Welche Bewertungsmethoden verwenden Sie und warum?',
 'Education', 2, true, 1),
('oliver-hard-1', 'OLIVER', 'HARD_SKILLS', 'curriculum',
 'Wie planen Sie eine Unterrichtseinheit von der Lehrplananalyse bis zur Durchführung?',
 'Education', 3, true, 1),
('oliver-hard-2', 'OLIVER', 'HARD_SKILLS', 'digital_tools',
 'Welche digitalen Werkzeuge setzen Sie im Unterricht ein und wie integrieren Sie diese sinnvoll?',
 'Education', 2, true, 1),
-- STAR_SOFT
('lena-star-1', 'LENA', 'STAR_SOFT', 'difficult_student',
 'Erzählen Sie von einem schwierigen Schüler oder einer schwierigen Klasse und wie Sie damit umgegangen sind.',
 'Education', 2, true, 1),
('oliver-star-1', 'OLIVER', 'STAR_SOFT', 'parent_conflict',
 'Beschreiben Sie eine herausfordernde Situation mit Eltern und wie Sie diese gelöst haben.',
 'Education', 3, true, 1),
-- CLOSING
('lena-close-1', 'LENA', 'CLOSING', 'motivation',
 'Warum möchten Sie an unserer Schule unterrichten?',
 'Education', 1, true, 1),
('oliver-close-1', 'OLIVER', 'CLOSING', 'questions',
 'Was möchten Sie noch über unsere Schulgemeinde oder das Kollegium erfahren?',
 'Education', 1, true, 1);

-- ─── Rubric templates for Media and Education industries ─────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json, version, active) VALUES
('Media', 'CONTENT', 'A2-B2', 'OVERALL',
 '{"creativity":{"description":"Kreativität und Originalität der Ideen"},"communication":{"description":"Klare und überzeugende Kommunikation"},"media_literacy":{"description":"Verständnis aktueller Medientrends"},"teamwork":{"description":"Zusammenarbeit in redaktionellen Teams"}}',
 '{"creativity":0.30,"communication":0.30,"media_literacy":0.25,"teamwork":0.15}',
 1, true),

('Education', 'TEACHING', 'A2-B2', 'OVERALL',
 '{"pedagogy":{"description":"Didaktisches Wissen und Unterrichtsgestaltung"},"communication":{"description":"Kommunikation mit Schülern und Eltern"},"differentiation":{"description":"Differenzierung und Inklusion"},"reflection":{"description":"Selbstreflexion und Bereitschaft zur Weiterentwicklung"}}',
 '{"pedagogy":0.35,"communication":0.25,"differentiation":0.25,"reflection":0.15}',
 1, true),

('Media', 'CONTENT', 'A2-B2', 'HARD_SKILLS',
 '{"tools":{"description":"Kenntnisse in Content-Tools und SEO"},"analytics":{"description":"Datengetriebenes Denken"},"content_quality":{"description":"Qualität und Konsistenz der Inhalte"}}',
 '{"tools":0.35,"analytics":0.35,"content_quality":0.30}',
 1, true),

('Education', 'TEACHING', 'A2-B2', 'HARD_SKILLS',
 '{"curriculum_planning":{"description":"Lehrplankonformität und Stundenplanung"},"assessment":{"description":"Bewertungsmethoden"},"digital_competence":{"description":"Einsatz digitaler Lernmittel"}}',
 '{"curriculum_planning":0.40,"assessment":0.35,"digital_competence":0.25}',
 1, true);
