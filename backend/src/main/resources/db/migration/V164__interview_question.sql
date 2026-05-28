-- Interview question bank: DB-backed store for curated questions per persona and phase
CREATE TABLE IF NOT EXISTS interview_question (
    id           VARCHAR(100) PRIMARY KEY,         -- e.g. "lukas_tech_arch_001"
    persona_code VARCHAR(32)  NOT NULL,             -- FK to interview_persona.code
    phase        VARCHAR(30)  NOT NULL,             -- INTRO | ICE_BREAKER | HARD_SKILLS | STAR_SOFT | CLOSING
    topic_key    VARCHAR(80)  NOT NULL,             -- e.g. "architecture", "teamwork", "hygiene"
    question_de  TEXT         NOT NULL,
    industry     VARCHAR(100),                      -- optional industry override
    difficulty   VARCHAR(20)  NOT NULL DEFAULT 'INTERMEDIATE',
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    version      INT          NOT NULL DEFAULT 1,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iq_persona_phase ON interview_question (persona_code, phase, active);

-- Seed common questions (shared across all personas)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('common_intro_self',          'DEFAULT', 'INTRO',       'intro',       'Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung und Ihr nächster Schritt.',             'BEGINNER'),
('common_ice_motivation',      'DEFAULT', 'ICE_BREAKER', 'motivation',  'Was hat Sie besonders an dieser Position interessiert?',                                                'BEGINNER'),
('common_ice_typical_day',     'DEFAULT', 'ICE_BREAKER', 'routine',     'Beschreiben Sie einen typischen Arbeitstag in Ihrer letzten Stelle — konkret und chronologisch.',       'INTERMEDIATE'),
('common_ice_found_role',      'DEFAULT', 'ICE_BREAKER', 'motivation',  'Wie sind Sie auf diese Stelle aufmerksam geworden, und was erwarten Sie vom Team?',                     'BEGINNER'),
('common_star_conflict',       'DEFAULT', 'STAR_SOFT',   'team',        'Nennen Sie einen Konflikt im Team: Situation, Ihre Aufgabe, Ihre Handlung und das Ergebnis.',           'INTERMEDIATE'),
('common_star_stress',         'DEFAULT', 'STAR_SOFT',   'stress',      'Beschreiben Sie eine stressige Situation mit Zeitdruck — was genau haben Sie getan und was war das Ergebnis?', 'INTERMEDIATE'),
('common_star_mistake',        'DEFAULT', 'STAR_SOFT',   'fehler',      'Erzählen Sie von einem Fehler bei der Arbeit: wie entdeckt, wie behoben, was haben Sie daraus gelernt?', 'INTERMEDIATE'),
('common_close_ask',           'DEFAULT', 'CLOSING',     'closing',     'Haben Sie noch Fragen an uns?',                                                                          'BEGINNER')
ON CONFLICT (id) DO NOTHING;

-- LUKAS — IT / Tech
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('lukas_intro_tech',           'LUKAS', 'INTRO',        'intro',       'Bitte stellen Sie sich kurz vor und beschreiben Sie Ihr technisches Profil in zwei Sätzen.',             'INTERMEDIATE'),
('lukas_ice_project',          'LUKAS', 'ICE_BREAKER',  'project',     'Welches System oder Feature haben Sie zuletzt gebaut oder verbessert?',                                  'INTERMEDIATE'),
('lukas_hard_arch',            'LUKAS', 'HARD_SKILLS',  'architecture','Beschreiben Sie eine Architekturentscheidung, die Sie getroffen haben — Trade-offs und Ergebnis.',       'ADVANCED'),
('lukas_hard_debug',           'LUKAS', 'HARD_SKILLS',  'debugging',   'Nennen Sie einen schwierigen Bug, den Sie debuggt haben — Vorgehen, Root Cause, Fix.',                  'ADVANCED'),
('lukas_hard_collab',          'LUKAS', 'HARD_SKILLS',  'teamwork',    'Wie haben Sie mit einem nicht-technischen Stakeholder eine technische Anforderung geklärt?',             'INTERMEDIATE'),
('lukas_hard_scale',           'LUKAS', 'HARD_SKILLS',  'scalability', 'Wie haben Sie ein System unter Last stabilisiert oder skaliert — konkrete Maßnahmen und Ergebnisse?',   'ADVANCED'),
('lukas_star_conflict',        'LUKAS', 'STAR_SOFT',    'team',        'Beschreiben Sie einen Technologiekonflikt im Team: verschiedene Meinungen, Ihre Rolle, Ergebnis.',       'ADVANCED'),
('lukas_star_deadline',        'LUKAS', 'STAR_SOFT',    'deadline',    'Erzählen Sie von einem engen Deadline-Projekt: Entscheidungen unter Druck, was haben Sie geopfert?',    'ADVANCED')
ON CONFLICT (id) DO NOTHING;

-- EMMA — Business
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('emma_intro_biz',             'EMMA', 'INTRO',         'intro',       'Stellen Sie sich vor und erläutern Sie kurz, welchen Mehrwert Sie für dieses Team mitbringen.',          'BEGINNER'),
('emma_ice_role',              'EMMA', 'ICE_BREAKER',   'motivation',  'Beschreiben Sie Ihre aktuelle Rolle und was Sie zu einem Wechsel bewogen hat.',                          'INTERMEDIATE'),
('emma_hard_negotiation',      'EMMA', 'HARD_SKILLS',   'negotiation', 'Erzählen Sie von einer Verhandlung — Ziel, Vorbereitung, Ergebnis.',                                    'INTERMEDIATE'),
('emma_hard_kpi',              'EMMA', 'HARD_SKILLS',   'metrics',     'Wie haben Sie in Ihrer letzten Rolle KPIs definiert und verfolgt?',                                      'ADVANCED'),
('emma_star_client',           'EMMA', 'STAR_SOFT',     'client',      'Beschreiben Sie einen schwierigen Kundenkontakt: Situation, Ihre Lösung, Ergebnis.',                     'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- ANNA — Education / Career
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('anna_intro_edu',             'ANNA', 'INTRO',         'intro',       'Bitte stellen Sie sich vor: Ausbildung, bisherige Stationen und Ihre Stärken.',                         'BEGINNER'),
('anna_ice_motivation_edu',    'ANNA', 'ICE_BREAKER',   'motivation',  'Warum interessieren Sie sich gerade jetzt für diese Stelle?',                                           'BEGINNER'),
('anna_hard_class',            'ANNA', 'HARD_SKILLS',   'teaching',    'Beschreiben Sie eine Unterrichtssituation, die Sie besonders herausgefordert hat — Lösung und Ergebnis.','INTERMEDIATE'),
('anna_hard_learning',         'ANNA', 'HARD_SKILLS',   'learning',    'Wie bleiben Sie in Ihrem Fachgebiet aktuell? Nennen Sie ein konkretes Beispiel.',                       'INTERMEDIATE'),
('anna_star_difficult_student','ANNA', 'STAR_SOFT',     'teamwork',    'Erzählen Sie von einem schwierigen Schüler oder Teilnehmer und wie Sie damit umgegangen sind.',          'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- KLAUS — Gastronomy
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('klaus_intro_gastro',         'KLAUS', 'INTRO',        'intro',       'Stellen Sie sich vor: Stationen, Küchentypen und Ihre Spezialität.',                                    'BEGINNER'),
('klaus_ice_station',          'KLAUS', 'ICE_BREAKER',  'routine',     'Beschreiben Sie Ihren typischen Arbeitstag in der Küche — von Mise en Place bis Service.',              'INTERMEDIATE'),
('klaus_hard_haccp',           'KLAUS', 'HARD_SKILLS',  'hygiene',     'Nennen Sie einen Vorfall, bei dem Hygiene oder Qualität gefährdet war — was haben Sie getan?',          'INTERMEDIATE'),
('klaus_hard_rush',            'KLAUS', 'HARD_SKILLS',  'pressure',    'Wie organisieren Sie Ihren Posten bei vollem Haus mit 200 Covers? Konkretes Beispiel.',                 'ADVANCED'),
('klaus_hard_seasonal',        'KLAUS', 'HARD_SKILLS',  'quality',     'Wie gehen Sie mit saisonalen Zutaten und wechselnden Menüs um?',                                        'INTERMEDIATE'),
('klaus_star_team',            'KLAUS', 'STAR_SOFT',    'team',        'Beschreiben Sie eine Situation, in der Ihr Team unter Druck fast zusammengebrochen ist — Ihre Rolle.',  'ADVANCED')
ON CONFLICT (id) DO NOTHING;

-- HEALTHCARE personas (WEBER, SARAH, SCHNEIDER)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('weber_intro_skin',           'WEBER', 'INTRO',        'intro',       'Stellen Sie sich vor: medizinischer Werdegang, Fachgebiet Dermatologie, besondere Kompetenzen.',       'INTERMEDIATE'),
('weber_hard_hygiene',         'WEBER', 'HARD_SKILLS',  'hygiene',     'Nennen Sie einen Vorfall in der Praxis, bei dem Hygienestandards gefährdet waren — Ihre Maßnahmen.',   'ADVANCED'),
('weber_hard_patient',         'WEBER', 'HARD_SKILLS',  'empathy',     'Wie gehen Sie mit einem verängstigten oder unkooperativen Patienten um? Konkretes Beispiel.',          'INTERMEDIATE'),
('sarah_intro_mfa',            'SARAH', 'INTRO',        'intro',       'Stellen Sie sich vor: Ausbildung, bisherige Praxen, Hauptaufgaben.',                                   'BEGINNER'),
('sarah_hard_appt',            'SARAH', 'HARD_SKILLS',  'scheduling',  'Wie managen Sie einen vollen Terminkalender bei gleichzeitig wartenden Notfallpatienten?',             'INTERMEDIATE'),
('sarah_hard_document',        'SARAH', 'HARD_SKILLS',  'documentation','Beschreiben Sie, wie Sie Patientenakten dokumentieren — Genauigkeit und Datenschutz.',                'INTERMEDIATE'),
('schneider_intro_eye',        'SCHNEIDER', 'INTRO',    'intro',       'Stellen Sie sich vor: ophthalmologischer Hintergrund und Ihre Erfahrung mit Sehtests.',                'INTERMEDIATE'),
('schneider_hard_test',        'SCHNEIDER', 'HARD_SKILLS','diagnostics','Beschreiben Sie Ihren Ablauf bei einem Sehtest — Vorbereitung, Durchführung, Dokumentation.',         'ADVANCED'),
('schneider_hard_lenses',      'SCHNEIDER', 'HARD_SKILLS','optometry',  'Wie beraten Sie einen Patienten, der zum ersten Mal Kontaktlinsen tragen möchte?',                   'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;

-- OPERATIONS personas (MAX, OLIVER)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('max_intro_ops',              'MAX', 'INTRO',           'intro',       'Stellen Sie sich vor: Maschinentypen, bisherige Betriebe, Hauptaufgaben.',                             'BEGINNER'),
('max_hard_safety',            'MAX', 'HARD_SKILLS',     'safety',      'Nennen Sie einen Sicherheitsvorfall oder Beinaheunfall — was haben Sie getan?',                        'INTERMEDIATE'),
('max_hard_maintenance',       'MAX', 'HARD_SKILLS',     'maintenance', 'Beschreiben Sie eine geplante Wartung: Schritte, Dokumentation, Wiederzulassung.',                    'INTERMEDIATE'),
('max_hard_troubleshoot',      'MAX', 'HARD_SKILLS',     'troubleshooting','Eine Maschine fällt während der Schicht aus — Ihr Vorgehen Schritt für Schritt.',                  'ADVANCED'),
('oliver_intro_cnc',           'OLIVER', 'INTRO',        'intro',       'Stellen Sie sich vor: CNC-Erfahrung, Maschinen, Materialien, Branchen.',                              'INTERMEDIATE'),
('oliver_hard_program',        'OLIVER', 'HARD_SKILLS',  'programming', 'Beschreiben Sie, wie Sie ein CNC-Programm aus einer technischen Zeichnung erstellen.',               'ADVANCED'),
('oliver_hard_tolerance',      'OLIVER', 'HARD_SKILLS',  'quality',     'Wie stellen Sie sicher, dass Werkstücke die geforderten Toleranzen einhalten?',                       'ADVANCED')
ON CONFLICT (id) DO NOTHING;

-- SERVICE personas (NIKLAS, NINA)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('niklas_intro_service',       'NIKLAS', 'INTRO',        'intro',       'Stellen Sie sich vor: Serviceerfahrung, Restauranttypen, Lieblingsaufgaben.',                         'BEGINNER'),
('niklas_hard_order',          'NIKLAS', 'HARD_SKILLS',  'service',     'Sie haben gleichzeitig drei Tische, eine Beschwerde und einen Notfall — wie priorisieren Sie?',       'ADVANCED'),
('niklas_hard_complaint',      'NIKLAS', 'HARD_SKILLS',  'complaints',  'Ein Gast ist unzufrieden mit seinem Gericht — Ihre genaue Vorgehensweise.',                           'INTERMEDIATE'),
('nina_intro_hotel',           'NINA', 'INTRO',          'intro',       'Stellen Sie sich vor: Hotelerfahrung, Rezeptionsaufgaben, Ihre Stärken.',                             'BEGINNER'),
('nina_hard_checkin',          'NINA', 'HARD_SKILLS',    'checkin',     'Beschreiben Sie Ihren Check-in-Ablauf bei Ankunft mehrerer Gruppen gleichzeitig.',                    'INTERMEDIATE'),
('nina_hard_complaint_hotel',  'NINA', 'HARD_SKILLS',    'complaints',  'Ein Gast beschwert sich über sein Zimmer um 23 Uhr — Schritt für Schritt Ihr Vorgehen.',              'ADVANCED')
ON CONFLICT (id) DO NOTHING;

-- MEDIA persona (HANNIE)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('hannie_intro_media',         'HANNIE', 'INTRO',        'intro',       'Stellen Sie sich vor: Moderationserfahrung, Formate, Ihr bevorzugtes Publikum.',                     'INTERMEDIATE'),
('hannie_hard_live',           'HANNIE', 'HARD_SKILLS',  'live',        'Beschreiben Sie eine Live-Situation, in der etwas schiefgelaufen ist — Ihre Reaktion.',               'ADVANCED'),
('hannie_hard_improv',         'HANNIE', 'HARD_SKILLS',  'improvisation','Ein Gast sagt seinen Auftritt kurzfristig ab. Wie füllen Sie die Zeit spontan?',                   'ADVANCED'),
('hannie_hard_audience',       'HANNIE', 'HARD_SKILLS',  'audience',    'Wie passen Sie Ihren Stil und Ton für verschiedene Zielgruppen an? Konkretes Beispiel.',              'INTERMEDIATE'),
('hannie_star_pressure',       'HANNIE', 'STAR_SOFT',    'pressure',    'Erzählen Sie von einer Moderation unter extremem Druck — Situation, Ihre Handlung, Ergebnis.',       'ADVANCED')
ON CONFLICT (id) DO NOTHING;

-- RETAIL personas (LENA, THOMAS, PETRA)
INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('lena_intro_retail',          'LENA', 'INTRO',          'intro',       'Stellen Sie sich vor: Erfahrung im Einzelhandel, Hauptaufgaben, Ihre Stärken.',                       'BEGINNER'),
('lena_hard_customer',         'LENA', 'HARD_SKILLS',    'customer',    'Ein Kunde ist unzufrieden und verlangt nach dem Chef — was tun Sie zuerst?',                          'INTERMEDIATE'),
('lena_hard_rush',             'LENA', 'HARD_SKILLS',    'pressure',    'Beschreiben Sie einen stressigen Einkaufssamstag — wie organisieren Sie Ihre Arbeit?',                'INTERMEDIATE'),
('thomas_intro_bakery',        'THOMAS', 'INTRO',        'intro',       'Stellen Sie sich vor: Bäckerausbildung, bisherige Stationen, Spezialitäten.',                         'BEGINNER'),
('thomas_hard_hygiene_bak',    'THOMAS', 'HARD_SKILLS',  'hygiene',     'Welche HACCP-Maßnahmen wenden Sie täglich in der Bäckerei an? Konkretes Beispiel.',                  'INTERMEDIATE'),
('petra_intro_butcher',        'PETRA', 'INTRO',         'intro',       'Stellen Sie sich vor: Metzgerausbildung, Fachkenntnisse, bisherige Arbeitgeber.',                     'BEGINNER'),
('petra_hard_hygiene_meat',    'PETRA', 'HARD_SKILLS',   'hygiene',     'Beschreiben Sie Ihre Hygienepraxis beim Umgang mit Fleisch und Geflügel.',                            'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;
