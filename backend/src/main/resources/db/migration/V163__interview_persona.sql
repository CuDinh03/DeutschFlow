-- Interview persona registry: maps interview-capable personas to their behavioral profile
CREATE TABLE IF NOT EXISTS interview_persona (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,   -- matches SpeakingPersona enum name
    label       VARCHAR(100) NOT NULL,
    industry    VARCHAR(100) NOT NULL,
    role_title  VARCHAR(150) NOT NULL,
    tone        VARCHAR(50)  NOT NULL,           -- e.g. formal, friendly, technical
    difficulty  VARCHAR(20)  NOT NULL,           -- BEGINNER | INTERMEDIATE | ADVANCED
    question_style  VARCHAR(50) NOT NULL,        -- e.g. behavioral, technical, situational
    follow_up_style VARCHAR(50) NOT NULL,        -- e.g. drill, challenge, deepen
    evaluation_bias VARCHAR(100),                -- what this persona weights more
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    version     INT          NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Seed interview-capable personas (bucket: interview-capable now)
INSERT INTO interview_persona (code, label, industry, role_title, tone, difficulty, question_style, follow_up_style, evaluation_bias) VALUES
('LUKAS',    'Lukas — Senior Tech Lead',              'IT / Software',            'Senior Tech Lead',               'technical',  'ADVANCED',     'technical',    'challenge',  'architecture, trade-offs, concrete projects'),
('EMMA',     'Emma — Business Dev Manager',           'Business / Office',        'Business Development Manager',   'friendly',   'INTERMEDIATE', 'behavioral',   'deepen',     'motivation, soft skills, business acumen'),
('ANNA',     'Anna — Career & Education Counselor',  'Education / Career',       'Career Counselor / Educator',    'warm',       'BEGINNER',     'behavioral',   'deepen',     'motivation, planning, learning habits'),
('KLAUS',    'Klaus — Head Chef',                     'Gastronomy',               'Küchenchef / Head Chef',         'direct',     'INTERMEDIATE', 'situational',  'challenge',  'mise en place, HACCP, rush-hour handling'),
('WEBER',    'Dr. Weber — Dermatologist',             'Healthcare / Dermatology', 'Dermatologin',                   'formal',     'ADVANCED',     'situational',  'probe',      'hygiene, patient empathy, documentation'),
('SARAH',    'Sarah — Medical Assistant',             'Healthcare / General',     'Medizinische Fachangestellte',   'formal',     'INTERMEDIATE', 'situational',  'probe',      'patient handling, scheduling, hygiene'),
('SCHNEIDER','Dr. Schneider — Ophthalmologist',       'Healthcare / Ophthalmology','Augenarzt',                     'formal',     'ADVANCED',     'situational',  'probe',      'precision, patient communication, diagnostics'),
('LENA',     'Lena — Retail Sales Associate',         'Retail / Verkauf',         'Supermarktmitarbeiterin',        'friendly',   'BEGINNER',     'situational',  'deepen',     'customer handling, accuracy, teamwork'),
('THOMAS',   'Thomas — Baker',                        'Retail / Bäckerei',        'Bäcker',                         'friendly',   'BEGINNER',     'situational',  'deepen',     'quality, hygiene, rush handling'),
('PETRA',    'Petra — Butcher',                       'Retail / Metzgerei',       'Metzger',                        'direct',     'BEGINNER',     'situational',  'deepen',     'hygiene, product knowledge, customer service'),
('MAX',      'Max — Machine Operator',                'Operations / Maschinenbau','Maschinenbediener',              'direct',     'INTERMEDIATE', 'technical',    'probe',      'safety, maintenance, troubleshooting'),
('OLIVER',   'Oliver — CNC Machinist',                'Operations / CNC',         'CNC-Fräser',                     'direct',     'ADVANCED',     'technical',    'probe',      'precision, program reading, quality control'),
('NIKLAS',   'Niklas — Waiter',                       'Service / Restaurant',     'Kellner',                        'friendly',   'BEGINNER',     'situational',  'deepen',     'guest handling, speed, complaints'),
('NINA',     'Nina — Hotel Receptionist',             'Service / Hotel',          'Rezeptionistin',                 'formal',     'INTERMEDIATE', 'situational',  'deepen',     'check-in, reservation, professionalism'),
('HANNIE',   'Hannie — MC / Moderator',               'Media / Entertainment',    'Moderatorin / MC',               'energetic',  'INTERMEDIATE', 'behavioral',   'challenge',  'live pressure, improvisation, stage presence')
ON CONFLICT (code) DO NOTHING;
