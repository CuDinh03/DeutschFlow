-- Phase 1: Seed 50 core A1 vocabulary words
-- Source: CEFR A1 vocabulary list

DELETE FROM words WHERE cefr_level = 'A1' AND frequency_rank <= 50;

INSERT INTO words (word, translation, word_type, gender, cefr_level, pronunciation_ipa, example_sentence, frequency_rank, image_url, created_at, updated_at)
VALUES
-- Greetings (5)
('Hallo', 'Hello', 'interjection', NULL, 'A1', '/ˈhalo:/', 'Hallo, wie geht es dir?', 1, 'https://via.placeholder.com/200?text=Hallo', NOW(), NOW()),
('Guten Morgen', 'Good morning', 'phrase', NULL, 'A1', '/ˈɡuːtən ˈmɔʁɡən/', 'Guten Morgen! Wie geht es?', 2, 'https://via.placeholder.com/200?text=Guten+Morgen', NOW(), NOW()),
('Guten Tag', 'Good afternoon', 'phrase', NULL, 'A1', '/ˈɡuːtən ˈtaːk/', 'Guten Tag, schön dich zu sehen!', 3, 'https://via.placeholder.com/200?text=Guten+Tag', NOW(), NOW()),
('Guten Abend', 'Good evening', 'phrase', NULL, 'A1', '/ˈɡuːtən ˈaːbənt/', 'Guten Abend! Wie war dein Tag?', 4, 'https://via.placeholder.com/200?text=Guten+Abend', NOW(), NOW()),
('Auf Wiedersehen', 'Goodbye', 'phrase', NULL, 'A1', '/aʊ̯f ˈviːdɐˌzeːən/', 'Auf Wiedersehen, bis morgen!', 5, 'https://via.placeholder.com/200?text=Auf+Wiedersehen', NOW(), NOW()),

-- Personal pronouns (6)
('Ich', 'I', 'pronoun', NULL, 'A1', '/ɪç/', 'Ich bin ein Schüler.', 6, 'https://via.placeholder.com/200?text=Ich', NOW(), NOW()),
('Du', 'You (singular)', 'pronoun', NULL, 'A1', '/duː/', 'Du bist sehr nett!', 7, 'https://via.placeholder.com/200?text=Du', NOW(), NOW()),
('Er', 'He', 'pronoun', NULL, 'A1', '/eːɐ̯/', 'Er ist mein Bruder.', 8, 'https://via.placeholder.com/200?text=Er', NOW(), NOW()),
('Sie', 'She', 'pronoun', NULL, 'A1', '/ziː/', 'Sie ist meine Mutter.', 9, 'https://via.placeholder.com/200?text=Sie', NOW(), NOW()),
('Wir', 'We', 'pronoun', NULL, 'A1', '/viːɐ̯/', 'Wir sind zusammen.', 10, 'https://via.placeholder.com/200?text=Wir', NOW(), NOW()),
('Sie', 'You (plural/formal)', 'pronoun', NULL, 'A1', '/ziː/', 'Sie sprechen Deutsch sehr gut!', 11, 'https://via.placeholder.com/200?text=Sie+formal', NOW(), NOW()),

-- Numbers (11)
('null', 'zero', 'number', NULL, 'A1', '/nʊl/', 'Das ist null Prozent.', 12, 'https://via.placeholder.com/200?text=0', NOW(), NOW()),
('eins', 'one', 'number', NULL, 'A1', '/aɪ̯ns/', 'Das ist eins.', 13, 'https://via.placeholder.com/200?text=1', NOW(), NOW()),
('zwei', 'two', 'number', NULL, 'A1', '/tsvai̯/', 'Das ist zwei.', 14, 'https://via.placeholder.com/200?text=2', NOW(), NOW()),
('drei', 'three', 'number', NULL, 'A1', '/drai̯/', 'Das ist drei.', 15, 'https://via.placeholder.com/200?text=3', NOW(), NOW()),
('vier', 'four', 'number', NULL, 'A1', '/fiːɐ̯/', 'Das ist vier.', 16, 'https://via.placeholder.com/200?text=4', NOW(), NOW()),
('fünf', 'five', 'number', NULL, 'A1', '/fʏnf/', 'Das ist fünf.', 17, 'https://via.placeholder.com/200?text=5', NOW(), NOW()),
('sechs', 'six', 'number', NULL, 'A1', '/zɛks/', 'Das ist sechs.', 18, 'https://via.placeholder.com/200?text=6', NOW(), NOW()),
('sieben', 'seven', 'number', NULL, 'A1', '/ˈziːbən/', 'Das ist sieben.', 19, 'https://via.placeholder.com/200?text=7', NOW(), NOW()),
('acht', 'eight', 'number', NULL, 'A1', '/axt/', 'Das ist acht.', 20, 'https://via.placeholder.com/200?text=8', NOW(), NOW()),
('neun', 'nine', 'number', NULL, 'A1', '/nɔɪ̯n/', 'Das ist neun.', 21, 'https://via.placeholder.com/200?text=9', NOW(), NOW()),
('zehn', 'ten', 'number', NULL, 'A1', '/tseːn/', 'Das ist zehn.', 22, 'https://via.placeholder.com/200?text=10', NOW(), NOW()),

-- Basic verbs (6)
('sein', 'to be', 'verb', NULL, 'A1', '/zaɪ̯n/', 'Ich bin müde.', 23, 'https://via.placeholder.com/200?text=sein', NOW(), NOW()),
('haben', 'to have', 'verb', NULL, 'A1', '/ˈhaːbən/', 'Du hast einen Hund.', 24, 'https://via.placeholder.com/200?text=haben', NOW(), NOW()),
('gehen', 'to go', 'verb', NULL, 'A1', '/ˈɡeːən/', 'Ich gehe zur Schule.', 25, 'https://via.placeholder.com/200?text=gehen', NOW(), NOW()),
('kommen', 'to come', 'verb', NULL, 'A1', '/ˈkɔmən/', 'Du kommst aus Deutschland?', 26, 'https://via.placeholder.com/200?text=kommen', NOW(), NOW()),
('sehen', 'to see', 'verb', NULL, 'A1', '/ˈzeːən/', 'Ich sehe einen Baum.', 27, 'https://via.placeholder.com/200?text=sehen', NOW(), NOW()),
('hören', 'to hear', 'verb', NULL, 'A1', '/ˈhøːʁən/', 'Ich höre Musik.', 28, 'https://via.placeholder.com/200?text=hören', NOW(), NOW()),

-- Family (4)
('Mutter', 'Mother', 'noun', 'f', 'A1', '/ˈmʊtɐ/', 'Meine Mutter ist Lehrerin.', 29, 'https://via.placeholder.com/200?text=Mutter', NOW(), NOW()),
('Vater', 'Father', 'noun', 'm', 'A1', '/ˈfaːtɐ/', 'Mein Vater arbeitet.', 30, 'https://via.placeholder.com/200?text=Vater', NOW(), NOW()),
('Bruder', 'Brother', 'noun', 'm', 'A1', '/ˈbʁuːdɐ/', 'Mein Bruder ist alt.', 31, 'https://via.placeholder.com/200?text=Bruder', NOW(), NOW()),
('Schwester', 'Sister', 'noun', 'f', 'A1', '/ˈʃvɛstɐ/', 'Meine Schwester ist jung.', 32, 'https://via.placeholder.com/200?text=Schwester', NOW(), NOW()),

-- Colors (4)
('rot', 'red', 'adjective', NULL, 'A1', '/ro:t/', 'Das Auto ist rot.', 33, 'https://via.placeholder.com/200?text=rot', NOW(), NOW()),
('blau', 'blue', 'adjective', NULL, 'A1', '/blaʊ̯/', 'Der Himmel ist blau.', 34, 'https://via.placeholder.com/200?text=blau', NOW(), NOW()),
('grün', 'green', 'adjective', NULL, 'A1', '/ɡʁyːn/', 'Das Gras ist grün.', 35, 'https://via.placeholder.com/200?text=grün', NOW(), NOW()),
('gelb', 'yellow', 'adjective', NULL, 'A1', '/ɡɛlp/', 'Die Sonne ist gelb.', 36, 'https://via.placeholder.com/200?text=gelb', NOW(), NOW()),

-- Common objects (8)
('Buch', 'Book', 'noun', 'n', 'A1', '/buːx/', 'Ich lese ein Buch.', 37, 'https://via.placeholder.com/200?text=Buch', NOW(), NOW()),
('Stift', 'Pen', 'noun', 'm', 'A1', '/ʃtɪft/', 'Hast du einen Stift?', 38, 'https://via.placeholder.com/200?text=Stift', NOW(), NOW()),
('Tisch', 'Table', 'noun', 'm', 'A1', '/tɪʃ/', 'Der Tisch ist groß.', 39, 'https://via.placeholder.com/200?text=Tisch', NOW(), NOW()),
('Stuhl', 'Chair', 'noun', 'm', 'A1', '/ʃtuːl/', 'Ich sitze auf einem Stuhl.', 40, 'https://via.placeholder.com/200?text=Stuhl', NOW(), NOW()),
('Tür', 'Door', 'noun', 'f', 'A1', '/tyːɐ̯/', 'Die Tür ist rot.', 41, 'https://via.placeholder.com/200?text=Tür', NOW(), NOW()),
('Fenster', 'Window', 'noun', 'n', 'A1', '/ˈfɛnstɐ/', 'Das Fenster ist offen.', 42, 'https://via.placeholder.com/200?text=Fenster', NOW(), NOW()),
('Hand', 'Hand', 'noun', 'f', 'A1', '/hant/', 'Ich habe zwei Hände.', 43, 'https://via.placeholder.com/200?text=Hand', NOW(), NOW()),
('Fuß', 'Foot', 'noun', 'm', 'A1', '/fuːs/', 'Mein Fuß tut weh.', 44, 'https://via.placeholder.com/200?text=Fuß', NOW(), NOW()),

-- Descriptors (4)
('gut', 'good', 'adjective', NULL, 'A1', '/ɡuːt/', 'Das ist eine gute Idee.', 45, 'https://via.placeholder.com/200?text=gut', NOW(), NOW()),
('schlecht', 'bad', 'adjective', NULL, 'A1', '/ʃlɛçt/', 'Das Wetter ist schlecht.', 46, 'https://via.placeholder.com/200?text=schlecht', NOW(), NOW()),
('schön', 'beautiful', 'adjective', NULL, 'A1', '/ʃøːn/', 'Du bist sehr schön.', 47, 'https://via.placeholder.com/200?text=schön', NOW(), NOW()),
('hässlich', 'ugly', 'adjective', NULL, 'A1', '/ˈhɛslɪç/', 'Dieser Teppich ist hässlich.', 48, 'https://via.placeholder.com/200?text=hässlich', NOW(), NOW()),

-- Extra common words (2)
('Name', 'Name', 'noun', 'm', 'A1', '/ˈnaːmə/', 'Mein Name ist Michael.', 49, 'https://via.placeholder.com/200?text=Name', NOW(), NOW()),
('Alter', 'Age', 'noun', 'n', 'A1', '/ˈaltɐ/', 'Mein Alter ist 25 Jahre.', 50, 'https://via.placeholder.com/200?text=Alter', NOW(), NOW());

-- Seed greeting dialogue templates
DELETE FROM dialogue_templates WHERE template_name LIKE 'greeting_%';

INSERT INTO dialogue_templates (template_name, difficulty_level, user_prompt_template, ai_system_prompt)
VALUES
('greeting_hello_name', 1, 'You will greet the AI and introduce yourself using: "Hallo, ich heiße [name]"', 'You are a friendly German teacher. The user will greet you and introduce themselves. Respond warmly, repeat their name, and ask how they are. Keep it simple and A1 level. Response should be 1-2 sentences.'),
('greeting_how_are_you', 1, 'The AI will ask "Wie geht dir?" Respond with how you feel using: "Mir geht es [gut/schlecht]"', 'Ask the user how they are using "Wie geht dir?" in a friendly tone. Respond to their answer and maybe ask a follow-up like "Was machst du heute?" Keep it simple A1 level.'),
('greeting_farewell', 1, 'Say goodbye using: "Auf Wiedersehen!" or "Tschüss!"', 'The user wants to say goodbye. Respond warmly with "Auf Wiedersehen!" or "Tschüss!" Keep it friendly and encouraging.'),
('simple_question_age', 1, 'The AI will ask "Wie alt bist du?" Respond with: "Ich bin [number] Jahre alt"', 'Ask the user their age using "Wie alt bist du?" in a friendly tone. Respond positively to their answer. Keep it simple.'),
('simple_repeat', 1, 'The AI will say a simple word from the vocabulary list. Repeat it after listening carefully.', 'Say a simple A1 word clearly (e.g., "Buch", "Stuhl", "Hand"). Wait for the user to repeat it. Give encouragement like "Sehr gut!" or "Prima!"');
