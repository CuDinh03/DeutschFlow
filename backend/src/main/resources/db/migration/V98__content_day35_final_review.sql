-- V98: Day 35 — Großes Review & Prüfungsvorbereitung A1

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Großes Review & A1-Prüfungsvorbereitung", "vi": "Ôn tập tổng hợp & Chuẩn bị thi A1"},
  "overview": {"de": "Abschließende Wiederholung aller Module und Prüfungsvorbereitung für Goethe-Zertifikat A1.", "vi": "Bài tổng ôn tập tất cả 9 module. Chuẩn bị thi Goethe-Zertifikat A1 với đầy đủ 4 kỹ năng: Hören (Nghe), Lesen (Đọc), Schreiben (Viết), Sprechen (Nói)."},
  "session_type": "FINAL_REVIEW",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Cấu trúc bài thi Goethe A1"},"content":{"vi":"Goethe-Zertifikat A1 gồm 4 phần:\n1. HÖREN (Nghe) — 20 phút, 15 điểm\n   - Alltagsgespräche hiểu thông tin cụ thể\n2. LESEN (Đọc) — 25 phút, 15 điểm\n   - Biển báo, quảng cáo, tin nhắn ngắn\n3. SCHREIBEN (Viết) — 20 phút, 15 điểm\n   - Điền form, viết email ngắn\n4. SPRECHEN (Nói) — 15 phút, 15 điểm\n   - Vorstellen + Bilder beschreiben + Dialog\n\nĐậu khi đạt ≥ 60% tổng điểm (45/75)"},"tags":["#Prüfung","#A1"]},
    {"type":"RULE","title":{"vi":"Bảng ngữ pháp A1 cần nắm"},"content":{"vi":"✅ Personalpronomen: ich, du, er/sie/es, wir, ihr, sie/Sie\n✅ Konjugation Präsens: alle Verben\n✅ Artikel: der/die/das, ein/eine/ein\n✅ Kein/keine/keinen\n✅ Possessivpronomen: mein/dein/sein/ihr\n✅ Nominativ + Akkusativ + Dativ Grundzüge\n✅ Modalverben: können, müssen, möchten, dürfen\n✅ Perfekt: haben/sein + Partizip II\n✅ Trennbare Verben\n✅ Zeitpräpositionen: am, im, um, von...bis, seit\n✅ Lokalpräpositionen: in, an, auf, neben, zwischen"},"tags":["#Grammatik","#A1","#Review"]},
    {"type":"EXAMPLE","title":{"vi":"Sprechen Teil 1: Sich vorstellen"},"content":{"vi":"Hallo! Ich heiße [Name].\nIch komme aus [Land].\nIch wohne in [Stadt/Ort] seit [Zeit].\nIch bin [Alter] Jahre alt.\nVon Beruf bin ich [Beruf].\nMeine Hobbys sind [Hobby1] und [Hobby2].\nIch lerne Deutsch, weil ich in Deutschland arbeite/lebe.\n\n→ Diese 7 Sätze reichen für Teil 1!"},"tags":["#Sprechen","#Vorstellen","#A1"]}
  ],
  "vocabulary": [
    {"id":"v_fin_01","german":"die Prüfung","meaning":"bài thi","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich mache im Juli die A1-Prüfung.","example_vi":"Tháng 7 tôi thi A1.","speak_de":"die Prüfung bestehen","tags":["#Prüfung","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈpʁyːfʊŋ/"],"common_errors_vi":["Prü-fung: ü tròn môi"],"ipa_target":"diː ˈpʁyːfʊŋ"}},
    {"id":"v_fin_02","german":"bestehen / durchfallen","meaning":"đậu / rớt (thi)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich hoffe, dass ich die Prüfung bestehe!","example_vi":"Tôi hy vọng sẽ đậu kỳ thi!","speak_de":"die Prüfung bestehen","tags":["#Prüfung","#A1"],"ai_speech_hints":{"focus_phonemes":["/bəˈʃteːən/"],"common_errors_vi":["be-STEH-en: nhấn STEH"],"ipa_target":"bəˈʃteːən"}},
    {"id":"v_fin_03","german":"der Wortschatz","meaning":"vốn từ vựng","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Für A1 braucht man ca. 700 Wörter Wortschatz.","example_vi":"Thi A1 cần khoảng 700 từ vựng.","speak_de":"der Wortschatz","tags":["#Lernen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvɔʁtˌʃats/"],"common_errors_vi":["Wort: W=/v/, sch=/ʃ/, tz=/ts/"],"ipa_target":"deːɐ̯ ˈvɔʁtˌʃats"}},
    {"id":"v_fin_04","german":"üben","meaning":"luyện tập","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich übe jeden Tag 30 Minuten Deutsch.","example_vi":"Mỗi ngày tôi luyện tiếng Đức 30 phút.","speak_de":"jeden Tag üben","tags":["#Lernen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈyːbən/"],"common_errors_vi":["üben: ü tròn môi, b=/b/"],"ipa_target":"ˈyːbən"}},
    {"id":"v_fin_05","german":"wiederholen","meaning":"ôn tập / lặp lại","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich wiederhole heute alle Grammatikregeln.","example_vi":"Hôm nay tôi ôn tập tất cả các quy tắc ngữ pháp.","speak_de":"wiederholen","tags":["#Lernen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˌviːdɐˈhoːlən/"],"common_errors_vi":["Wieder-HO-len: nhấn HO"],"ipa_target":"ˌviːdɐˈhoːlən"}},
    {"id":"v_fin_06","german":"viel Erfolg!","meaning":"chúc thành công!","gender":null,"color_code":null,"gender_label":null,"example_de":"Morgen habe ich Prüfung. — Viel Erfolg!","example_vi":"Ngày mai tôi thi. — Chúc thành công!","speak_de":"Viel Erfolg!","tags":["#Kommunikation","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɛɐ̯ˈfɔlk/"],"common_errors_vi":["Er-FOLG: g cuối →/k/"],"ipa_target":"fiːl ɛɐ̯ˈfɔlk"}}
  ],
  "phrases": [
    {"german":"Ich habe fleißig für die Prüfung gelernt.","meaning":"Tôi đã học chăm chỉ cho kỳ thi.","speak_de":"Ich habe fleißig gelernt."},
    {"german":"Herzlichen Glückwunsch! Sie haben bestanden!","meaning":"Chúc mừng! Bạn đã đậu!","speak_de":"Herzlichen Glückwunsch!"},
    {"german":"Mit Übung wird man besser!","meaning":"Luyện tập thì tiến bộ!","speak_de":"Mit Übung wird man besser!"}
  ],
  "examples": [
    {"german":"A1-Prüfung Sprechen — Übungsmonolog:\n''Hallo! Ich heiße Minh und komme aus Vietnam. Ich wohne seit einem Jahr in Hamburg und arbeite als Koch. Ich bin 28 Jahre alt. In meiner Freizeit lerne ich Deutsch, koche und gehe spazieren. Ich lerne Deutsch, weil ich besser kommunizieren möchte.''","translation":"Bài nói thực hành A1:\n''Xin chào! Tôi tên Minh và đến từ Việt Nam. Tôi sống ở Hamburg được một năm và làm đầu bếp. Tôi 28 tuổi. Lúc rảnh tôi học tiếng Đức, nấu ăn và đi dạo. Tôi học tiếng Đức vì muốn giao tiếp tốt hơn.''","note":"7 câu đủ cho phần Vorstellen A1","speak_de":"Hallo! Ich heiße Minh."},
    {"german":"Wichtige Redemittel für die Prüfung:\nIch verstehe nicht. / Können Sie das bitte wiederholen?\nWie bitte? / Könnten Sie langsamer sprechen?\nIch weiß nicht genau, aber... / Ich meine, dass...\nEntschuldigung, wie schreibt man das?","translation":"Câu hữu ích trong thi:\nTôi không hiểu. / Bạn có thể nhắc lại không?\nCó thể nói lại? / Có thể nói chậm hơn không?\nTôi không chắc lắm, nhưng... / Tôi nghĩ rằng...\nXin lỗi, cái đó viết thế nào?","note":"Đừng im lặng! Nói gì đó dù không chắc","speak_de":"Können Sie bitte langsamer sprechen?"}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg35_01","type":"MULTIPLE_CHOICE","question_vi":"Bài thi A1 gồm mấy phần?","options":["2","3","4","5"],"correct":2},
      {"id":"tg35_02","type":"FILL_BLANK","sentence_de":"Ich ___ seit ___ Jahren in Deutschland und ___ als Pfleger.","hint_vi":"sống ... ba ... làm việc","answer":"wohne, drei, arbeite","accept_also":["lebe, drei, arbeite"]},
      {"id":"tg35_03","type":"MULTIPLE_CHOICE","question_vi":"Perfekt của ''gehen'' là gì?","options":["hat gegangen","ist gegangen","hat gegeht","ist gegeht"],"correct":1},
      {"id":"tg35_04","type":"FILL_BLANK","sentence_de":"Ich ___ die Prüfung ___ — ich habe 80% erreicht!","hint_vi":"đã đậu kỳ thi","answer":"habe, bestanden","accept_also":["habe / bestanden"]},
      {"id":"tg35_05","type":"MULTIPLE_CHOICE","question_vi":"Để đậu A1, cần đạt tối thiểu bao nhiêu %?","options":["50%","60%","70%","80%"],"correct":1}
    ],
    "practice": [
      {"id":"p35_01","type":"TRANSLATE","from":"vi","sentence":"Tôi học tiếng Đức được 6 tháng. Tôi muốn thi A1 vào tháng 7. Tôi hy vọng sẽ đậu!","answer":"Ich lerne seit sechs Monaten Deutsch. Im Juli möchte ich die A1-Prüfung machen. Ich hoffe, dass ich bestehe!","accept_also":["Ich lerne Deutsch seit 6 Monaten. Die A1-Prüfung ist im Juli. Hoffentlich bestehe ich!"]},
      {"id":"p35_02","type":"REORDER","words":["bestanden!","haben","Herzlichen","Glückwunsch!","Sie"],"correct_order":["Herzlichen","Glückwunsch!","Sie","haben","bestanden!"],"translation":"Chúc mừng! Bạn đã đậu!"},
      {"id":"p35_03","type":"FILL_BLANK","sentence_de":"— Wie geht es Ihnen? — ___ gut, danke. Und ___?\n— Ich ___ mich ein bisschen müde — ich ___ gestern für die Prüfung ___.","hint_vi":"Danke ... Ihnen ... fühle ... habe...gelernt","answer":"Danke, Ihnen, fühle, habe, gelernt","accept_also":["Danke / Ihnen / fühle / habe / gelernt"]}
    ]
  },
  "reading_passage": {
    "text_de": "Mein Deutschkurs — Ein Rückblick\n\nVor 9 Monaten habe ich mit Deutschlernen angefangen. Zuerst war es sehr schwer — so viele Artikel und Regeln! Aber ich habe jeden Tag geübt: eine Stunde morgens und eine Stunde abends.\n\nIch habe gelernt: mich vorzustellen, über meine Familie zu sprechen, einkaufen zu gehen, beim Arzt zu kommunizieren und Wegbeschreibungen zu verstehen. Das ist viel!\n\nNächsten Monat mache ich die Goethe A1-Prüfung. Ich bin nervös, aber auch zuversichtlich. Meine Lehrerin sagt: ''Viel Erfolg, Minh! Du schaffst das!''\n\nNach A1 fange ich sofort mit A2 an!",
    "text_vi": "Khóa tiếng Đức của tôi — Nhìn lại\n\nCách đây 9 tháng tôi bắt đầu học tiếng Đức. Lúc đầu rất khó — nhiều mạo từ và quy tắc quá! Nhưng tôi luyện tập mỗi ngày: một tiếng buổi sáng và một tiếng buổi tối.\n\nTôi đã học: giới thiệu bản thân, nói về gia đình, đi mua sắm, giao tiếp với bác sĩ và hiểu chỉ đường. Nhiều thật!\n\nTháng tới tôi thi Goethe A1. Tôi hồi hộp nhưng cũng tự tin. Giáo viên nói: ''Chúc thành công, Minh! Bạn làm được!''\n\nSau A1 tôi sẽ học A2 ngay!",
    "questions": [
      {"id":"rq35_01","type":"FILL_BLANK","question_vi":"Minh học tiếng Đức bao lâu rồi?","answer":"9 Monate","accept_also":["neun Monate","seit 9 Monaten"]},
      {"id":"rq35_02","type":"MULTIPLE_CHOICE","question_vi":"Sau A1 Minh sẽ làm gì?","options":["Er hört auf zu lernen.","Er macht eine Pause.","Er fängt mit A2 an.","Er geht zurück nach Vietnam."],"correct":2}
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie Ihre Vorstellung für die A1-Prüfung (Sprechen Teil 1). Mindestens 6 Informationen über sich selbst.",
    "task_vi": "Viết phần giới thiệu bản thân cho thi A1 (Nói phần 1). Ít nhất 6 thông tin về bản thân.",
    "min_sentences": 6,
    "example_answer": "Guten Tag! Ich stelle mich vor.\nMein Name ist Lan Nguyen.\nIch komme aus Vietnam, aus Ho-Chi-Minh-Stadt.\nIch wohne seit einem Jahr in Frankfurt.\nIch bin 26 Jahre alt.\nVon Beruf bin ich Krankenpflegerin.\nIn meiner Freizeit lerne ich Deutsch und koche gern vietnamesisches Essen.\nIch lerne Deutsch, weil ich in Deutschland arbeiten und leben möchte.\nVielen Dank!"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Viel Erfolg bei der Prüfung!","meaning":"Chúc may mắn trong kỳ thi!"},
      {"text":"Herzlichen Glückwunsch!","meaning":"Chúc mừng!"},
      {"text":"Ich habe bestanden!","meaning":"Tôi đã đậu!"},
      {"text":"Können Sie das bitte wiederholen?","meaning":"Bạn có thể nhắc lại không?"},
      {"text":"Ich verstehe nicht — wie bitte?","meaning":"Tôi không hiểu — bạn nói gì ạ?"}
    ],
    "listen_dialogue": "Herzlichen Glückwunsch — Sie haben die A1-Prüfung bestanden! — Wirklich? Ich bin so froh! — Sie haben 68 von 75 Punkten erreicht. — Das ist wunderbar! Jetzt fange ich mit A2 an!"
  }
}'::jsonb
WHERE day_number = 35 AND is_active = TRUE;
