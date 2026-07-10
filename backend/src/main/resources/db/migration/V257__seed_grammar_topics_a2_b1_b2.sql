-- V257: Seed grammar_topics for A2, B1, B2 (Goethe standard)
-- #9 (mobile-bugfix 2026-07-09) part B: the grammar screen now gates topics per CEFR level;
-- only A1 was seeded (V117), so higher levels showed as empty locked sections. This fills the
-- A2/B1/B2 syllabus so a learner sees real topic names under each (dimmed until they reach it).
--
-- Idempotent: ON CONFLICT (topic_code) DO NOTHING — topic_code is UNIQUE (V117). Safe to replay
-- and safe against any codes already present. Exercises are authored separately (teacher/admin
-- flow, grammar_exercises); this seeds the topic catalogue only.

INSERT INTO grammar_topics (cefr_level, topic_code, title_de, title_vi, title_en, description_vi, sort_order) VALUES
-- ── A2 ──────────────────────────────────────────────────────────────────────
('A2', 'PRAETERITUM',           'Präteritum',                          'Thì quá khứ đơn',                  'Simple Past',                    'war, hatte, ging — quá khứ của sein/haben & động từ thường (văn viết)', 1),
('A2', 'WECHSELPRAEPOSITIONEN', 'Wechselpräpositionen',                'Giới từ hai cách (Wo/Wohin)',      'Two-way Prepositions',           'in, an, auf, über, unter, vor, hinter, neben, zwischen + Akk (Wohin?) / Dativ (Wo?)', 2),
('A2', 'DATIV',                 'Der Dativ',                           'Cách Dativ',                       'The Dative Case',                'dem, der, dem, den (Plural +n) — tân ngữ gián tiếp & Dativverben (helfen, danken)', 3),
('A2', 'KOMPARATIV',            'Komparativ & Superlativ',             'So sánh hơn & so sánh nhất',       'Comparative & Superlative',      'schnell → schneller → am schnellsten; gut/besser/am besten; so … wie', 4),
('A2', 'NEBENSATZ_WEIL',        'Nebensätze: weil, dass',              'Mệnh đề phụ với weil, dass',       'Subordinate Clauses (weil, dass)','Liên từ phụ thuộc đẩy động từ chia xuống CUỐI câu', 5),
('A2', 'KONJUNKTIONEN',         'Konjunktionen (und, aber, denn)',     'Liên từ đẳng lập',                 'Coordinating Conjunctions',      'und, aber, oder, denn, sondern — không đổi trật tự câu', 6),
('A2', 'REFLEXIVE_VERBEN',      'Reflexive Verben',                    'Động từ phản thân',                'Reflexive Verbs',                'sich freuen, sich waschen — đại từ phản thân mich/dich/sich', 7),
('A2', 'GENITIV_NAME',          'Genitiv (Namen) & von + Dativ',       'Sở hữu cách cơ bản',               'Basic Genitive (Names)',         'Annas Buch, das Auto von meinem Vater', 8),
('A2', 'ADJEKTIV_DEKLINATION',  'Adjektivdeklination (Nom/Akk)',       'Chia đuôi tính từ (Nom/Akk)',      'Adjective Endings (Nom/Acc)',    'ein guter Mann, den kleinen Hund — đuôi tính từ sau mạo từ', 9),
('A2', 'MODALVERBEN_PRAET',     'Modalverben im Präteritum',           'Động từ khiếm khuyết ở quá khứ',   'Modal Verbs (Past)',             'konnte, musste, wollte, durfte, sollte', 10),
('A2', 'PERFEKT_TRENNBAR',      'Perfekt (trennbar/unregelmäßig)',     'Perfekt nâng cao',                 'Perfect (separable/irregular)',   'aufgestanden, eingekauft; gefahren (sein) vs. gegessen (haben)', 11),
('A2', 'FUTUR_I',               'Futur I',                             'Thì tương lai I',                  'Future Tense',                   'werden + Infinitiv — dự định & dự đoán', 12),
('A2', 'IMPERATIV_HOEFLICH',    'Imperativ (du/ihr/Sie)',              'Câu mệnh lệnh đầy đủ',             'Imperative (all forms)',         'Komm! Kommt! Kommen Sie! — kể cả động từ bất quy tắc', 13),
('A2', 'PRONOMEN_DATIV',        'Personalpronomen im Dativ',           'Đại từ nhân xưng (Dativ)',         'Personal Pronouns (Dative)',     'mir, dir, ihm, ihr, uns, euch, ihnen', 14),
-- ── B1 ──────────────────────────────────────────────────────────────────────
('B1', 'KONJUNKTIV_II',         'Konjunktiv II (würde/könnte/hätte)',  'Thức giả định II (lịch sự & giả thiết)','Subjunctive II',            'würde + Infinitiv, hätte/wäre/könnte — lời khuyên, mong ước, lịch sự', 1),
('B1', 'PASSIV',                'Passiv (Präsens & Präteritum)',       'Câu bị động',                      'Passive Voice',                  'werden + Partizip II; von + Dativ (tác nhân)', 2),
('B1', 'RELATIVSAETZE',         'Relativsätze',                        'Mệnh đề quan hệ',                  'Relative Clauses',               'der/die/das, dessen/deren — bổ nghĩa danh từ', 3),
('B1', 'NEBENSATZ_WENN_ALS',    'Temporale Nebensätze (wenn/als)',     'Mệnh đề thời gian',                'Temporal Clauses',               'wenn (lặp/hiện tại), als (một lần trong quá khứ), während, bevor, nachdem', 4),
('B1', 'GENITIV',               'Der Genitiv',                         'Sở hữu cách',                      'The Genitive Case',              'des Mannes, der Frau; wegen, während, trotz + Genitiv', 5),
('B1', 'ADJEKTIV_KOMPLETT',     'Adjektivdeklination (alle Fälle)',    'Chia đuôi tính từ (đủ 4 cách)',    'Adjective Endings (all cases)',  'Bảng đuôi đầy đủ: có/không mạo từ, 3 giống + số nhiều', 6),
('B1', 'INFINITIV_ZU',          'Infinitiv mit zu',                    'Cấu trúc zu + Infinitiv',          'Infinitive with zu',             'Es ist wichtig, pünktlich zu sein; Ich habe vor, zu …', 7),
('B1', 'FINALSATZ',             'Finalsätze (damit / um … zu)',        'Mệnh đề mục đích',                 'Purpose Clauses',                'um … zu (cùng chủ ngữ) vs. damit (khác chủ ngữ)', 8),
('B1', 'KAUSAL_KONZESSIV',      'Kausal- & Konzessivsätze',            'Mệnh đề nguyên nhân & nhượng bộ',  'Causal & Concessive Clauses',    'weil/da (nguyên nhân), obwohl (nhượng bộ)', 9),
('B1', 'VERBEN_PRAEPOSITION',   'Verben mit Präpositionen',            'Động từ đi với giới từ cố định',   'Verbs with Prepositions',        'warten auf +Akk, denken an +Akk, teilnehmen an +Dativ', 10),
('B1', 'N_DEKLINATION',         'N-Deklination',                       'Danh từ yếu (N-Deklination)',      'Weak Nouns',                     'der Junge → den/dem/des Jungen; Kunde, Mensch, Student', 11),
('B1', 'KONNEKTOREN',           'Konnektoren (deshalb/trotzdem)',      'Trạng từ liên kết',                'Adverbial Connectors',           'deshalb, deswegen, trotzdem, sonst, dann — chiếm vị trí 1', 12),
('B1', 'PLUSQUAMPERFEKT',       'Plusquamperfekt',                     'Thì quá khứ hoàn thành',           'Past Perfect',                   'hatte/war + Partizip II — hành động xảy ra trước (kết hợp nachdem)', 13),
('B1', 'INDIREKTE_FRAGE',       'Indirekte Fragen (ob / W-Wort)',      'Câu hỏi gián tiếp',                'Indirect Questions',             'Ich weiß nicht, ob … / wann … — động từ ở cuối', 14),
-- ── B2 ──────────────────────────────────────────────────────────────────────
('B2', 'KONJUNKTIV_I',          'Konjunktiv I (indirekte Rede)',       'Thức giả định I (lời nói gián tiếp)','Subjunctive I',              'Er sagt, er sei/habe/komme — văn báo chí, tường thuật', 1),
('B2', 'PASSIV_MODAL',          'Passiv mit Modalverben & Zustandspassiv','Bị động nâng cao',              'Passive (modal & stative)',      'muss gemacht werden; Zustandspassiv: ist geschlossen', 2),
('B2', 'PARTIZIP_ATTRIBUT',     'Partizipialattribute (P I & P II)',   'Định ngữ phân từ',                 'Participial Attributes',         'die lachenden Kinder (P I), das gekochte Ei (P II)', 3),
('B2', 'NOMINALISIERUNG',       'Nominalisierung & Verbalisierung',    'Danh từ hoá & động từ hoá',        'Nominalisation',                 'Chuyển mệnh đề ↔ cụm danh từ: weil er … → wegen seines …', 4),
('B2', 'KONNEKTOREN_ADVERBIAL', 'Konnektoren (dennoch/folglich/indem)','Liên kết văn phong',               'Advanced Connectors',            'dennoch, folglich, indem, sofern, je … desto', 5),
('B2', 'FUTUR_II',              'Futur II & Vermutung',                'Tương lai hoàn thành & phỏng đoán','Future Perfect / Assumption',    'wird … gemacht haben; Vermutung: Er wird wohl … sein', 6),
('B2', 'RELATIVSATZ_WO',        'Relativsätze (wo/was/wer + Präp.)',   'Mệnh đề quan hệ nâng cao',         'Advanced Relative Clauses',      'das, was …; der Ort, wo …; mit dem/der …; wovon, worüber', 7),
('B2', 'KONJUNKTIV_II_VERG',    'Konjunktiv II der Vergangenheit',     'Thức giả định II ở quá khứ',       'Subjunctive II (Past)',          'hätte … gemacht, wäre … gewesen — tiếc nuối, giả thiết quá khứ', 8),
('B2', 'IRREALE_BEDINGUNG',     'Irreale Bedingungssätze',             'Câu điều kiện phi thực',           'Unreal Conditionals',            'Wenn ich Zeit hätte, würde ich …; Wenn ich … gehabt hätte, …', 9),
('B2', 'MODALPARTIKELN',        'Modalpartikeln (doch, mal, ja, eben)','Tiểu từ tình thái',                'Modal Particles',                'doch, mal, ja, eben, halt, wohl — sắc thái khẩu ngữ', 10),
('B2', 'PRAEPOSITIONALADVERB',  'Präpositionaladverbien (darauf/worüber)','Trạng từ giới từ',              'Prepositional Adverbs',          'da(r)- + giới từ (darauf, damit) / wo(r)- (worüber, wovon)', 11),
('B2', 'FUNKTIONSVERBGEFUEGE',  'Funktionsverbgefüge',                 'Cụm động từ chức năng',            'Light-verb Constructions',       'in Frage stellen, zur Verfügung stehen, Bezug nehmen auf', 12)
ON CONFLICT (topic_code) DO NOTHING;
