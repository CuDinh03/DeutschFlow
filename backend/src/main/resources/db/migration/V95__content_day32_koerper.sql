-- V95: Day 32 — Körperteile & Krankheiten

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Körperteile & Krankheiten", "vi": "Bộ phận cơ thể & Bệnh tật"},
  "overview": {"de": "Körperteile nennen und Krankheiten beschreiben. Dativ erweitert.", "vi": "Học bộ phận cơ thể và mô tả triệu chứng bệnh. Rất quan trọng khi đến bệnh viện/phòng khám ở Đức. Cũng học cách dùng ''tut weh'' (đau) với Dativ."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Nói về đau: tut weh + Dativ"},"content":{"vi":"Cấu trúc: [Körperteil im Nominativ] tut [mir/dir/ihm/ihr] weh.\nMir tut der Kopf weh. — Tôi bị đau đầu.\nDir tut der Bauch weh? — Bạn đau bụng à?\nIhm tut die Hand weh. — Anh ấy đau tay.\nihr tut das Bein weh. — Cô ấy đau chân.\n\nHoặc: Ich habe Kopfschmerzen. / Ich habe Bauchschmerzen.\n(-schmerzen = đau → Kopfschmerzen, Halsschmerzen, Rückenschmerzen)"},"tags":["#Körper","#Dativ","#Schmerzen"]},
    {"type":"RULE","title":{"vi":"Triệu chứng phổ biến"},"content":{"vi": "Ich bin krank. — Tôi bị bệnh.\nIch habe Fieber. — Tôi bị sốt.\nIch habe Husten. — Tôi ho.\nIch habe Schnupfen. — Tôi bị sổ mũi.\nMir ist schlecht. / Mir ist übel. — Tôi buồn nôn.\nIch bin müde. — Tôi mệt.\nIch kann nicht schlafen. — Tôi không ngủ được.\nIch brauche ein Rezept. — Tôi cần đơn thuốc."},"tags":["#Krankheit","#Symptome"]},
    {"type":"EXAMPLE","title":{"vi":"Tại phòng khám"},"content":{"vi":"Patient: Guten Tag, ich möchte einen Termin.\nRezeption: Was fehlt Ihnen?\nPatient: Mir tut der Hals sehr weh und ich habe Fieber.\nArzt: Seit wann haben Sie diese Beschwerden?\nPatient: Seit drei Tagen.\nArzt: Ich schreibe Ihnen ein Rezept. Nehmen Sie dreimal täglich eine Tablette."},"tags":["#Arzt","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_koer_01","german":"der Kopf","meaning":"cái đầu","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Mir tut der Kopf weh. Ich habe Kopfschmerzen.","example_vi":"Tôi đau đầu.","speak_de":"der Kopf","tags":["#Körper","#A1"],"ai_speech_hints":{"focus_phonemes":["/kɔpf/"],"common_errors_vi":["pf cuối: /pf/"],"ipa_target":"deːɐ̯ kɔpf"}},
    {"id":"v_koer_02","german":"der Hals","meaning":"cổ họng / cổ","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich habe Halsschmerzen — ich kann kaum schlucken.","example_vi":"Tôi đau họng — nuốt khó lắm.","speak_de":"der Hals","tags":["#Körper","#A1"],"ai_speech_hints":{"focus_phonemes":["/hals/"],"common_errors_vi":["ls cuối: l+s rõ ràng"],"ipa_target":"deːɐ̯ hals"}},
    {"id":"v_koer_03","german":"der Rücken","meaning":"lưng","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich sitze den ganzen Tag und habe Rückenschmerzen.","example_vi":"Tôi ngồi cả ngày nên bị đau lưng.","speak_de":"der Rücken","tags":["#Körper","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʁʏkən/"],"common_errors_vi":["ü tròn môi, ck=/k/"],"ipa_target":"deːɐ̯ ˈʁʏkən"}},
    {"id":"v_koer_04","german":"das Fieber","meaning":"sốt","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Ich habe 38,5 Grad Fieber.","example_vi":"Tôi sốt 38,5 độ.","speak_de":"Ich habe Fieber","tags":["#Krankheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfiːbɐ/"],"common_errors_vi":["ie=/iː/, -ber=/bɐ/"],"ipa_target":"das ˈfiːbɐ"}},
    {"id":"v_koer_05","german":"der Husten / der Schnupfen","meaning":"ho / sổ mũi","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich habe Husten und Schnupfen — wahrscheinlich eine Erkältung.","example_vi":"Tôi ho và sổ mũi — có lẽ bị cảm.","speak_de":"Husten und Schnupfen","tags":["#Krankheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈhuːstən/","/ˈʃnʊpfən/"],"common_errors_vi":["Husten: H bật, Schnupfen: Schn=/ʃn/"],"ipa_target":"deːɐ̯ ˈhuːstən"}},
    {"id":"v_koer_06","german":"die Tablette","meaning":"viên thuốc","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Nehmen Sie zweimal täglich eine Tablette nach dem Essen.","example_vi":"Uống hai lần mỗi ngày một viên sau bữa ăn.","speak_de":"eine Tablette nehmen","tags":["#Medizin","#A1"],"ai_speech_hints":{"focus_phonemes":["/taˈblɛtə/"],"common_errors_vi":["Tab-LET-te: nhấn LET"],"ipa_target":"diː taˈblɛtə"}},
    {"id":"v_koer_07","german":"das Rezept","meaning": "đơn thuốc","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Ohne Rezept bekomme ich das Medikament nicht.","example_vi":"Không có đơn tôi không mua được thuốc.","speak_de":"ein Rezept","tags":["#Medizin","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʁeˈtsɛpt/"],"common_errors_vi":["Re-ZEPT: z=/ts/"],"ipa_target":"das ʁeˈtsɛpt"}}
  ],
  "phrases": [
    {"german":"Mir tut der Bauch weh.","meaning":"Tôi bị đau bụng.","speak_de":"Mir tut der Bauch weh."},
    {"german":"Seit wann haben Sie Fieber?","meaning":"Bạn bị sốt từ khi nào?","speak_de":"Seit wann haben Sie Fieber?"},
    {"german":"Ich brauche einen Arzttermin.","meaning":"Tôi cần đặt lịch hẹn bác sĩ.","speak_de":"Ich brauche einen Arzttermin."}
  ],
  "examples": [
    {"german":"— Was fehlt Ihnen? — Mir tut der Hals sehr weh, ich habe Husten und 38 Grad Fieber. — Seit wann? — Seit zwei Tagen. — Ich verschreibe Ihnen Antibiotika.","translation":"— Bạn bị gì? — Tôi đau họng nhiều, ho và sốt 38 độ. — Từ khi nào? — Từ hai ngày nay. — Tôi kê cho bạn kháng sinh.","note":"Was fehlt Ihnen? = Bạn bị gì? (lịch sự)","speak_de":"Mir tut der Hals sehr weh."},
    {"german":"Ich kann nicht zur Arbeit kommen — ich bin krank. Mir ist schlecht und ich habe starke Kopfschmerzen. Ich bleibe heute im Bett.","translation":"Tôi không thể đến làm — tôi bị bệnh. Tôi buồn nôn và đau đầu dữ. Hôm nay tôi nằm nghỉ.","note":"stark = mạnh/dữ dội; im Bett bleiben = nằm trên giường","speak_de":"Ich bin krank und bleibe im Bett."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg32_01","type":"FILL_BLANK","sentence_de":"___ tut ___ Kopf weh. (ich)","hint_vi":"Mir... der","answer":"Mir, der","accept_also":["mir / der"]},
      {"id":"tg32_02","type":"MULTIPLE_CHOICE","question_vi":"''Was fehlt Ihnen?'' = ?","options":["Bạn thiếu gì?","Bạn bị gì vậy?","Bạn muốn gì?","Bạn ở đâu?"],"correct":1},
      {"id":"tg32_03","type":"FILL_BLANK","sentence_de":"Ich habe ___ und ___. Wahrscheinlich eine Erkältung.","hint_vi":"ho ... sổ mũi","answer":"Husten, Schnupfen","accept_also":["Husten / Schnupfen"]},
      {"id":"tg32_04","type":"MULTIPLE_CHOICE","question_vi":"''Nehmen Sie dreimal täglich eine Tablette'' — täglich nghĩa là gì?","options":["mỗi giờ","mỗi ngày","mỗi tuần","mỗi bữa"],"correct":1},
      {"id":"tg32_05","type":"FILL_BLANK","sentence_de":"___ ___ haben Sie diese Beschwerden?","hint_vi":"Từ bao giờ (seit wann)?","answer":"Seit wann","accept_also":["seit wann"]}
    ],
    "practice": [
      {"id":"p32_01","type":"TRANSLATE","from":"vi","sentence":"Tôi bị đau lưng từ ba ngày nay. Tôi cần đặt lịch hẹn bác sĩ.","answer":"Ich habe seit drei Tagen Rückenschmerzen. Ich brauche einen Arzttermin.","accept_also":["Mir tut der Rücken seit drei Tagen weh. Ich brauche einen Termin beim Arzt."]},
      {"id":"p32_02","type":"REORDER","words":["weh.","Hals","tut","sehr","Mir","der"],"correct_order":["Mir","tut","der","Hals","sehr","weh."],"translation":"Tôi đau họng nhiều."},
      {"id":"p32_03","type":"FILL_BLANK","sentence_de":"Ich ___ 39 Grad Fieber und ___ mir schlecht.","hint_vi":"có ... cảm thấy (mir ist)","answer":"habe, ist","accept_also":["habe / ist"]}
    ]
  },
  "reading_passage": {
    "text_de": "Beim Hausarzt\n\nMinh geht zum Hausarzt. Die Sprechstundenhilfe fragt: ''Was haben Sie?'' Minh antwortet: ''Mir tut der Hals weh, ich habe Husten und seit gestern Fieber — 38,5 Grad.'' Der Arzt untersucht ihn: ''Öffnen Sie den Mund. Sagen Sie Aaah.'' Er schaut in den Hals: ''Sie haben eine Halsentzündung. Ich verschreibe Ihnen Antibiotika. Nehmen Sie dreimal täglich eine Tablette, immer nach dem Essen. Trinken Sie viel Wasser und ruhen Sie sich aus.'' Minh bekommt auch eine Krankmeldung für drei Tage.",
    "text_vi": "Tại phòng khám gia đình\n\nMinh đến bác sĩ gia đình. Y tá hỏi: ''Anh bị gì?'' Minh trả lời: ''Tôi đau họng, ho và từ hôm qua sốt — 38,5 độ.'' Bác sĩ khám: ''Mở miệng ra. Nói Aaah.'' Ông nhìn vào họng: ''Anh bị viêm họng. Tôi kê kháng sinh. Uống ba lần mỗi ngày một viên, luôn sau bữa ăn. Uống nhiều nước và nghỉ ngơi.'' Minh còn nhận được giấy nghỉ bệnh ba ngày.",
    "questions": [
      {"id":"rq32_01","type":"MULTIPLE_CHOICE","question_vi":"Minh bị bệnh gì?","options":["Erkältung","Grippe","Halsentzündung","Magenprobleme"],"correct":2},
      {"id":"rq32_02","type":"FILL_BLANK","question_vi":"Minh uống thuốc bao nhiêu lần một ngày?","answer":"dreimal","accept_also":["drei Mal","3 Mal täglich"]}
    ]
  },
  "writing_prompt": {
    "task_de": "Sie sind krank und schreiben eine Nachricht an Ihren Chef/Ihre Chefin. Erklären Sie, was Ihnen fehlt. (5-6 Sätze)",
    "task_vi": "Bạn bị bệnh và nhắn tin cho sếp. Giải thích bạn bị gì. (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Sehr geehrter Herr Müller,\n\nleider kann ich heute nicht zur Arbeit kommen.\nMir tut der Kopf sehr weh und ich habe 38 Grad Fieber.\nIch habe auch Husten und Schnupfen.\nIch war heute beim Arzt und habe eine Krankmeldung für 2 Tage bekommen.\nIch melde mich, sobald es mir besser geht.\n\nMit freundlichen Grüßen,\nMinh"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Mir tut der Kopf weh.","meaning":"Tôi đau đầu."},
      {"text":"Ich habe Fieber.","meaning":"Tôi bị sốt."},
      {"text":"Was fehlt Ihnen?","meaning":"Bạn bị gì vậy?"},
      {"text":"Seit wann?","meaning":"Từ bao giờ?"},
      {"text":"Nehmen Sie täglich eine Tablette.","meaning":"Mỗi ngày uống một viên."}
    ],
    "listen_dialogue": "Guten Tag! Was fehlt Ihnen? — Mir tut der Bauch sehr weh und ich habe Fieber. — Seit wann? — Seit gestern Abend. — Haben Sie auch Übelkeit? — Ja, mir ist schlecht. — Ich untersuche Sie jetzt."
  }
}'::jsonb
WHERE day_number = 32 AND is_active = TRUE;
