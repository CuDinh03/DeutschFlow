-- Ordered beginner journey items for day-1 / week-1 experience
CREATE TABLE beginner_journey_items (
    id             BIGSERIAL PRIMARY KEY,
    sequence_order INT NOT NULL UNIQUE,
    item_type      VARCHAR(30) NOT NULL, -- VOCABULARY | PHRASE | DIALOGUE_PROMPT
    title_de       VARCHAR(200) NOT NULL,
    title_vi       VARCHAR(200),
    example_de     VARCHAR(500),
    example_vi     VARCHAR(500),
    audio_hint     VARCHAR(200),
    phase          VARCHAR(20) NOT NULL DEFAULT 'FOUNDATION',
    week_number    INT NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Week 1, Day 1: greetings and core self-introduction items
INSERT INTO beginner_journey_items (sequence_order, item_type, title_de, title_vi, example_de, example_vi, audio_hint, phase, week_number) VALUES
(1,  'VOCABULARY',      'Hallo',             'Xin chào',              'Hallo! Wie geht es Ihnen?',                 'Xin chào! Bạn có khỏe không?',          'ha-lo',          'FOUNDATION', 1),
(2,  'PHRASE',          'Guten Morgen',      'Chào buổi sáng',        'Guten Morgen! Schönen Tag noch.',           'Chào buổi sáng! Chúc bạn ngày tốt lành.', 'goo-ten mor-gen', 'FOUNDATION', 1),
(3,  'PHRASE',          'Guten Tag',         'Chào buổi trưa',        'Guten Tag! Wie heißen Sie?',                'Chào buổi trưa! Bạn tên gì?',           'goo-ten tahk',    'FOUNDATION', 1),
(4,  'PHRASE',          'Auf Wiedersehen',   'Tạm biệt',              'Auf Wiedersehen! Bis morgen.',              'Tạm biệt! Hẹn gặp lại ngày mai.',       'owf vee-der-zayn', 'FOUNDATION', 1),
(5,  'VOCABULARY',      'Ich',               'Tôi',                   'Ich bin Anna.',                             'Tôi là Anna.',                           'ikh',             'FOUNDATION', 1),
(6,  'VOCABULARY',      'bin',               'là (tôi là)',           'Ich bin Studentin.',                        'Tôi là sinh viên.',                      'bin',             'FOUNDATION', 1),
(7,  'PHRASE',          'Ich heiße...',      'Tên tôi là...',         'Ich heiße Maria. Und Sie?',                 'Tên tôi là Maria. Còn bạn?',             'ikh high-se',     'FOUNDATION', 1),
(8,  'DIALOGUE_PROMPT', 'Wie heißen Sie?',  'Bạn tên gì?',           'Wie heißen Sie? — Ich heiße Thomas.',       'Bạn tên gì? — Tên tôi là Thomas.',       'vee high-sen zee', 'FOUNDATION', 1),
(9,  'PHRASE',          'Bitte',             'Xin / Làm ơn',          'Bitte, sprechen Sie langsamer.',            'Làm ơn, hãy nói chậm hơn.',             'bit-te',          'FOUNDATION', 1),
(10, 'PHRASE',          'Danke schön',       'Cảm ơn rất nhiều',      'Danke schön! Das ist sehr nett.',           'Cảm ơn rất nhiều! Thật tuyệt vời.',     'dank-e shern',    'FOUNDATION', 1);
