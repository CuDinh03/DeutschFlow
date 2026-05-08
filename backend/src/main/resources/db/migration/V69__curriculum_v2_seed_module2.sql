-- V69: Seed Module 2 - Danh từ & Từ vựng lõi (Node 7-10)

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══ NODE 7: Nomen & Artikel ═══
('CORE_TRUNK',
 'Nomen & Artikel: der, die, das',
 'Danh từ & Quán từ: der, die, das',
 'Giống của danh từ tiếng Đức: der (nam), die (nữ), das (trung). Quy tắc nhận biết cơ bản.',
 '🔵', 'GRUNDLAGEN', 7, 2, 7, 'A1', 3, 150, 1,
 2, 'Hệ thống Danh từ & Từ vựng lõi', 'Nomen, Artikel & Grundwortschatz', 'LESSON',
 ARRAY['#Nomen','#Artikel','#Genus','#Grammatik'],
 '{
   "title":{"de":"Nomen & Artikel","vi":"Danh từ & Quán từ xác định"},
   "overview":{"de":"Jedes Nomen hat ein Genus: maskulin, feminin oder neutral.","vi":"Mọi danh từ tiếng Đức đều có GIỐNG: der (nam-m), die (nữ-f), das (trung-n). Đây là rào cản lớn nhất nhưng có một số quy tắc giúp bạn đoán đúng ~70%."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"3 giống: der / die / das"},"content":{"vi":"🔵 der (maskulin-m): der Mann, der Tisch, der Tag\n🔴 die (feminin-f): die Frau, die Schule, die Zeit\n🟢 das (neutral-n): das Kind, das Buch, das Haus\n\n⚠️ Giống KHÔNG liên quan đến giới tính thực tế!\ndas Mädchen (cô gái) = TRUNG tính!"},"tags":["#Artikel","#Genus"]},
     {"type":"RULE","title":{"vi":"Quy tắc nhận biết giống"},"content":{"vi":"🔴 die (-ung): die Wohnung, die Zeitung\n🔴 die (-heit/-keit): die Freiheit, die Möglichkeit\n🔴 die (-tion): die Information, die Station\n🔵 der (-er cho người): der Lehrer, der Fahrer\n🟢 das (-chen/-lein nhỏ): das Mädchen, das Brötchen\n🟢 das (Ge-): das Geschenk, das Getränk"},"tags":["#Genus","#Grammatik"]},
     {"type":"EXAMPLE","title":{"vi":"Luyện nhận diện"},"content":{"vi":"die Wohnung → -ung = die ✅\nder Computer → người/máy = der ✅\ndas Brötchen → -chen = das ✅\n\nBạn PHẢI học giống cùng với từ mới!"},"tags":["#Genus"]}
   ],
   "vocabulary":[
     {"id":"v_nom_01","german":"der Mann","meaning":"người đàn ông","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Mann ist groß.","example_vi":"Người đàn ông cao.","speak_de":"der Mann","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/man/"],"common_errors_vi":["nn đọc rõ /n/"],"ipa_target":"deːɐ̯ man"}},
     {"id":"v_nom_02","german":"die Frau","meaning":"người phụ nữ / vợ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Frau ist nett.","example_vi":"Người phụ nữ tốt bụng.","speak_de":"die Frau","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/fʁaʊ/"],"common_errors_vi":["au = /aʊ/"],"ipa_target":"diː fʁaʊ"}},
     {"id":"v_nom_03","german":"das Kind","meaning":"đứa trẻ","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Kind spielt.","example_vi":"Đứa trẻ chơi.","speak_de":"das Kind","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/kɪnt/"],"common_errors_vi":["d cuối = /t/"],"ipa_target":"das kɪnt"}},
     {"id":"v_nom_04","german":"die Wohnung","meaning":"căn hộ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Wohnung ist klein.","example_vi":"Căn hộ nhỏ.","speak_de":"die Wohnung","tags":["#Nomen","#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvoːnʊŋ/"],"common_errors_vi":["W = /v/, -ung = /ʊŋ/"],"ipa_target":"diː ˈvoːnʊŋ"}},
     {"id":"v_nom_05","german":"das Mädchen","meaning":"cô gái","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Mädchen ist jung.","example_vi":"Cô gái trẻ.","speak_de":"das Mädchen","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈmɛːtçən/"],"common_errors_vi":["-chen = /çən/, ä = /ɛː/"],"ipa_target":"das ˈmɛːtçən"}}
   ],
   "phrases":[{"german":"Was ist das?","meaning":"Đây là cái gì?","speak_de":"Was ist das?"},{"german":"Das ist ein Tisch.","meaning":"Đây là một cái bàn.","speak_de":"Das ist ein Tisch."}],
   "examples":[{"german":"Die Wohnung hat drei Zimmer.","translation":"Căn hộ có 3 phòng.","note":"-ung → die (nữ)","speak_de":"Die Wohnung hat drei Zimmer."}],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 8: Zahlen & Alter ═══
('CORE_TRUNK',
 'Zahlen 0-100 & Alter',
 'Số đếm 0-100 & Tuổi tác',
 'Số đếm từ 0 đến 100, cách đọc số ngược của tiếng Đức, hỏi đáp về tuổi.',
 '🔢', 'GRUNDLAGEN', 8, 2, 8, 'A1', 2, 120, 1,
 2, 'Hệ thống Danh từ & Từ vựng lõi', 'Nomen, Artikel & Grundwortschatz', 'LESSON',
 ARRAY['#Zahlen','#Alter','#Grundlagen'],
 '{
   "title":{"de":"Zahlen 0-100 & Alter","vi":"Số đếm 0-100 & Tuổi tác"},
   "overview":{"de":"Zahlen von 0 bis 100 und wie man nach dem Alter fragt.","vi":"Số đếm tiếng Đức có quy tắc ĐỌC NGƯỢC từ 21 trở lên: 21 = ein-und-zwanzig (một-và-hai mươi)."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"Số 0-20"},"content":{"vi":"0 null, 1 eins, 2 zwei, 3 drei, 4 vier, 5 fünf\n6 sechs, 7 sieben, 8 acht, 9 neun, 10 zehn\n11 elf, 12 zwölf, 13 dreizehn, 14 vierzehn\n15 fünfzehn, 16 sechzehn ⚠️(không phải sechszehn)\n17 siebzehn ⚠️(không phải siebenzehn)\n18 achtzehn, 19 neunzehn, 20 zwanzig"},"tags":["#Zahlen"]},
     {"type":"RULE","title":{"vi":"Umkehrregel: Số ngược 21-99"},"content":{"vi":"21 = einundzwanzig (1 và 20)\n35 = fünfunddreißig (5 và 30)\n47 = siebenundvierzig (7 và 40)\n99 = neunundneunzig\n\n⚠️ 30 = dreißig (ß, không phải z!)\nHàng chục: 30 dreißig, 40 vierzig, 50 fünfzig, 60 sechzig, 70 siebzig, 80 achtzig, 90 neunzig"},"tags":["#Zahlen","#Umkehrregel"]},
     {"type":"EXAMPLE","title":{"vi":"Hỏi tuổi"},"content":{"vi":"Wie alt bist du? — Ich bin 25 Jahre alt.\nWie alt sind Sie? — Ich bin dreißig.\n\nCấu trúc: sein + Zahl + Jahre alt"},"tags":["#Alter","#Frage"]}
   ],
   "vocabulary":[
     {"id":"v_zahl_01","german":"die Zahl","meaning":"con số","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Zahl ist groß.","example_vi":"Con số lớn.","speak_de":"die Zahl","tags":["#Nomen","#Zahlen","#A1"],"ai_speech_hints":{"focus_phonemes":["/tsaːl/"],"common_errors_vi":["z = /ts/"],"ipa_target":"diː tsaːl"}},
     {"id":"v_zahl_02","german":"das Jahr","meaning":"năm","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Ein Jahr hat 12 Monate.","example_vi":"Một năm có 12 tháng.","speak_de":"das Jahr","tags":["#Nomen","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/jaːɐ̯/"],"common_errors_vi":["j = /j/ như y"],"ipa_target":"das jaːɐ̯"}},
     {"id":"v_zahl_03","german":"alt","meaning":"già, tuổi","gender":null,"color_code":null,"gender_label":null,"example_de":"Wie alt bist du?","example_vi":"Bạn bao nhiêu tuổi?","speak_de":"alt","tags":["#Adjektiv","#Alter","#A1"],"ai_speech_hints":{"focus_phonemes":["/alt/"],"common_errors_vi":["Đọc rõ âm /t/ cuối"],"ipa_target":"alt"}}
   ],
   "phrases":[{"german":"Wie alt bist du?","meaning":"Bạn bao nhiêu tuổi?","speak_de":"Wie alt bist du?"},{"german":"Ich bin fünfundzwanzig Jahre alt.","meaning":"Tôi 25 tuổi.","speak_de":"Ich bin fünfundzwanzig Jahre alt."}],
   "examples":[{"german":"Meine Telefonnummer ist 0176-3842591.","translation":"Số điện thoại của tôi là...","note":"Đọc từng chữ số","speak_de":"null eins sieben sechs drei acht vier zwei fünf neun eins"}],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 9: W-Fragen ═══
('CORE_TRUNK',
 'W-Fragen: Wer, Was, Wo, Woher, Wie',
 'Câu hỏi W: Ai, Gì, Ở đâu, Từ đâu, Thế nào',
 'Các từ để hỏi cơ bản và cấu trúc câu hỏi có từ để hỏi.',
 '❓', 'GRUNDLAGEN', 9, 2, 9, 'A1', 2, 130, 1,
 2, 'Hệ thống Danh từ & Từ vựng lõi', 'Nomen, Artikel & Grundwortschatz', 'LESSON',
 ARRAY['#WFragen','#Fragesatz','#Satzbau'],
 '{
   "title":{"de":"W-Fragen","vi":"Câu hỏi W"},
   "overview":{"de":"W-Fragen: Wer, Was, Wo, Woher, Wie, Wann.","vi":"Câu hỏi W giúp bạn khai thác thông tin. Động từ vẫn ở vị trí 2 (V2) sau từ để hỏi."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"6 từ để hỏi cơ bản"},"content":{"vi":"Wer? = Ai? → Wer ist das? (Đó là ai?)\nWas? = Cái gì? → Was machst du? (Bạn làm gì?)\nWo? = Ở đâu? → Wo wohnst du? (Bạn sống ở đâu?)\nWoher? = Từ đâu? → Woher kommst du? (Bạn đến từ đâu?)\nWie? = Thế nào? → Wie heißt du? (Bạn tên gì?)\nWann? = Khi nào? → Wann kommst du? (Khi nào bạn đến?)"},"tags":["#WFragen"]},
     {"type":"RULE","title":{"vi":"Cấu trúc: W-Wort + V2"},"content":{"vi":"W-Wort | Verb | Subjekt | Rest\nWas    | machst | du    | heute?\nWo     | wohnst | du    | ?\nWie    | heißen | Sie   | ?\n\nĐộng từ LUÔN ở vị trí 2!"},"tags":["#WFragen","#V2Regel"]}
   ],
   "vocabulary":[
     {"id":"v_wf_01","german":"wohnen","meaning":"sống, ở","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich wohne in Berlin.","example_vi":"Tôi sống ở Berlin.","speak_de":"wohnen","tags":["#Verb","#Wohnen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvoːnən/"],"common_errors_vi":["w = /v/"],"ipa_target":"ˈvoːnən"}},
     {"id":"v_wf_02","german":"heißen","meaning":"tên là","gender":null,"color_code":null,"gender_label":null,"example_de":"Wie heißen Sie?","example_vi":"Quý vị tên gì?","speak_de":"heißen","tags":["#Verb","#Vorstellen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈhaɪsn̩/"],"common_errors_vi":["ei = /aɪ/, ß = /s/"],"ipa_target":"ˈhaɪsn̩"}},
     {"id":"v_wf_03","german":"kommen","meaning":"đến","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich komme aus Vietnam.","example_vi":"Tôi đến từ Việt Nam.","speak_de":"kommen","tags":["#Verb","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkɔmən/"],"common_errors_vi":["mm đọc ngắn"],"ipa_target":"ˈkɔmən"}}
   ],
   "phrases":[{"german":"Wie heißt du?","meaning":"Bạn tên gì?","speak_de":"Wie heißt du?"},{"german":"Woher kommen Sie?","meaning":"Quý vị từ đâu đến?","speak_de":"Woher kommen Sie?"}],
   "examples":[{"german":"Wo wohnst du? — Ich wohne in Hanoi.","translation":"Bạn sống ở đâu? — Tôi sống ở Hà Nội.","note":"W-Frage + V2","speak_de":"Wo wohnst du? Ich wohne in Hanoi."}],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 10: Akkusativ cơ bản ═══
('CORE_TRUNK',
 'Akkusativ: einen, eine, ein',
 'Akkusativ cơ bản: einen, eine, ein',
 'Cách 4 (Akkusativ) cơ bản: chỉ với Ich habe/brauche + Akkusativ.',
 '🎯', 'GRUNDLAGEN', 10, 2, 10, 'A1', 3, 160, 1,
 2, 'Hệ thống Danh từ & Từ vựng lõi', 'Nomen, Artikel & Grundwortschatz', 'REVIEW',
 ARRAY['#Akkusativ','#Grammatik','#Artikel'],
 '{
   "title":{"de":"Akkusativ Grundlagen","vi":"Akkusativ cơ bản"},
   "overview":{"de":"Akkusativ mit haben und brauchen.","vi":"Akkusativ (Cách 4) là cách của TÂN NGỮ TRỰC TIẾP. Ở A1, chỉ cần nhớ: chỉ DER đổi thành DEN/EINEN. Die và Das KHÔNG đổi."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"Akkusativ: Chỉ DER đổi!"},"content":{"vi":"Nominativ → Akkusativ:\n🔵 der → den / ein → einen (CHỈ CÁI NÀY ĐỔI!)\n🔴 die → die / eine → eine (KHÔNG đổi)\n🟢 das → das / ein → ein (KHÔNG đổi)\n\nIch habe einen Hund. (der Hund → einen Hund)\nIch habe eine Katze. (die Katze → eine Katze) ← không đổi\nIch habe ein Buch. (das Buch → ein Buch) ← không đổi"},"tags":["#Akkusativ","#Artikel"]},
     {"type":"RULE","title":{"vi":"Khi nào dùng Akkusativ?"},"content":{"vi":"Sau các động từ chỉ hành động hướng đến vật:\nhaben (có): Ich habe einen Bruder.\nbrauchen (cần): Ich brauche eine Tasche.\nmöchten (muốn): Ich möchte einen Kaffee.\n\n⚠️ Ở A1 chỉ cần nhớ: haben + Akkusativ, brauchen + Akkusativ"},"tags":["#Akkusativ","#Grammatik"]},
     {"type":"EXAMPLE","title":{"vi":"Ví dụ so sánh"},"content":{"vi":"Nominativ: Der Hund ist groß. (Con chó to.)\nAkkusativ: Ich habe einen Hund. (Tôi có một con chó.)\n\nNom: Der Kaffee ist heiß. (Cà phê nóng.)\nAkk: Ich möchte einen Kaffee. (Tôi muốn một ly cà phê.)"},"tags":["#Akkusativ"]}
   ],
   "vocabulary":[
     {"id":"v_akk_01","german":"der Hund","meaning":"con chó","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich habe einen Hund.","example_vi":"Tôi có một con chó.","speak_de":"der Hund","tags":["#Nomen","#Tier","#A1"],"ai_speech_hints":{"focus_phonemes":["/hʊnt/"],"common_errors_vi":["d cuối = /t/"],"ipa_target":"deːɐ̯ hʊnt"}},
     {"id":"v_akk_02","german":"die Katze","meaning":"con mèo","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich habe eine Katze.","example_vi":"Tôi có một con mèo.","speak_de":"die Katze","tags":["#Nomen","#Tier","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkatsə/"],"common_errors_vi":["tz = /ts/"],"ipa_target":"diː ˈkatsə"}},
     {"id":"v_akk_03","german":"brauchen","meaning":"cần","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich brauche einen Stift.","example_vi":"Tôi cần một cây bút.","speak_de":"brauchen","tags":["#Verb","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈbʁaʊxn̩/"],"common_errors_vi":["au = /aʊ/, ch = /x/"],"ipa_target":"ˈbʁaʊxn̩"}},
     {"id":"v_akk_04","german":"der Kaffee","meaning":"cà phê","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich möchte einen Kaffee.","example_vi":"Tôi muốn một ly cà phê.","speak_de":"der Kaffee","tags":["#Nomen","#Essen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkafeː/"],"common_errors_vi":["Nhấn âm đầu, ee = /eː/"],"ipa_target":"deːɐ̯ ˈkafeː"}}
   ],
   "phrases":[{"german":"Ich möchte einen Kaffee, bitte.","meaning":"Tôi muốn một ly cà phê, xin vui lòng.","speak_de":"Ich möchte einen Kaffee bitte."},{"german":"Ich brauche Hilfe.","meaning":"Tôi cần giúp đỡ.","speak_de":"Ich brauche Hilfe."}],
   "examples":[{"german":"Hast du einen Bruder? — Ja, ich habe einen Bruder und eine Schwester.","translation":"Bạn có anh/em trai không? — Có, tôi có một anh trai và một chị gái.","note":"einen Bruder (m→Akk), eine Schwester (f→không đổi)","speak_de":"Hast du einen Bruder? Ja, ich habe einen Bruder und eine Schwester."}],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb);

-- DAG: 7→6, 8→7, 9→8, 10→9
DO $$
DECLARE n6 BIGINT; n7 BIGINT; n8 BIGINT; n9 BIGINT; n10 BIGINT;
BEGIN
  SELECT id INTO n6 FROM skill_tree_nodes WHERE day_number = 6 LIMIT 1;
  SELECT id INTO n7 FROM skill_tree_nodes WHERE day_number = 7 LIMIT 1;
  SELECT id INTO n8 FROM skill_tree_nodes WHERE day_number = 8 LIMIT 1;
  SELECT id INTO n9 FROM skill_tree_nodes WHERE day_number = 9 LIMIT 1;
  SELECT id INTO n10 FROM skill_tree_nodes WHERE day_number = 10 LIMIT 1;
  INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
  VALUES (n7, n6, 'HARD', 60), (n8, n7, 'HARD', 60), (n9, n8, 'HARD', 60), (n10, n9, 'HARD', 60)
  ON CONFLICT DO NOTHING;
END $$;
