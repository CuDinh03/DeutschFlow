-- V67: Seed Module 0 - Phonetik (Node 1-3) with full content_json

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══ NODE 1: Alphabet & Sonderzeichen ═══
('CORE_TRUNK',
 'Alphabet & Sonderzeichen (Teil 1)',
 'Bảng chữ cái & Âm đặc trưng (P1)',
 'Học bảng chữ cái tiếng Đức: A-Z, Umlaut ä ö ü, Eszett ß, nguyên âm kép ei ie eu.',
 '🔤', 'PHONETIK', 1, 1, 1, 'A1', 1, 100, 1,
 0, 'Nhập môn & Ngữ âm', 'Einführung & Phonetik', 'LESSON',
 ARRAY['#Alphabet','#Vokale','#Phonetik','#Umlaut'],
 '{
   "title": {"de":"Alphabet & Sonderzeichen","vi":"Bảng chữ cái & Âm đặc trưng"},
   "overview": {"de":"Das deutsche Alphabet hat 26 Buchstaben plus ä, ö, ü und ß.","vi":"Bảng chữ cái tiếng Đức có 26 chữ cái cộng thêm ä, ö, ü và ß. Đây là nền tảng quan trọng nhất."},
   "session_type": "LESSON",
   "theory_cards": [
     {"type":"RULE","title":{"vi":"Umlaut: ä, ö, ü"},"content":{"vi":"ä = e kéo dài (như \"é\" trong tiếng Việt)\nö = tròn môi + phát âm ơ\nü = tròn môi + phát âm i"},"tags":["#Umlaut","#Phonetik"]},
     {"type":"RULE","title":{"vi":"Eszett: ß"},"content":{"vi":"ß phát âm như ss. Chỉ dùng sau nguyên âm dài hoặc nguyên âm kép.\nVí dụ: Straße (đường phố), groß (to lớn)"},"tags":["#Eszett","#Phonetik"]},
     {"type":"EXAMPLE","title":{"vi":"Nguyên âm kép: ei, ie, eu"},"content":{"vi":"ei = /ai/ (như \"ai\" tiếng Việt): mein, dein, nein\nie = /iː/ (như \"i\" kéo dài): die, wie, Bier\neu = /ɔʏ/ (như \"oi\"): heute, Freund, neu"},"tags":["#Diphthonge","#Phonetik"]}
   ],
   "vocabulary": [
     {"id":"v_abc_01","german":"das Alphabet","meaning":"bảng chữ cái","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Alphabet hat 26 Buchstaben.","example_vi":"Bảng chữ cái có 26 chữ cái.","speak_de":"das Alphabet","tags":["#Nomen","#Grundlagen","#A1"],"ai_speech_hints":{"focus_phonemes":["/alfaˈbeːt/"],"common_errors_vi":["Nhấn âm cuối -bet, không phải đầu"],"ipa_target":"das alfaˈbeːt"}},
     {"id":"v_abc_02","german":"der Buchstabe","meaning":"chữ cái","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"A ist ein Buchstabe.","example_vi":"A là một chữ cái.","speak_de":"der Buchstabe","tags":["#Nomen","#Grundlagen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈbuːxʃtaːbə/"],"common_errors_vi":["Âm /x/ trong buch - người Việt hay đọc thành k"],"ipa_target":"deːɐ̯ ˈbuːxʃtaːbə"}},
     {"id":"v_abc_03","german":"die Aussprache","meaning":"cách phát âm","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Aussprache ist wichtig.","example_vi":"Cách phát âm rất quan trọng.","speak_de":"die Aussprache","tags":["#Nomen","#Phonetik","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaʊ̯sʃpʁaːxə/"],"common_errors_vi":["Cụm au đọc /ao/, spr đọc /ʃpr/"],"ipa_target":"diː ˈaʊ̯sʃpʁaːxə"}},
     {"id":"v_abc_04","german":"groß","meaning":"to, lớn","gender":null,"color_code":null,"gender_label":null,"example_de":"Das Haus ist groß.","example_vi":"Ngôi nhà to.","speak_de":"groß","tags":["#Adjektiv","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɡʁoːs/"],"common_errors_vi":["ß đọc là ss, không phải z"],"ipa_target":"ɡʁoːs"}},
     {"id":"v_abc_05","german":"die Straße","meaning":"đường phố","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Straße ist lang.","example_vi":"Con đường dài.","speak_de":"die Straße","tags":["#Nomen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʃtʁaːsə/"],"common_errors_vi":["str đọc /ʃtr/ không phải /str/"],"ipa_target":"diː ˈʃtʁaːsə"}}
   ],
   "phrases": [
     {"german":"Wie buchstabiert man das?","meaning":"Đánh vần thế nào?","speak_de":"Wie buchstabiert man das?"},
     {"german":"Können Sie das wiederholen?","meaning":"Bạn có thể nhắc lại không?","speak_de":"Können Sie das wiederholen?"}
   ],
   "examples": [
     {"german":"A, B, C, D, E, F, G...","translation":"A, B, C, D, E, F, G...","note":"26 chữ cái cơ bản giống tiếng Anh","speak_de":"A B C D E F G"},
     {"german":"Ä, Ö, Ü, ß","translation":"Ä, Ö, Ü, ß","note":"4 ký tự đặc trưng tiếng Đức","speak_de":"Ä Ö Ü Eszett"}
   ],
   "exercises":{"theory_gate":[],"practice":[]},
   "reading_passage":null,
   "audio_content":null,
   "writing_prompt":null
 }'::jsonb),

-- ═══ NODE 2: Diphthonge & Vokale ═══
('CORE_TRUNK',
 'Diphthonge & Vokale (Teil 2)',
 'Nguyên âm kép & Nguyên âm (P2)',
 'Luyện phát âm ei/ie/eu/äu/au — các cặp nguyên âm kép dễ nhầm nhất.',
 '🗣️', 'PHONETIK', 2, 1, 2, 'A1', 1, 100, 1,
 0, 'Nhập môn & Ngữ âm', 'Einführung & Phonetik', 'LESSON',
 ARRAY['#Diphthonge','#Phonetik','#Vokale'],
 '{
   "title": {"de":"Diphthonge & Vokale","vi":"Nguyên âm kép & Nguyên âm"},
   "overview": {"de":"Die wichtigsten Diphthonge: ei, ie, eu, äu, au.","vi":"Nguyên âm kép là điểm khó nhất cho người Việt. ei ≠ ie là lỗi phổ biến nhất."},
   "session_type": "LESSON",
   "theory_cards": [
     {"type":"RULE","title":{"vi":"ei vs ie — Cặp đôi tử thần"},"content":{"vi":"ei = /aɪ/ (đọc như \"ai\"): mein, dein, nein, Ei\nie = /iː/ (đọc như \"i\" dài): die, wie, Bier, spielen\n\n⚠️ Mẹo: Đọc chữ CÁI THỨ HAI!\nei → đọc \"i\" → /aɪ/\nie → đọc \"e\" → /iː/"},"tags":["#Diphthonge","#Phonetik"]},
     {"type":"RULE","title":{"vi":"eu/äu & au"},"content":{"vi":"eu = äu = /ɔʏ/ (như \"oi\"): heute, Häuser, neu\nau = /aʊ/ (như \"ao\"): Haus, Frau, blau"},"tags":["#Diphthonge","#Phonetik"]},
     {"type":"EXAMPLE","title":{"vi":"Luyện phân biệt"},"content":{"vi":"Bein (chân) vs Biene (con ong)\nwein (rượu) vs Wien (thành phố Vienna)\nReise (chuyến đi) vs Riese (người khổng lồ)"},"tags":["#Phonetik"]}
   ],
   "vocabulary": [
     {"id":"v_diph_01","german":"das Ei","meaning":"quả trứng","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Ei ist weiß.","example_vi":"Quả trứng màu trắng.","speak_de":"das Ei","tags":["#Nomen","#Essen","#A1"],"ai_speech_hints":{"focus_phonemes":["/aɪ/"],"common_errors_vi":["ei đọc /ai/ không phải /ei/"],"ipa_target":"das aɪ"}},
     {"id":"v_diph_02","german":"das Bier","meaning":"bia","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Bier ist kalt.","example_vi":"Bia lạnh.","speak_de":"das Bier","tags":["#Nomen","#Essen","#A1"],"ai_speech_hints":{"focus_phonemes":["/iː/"],"common_errors_vi":["ie đọc /iː/ dài, không phải /ie/"],"ipa_target":"das biːɐ̯"}},
     {"id":"v_diph_03","german":"die Frau","meaning":"người phụ nữ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Frau ist nett.","example_vi":"Người phụ nữ tốt bụng.","speak_de":"die Frau","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/aʊ/"],"common_errors_vi":["au đọc /ao/"],"ipa_target":"diː fʁaʊ"}},
     {"id":"v_diph_04","german":"heute","meaning":"hôm nay","gender":null,"color_code":null,"gender_label":null,"example_de":"Heute ist Montag.","example_vi":"Hôm nay là thứ Hai.","speak_de":"heute","tags":["#Adverb","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɔʏ/"],"common_errors_vi":["eu đọc /oi/"],"ipa_target":"ˈhɔʏtə"}}
   ],
   "phrases": [
     {"german":"Wie spricht man das aus?","meaning":"Phát âm thế nào?","speak_de":"Wie spricht man das aus?"}
   ],
   "examples": [
     {"german":"Mein Freund trinkt ein Bier.","translation":"Bạn tôi uống một ly bia.","note":"ei trong mein = /aɪ/, ie trong Bier = /iː/","speak_de":"Mein Freund trinkt ein Bier"}
   ],
   "exercises":{"theory_gate":[],"practice":[]},
   "reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 3: Konsonanten ═══
('CORE_TRUNK',
 'Konsonantengruppen & Aussprache (Teil 3)',
 'Cụm phụ âm & Phát âm (P3)',
 'Luyện các cụm phụ âm khó: sch, ch (ich/ach), sp, st, pf, z.',
 '🔊', 'PHONETIK', 3, 1, 3, 'A1', 2, 120, 1,
 0, 'Nhập môn & Ngữ âm', 'Einführung & Phonetik', 'LESSON',
 ARRAY['#Konsonanten','#Phonetik','#Aussprache'],
 '{
   "title": {"de":"Konsonantengruppen","vi":"Cụm phụ âm tiếng Đức"},
   "overview": {"de":"Wichtige Konsonantengruppen: sch, ch, sp, st, pf, z.","vi":"Các cụm phụ âm là thử thách lớn cho người Việt. Đặc biệt ch có 2 cách đọc khác nhau."},
   "session_type": "LESSON",
   "theory_cards": [
     {"type":"RULE","title":{"vi":"ch: ich-Laut vs ach-Laut"},"content":{"vi":"ich-Laut /ç/: sau e, i, ü, ö, äu, eu → ich, recht, möchte\nach-Laut /x/: sau a, o, u, au → Buch, noch, auch\n\n⚠️ Người Việt: /ç/ giống \"sh\" nhẹ, /x/ giống \"kh\" trong tiếng Việt"},"tags":["#ch","#Phonetik"]},
     {"type":"RULE","title":{"vi":"sch, sp, st"},"content":{"vi":"sch = /ʃ/ (như \"s\" trong tiếng Việt): Schule, Tisch\nsp ở đầu từ = /ʃp/: sprechen, spielen\nst ở đầu từ = /ʃt/: Straße, Stuhl"},"tags":["#sch","#Phonetik"]},
     {"type":"RULE","title":{"vi":"pf & z"},"content":{"vi":"pf = /pf/ (bật hơi): Pferd, Apfel, Kopf\nz = /ts/: zehn, Zug, Katze\n\n⚠️ z tiếng Đức KHÔNG đọc như z tiếng Anh!"},"tags":["#pf","#z","#Phonetik"]}
   ],
   "vocabulary": [
     {"id":"v_kons_01","german":"die Schule","meaning":"trường học","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die Schule ist groß.","example_vi":"Trường học lớn.","speak_de":"die Schule","tags":["#Nomen","#Schule","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃ/"],"common_errors_vi":["sch đọc /s/ thay vì /ʃ/"],"ipa_target":"diː ˈʃuːlə"}},
     {"id":"v_kons_02","german":"das Buch","meaning":"quyển sách","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Das Buch ist interessant.","example_vi":"Quyển sách thú vị.","speak_de":"das Buch","tags":["#Nomen","#Schule","#A1"],"ai_speech_hints":{"focus_phonemes":["/x/"],"common_errors_vi":["ch sau u = ach-Laut /x/, giống kh"],"ipa_target":"das buːx"}},
     {"id":"v_kons_03","german":"sprechen","meaning":"nói","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich spreche Deutsch.","example_vi":"Tôi nói tiếng Đức.","speak_de":"sprechen","tags":["#Verb","#Kommunikation","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃpʁ/","/ç/"],"common_errors_vi":["spr đọc /ʃpr/, ch cuối = ich-Laut /ç/"],"ipa_target":"ˈʃpʁɛçn̩"}},
     {"id":"v_kons_04","german":"der Apfel","meaning":"quả táo","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Apfel ist rot.","example_vi":"Quả táo màu đỏ.","speak_de":"der Apfel","tags":["#Nomen","#Essen","#A1"],"ai_speech_hints":{"focus_phonemes":["/pf/"],"common_errors_vi":["pf phải bật hơi, không bỏ p"],"ipa_target":"deːɐ̯ ˈapfl̩"}},
     {"id":"v_kons_05","german":"zehn","meaning":"mười","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin zehn Jahre alt.","example_vi":"Tôi mười tuổi.","speak_de":"zehn","tags":["#Zahlen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ts/"],"common_errors_vi":["z đọc /ts/ không phải /z/"],"ipa_target":"tseːn"}}
   ],
   "phrases": [
     {"german":"Ich spreche ein bisschen Deutsch.","meaning":"Tôi nói một chút tiếng Đức.","speak_de":"Ich spreche ein bisschen Deutsch."},
     {"german":"Entschuldigung!","meaning":"Xin lỗi!","speak_de":"Entschuldigung"}
   ],
   "examples": [
     {"german":"Ich möchte ein Buch.","translation":"Tôi muốn một quyển sách.","note":"ch trong ich = /ç/, ch trong Buch = /x/","speak_de":"Ich möchte ein Buch"}
   ],
   "exercises":{"theory_gate":[],"practice":[]},
   "reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb);

-- DAG: Node 2 depends on Node 1, Node 3 depends on Node 2
DO $$
DECLARE n1 BIGINT; n2 BIGINT; n3 BIGINT;
BEGIN
  SELECT id INTO n1 FROM skill_tree_nodes WHERE day_number = 1 LIMIT 1;
  SELECT id INTO n2 FROM skill_tree_nodes WHERE day_number = 2 LIMIT 1;
  SELECT id INTO n3 FROM skill_tree_nodes WHERE day_number = 3 LIMIT 1;
  INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
  VALUES (n2, n1, 'HARD', 60), (n3, n2, 'HARD', 60)
  ON CONFLICT DO NOTHING;
END $$;
