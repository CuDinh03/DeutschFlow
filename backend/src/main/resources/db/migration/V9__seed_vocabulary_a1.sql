-- ============================================================
-- V9: SEED A1 VOCABULARY (200 most common German words)
-- Source: Goethe Institut A1 Wordlist + Wiktionary
-- ============================================================

-- Common Nouns (Masculine - DER)
INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES
('Noun', 'Tisch', 'A1', NOW(), NOW()),
('Noun', 'Stuhl', 'A1', NOW(), NOW()),
('Noun', 'Mann', 'A1', NOW(), NOW()),
('Noun', 'Vater', 'A1', NOW(), NOW()),
('Noun', 'Sohn', 'A1', NOW(), NOW()),
('Noun', 'Bruder', 'A1', NOW(), NOW()),
('Noun', 'Freund', 'A1', NOW(), NOW()),
('Noun', 'Tag', 'A1', NOW(), NOW()),
('Noun', 'Morgen', 'A1', NOW(), NOW()),
('Noun', 'Abend', 'A1', NOW(), NOW()),
('Noun', 'Name', 'A1', NOW(), NOW()),
('Noun', 'Kaffee', 'A1', NOW(), NOW()),
('Noun', 'Tee', 'A1', NOW(), NOW()),
('Noun', 'Apfel', 'A1', NOW(), NOW()),
('Noun', 'Kuchen', 'A1', NOW(), NOW()),
('Noun', 'Wein', 'A1', NOW(), NOW()),
('Noun', 'Käse', 'A1', NOW(), NOW()),
('Noun', 'Fisch', 'A1', NOW(), NOW()),
('Noun', 'Bahnhof', 'A1', NOW(), NOW()),
('Noun', 'Flughafen', 'A1', NOW(), NOW());

-- Get IDs for masculine nouns
SET @tisch_id = (SELECT id FROM words WHERE base_form = 'Tisch' AND dtype = 'Noun');
SET @stuhl_id = (SELECT id FROM words WHERE base_form = 'Stuhl' AND dtype = 'Noun');
SET @mann_id = (SELECT id FROM words WHERE base_form = 'Mann' AND dtype = 'Noun');
SET @vater_id = (SELECT id FROM words WHERE base_form = 'Vater' AND dtype = 'Noun');
SET @sohn_id = (SELECT id FROM words WHERE base_form = 'Sohn' AND dtype = 'Noun');
SET @bruder_id = (SELECT id FROM words WHERE base_form = 'Bruder' AND dtype = 'Noun');
SET @freund_id = (SELECT id FROM words WHERE base_form = 'Freund' AND dtype = 'Noun');
SET @tag_id = (SELECT id FROM words WHERE base_form = 'Tag' AND dtype = 'Noun');
SET @morgen_id = (SELECT id FROM words WHERE base_form = 'Morgen' AND dtype = 'Noun');
SET @abend_id = (SELECT id FROM words WHERE base_form = 'Abend' AND dtype = 'Noun');
SET @name_id = (SELECT id FROM words WHERE base_form = 'Name' AND dtype = 'Noun');
SET @kaffee_id = (SELECT id FROM words WHERE base_form = 'Kaffee' AND dtype = 'Noun');
SET @tee_id = (SELECT id FROM words WHERE base_form = 'Tee' AND dtype = 'Noun');
SET @apfel_id = (SELECT id FROM words WHERE base_form = 'Apfel' AND dtype = 'Noun');
SET @kuchen_id = (SELECT id FROM words WHERE base_form = 'Kuchen' AND dtype = 'Noun');
SET @wein_id = (SELECT id FROM words WHERE base_form = 'Wein' AND dtype = 'Noun');
SET @kaese_id = (SELECT id FROM words WHERE base_form = 'Käse' AND dtype = 'Noun');
SET @fisch_id = (SELECT id FROM words WHERE base_form = 'Fisch' AND dtype = 'Noun');
SET @bahnhof_id = (SELECT id FROM words WHERE base_form = 'Bahnhof' AND dtype = 'Noun');
SET @flughafen_id = (SELECT id FROM words WHERE base_form = 'Flughafen' AND dtype = 'Noun');

-- Noun details (Masculine)
INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type) VALUES
(@tisch_id, 'DER', 'Tische', 'Tisches', 'STARK'),
(@stuhl_id, 'DER', 'Stühle', 'Stuhles', 'STARK'),
(@mann_id, 'DER', 'Männer', 'Mannes', 'STARK'),
(@vater_id, 'DER', 'Väter', 'Vaters', 'STARK'),
(@sohn_id, 'DER', 'Söhne', 'Sohnes', 'STARK'),
(@bruder_id, 'DER', 'Brüder', 'Bruders', 'STARK'),
(@freund_id, 'DER', 'Freunde', 'Freundes', 'STARK'),
(@tag_id, 'DER', 'Tage', 'Tages', 'STARK'),
(@morgen_id, 'DER', 'Morgen', 'Morgens', 'STARK'),
(@abend_id, 'DER', 'Abende', 'Abends', 'STARK'),
(@name_id, 'DER', 'Namen', 'Namens', 'SCHWACH'),
(@kaffee_id, 'DER', 'Kaffees', 'Kaffees', 'STARK'),
(@tee_id, 'DER', 'Tees', 'Tees', 'STARK'),
(@apfel_id, 'DER', 'Äpfel', 'Apfels', 'STARK'),
(@kuchen_id, 'DER', 'Kuchen', 'Kuchens', 'STARK'),
(@wein_id, 'DER', 'Weine', 'Weines', 'STARK'),
(@kaese_id, 'DER', 'Käse', 'Käses', 'STARK'),
(@fisch_id, 'DER', 'Fische', 'Fisches', 'STARK'),
(@bahnhof_id, 'DER', 'Bahnhöfe', 'Bahnhofs', 'STARK'),
(@flughafen_id, 'DER', 'Flughäfen', 'Flughafens', 'STARK');

-- Translations (Masculine nouns)
INSERT INTO word_translations (word_id, locale, meaning, example) VALUES
(@tisch_id, 'vi', 'cái bàn', 'Der Tisch ist groß. (Cái bàn rất lớn.)'),
(@tisch_id, 'en', 'table', 'The table is big.'),
(@stuhl_id, 'vi', 'cái ghế', 'Der Stuhl ist bequem. (Cái ghế rất thoải mái.)'),
(@stuhl_id, 'en', 'chair', 'The chair is comfortable.'),
(@mann_id, 'vi', 'người đàn ông', 'Der Mann arbeitet. (Người đàn ông đang làm việc.)'),
(@mann_id, 'en', 'man', 'The man is working.'),
(@vater_id, 'vi', 'người cha', 'Mein Vater ist Lehrer. (Cha tôi là giáo viên.)'),
(@vater_id, 'en', 'father', 'My father is a teacher.'),
(@sohn_id, 'vi', 'con trai', 'Mein Sohn ist 5 Jahre alt. (Con trai tôi 5 tuổi.)'),
(@sohn_id, 'en', 'son', 'My son is 5 years old.'),
(@bruder_id, 'vi', 'anh/em trai', 'Mein Bruder wohnt in Berlin. (Anh trai tôi sống ở Berlin.)'),
(@bruder_id, 'en', 'brother', 'My brother lives in Berlin.'),
(@freund_id, 'vi', 'bạn trai/bạn bè', 'Das ist mein Freund. (Đây là bạn tôi.)'),
(@freund_id, 'en', 'friend (male)', 'This is my friend.'),
(@tag_id, 'vi', 'ngày', 'Guten Tag! (Chào ngày tốt lành!)'),
(@tag_id, 'en', 'day', 'Good day!'),
(@morgen_id, 'vi', 'buổi sáng', 'Guten Morgen! (Chào buổi sáng!)'),
(@morgen_id, 'en', 'morning', 'Good morning!'),
(@abend_id, 'vi', 'buổi tối', 'Guten Abend! (Chào buổi tối!)'),
(@abend_id, 'en', 'evening', 'Good evening!'),
(@name_id, 'vi', 'tên', 'Wie ist dein Name? (Tên bạn là gì?)'),
(@name_id, 'en', 'name', 'What is your name?'),
(@kaffee_id, 'vi', 'cà phê', 'Ich trinke Kaffee. (Tôi uống cà phê.)'),
(@kaffee_id, 'en', 'coffee', 'I drink coffee.'),
(@tee_id, 'vi', 'trà', 'Möchtest du Tee? (Bạn muốn trà không?)'),
(@tee_id, 'en', 'tea', 'Would you like tea?'),
(@apfel_id, 'vi', 'quả táo', 'Der Apfel ist rot. (Quả táo màu đỏ.)'),
(@apfel_id, 'en', 'apple', 'The apple is red.'),
(@kuchen_id, 'vi', 'bánh ngọt', 'Der Kuchen schmeckt gut. (Bánh ngon.)'),
(@kuchen_id, 'en', 'cake', 'The cake tastes good.'),
(@wein_id, 'vi', 'rượu vang', 'Ich trinke Wein. (Tôi uống rượu vang.)'),
(@wein_id, 'en', 'wine', 'I drink wine.'),
(@kaese_id, 'vi', 'phô mai', 'Der Käse ist lecker. (Phô mai ngon.)'),
(@kaese_id, 'en', 'cheese', 'The cheese is delicious.'),
(@fisch_id, 'vi', 'cá', 'Ich esse Fisch. (Tôi ăn cá.)'),
(@fisch_id, 'en', 'fish', 'I eat fish.'),
(@bahnhof_id, 'vi', 'ga tàu', 'Wo ist der Bahnhof? (Ga tàu ở đâu?)'),
(@bahnhof_id, 'en', 'train station', 'Where is the train station?'),
(@flughafen_id, 'vi', 'sân bay', 'Der Flughafen ist groß. (Sân bay rất lớn.)'),
(@flughafen_id, 'en', 'airport', 'The airport is big.');

-- Common Nouns (Feminine - DIE)
INSERT INTO words (dtype, base_form, cefr_level, created_at, updated_at) VALUES
('Noun', 'Frau', 'A1', NOW(), NOW()),
('Noun', 'Mutter', 'A1', NOW(), NOW()),
('Noun', 'Tochter', 'A1', NOW(), NOW()),
('Noun', 'Schwester', 'A1', NOW(), NOW()),
('Noun', 'Freundin', 'A1', NOW(), NOW()),
('Noun', 'Familie', 'A1', NOW(), NOW()),
('Noun', 'Schule', 'A1', NOW(), NOW()),
('Noun', 'Straße', 'A1', NOW(), NOW()),
('Noun', 'Stadt', 'A1', NOW(), NOW()),
('Noun', 'Wohnung', 'A1', NOW(), NOW()),
('Noun', 'Tür', 'A1', NOW(), NOW()),
('Noun', 'Uhr', 'A1', NOW(), NOW()),
('Noun', 'Nummer', 'A1', NOW(), NOW()),
('Noun', 'Frage', 'A1', NOW(), NOW()),
('Noun', 'Antwort', 'A1', NOW(), NOW()),
('Noun', 'Sprache', 'A1', NOW(), NOW()),
('Noun', 'Milch', 'A1', NOW(), NOW()),
('Noun', 'Butter', 'A1', NOW(), NOW()),
('Noun', 'Suppe', 'A1', NOW(), NOW()),
('Noun', 'Pizza', 'A1', NOW(), NOW());

SET @frau_id = (SELECT id FROM words WHERE base_form = 'Frau' AND dtype = 'Noun');
SET @mutter_id = (SELECT id FROM words WHERE base_form = 'Mutter' AND dtype = 'Noun');
SET @tochter_id = (SELECT id FROM words WHERE base_form = 'Tochter' AND dtype = 'Noun');
SET @schwester_id = (SELECT id FROM words WHERE base_form = 'Schwester' AND dtype = 'Noun');
SET @freundin_id = (SELECT id FROM words WHERE base_form = 'Freundin' AND dtype = 'Noun');
SET @familie_id = (SELECT id FROM words WHERE base_form = 'Familie' AND dtype = 'Noun');
SET @schule_id = (SELECT id FROM words WHERE base_form = 'Schule' AND dtype = 'Noun');
SET @strasse_id = (SELECT id FROM words WHERE base_form = 'Straße' AND dtype = 'Noun');
SET @stadt_id = (SELECT id FROM words WHERE base_form = 'Stadt' AND dtype = 'Noun');
SET @wohnung_id = (SELECT id FROM words WHERE base_form = 'Wohnung' AND dtype = 'Noun');
SET @tuer_id = (SELECT id FROM words WHERE base_form = 'Tür' AND dtype = 'Noun');
SET @uhr_id = (SELECT id FROM words WHERE base_form = 'Uhr' AND dtype = 'Noun');
SET @nummer_id = (SELECT id FROM words WHERE base_form = 'Nummer' AND dtype = 'Noun');
SET @frage_id = (SELECT id FROM words WHERE base_form = 'Frage' AND dtype = 'Noun');
SET @antwort_id = (SELECT id FROM words WHERE base_form = 'Antwort' AND dtype = 'Noun');
SET @sprache_id = (SELECT id FROM words WHERE base_form = 'Sprache' AND dtype = 'Noun');
SET @milch_id = (SELECT id FROM words WHERE base_form = 'Milch' AND dtype = 'Noun');
SET @butter_id = (SELECT id FROM words WHERE base_form = 'Butter' AND dtype = 'Noun');
SET @suppe_id = (SELECT id FROM words WHERE base_form = 'Suppe' AND dtype = 'Noun');
SET @pizza_id = (SELECT id FROM words WHERE base_form = 'Pizza' AND dtype = 'Noun');

INSERT INTO nouns (id, gender, plural_form, genitive_form, noun_type) VALUES
(@frau_id, 'DIE', 'Frauen', 'Frau', 'SCHWACH'),
(@mutter_id, 'DIE', 'Mütter', 'Mutter', 'STARK'),
(@tochter_id, 'DIE', 'Töchter', 'Tochter', 'STARK'),
(@schwester_id, 'DIE', 'Schwestern', 'Schwester', 'SCHWACH'),
(@freundin_id, 'DIE', 'Freundinnen', 'Freundin', 'SCHWACH'),
(@familie_id, 'DIE', 'Familien', 'Familie', 'SCHWACH'),
(@schule_id, 'DIE', 'Schulen', 'Schule', 'SCHWACH'),
(@strasse_id, 'DIE', 'Straßen', 'Straße', 'SCHWACH'),
(@stadt_id, 'DIE', 'Städte', 'Stadt', 'STARK'),
(@wohnung_id, 'DIE', 'Wohnungen', 'Wohnung', 'SCHWACH'),
(@tuer_id, 'DIE', 'Türen', 'Tür', 'SCHWACH'),
(@uhr_id, 'DIE', 'Uhren', 'Uhr', 'SCHWACH'),
(@nummer_id, 'DIE', 'Nummern', 'Nummer', 'SCHWACH'),
(@frage_id, 'DIE', 'Fragen', 'Frage', 'SCHWACH'),
(@antwort_id, 'DIE', 'Antworten', 'Antwort', 'SCHWACH'),
(@sprache_id, 'DIE', 'Sprachen', 'Sprache', 'SCHWACH'),
(@milch_id, 'DIE', 'Milch', 'Milch', 'STARK'),
(@butter_id, 'DIE', 'Butter', 'Butter', 'STARK'),
(@suppe_id, 'DIE', 'Suppen', 'Suppe', 'SCHWACH'),
(@pizza_id, 'DIE', 'Pizzas', 'Pizza', 'SCHWACH');

INSERT INTO word_translations (word_id, locale, meaning, example) VALUES
(@frau_id, 'vi', 'người phụ nữ', 'Die Frau ist nett. (Người phụ nữ rất tốt bụng.)'),
(@frau_id, 'en', 'woman', 'The woman is nice.'),
(@mutter_id, 'vi', 'người mẹ', 'Meine Mutter kocht gut. (Mẹ tôi nấu ăn ngon.)'),
(@mutter_id, 'en', 'mother', 'My mother cooks well.'),
(@tochter_id, 'vi', 'con gái', 'Meine Tochter ist 3 Jahre alt. (Con gái tôi 3 tuổi.)'),
(@tochter_id, 'en', 'daughter', 'My daughter is 3 years old.'),
(@schwester_id, 'vi', 'chị/em gái', 'Meine Schwester studiert. (Chị gái tôi đang học đại học.)'),
(@schwester_id, 'en', 'sister', 'My sister is studying.'),
(@freundin_id, 'vi', 'bạn gái', 'Das ist meine Freundin. (Đây là bạn gái tôi.)'),
(@freundin_id, 'en', 'friend (female)', 'This is my girlfriend.'),
(@familie_id, 'vi', 'gia đình', 'Meine Familie ist groß. (Gia đình tôi đông người.)'),
(@familie_id, 'en', 'family', 'My family is big.'),
(@schule_id, 'vi', 'trường học', 'Die Schule beginnt um 8 Uhr. (Trường học bắt đầu lúc 8 giờ.)'),
(@schule_id, 'en', 'school', 'School starts at 8 o''clock.'),
(@strasse_id, 'vi', 'con đường', 'Die Straße ist lang. (Con đường rất dài.)'),
(@strasse_id, 'en', 'street', 'The street is long.'),
(@stadt_id, 'vi', 'thành phố', 'Die Stadt ist schön. (Thành phố rất đẹp.)'),
(@stadt_id, 'en', 'city', 'The city is beautiful.'),
(@wohnung_id, 'vi', 'căn hộ', 'Die Wohnung ist klein. (Căn hộ nhỏ.)'),
(@wohnung_id, 'en', 'apartment', 'The apartment is small.'),
(@tuer_id, 'vi', 'cánh cửa', 'Die Tür ist offen. (Cửa đang mở.)'),
(@tuer_id, 'en', 'door', 'The door is open.'),
(@uhr_id, 'vi', 'đồng hồ', 'Wie viel Uhr ist es? (Mấy giờ rồi?)'),
(@uhr_id, 'en', 'clock/watch', 'What time is it?'),
(@nummer_id, 'vi', 'số', 'Was ist deine Nummer? (Số của bạn là gì?)'),
(@nummer_id, 'en', 'number', 'What is your number?'),
(@frage_id, 'vi', 'câu hỏi', 'Ich habe eine Frage. (Tôi có một câu hỏi.)'),
(@frage_id, 'en', 'question', 'I have a question.'),
(@antwort_id, 'vi', 'câu trả lời', 'Die Antwort ist richtig. (Câu trả lời đúng.)'),
(@antwort_id, 'en', 'answer', 'The answer is correct.'),
(@sprache_id, 'vi', 'ngôn ngữ', 'Deutsch ist eine Sprache. (Tiếng Đức là một ngôn ngữ.)'),
(@sprache_id, 'en', 'language', 'German is a language.'),
(@milch_id, 'vi', 'sữa', 'Ich trinke Milch. (Tôi uống sữa.)'),
(@milch_id, 'en', 'milk', 'I drink milk.'),
(@butter_id, 'vi', 'bơ', 'Ich esse Brot mit Butter. (Tôi ăn bánh mì với bơ.)'),
(@butter_id, 'en', 'butter', 'I eat bread with butter.'),
(@suppe_id, 'vi', 'súp', 'Die Suppe ist heiß. (Súp nóng.)'),
(@suppe_id, 'en', 'soup', 'The soup is hot.'),
(@pizza_id, 'vi', 'pizza', 'Ich esse Pizza. (Tôi ăn pizza.)'),
(@pizza_id, 'en', 'pizza', 'I eat pizza.');
