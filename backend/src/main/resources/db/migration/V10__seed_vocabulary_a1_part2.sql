-- ============================================================
-- V10: SEED A1 VOCABULARY Part 2 (Neuter nouns + Common verbs)
-- ============================================================

-- Common Nouns (Neuter - DAS)
INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES
('Noun', 'Kind', 'A1', NOW(), NOW()),
('Noun', 'Haus', 'A1', NOW(), NOW()),
('Noun', 'Buch', 'A1', NOW(), NOW()),
('Noun', 'Auto', 'A1', NOW(), NOW()),
('Noun', 'Zimmer', 'A1', NOW(), NOW()),
('Noun', 'Fenster', 'A1', NOW(), NOW()),
('Noun', 'Bett', 'A1', NOW(), NOW()),
('Noun', 'Brot', 'A1', NOW(), NOW()),
('Noun', 'Wasser', 'A1', NOW(), NOW()),
('Noun', 'Bier', 'A1', NOW(), NOW()),
('Noun', 'Glas', 'A1', NOW(), NOW()),
('Noun', 'Ei', 'A1', NOW(), NOW()),
('Noun', 'Fleisch', 'A1', NOW(), NOW()),
('Noun', 'Gemüse', 'A1', NOW(), NOW()),
('Noun', 'Obst', 'A1', NOW(), NOW()),
('Noun', 'Jahr', 'A1', NOW(), NOW()),
('Noun', 'Land', 'A1', NOW(), NOW()),
('Noun', 'Wetter', 'A1', NOW(), NOW()),
('Noun', 'Geld', 'A1', NOW(), NOW()),
('Noun', 'Handy', 'A1', NOW(), NOW());

SET @kind_id = (SELECT id FROM words WHERE base_form = 'Kind' AND dtype = 'Noun');
SET @haus_id = (SELECT id FROM words WHERE base_form = 'Haus' AND dtype = 'Noun');
SET @buch_id = (SELECT id FROM words WHERE base_form = 'Buch' AND dtype = 'Noun');
SET @auto_id = (SELECT id FROM words WHERE base_form = 'Auto' AND dtype = 'Noun');
SET @zimmer_id = (SELECT id FROM words WHERE base_form = 'Zimmer' AND dtype = 'Noun');
SET @fenster_id = (SELECT id FROM words WHERE base_form = 'Fenster' AND dtype = 'Noun');
SET @bett_id = (SELECT id FROM words WHERE base_form = 'Bett' AND dtype = 'Noun');
SET @brot_id = (SELECT id FROM words WHERE base_form = 'Brot' AND dtype = 'Noun');
SET @wasser_id = (SELECT id FROM words WHERE base_form = 'Wasser' AND dtype = 'Noun');
SET @bier_id = (SELECT id FROM words WHERE base_form = 'Bier' AND dtype = 'Noun');
SET @glas_id = (SELECT id FROM words WHERE base_form = 'Glas' AND dtype = 'Noun');
SET @ei_id = (SELECT id FROM words WHERE base_form = 'Ei' AND dtype = 'Noun');
SET @fleisch_id = (SELECT id FROM words WHERE base_form = 'Fleisch' AND dtype = 'Noun');
SET @gemuese_id = (SELECT id FROM words WHERE base_form = 'Gemüse' AND dtype = 'Noun');
SET @obst_id = (SELECT id FROM words WHERE base_form = 'Obst' AND dtype = 'Noun');
SET @jahr_id = (SELECT id FROM words WHERE base_form = 'Jahr' AND dtype = 'Noun');
SET @land_id = (SELECT id FROM words WHERE base_form = 'Land' AND dtype = 'Noun');
SET @wetter_id = (SELECT id FROM words WHERE base_form = 'Wetter' AND dtype = 'Noun');
SET @geld_id = (SELECT id FROM words WHERE base_form = 'Geld' AND dtype = 'Noun');
SET @handy_id = (SELECT id FROM words WHERE base_form = 'Handy' AND dtype = 'Noun');

INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type) VALUES
(@kind_id, 'DAS', 'Kinder', 'Kindes', 'STARK'),
(@haus_id, 'DAS', 'Häuser', 'Hauses', 'STARK'),
(@buch_id, 'DAS', 'Bücher', 'Buches', 'STARK'),
(@auto_id, 'DAS', 'Autos', 'Autos', 'STARK'),
(@zimmer_id, 'DAS', 'Zimmer', 'Zimmers', 'STARK'),
(@fenster_id, 'DAS', 'Fenster', 'Fensters', 'STARK'),
(@bett_id, 'DAS', 'Betten', 'Bettes', 'STARK'),
(@brot_id, 'DAS', 'Brote', 'Brotes', 'STARK'),
(@wasser_id, 'DAS', 'Wasser', 'Wassers', 'STARK'),
(@bier_id, 'DAS', 'Biere', 'Bieres', 'STARK'),
(@glas_id, 'DAS', 'Gläser', 'Glases', 'STARK'),
(@ei_id, 'DAS', 'Eier', 'Eies', 'STARK'),
(@fleisch_id, 'DAS', 'Fleisch', 'Fleisches', 'STARK'),
(@gemuese_id, 'DAS', 'Gemüse', 'Gemüses', 'STARK'),
(@obst_id, 'DAS', 'Obst', 'Obstes', 'STARK'),
(@jahr_id, 'DAS', 'Jahre', 'Jahres', 'STARK'),
(@land_id, 'DAS', 'Länder', 'Landes', 'STARK'),
(@wetter_id, 'DAS', 'Wetter', 'Wetters', 'STARK'),
(@geld_id, 'DAS', 'Gelder', 'Geldes', 'STARK'),
(@handy_id, 'DAS', 'Handys', 'Handys', 'STARK');

INSERT INTO word_translations (word_id, locale, meaning, example) VALUES
(@kind_id, 'vi', 'đứa trẻ', 'Das Kind spielt. (Đứa trẻ đang chơi.)'),
(@kind_id, 'en', 'child', 'The child is playing.'),
(@haus_id, 'vi', 'ngôi nhà', 'Das Haus ist schön. (Ngôi nhà đẹp.)'),
(@haus_id, 'en', 'house', 'The house is beautiful.'),
(@buch_id, 'vi', 'quyển sách', 'Das Buch ist interessant. (Quyển sách thú vị.)'),
(@buch_id, 'en', 'book', 'The book is interesting.'),
(@auto_id, 'vi', 'xe hơi', 'Das Auto ist schnell. (Xe hơi nhanh.)'),
(@auto_id, 'en', 'car', 'The car is fast.'),
(@zimmer_id, 'vi', 'căn phòng', 'Das Zimmer ist groß. (Căn phòng rộng.)'),
(@zimmer_id, 'en', 'room', 'The room is big.'),
(@fenster_id, 'vi', 'cửa sổ', 'Das Fenster ist offen. (Cửa sổ đang mở.)'),
(@fenster_id, 'en', 'window', 'The window is open.'),
(@bett_id, 'vi', 'giường', 'Das Bett ist bequem. (Giường thoải mái.)'),
(@bett_id, 'en', 'bed', 'The bed is comfortable.'),
(@brot_id, 'vi', 'bánh mì', 'Das Brot ist frisch. (Bánh mì tươi.)'),
(@brot_id, 'en', 'bread', 'The bread is fresh.'),
(@wasser_id, 'vi', 'nước', 'Ich trinke Wasser. (Tôi uống nước.)'),
(@wasser_id, 'en', 'water', 'I drink water.'),
(@bier_id, 'vi', 'bia', 'Das Bier ist kalt. (Bia lạnh.)'),
(@bier_id, 'en', 'beer', 'The beer is cold.'),
(@glas_id, 'vi', 'cái ly', 'Das Glas ist voll. (Cái ly đầy.)'),
(@glas_id, 'en', 'glass', 'The glass is full.'),
(@ei_id, 'vi', 'quả trứng', 'Ich esse ein Ei. (Tôi ăn một quả trứng.)'),
(@ei_id, 'en', 'egg', 'I eat an egg.'),
(@fleisch_id, 'vi', 'thịt', 'Das Fleisch ist lecker. (Thịt ngon.)'),
(@fleisch_id, 'en', 'meat', 'The meat is delicious.'),
(@gemuese_id, 'vi', 'rau củ', 'Ich esse Gemüse. (Tôi ăn rau.)'),
(@gemuese_id, 'en', 'vegetables', 'I eat vegetables.'),
(@obst_id, 'vi', 'trái cây', 'Obst ist gesund. (Trái cây tốt cho sức khỏe.)'),
(@obst_id, 'en', 'fruit', 'Fruit is healthy.'),
(@jahr_id, 'vi', 'năm', 'Ein Jahr hat 12 Monate. (Một năm có 12 tháng.)'),
(@jahr_id, 'en', 'year', 'A year has 12 months.'),
(@land_id, 'vi', 'đất nước', 'Deutschland ist ein Land. (Đức là một đất nước.)'),
(@land_id, 'en', 'country', 'Germany is a country.'),
(@wetter_id, 'vi', 'thời tiết', 'Das Wetter ist schön. (Thời tiết đẹp.)'),
(@wetter_id, 'en', 'weather', 'The weather is nice.'),
(@geld_id, 'vi', 'tiền', 'Ich brauche Geld. (Tôi cần tiền.)'),
(@geld_id, 'en', 'money', 'I need money.'),
(@handy_id, 'vi', 'điện thoại di động', 'Mein Handy ist neu. (Điện thoại của tôi mới.)'),
(@handy_id, 'en', 'mobile phone', 'My phone is new.');

-- Common Verbs (A1 Level)
INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES
('Verb', 'sein', 'A1', NOW(), NOW()),
('Verb', 'haben', 'A1', NOW(), NOW()),
('Verb', 'werden', 'A1', NOW(), NOW()),
('Verb', 'können', 'A1', NOW(), NOW()),
('Verb', 'müssen', 'A1', NOW(), NOW()),
('Verb', 'sagen', 'A1', NOW(), NOW()),
('Verb', 'machen', 'A1', NOW(), NOW()),
('Verb', 'geben', 'A1', NOW(), NOW()),
('Verb', 'kommen', 'A1', NOW(), NOW()),
('Verb', 'gehen', 'A1', NOW(), NOW()),
('Verb', 'wissen', 'A1', NOW(), NOW()),
('Verb', 'sehen', 'A1', NOW(), NOW()),
('Verb', 'wollen', 'A1', NOW(), NOW()),
('Verb', 'finden', 'A1', NOW(), NOW()),
('Verb', 'heißen', 'A1', NOW(), NOW()),
('Verb', 'essen', 'A1', NOW(), NOW()),
('Verb', 'trinken', 'A1', NOW(), NOW()),
('Verb', 'sprechen', 'A1', NOW(), NOW()),
('Verb', 'lernen', 'A1', NOW(), NOW()),
('Verb', 'arbeiten', 'A1', NOW(), NOW());

SET @sein_id = (SELECT id FROM words WHERE base_form = 'sein' AND dtype = 'Verb');
SET @haben_id = (SELECT id FROM words WHERE base_form = 'haben' AND dtype = 'Verb');
SET @werden_id = (SELECT id FROM words WHERE base_form = 'werden' AND dtype = 'Verb');
SET @koennen_id = (SELECT id FROM words WHERE base_form = 'können' AND dtype = 'Verb');
SET @muessen_id = (SELECT id FROM words WHERE base_form = 'müssen' AND dtype = 'Verb');
SET @sagen_id = (SELECT id FROM words WHERE base_form = 'sagen' AND dtype = 'Verb');
SET @machen_id = (SELECT id FROM words WHERE base_form = 'machen' AND dtype = 'Verb');
SET @geben_id = (SELECT id FROM words WHERE base_form = 'geben' AND dtype = 'Verb');
SET @kommen_id = (SELECT id FROM words WHERE base_form = 'kommen' AND dtype = 'Verb');
SET @gehen_id = (SELECT id FROM words WHERE base_form = 'gehen' AND dtype = 'Verb');
SET @wissen_id = (SELECT id FROM words WHERE base_form = 'wissen' AND dtype = 'Verb');
SET @sehen_id = (SELECT id FROM words WHERE base_form = 'sehen' AND dtype = 'Verb');
SET @wollen_id = (SELECT id FROM words WHERE base_form = 'wollen' AND dtype = 'Verb');
SET @finden_id = (SELECT id FROM words WHERE base_form = 'finden' AND dtype = 'Verb');
SET @heissen_id = (SELECT id FROM words WHERE base_form = 'heißen' AND dtype = 'Verb');
SET @essen_id = (SELECT id FROM words WHERE base_form = 'essen' AND dtype = 'Verb');
SET @trinken_id = (SELECT id FROM words WHERE base_form = 'trinken' AND dtype = 'Verb');
SET @sprechen_id = (SELECT id FROM words WHERE base_form = 'sprechen' AND dtype = 'Verb');
SET @lernen_id = (SELECT id FROM words WHERE base_form = 'lernen' AND dtype = 'Verb');
SET @arbeiten_id = (SELECT id FROM words WHERE base_form = 'arbeiten' AND dtype = 'Verb');

INSERT INTO verbs (id, auxiliary_verb, partizip2, is_separable, is_irregular) VALUES
(@sein_id, 'SEIN', 'gewesen', FALSE, TRUE),
(@haben_id, 'HABEN', 'gehabt', FALSE, TRUE),
(@werden_id, 'SEIN', 'geworden', FALSE, TRUE),
(@koennen_id, 'HABEN', 'gekonnt', FALSE, TRUE),
(@muessen_id, 'HABEN', 'gemusst', FALSE, TRUE),
(@sagen_id, 'HABEN', 'gesagt', FALSE, FALSE),
(@machen_id, 'HABEN', 'gemacht', FALSE, FALSE),
(@geben_id, 'HABEN', 'gegeben', FALSE, TRUE),
(@kommen_id, 'SEIN', 'gekommen', FALSE, TRUE),
(@gehen_id, 'SEIN', 'gegangen', FALSE, TRUE),
(@wissen_id, 'HABEN', 'gewusst', FALSE, TRUE),
(@sehen_id, 'HABEN', 'gesehen', FALSE, TRUE),
(@wollen_id, 'HABEN', 'gewollt', FALSE, TRUE),
(@finden_id, 'HABEN', 'gefunden', FALSE, TRUE),
(@heissen_id, 'HABEN', 'geheißen', FALSE, TRUE),
(@essen_id, 'HABEN', 'gegessen', FALSE, TRUE),
(@trinken_id, 'HABEN', 'getrunken', FALSE, TRUE),
(@sprechen_id, 'HABEN', 'gesprochen', FALSE, TRUE),
(@lernen_id, 'HABEN', 'gelernt', FALSE, FALSE),
(@arbeiten_id, 'HABEN', 'gearbeitet', FALSE, FALSE);

-- Verb conjugations (Present tense - Präsens)
INSERT INTO verb_conjugations (verb_id, tense, pronoun, form) VALUES
-- sein
(@sein_id, 'PRASENS', 'ICH', 'bin'),
(@sein_id, 'PRASENS', 'DU', 'bist'),
(@sein_id, 'PRASENS', 'ER_SIE_ES', 'ist'),
(@sein_id, 'PRASENS', 'WIR', 'sind'),
(@sein_id, 'PRASENS', 'IHR', 'seid'),
(@sein_id, 'PRASENS', 'SIE_FORMAL', 'sind'),
-- haben
(@haben_id, 'PRASENS', 'ICH', 'habe'),
(@haben_id, 'PRASENS', 'DU', 'hast'),
(@haben_id, 'PRASENS', 'ER_SIE_ES', 'hat'),
(@haben_id, 'PRASENS', 'WIR', 'haben'),
(@haben_id, 'PRASENS', 'IHR', 'habt'),
(@haben_id, 'PRASENS', 'SIE_FORMAL', 'haben'),
-- werden
(@werden_id, 'PRASENS', 'ICH', 'werde'),
(@werden_id, 'PRASENS', 'DU', 'wirst'),
(@werden_id, 'PRASENS', 'ER_SIE_ES', 'wird'),
(@werden_id, 'PRASENS', 'WIR', 'werden'),
(@werden_id, 'PRASENS', 'IHR', 'werdet'),
(@werden_id, 'PRASENS', 'SIE_FORMAL', 'werden'),
-- können
(@koennen_id, 'PRASENS', 'ICH', 'kann'),
(@koennen_id, 'PRASENS', 'DU', 'kannst'),
(@koennen_id, 'PRASENS', 'ER_SIE_ES', 'kann'),
(@koennen_id, 'PRASENS', 'WIR', 'können'),
(@koennen_id, 'PRASENS', 'IHR', 'könnt'),
(@koennen_id, 'PRASENS', 'SIE_FORMAL', 'können'),
-- müssen
(@muessen_id, 'PRASENS', 'ICH', 'muss'),
(@muessen_id, 'PRASENS', 'DU', 'musst'),
(@muessen_id, 'PRASENS', 'ER_SIE_ES', 'muss'),
(@muessen_id, 'PRASENS', 'WIR', 'müssen'),
(@muessen_id, 'PRASENS', 'IHR', 'müsst'),
(@muessen_id, 'PRASENS', 'SIE_FORMAL', 'müssen');

-- Verb translations
INSERT INTO word_translations (word_id, locale, meaning, example) VALUES
(@sein_id, 'vi', 'là, thì, ở', 'Ich bin Student. (Tôi là sinh viên.)'),
(@sein_id, 'en', 'to be', 'I am a student.'),
(@haben_id, 'vi', 'có', 'Ich habe einen Hund. (Tôi có một con chó.)'),
(@haben_id, 'en', 'to have', 'I have a dog.'),
(@werden_id, 'vi', 'trở thành', 'Ich werde Arzt. (Tôi sẽ trở thành bác sĩ.)'),
(@werden_id, 'en', 'to become', 'I will become a doctor.'),
(@koennen_id, 'vi', 'có thể', 'Ich kann Deutsch sprechen. (Tôi có thể nói tiếng Đức.)'),
(@koennen_id, 'en', 'can, to be able to', 'I can speak German.'),
(@muessen_id, 'vi', 'phải', 'Ich muss lernen. (Tôi phải học.)'),
(@muessen_id, 'en', 'must, to have to', 'I must study.'),
(@sagen_id, 'vi', 'nói', 'Er sagt die Wahrheit. (Anh ấy nói sự thật.)'),
(@sagen_id, 'en', 'to say', 'He says the truth.'),
(@machen_id, 'vi', 'làm', 'Ich mache Hausaufgaben. (Tôi làm bài tập về nhà.)'),
(@machen_id, 'en', 'to do, to make', 'I do homework.'),
(@geben_id, 'vi', 'cho', 'Ich gebe dir das Buch. (Tôi cho bạn quyển sách.)'),
(@geben_id, 'en', 'to give', 'I give you the book.'),
(@kommen_id, 'vi', 'đến', 'Ich komme aus Vietnam. (Tôi đến từ Việt Nam.)'),
(@kommen_id, 'en', 'to come', 'I come from Vietnam.'),
(@gehen_id, 'vi', 'đi', 'Ich gehe zur Schule. (Tôi đi học.)'),
(@gehen_id, 'en', 'to go', 'I go to school.'),
(@wissen_id, 'vi', 'biết', 'Ich weiß es nicht. (Tôi không biết.)'),
(@wissen_id, 'en', 'to know', 'I don''t know.'),
(@sehen_id, 'vi', 'nhìn thấy', 'Ich sehe dich. (Tôi nhìn thấy bạn.)'),
(@sehen_id, 'en', 'to see', 'I see you.'),
(@wollen_id, 'vi', 'muốn', 'Ich will Deutsch lernen. (Tôi muốn học tiếng Đức.)'),
(@wollen_id, 'en', 'to want', 'I want to learn German.'),
(@finden_id, 'vi', 'tìm thấy', 'Ich finde das Buch. (Tôi tìm thấy quyển sách.)'),
(@finden_id, 'en', 'to find', 'I find the book.'),
(@heissen_id, 'vi', 'tên là', 'Ich heiße Anna. (Tôi tên là Anna.)'),
(@heissen_id, 'en', 'to be called', 'My name is Anna.'),
(@essen_id, 'vi', 'ăn', 'Ich esse Brot. (Tôi ăn bánh mì.)'),
(@essen_id, 'en', 'to eat', 'I eat bread.'),
(@trinken_id, 'vi', 'uống', 'Ich trinke Wasser. (Tôi uống nước.)'),
(@trinken_id, 'en', 'to drink', 'I drink water.'),
(@sprechen_id, 'vi', 'nói', 'Ich spreche Deutsch. (Tôi nói tiếng Đức.)'),
(@sprechen_id, 'en', 'to speak', 'I speak German.'),
(@lernen_id, 'vi', 'học', 'Ich lerne Deutsch. (Tôi học tiếng Đức.)'),
(@lernen_id, 'en', 'to learn', 'I learn German.'),
(@arbeiten_id, 'vi', 'làm việc', 'Ich arbeite in Berlin. (Tôi làm việc ở Berlin.)'),
(@arbeiten_id, 'en', 'to work', 'I work in Berlin.');
