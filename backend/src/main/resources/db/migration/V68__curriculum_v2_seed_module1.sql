-- V68: Seed Module 1 - Verben & Câu đơn (Node 4-6)

INSERT INTO skill_tree_nodes (
  node_type, title_de, title_vi, description_vi, emoji,
  phase, day_number, week_number, sort_order, cefr_level,
  difficulty, xp_reward, energy_cost, module_number, module_title_vi,
  module_title_de, session_type, tags, content_json
) VALUES

-- ═══ NODE 4: Personalpronomen & sein ═══
('CORE_TRUNK',
 'Personalpronomen & sein',
 'Đại từ nhân xưng & động từ sein',
 'Học đại từ nhân xưng ich/du/er/sie/es/wir/ihr/sie/Sie và chia động từ sein.',
 '👤', 'GRUNDLAGEN', 4, 1, 4, 'A1', 2, 120, 1,
 1, 'Nền tảng Động từ & Câu đơn', 'Grundverben & einfache Sätze', 'LESSON',
 ARRAY['#Pronomen','#sein','#Konjugation','#Grundlagen'],
 '{
   "title":{"de":"Personalpronomen & sein","vi":"Đại từ nhân xưng & động từ sein"},
   "overview":{"de":"Die Personalpronomen und das Verb sein.","vi":"Đại từ nhân xưng là nền tảng. Động từ sein (thì/là/ở) là động từ quan trọng nhất trong tiếng Đức."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"Đại từ nhân xưng"},"content":{"vi":"ich = tôi\ndu = bạn (thân mật)\ner = anh ấy | sie = cô ấy | es = nó\nwir = chúng tôi\nihr = các bạn (thân mật)\nsie = họ | Sie = Bạn/Quý vị (lịch sự)"},"tags":["#Pronomen"]},
     {"type":"RULE","title":{"vi":"Chia động từ sein"},"content":{"vi":"ich bin — Ich bin Student.\ndu bist — Du bist nett.\ner/sie/es ist — Er ist groß.\nwir sind — Wir sind Freunde.\nihr seid — Ihr seid hier.\nsie/Sie sind — Sie sind Lehrer."},"tags":["#sein","#Konjugation"]},
     {"type":"EXAMPLE","title":{"vi":"sein trong câu"},"content":{"vi":"Ich bin Maria. (Tôi là Maria.)\nDu bist aus Vietnam. (Bạn đến từ Việt Nam.)\nDas ist gut. (Điều đó tốt.)"},"tags":["#sein","#Satzbau"]}
   ],
   "vocabulary":[
     {"id":"v_sein_01","german":"sein","meaning":"thì, là, ở","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin Student.","example_vi":"Tôi là sinh viên.","speak_de":"sein","tags":["#Verb","#sein","#A1"],"ai_speech_hints":{"focus_phonemes":["/zaɪn/"],"common_errors_vi":["s đầu từ đọc /z/ không phải /s/"],"ipa_target":"zaɪn"}},
     {"id":"v_sein_02","german":"der Student","meaning":"sinh viên (nam)","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Er ist Student.","example_vi":"Anh ấy là sinh viên.","speak_de":"der Student","tags":["#Nomen","#Beruf","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃt/"],"common_errors_vi":["st đầu = /ʃt/"],"ipa_target":"deːɐ̯ ʃtuˈdɛnt"}},
     {"id":"v_sein_03","german":"nett","meaning":"tốt bụng, dễ thương","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie ist sehr nett.","example_vi":"Cô ấy rất tốt bụng.","speak_de":"nett","tags":["#Adjektiv","#A1"],"ai_speech_hints":{"focus_phonemes":["/nɛt/"],"common_errors_vi":["tt cuối đọc rõ /t/"],"ipa_target":"nɛt"}},
     {"id":"v_sein_04","german":"der Freund","meaning":"bạn (nam)","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Er ist mein Freund.","example_vi":"Anh ấy là bạn tôi.","speak_de":"der Freund","tags":["#Nomen","#Familie","#A1"],"ai_speech_hints":{"focus_phonemes":["/fʁɔʏnt/"],"common_errors_vi":["eu = /ɔʏ/, d cuối = /t/"],"ipa_target":"deːɐ̯ fʁɔʏnt"}}
   ],
   "phrases":[
     {"german":"Ich bin aus Vietnam.","meaning":"Tôi đến từ Việt Nam.","speak_de":"Ich bin aus Vietnam."},
     {"german":"Wer bist du?","meaning":"Bạn là ai?","speak_de":"Wer bist du?"},
     {"german":"Woher kommen Sie?","meaning":"Quý vị đến từ đâu?","speak_de":"Woher kommen Sie?"}
   ],
   "examples":[
     {"german":"Ich bin 25 Jahre alt.","translation":"Tôi 25 tuổi.","note":"Cấu trúc nói tuổi: sein + Zahl + Jahre alt","speak_de":"Ich bin fünfundzwanzig Jahre alt."}
   ],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 5: haben & Grundverben ═══
('CORE_TRUNK',
 'haben & Grundverben',
 'haben & Động từ cơ bản',
 'Chia động từ haben và các động từ có quy tắc: machen, lernen, arbeiten.',
 '⚡', 'GRUNDLAGEN', 5, 1, 5, 'A1', 2, 130, 1,
 1, 'Nền tảng Động từ & Câu đơn', 'Grundverben & einfache Sätze', 'LESSON',
 ARRAY['#haben','#Konjugation','#RegelmäßigeVerben'],
 '{
   "title":{"de":"haben & Grundverben","vi":"haben & Động từ cơ bản"},
   "overview":{"de":"Das Verb haben und regelmäßige Verben.","vi":"haben (có) là trụ cột thứ 2. Cùng với sein, bạn đã có thể đặt hầu hết các câu cơ bản."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"Chia động từ haben"},"content":{"vi":"ich habe — Ich habe ein Buch.\ndu hast — Du hast Zeit.\ner/sie/es hat — Sie hat einen Hund.\nwir haben — Wir haben Hunger.\nihr habt — Ihr habt Glück.\nsie/Sie haben — Sie haben Kinder."},"tags":["#haben","#Konjugation"]},
     {"type":"RULE","title":{"vi":"Động từ có quy tắc"},"content":{"vi":"Công thức: Gốc + đuôi (-e, -st, -t, -en, -t, -en)\nmachen (làm): ich mache, du machst, er macht\nlernen (học): ich lerne, du lernst, er lernt\narbeiten (làm việc): ich arbeite, du arbeitest, er arbeitet\n\n⚠️ arbeiten: thêm e trước -st, -t vì gốc kết thúc bằng -t"},"tags":["#Konjugation","#RegelmäßigeVerben"]},
     {"type":"EXAMPLE","title":{"vi":"Ví dụ trong câu"},"content":{"vi":"Ich habe zwei Kinder. (Tôi có 2 con.)\nWir lernen Deutsch. (Chúng tôi học tiếng Đức.)\nEr arbeitet in Berlin. (Anh ấy làm việc ở Berlin.)"},"tags":["#haben","#Satzbau"]}
   ],
   "vocabulary":[
     {"id":"v_hab_01","german":"haben","meaning":"có","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe Zeit.","example_vi":"Tôi có thời gian.","speak_de":"haben","tags":["#Verb","#haben","#A1"],"ai_speech_hints":{"focus_phonemes":["/haːbn̩/"],"common_errors_vi":["h đọc bật hơi rõ"],"ipa_target":"ˈhaːbn̩"}},
     {"id":"v_hab_02","german":"machen","meaning":"làm","gender":null,"color_code":null,"gender_label":null,"example_de":"Was machst du?","example_vi":"Bạn làm gì?","speak_de":"machen","tags":["#Verb","#A1"],"ai_speech_hints":{"focus_phonemes":["/maxn̩/"],"common_errors_vi":["ch = ach-Laut /x/"],"ipa_target":"ˈmaxn̩"}},
     {"id":"v_hab_03","german":"lernen","meaning":"học","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich lerne Deutsch.","example_vi":"Tôi học tiếng Đức.","speak_de":"lernen","tags":["#Verb","#Schule","#A1"],"ai_speech_hints":{"focus_phonemes":["/lɛʁnən/"],"common_errors_vi":["r đọc /ʁ/ (uvular)"],"ipa_target":"ˈlɛʁnən"}},
     {"id":"v_hab_04","german":"die Zeit","meaning":"thời gian","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich habe keine Zeit.","example_vi":"Tôi không có thời gian.","speak_de":"die Zeit","tags":["#Nomen","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/tsaɪt/"],"common_errors_vi":["z = /ts/"],"ipa_target":"diː tsaɪt"}}
   ],
   "phrases":[
     {"german":"Ich habe eine Frage.","meaning":"Tôi có một câu hỏi.","speak_de":"Ich habe eine Frage."},
     {"german":"Was machst du beruflich?","meaning":"Bạn làm nghề gì?","speak_de":"Was machst du beruflich?"}
   ],
   "examples":[
     {"german":"Sie hat einen Hund und eine Katze.","translation":"Cô ấy có một con chó và một con mèo.","note":"einen = Akkusativ (sẽ học ở Module 2)","speak_de":"Sie hat einen Hund und eine Katze."}
   ],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb),

-- ═══ NODE 6: V2-Regel ═══
('CORE_TRUNK',
 'V2-Regel & Aussagesatz',
 'Quy tắc V2 & Câu trần thuật',
 'Quy tắc vàng: Động từ LUÔN đứng vị trí số 2 trong câu trần thuật.',
 '📏', 'GRUNDLAGEN', 6, 1, 6, 'A1', 3, 140, 1,
 1, 'Nền tảng Động từ & Câu đơn', 'Grundverben & einfache Sätze', 'LESSON',
 ARRAY['#V2Regel','#Satzbau','#Aussagesatz'],
 '{
   "title":{"de":"V2-Regel & Aussagesatz","vi":"Quy tắc V2 & Câu trần thuật"},
   "overview":{"de":"Das Verb steht immer auf Position 2.","vi":"Quy tắc V2 là quy tắc VÀNG của tiếng Đức: Động từ chia luôn đứng ở vị trí thứ 2 trong câu trần thuật, bất kể bạn bắt đầu câu bằng gì."},
   "session_type":"LESSON",
   "theory_cards":[
     {"type":"RULE","title":{"vi":"V2: Động từ vị trí số 2"},"content":{"vi":"Pos 1 (Chủ ngữ/Trạng từ) | Pos 2 (ĐỘNG TỪ) | Pos 3+ (phần còn lại)\n\nIch | lerne | Deutsch.\nHeute | lerne | ich Deutsch.\nDeutsch | lerne | ich heute.\n\n⚠️ Dù đổi vị trí Pos 1, động từ LUÔN ở Pos 2!"},"tags":["#V2Regel","#Satzbau"]},
     {"type":"RULE","title":{"vi":"Câu hỏi Ja/Nein"},"content":{"vi":"Câu hỏi Có/Không: Động từ đứng Pos 1\nLernst du Deutsch? (Bạn học tiếng Đức à?)\nBist du Student? (Bạn là sinh viên à?)\nHaben Sie Zeit? (Quý vị có thời gian không?)"},"tags":["#Fragesatz","#Satzbau"]},
     {"type":"EXAMPLE","title":{"vi":"So sánh V2 tiếng Đức vs tiếng Việt"},"content":{"vi":"🇻🇳 Hôm nay tôi học tiếng Đức.\n🇩🇪 Heute lerne ich Deutsch.\n\n🇻🇳 Tiếng Đức tôi học hôm nay.\n🇩🇪 Deutsch lerne ich heute.\n\nĐộng từ lerne luôn ở vị trí 2!"},"tags":["#V2Regel"]}
   ],
   "vocabulary":[
     {"id":"v_v2_01","german":"heute","meaning":"hôm nay","gender":null,"color_code":null,"gender_label":null,"example_de":"Heute lerne ich Deutsch.","example_vi":"Hôm nay tôi học tiếng Đức.","speak_de":"heute","tags":["#Adverb","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈhɔʏtə/"],"common_errors_vi":["eu = /ɔʏ/"],"ipa_target":"ˈhɔʏtə"}},
     {"id":"v_v2_02","german":"auch","meaning":"cũng","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich lerne auch Englisch.","example_vi":"Tôi cũng học tiếng Anh.","speak_de":"auch","tags":["#Adverb","#A1"],"ai_speech_hints":{"focus_phonemes":["/aʊx/"],"common_errors_vi":["ch cuối = ach-Laut /x/"],"ipa_target":"aʊx"}},
     {"id":"v_v2_03","german":"aber","meaning":"nhưng","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin müde, aber ich lerne.","example_vi":"Tôi mệt, nhưng tôi học.","speak_de":"aber","tags":["#Konjunktion","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaːbɐ/"],"common_errors_vi":["b đọc /b/ rõ ràng"],"ipa_target":"ˈaːbɐ"}}
   ],
   "phrases":[
     {"german":"Ich verstehe das nicht.","meaning":"Tôi không hiểu.","speak_de":"Ich verstehe das nicht."},
     {"german":"Sprechen Sie bitte langsam.","meaning":"Xin hãy nói chậm.","speak_de":"Sprechen Sie bitte langsam."}
   ],
   "examples":[
     {"german":"Morgen gehe ich ins Kino.","translation":"Ngày mai tôi đi xem phim.","note":"Morgen ở Pos 1, gehe ở Pos 2","speak_de":"Morgen gehe ich ins Kino."}
   ],
   "exercises":{"theory_gate":[],"practice":[]},"reading_passage":null,"audio_content":null,"writing_prompt":null
 }'::jsonb);

-- DAG: 4→3, 5→4, 6→5
DO $$
DECLARE n3 BIGINT; n4 BIGINT; n5 BIGINT; n6 BIGINT;
BEGIN
  SELECT id INTO n3 FROM skill_tree_nodes WHERE day_number = 3 LIMIT 1;
  SELECT id INTO n4 FROM skill_tree_nodes WHERE day_number = 4 LIMIT 1;
  SELECT id INTO n5 FROM skill_tree_nodes WHERE day_number = 5 LIMIT 1;
  SELECT id INTO n6 FROM skill_tree_nodes WHERE day_number = 6 LIMIT 1;
  INSERT INTO skill_tree_node_dependencies (node_id, depends_on_node_id, dependency_type, min_score_percent)
  VALUES (n4, n3, 'HARD', 60), (n5, n4, 'HARD', 60), (n6, n5, 'HARD', 60)
  ON CONFLICT DO NOTHING;
END $$;
