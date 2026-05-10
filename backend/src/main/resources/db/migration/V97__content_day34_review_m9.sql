-- V97: Day 34 — Review Module 9 (Gesundheit)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 9", "vi": "Ôn tập Module 9 — Sức khỏe"},
  "overview": {"de": "Wiederholung: Körperteile, Krankheiten, Arztbesuch, Apotheke, Modalverben.", "vi": "Ôn tập toàn bộ Module 9: bộ phận cơ thể, triệu chứng bệnh, tại bác sĩ, nhà thuốc và Modalverben (müssen/sollen/dürfen)."},
  "session_type": "REVIEW",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Bảng tổng hợp Modalverben"},"content":{"vi":"können = có thể (khả năng)\nIch kann Deutsch sprechen. (Tôi có thể nói tiếng Đức.)\n\nmüssen = phải (bắt buộc)\nIch muss heute arbeiten. (Hôm nay tôi phải đi làm.)\n\nsollen = nên/được bảo\nDu sollst mehr schlafen. (Bạn nên ngủ nhiều hơn.)\n\ndürfen = được phép\nHier darf man parken. (Ở đây được phép đậu xe.)\n\nwollen = muốn (mạnh)\nIch will Arzt werden. (Tôi muốn trở thành bác sĩ.)\n\nmöchten = muốn (lịch sự)\nIch möchte einen Termin. (Tôi muốn đặt lịch hẹn.)"},"tags":["#Modalverben","#Review"]},
    {"type":"RULE","title":{"vi":"''tut weh'' vs. ''habe Schmerzen'' — Khi nào dùng?"},"content":{"vi":"mir tut [Körperteil] weh:\n→ Tự nhiên trong hội thoại\n→ Mir tut der Kopf weh. (nhấn vào cảm giác)\n\nIch habe [Körperteil]schmerzen:\n→ Chính thức, thường dùng với bác sĩ\n→ Ich habe Kopfschmerzen. (tên gọi bệnh)\n\nIch habe...:\n→ Für allgemeine Beschwerden:\nIch habe Fieber / Husten / Schnupfen."},"tags":["#Grammatik","#Körper"]},
    {"type":"EXAMPLE","title":{"vi":"Tổng hợp: Mô tả sức khỏe + Nhà thuốc"},"content":{"vi":"Arzt: Was haben Sie? Was fehlt Ihnen?\nPatient: Mir tut der Bauch weh. Ich habe auch Fieber und mir ist schlecht.\nArzt: Seit wann? Haben Sie Allergien?\nPatient: Seit zwei Tagen. Ich bin allergisch gegen Penicillin.\nArzt: Ich verschreibe Paracetamol. Sie müssen viel trinken, sollen ausruhen und dürfen nicht arbeiten.\nIn der Apotheke: Ich habe ein Rezept. Darf ich Alkohol trinken?\nApotheker: Nein, das dürfen Sie nicht!"},"tags":["#Review","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_rev9_01","german":"sich ausruhen","meaning":"nghỉ ngơi","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie müssen sich mindestens 3 Tage ausruhen.","example_vi":"Bạn phải nghỉ ngơi ít nhất 3 ngày.","speak_de":"Sie müssen sich ausruhen.","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaʊ̯sˌʁuːən/"],"common_errors_vi":["ausruhen: aus-RUH-en, Trennbar"],"ipa_target":"zɪç ˈaʊ̯sˌʁuːən"}},
    {"id":"v_rev9_02","german":"die Krankmeldung","meaning":"giấy nghỉ bệnh","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich brauche eine Krankmeldung für meinen Arbeitgeber.","example_vi":"Tôi cần giấy nghỉ bệnh cho công ty.","speak_de":"eine Krankmeldung","tags":["#Arbeit","#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈkʁaŋkmɛldʊŋ/"],"common_errors_vi":["Krank-mel-dung: krank=/kʁaŋk/"],"ipa_target":"diː ˈkʁaŋkmɛldʊŋ"}},
    {"id":"v_rev9_03","german":"gesund","meaning":"khỏe mạnh","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich bin wieder gesund! Danke für Ihre Hilfe.","example_vi":"Tôi khỏe lại rồi! Cảm ơn đã giúp.","speak_de":"wieder gesund","tags":["#Gesundheit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɡəˈzʊnt/"],"common_errors_vi":["ge-SUND: d cuối →/t/"],"ipa_target":"ɡəˈzʊnt"}},
    {"id":"v_rev9_04","german":"Gute Besserung!","meaning":"Mau khỏi bệnh nhé!","gender":null,"color_code":null,"gender_label":null,"example_de":"Du bist krank? Gute Besserung!","example_vi":"Bạn bị bệnh à? Mau khỏi nhé!","speak_de":"Gute Besserung!","tags":["#Kommunikation","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈɡuːtə bɛˈsəʁʊŋ/"],"common_errors_vi":["Bes-ser-ung: bệt rõ từng âm tiết"],"ipa_target":"ˈɡuːtə bɛˈsəʁʊŋ"}},
    {"id":"v_rev9_05","german":"die Notaufnahme","meaning":"phòng cấp cứu","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Im Notfall: Rufen Sie 112 an oder gehen Sie in die Notaufnahme!","example_vi":"Trường hợp khẩn cấp: Gọi 112 hoặc đến phòng cấp cứu!","speak_de":"die Notaufnahme","tags":["#Gesundheit","#Notfall","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈnoːtˌʔaʊ̯fnaːmə/"],"common_errors_vi":["Not: /noːt/, Aufnahme: auf+nehmen"],"ipa_target":"diː ˈnoːtˌʔaʊ̯fnaːmə"}}
  ],
  "phrases": [
    {"german":"Gute Besserung!","meaning":"Mau khỏi bệnh nhé!","speak_de":"Gute Besserung!"},
    {"german":"Ich fühle mich viel besser, danke!","meaning":"Tôi cảm thấy khỏe hơn nhiều, cảm ơn!","speak_de":"Ich fühle mich viel besser."},
    {"german":"Im Notfall bitte 112 anrufen!","meaning":"Trường hợp khẩn cấp gọi 112!","speak_de":"Bitte 112 anrufen!"}
  ],
  "examples": [
    {"german":"Ich war letzte Woche krank. Ich hatte Fieber und Halsschmerzen. Der Arzt hat mir Antibiotika verschrieben. Ich musste 5 Tage zu Hause bleiben. Jetzt bin ich wieder gesund!","translation":"Tuần trước tôi bị bệnh. Tôi sốt và đau họng. Bác sĩ kê kháng sinh. Tôi phải ở nhà 5 ngày. Bây giờ tôi khỏe lại rồi!","note":"Dùng Perfekt (Vergangenheit) để kể về bệnh đã qua","speak_de":"Jetzt bin ich wieder gesund!"},
    {"german":"Wichtige Nummern: 112 = Notfall (Feuerwehr + Notarzt), 110 = Polizei, 116 117 = Ärztlicher Bereitschaftsdienst (außerhalb der Sprechzeiten)","translation":"Số quan trọng: 112 = Cấp cứu (cứu hỏa + bác sĩ khẩn), 110 = Cảnh sát, 116 117 = Bác sĩ trực (ngoài giờ)","note":"Cần nhớ! 112 miễn phí từ mọi điện thoại","speak_de":"Im Notfall: eins-eins-zwei!"}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg34_01","type":"MULTIPLE_CHOICE","question_vi":"''Sie dürfen keinen Alkohol trinken'' dùng Modalverb gì?","options":["müssen","sollen","dürfen","können"],"correct":2},
      {"id":"tg34_02","type":"FILL_BLANK","sentence_de":"___ tut ___ Bauch weh. Ich habe auch ___. (ich, Fieber)","hint_vi":"Mir ... der ... Fieber","answer":"Mir, der, Fieber","accept_also":["Mir / der / Fieber"]},
      {"id":"tg34_03","type":"MULTIPLE_CHOICE","question_vi":"''Gute Besserung!'' nói khi nào?","options":["Khi ai đó tốt nghiệp","Khi ai đó bị bệnh","Khi ai đó sinh nhật","Khi ai đó đi du lịch"],"correct":1},
      {"id":"tg34_04","type":"FILL_BLANK","sentence_de":"Ich ___ mich ausruhen und ___ nicht arbeiten.","hint_vi":"phải ... không được phép","answer":"muss, darf","accept_also":["muss / darf"]},
      {"id":"tg34_05","type":"MULTIPLE_CHOICE","question_vi":"Số điện thoại cấp cứu ở Đức là gì?","options":["110","112","115","116"],"correct":1}
    ],
    "practice": [
      {"id":"p34_01","type":"TRANSLATE","from":"vi","sentence":"Tôi đau lưng từ một tuần. Tôi phải đặt lịch hẹn bác sĩ. Có thể tôi cần đơn thuốc.","answer":"Ich habe seit einer Woche Rückenschmerzen. Ich muss einen Arzttermin machen. Vielleicht brauche ich ein Rezept.","accept_also":["Mir tut der Rücken seit einer Woche weh. Ich muss zum Arzt. Vielleicht bekomme ich ein Rezept."]},
      {"id":"p34_02","type":"REORDER","words":["Besserung!","Gute","krank?","Sie","Sind"],"correct_order":["Sind","Sie","krank?","Gute","Besserung!"],"translation":"Bạn bị bệnh à? Mau khỏi nhé!"},
      {"id":"p34_03","type":"FILL_BLANK","sentence_de":"— Was ___ Ihnen? — Mir ___ der Kopf weh und ich ___ Fieber.","hint_vi":"fehlt ... tut ... habe","answer":"fehlt, tut, habe","accept_also":["fehlt / tut / habe"]}
    ]
  },
  "reading_passage": {
    "text_de": "Gesund leben in Deutschland\n\nIn Deutschland legen die Menschen großen Wert auf Gesundheit. Das Gesundheitssystem ist sehr gut: Es gibt viele Ärzte, Krankenhäuser und Apotheken. Jeder Arbeitnehmer hat eine Krankenversicherung. Im Krankheitsfall kann man jederzeit zum Arzt gehen. Der Arzt schreibt, wenn nötig, eine Krankmeldung. Wichtig: Man muss spätestens am dritten Krankheitstag eine Krankmeldung beim Arbeitgeber vorlegen. Im Notfall ruft man 112 an — der Notruf ist kostenlos.",
    "text_vi": "Sống khỏe mạnh ở Đức\n\nỞ Đức người ta rất coi trọng sức khỏe. Hệ thống y tế rất tốt: có nhiều bác sĩ, bệnh viện và nhà thuốc. Mỗi người đi làm đều có bảo hiểm y tế. Khi bệnh có thể đến bác sĩ bất cứ lúc nào. Bác sĩ nếu cần sẽ viết giấy nghỉ bệnh. Quan trọng: Phải nộp giấy nghỉ bệnh cho công ty chậm nhất vào ngày bệnh thứ ba. Trường hợp khẩn cấp gọi 112 — miễn phí.",
    "questions": [
      {"id":"rq34_01","type":"FILL_BLANK","question_vi":"Phải nộp giấy nghỉ bệnh chậm nhất vào ngày thứ mấy?","answer":"dritten Krankheitstag","accept_also":["am dritten Tag","Tag drei","3. Tag"]},
      {"id":"rq34_02","type":"MULTIPLE_CHOICE","question_vi":"112 có tốn tiền không?","options":["Ja, 0,50 Euro","Ja, sehr teuer","Nein, kostenlos","Nur aus dem Festnetz"],"correct":2}
    ]
  },
  "writing_prompt": {
    "task_de": "Sie waren krank und möchten Ihrem Freund/Ihrer Freundin davon erzählen. Was hatten Sie? Was hat der Arzt gesagt? Wie geht es Ihnen jetzt? (6-7 Sätze, Perfekt)",
    "task_vi": "Bạn vừa khỏi bệnh và muốn kể cho bạn bè nghe. Bạn bị gì? Bác sĩ nói gì? Bây giờ thế nào? (6-7 câu, dùng Perfekt)",
    "min_sentences": 6,
    "example_answer": "Letzte Woche war ich richtig krank!\nIch hatte hohes Fieber und starke Kopfschmerzen.\nIch bin zum Arzt gegangen.\nDer Arzt hat gesagt, ich habe eine Grippe.\nIch musste 5 Tage im Bett bleiben und durfte nicht arbeiten.\nIch habe viel getrunken und geschlafen.\nJetzt bin ich wieder gesund — Gott sei Dank!"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Gute Besserung!","meaning":"Mau khỏi bệnh nhé!"},
      {"text":"Ich fühle mich besser.","meaning":"Tôi cảm thấy khỏe hơn."},
      {"text":"die Krankmeldung","meaning":"giấy nghỉ bệnh"},
      {"text":"Im Notfall: 112!","meaning":"Cấp cứu: 112!"},
      {"text":"Sie müssen sich ausruhen.","meaning":"Bạn phải nghỉ ngơi."}
    ],
    "listen_dialogue": "Wie geht es Ihnen? — Viel besser, danke! Letzte Woche war ich krank — Fieber und Halsschmerzen. — Gute Besserung! Sind Sie zum Arzt gegangen? — Ja, er hat Antibiotika verschrieben. Jetzt bin ich wieder fit!"
  }
}'::jsonb
WHERE day_number = 34 AND is_active = TRUE;
