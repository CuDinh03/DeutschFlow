-- V90: Day 27 — Wochentage, Monate, Jahreszeiten & Zeitpräpositionen

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Wochentage, Monate & Jahreszeiten", "vi": "Thứ, Tháng & Mùa"},
  "overview": {"de": "Wochentage, Monate, Jahreszeiten und Zeitpräpositionen am, im, um, von...bis.", "vi": "Học thứ trong tuần, tháng, mùa và các giới từ thời gian quan trọng. Người Việt hay nhầm am/im/um — bài này sẽ giải thích rõ từng trường hợp!"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Giới từ thời gian: am / im / um"},"content":{"vi":"AM + Wochentag/Datum:\nam Montag (thứ Hai), am 5. Mai (ngày 5/5)\nam Morgen / am Abend\n\nIM + Monat/Jahreszeit:\nim Januar, im Sommer (mùa hè)\nim Urlaub (trong kỳ nghỉ)\n\nUM + Uhrzeit:\num 9 Uhr, um Mitternacht\n\n⚠️ Nhớ: AM-Wochentag | IM-Monat | UM-Uhrzeit"},"tags":["#Zeitpräpositionen","#am","#im","#um"]},
    {"type":"RULE","title":{"vi":"Wochentage — Thứ trong tuần"},"content":{"vi":"Montag (T2) — Dienstag (T3) — Mittwoch (T4)\nDonnerstag (T5) — Freitag (T6)\nSamstag/Sonnabend (T7) — Sonntag (CN)\n\nDeutschland: Woche beginnt mit Montag!\n(Không phải Sonntag như Mỹ)\n\nAm Wochenende = T7 và CN\nwochentags / werktags = ngày thường (T2-T6)"},"tags":["#Wochentage","#Kalender"]},
    {"type":"EXAMPLE","title":{"vi":"Tháng & Mùa + Giới từ"},"content":{"vi":"Monate: Januar, Februar, März, April, Mai, Juni, Juli, August, September, Oktober, November, Dezember\n\nJahreszeiten:\nder Frühling (Xuân) — März bis Mai\nder Sommer (Hạ) — Juni bis August\nder Herbst (Thu) — September bis November\nder Winter (Đông) — Dezember bis Februar\n\nVí dụ: Im Winter ist es kalt. Im Sommer fahre ich in den Urlaub."},"tags":["#Monate","#Jahreszeiten"]}
  ],
  "vocabulary": [
    {"id":"v_kal_01","german":"der Montag","meaning":"thứ Hai","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Am Montag fange ich die neue Arbeit an.","example_vi":"Thứ Hai tôi bắt đầu công việc mới.","speak_de":"am Montag","tags":["#Wochentage","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈmoːntaːk/"],"common_errors_vi":["tag cuối: g→/k/"],"ipa_target":"deːɐ̯ ˈmoːntaːk"}},
    {"id":"v_kal_02","german":"das Wochenende","meaning":"cuối tuần","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Was machst du am Wochenende?","example_vi":"Cuối tuần bạn làm gì?","speak_de":"am Wochenende","tags":["#Kalender","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvɔxənˌʔɛndə/"],"common_errors_vi":["Wochen: W=/v/, ch=/x/"],"ipa_target":"das ˈvɔxənˌʔɛndə"}},
    {"id":"v_kal_03","german":"der Frühling / der Sommer","meaning":"mùa Xuân / mùa Hè","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Im Sommer ist es sehr heiß in Deutschland.","example_vi":"Mùa hè rất nóng ở Đức.","speak_de":"im Sommer","tags":["#Jahreszeiten","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfʁyːlɪŋ/","/ˈzɔmɐ/"],"common_errors_vi":["Frühling: ü tròn, S-/z/"],"ipa_target":"deːɐ̯ ˈfʁyːlɪŋ"}},
    {"id":"v_kal_04","german":"der Herbst / der Winter","meaning":"mùa Thu / mùa Đông","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Im Winter gibt es oft Schnee in Deutschland.","example_vi":"Mùa đông ở Đức thường có tuyết.","speak_de":"im Winter","tags":["#Jahreszeiten","#A1"],"ai_speech_hints":{"focus_phonemes":["/hɛʁpst/","/ˈvɪntɐ/"],"common_errors_vi":["Herbst: b→/p/ trước st"],"ipa_target":"deːɐ̯ hɛʁpst"}},
    {"id":"v_kal_05","german":"von...bis","meaning":"từ...đến (thời gian)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich arbeite von Montag bis Freitag, von 9 bis 17 Uhr.","example_vi":"Tôi làm T2 đến T6, từ 9 đến 17 giờ.","speak_de":"von Montag bis Freitag","tags":["#Präpositionen","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/fɔn/","/bɪs/"],"common_errors_vi":["von: v=/f/, bis: kurz /ɪ/"],"ipa_target":"fɔn ... bɪs"}},
    {"id":"v_kal_06","german":"der Urlaub","meaning":"kỳ nghỉ","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Im Sommer fahre ich in den Urlaub nach Vietnam.","example_vi":"Mùa hè tôi về Việt Nam nghỉ.","speak_de":"in den Urlaub fahren","tags":["#Freizeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈuːɐ̯laʊ̯p/"],"common_errors_vi":["Urlaub: U dài /uː/, au=/ao/"],"ipa_target":"deːɐ̯ ˈuːɐ̯laʊ̯p"}}
  ],
  "phrases": [
    {"german":"Am Wochenende schlafe ich länger.","meaning":"Cuối tuần tôi ngủ lâu hơn.","speak_de":"Am Wochenende schlafe ich länger."},
    {"german":"Im Winter ist es kalt und im Sommer heiß.","meaning":"Mùa đông lạnh và mùa hè nóng.","speak_de":"Im Winter ist es kalt."},
    {"german":"Ich arbeite von Montag bis Freitag.","meaning":"Tôi làm việc từ thứ Hai đến thứ Sáu.","speak_de":"Ich arbeite von Montag bis Freitag."}
  ],
  "examples": [
    {"german":"Im Sommer fahre ich immer in den Urlaub. Dieses Jahr fliege ich im Juli nach Vietnam — von Samstag bis Samstag, zwei Wochen.","translation":"Mùa hè tôi luôn đi nghỉ. Năm nay tháng 7 tôi bay về Việt Nam — từ thứ Bảy đến thứ Bảy, hai tuần.","note":"im Juli (tháng 7), von...bis (từ...đến)","speak_de":"Im Juli fliege ich nach Vietnam."},
    {"german":"Am Donnerstag habe ich einen Deutschkurs, von 18 bis 20 Uhr. Am Samstag treffe ich Freunde.","translation":"Thứ Năm tôi có lớp tiếng Đức, từ 18 đến 20 giờ. Thứ Bảy tôi gặp bạn bè.","note":"am + Wochentag, von...bis + Uhrzeit","speak_de":"Am Donnerstag habe ich Deutschkurs."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg27_01","type":"FILL_BLANK","sentence_de":"___ Montag habe ich Arzttermin. ___ Januar ist es sehr kalt. ___ 9 Uhr beginnt die Besprechung.","hint_vi":"am ... im ... um","answer":"Am, Im, Um","accept_also":["am / im / um"]},
      {"id":"tg27_02","type":"MULTIPLE_CHOICE","question_vi":"''im Sommer'' nghĩa là?","options":["vào mùa hè","vào thứ Bảy","vào buổi sáng","vào năm 2000"],"correct":0},
      {"id":"tg27_03","type":"FILL_BLANK","sentence_de":"Ich arbeite ___ Montag ___ Freitag.","hint_vi":"từ ... đến","answer":"von, bis","accept_also":["von / bis"]},
      {"id":"tg27_04","type":"MULTIPLE_CHOICE","question_vi":"Tuần lịch ở Đức bắt đầu từ ngày nào?","options":["Sonntag","Samstag","Montag","Dienstag"],"correct":2},
      {"id":"tg27_05","type":"FILL_BLANK","sentence_de":"___ Herbst fallen die Blätter von den Bäumen.","hint_vi":"Vào mùa Thu","answer":"Im","accept_also":["im"]}
    ],
    "practice": [
      {"id":"p27_01","type":"TRANSLATE","from":"vi","sentence":"Thứ Sáu tôi tan làm lúc 17 giờ. Cuối tuần tôi nghỉ ngơi.","answer":"Am Freitag höre ich um 17 Uhr mit der Arbeit auf. Am Wochenende erhole ich mich.","accept_also":["Freitags bin ich um 17 Uhr fertig. Am Wochenende ruhe ich mich aus."]},
      {"id":"p27_02","type":"REORDER","words":["bis","von","Ich","Freitag.","Montag","arbeite"],"correct_order":["Ich","arbeite","von","Montag","bis","Freitag."],"translation":"Tôi làm việc từ thứ Hai đến thứ Sáu."},
      {"id":"p27_03","type":"FILL_BLANK","sentence_de":"___ Winter fahre ich nach Vietnam. ___ Sommer ist es hier heiß.","hint_vi":"vào mùa đông ... vào mùa hè","answer":"Im, Im","accept_also":["Im / Im"]}
    ]
  },
  "reading_passage": {
    "text_de": "Die vier Jahreszeiten in Deutschland\n\nDeutschland hat vier deutliche Jahreszeiten. Im Frühling (März bis Mai) blühen die Blumen und es wird wärmer. Im Sommer (Juni bis August) ist es heiß — bis 35 Grad. Viele Deutsche fahren im Juli oder August in den Urlaub. Im Herbst (September bis November) werden die Blätter bunt und fallen. Im Winter (Dezember bis Februar) schneit es manchmal und es gibt Weihnachten.",
    "text_vi": "Bốn mùa ở Đức\n\nĐức có bốn mùa rõ ràng. Mùa Xuân (tháng 3-5) hoa nở và ấm dần. Mùa Hè (tháng 6-8) nóng — đến 35 độ. Nhiều người Đức đi nghỉ vào tháng 7 hoặc 8. Mùa Thu (tháng 9-11) lá cây chuyển màu rực rỡ rồi rụng. Mùa Đông (tháng 12-2) đôi khi có tuyết và có Giáng Sinh.",
    "questions": [
      {"id":"rq27_01","type":"MULTIPLE_CHOICE","question_vi":"Mùa hè ở Đức có thể nóng đến bao nhiêu độ?","options":["25 Grad","30 Grad","35 Grad","40 Grad"],"correct":2},
      {"id":"rq27_02","type":"FILL_BLANK","question_vi":"Người Đức thường đi nghỉ vào tháng nào?","answer":"Juli oder August","accept_also":["im Juli oder August","Juli/August"]}
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihren Lieblingsmonat oder Ihre Lieblingszeit. Warum? Was machen Sie da? (5-6 Sätze)",
    "task_vi": "Mô tả tháng hoặc mùa yêu thích của bạn. Tại sao? Bạn làm gì vào thời gian đó? (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Mein Lieblingsmonat ist Dezember.\nIm Dezember gibt es Weihnachten und viele Feste.\nEs ist manchmal kalt, aber sehr gemütlich.\nAm Wochenende gehe ich mit Familie auf den Weihnachtsmarkt.\nVon Montag bis Freitag arbeite ich, aber abends koche ich Weihnachtsessen.\nIm Dezember fahre ich manchmal nach Vietnam zu meiner Familie."
  },
  "audio_content": {
    "listen_words": [
      {"text":"am Montag","meaning":"vào thứ Hai"},
      {"text":"im Sommer","meaning":"vào mùa hè"},
      {"text":"von Montag bis Freitag","meaning":"từ thứ Hai đến thứ Sáu"},
      {"text":"das Wochenende","meaning":"cuối tuần"},
      {"text":"im Januar / im Dezember","meaning":"vào tháng 1 / tháng 12"}
    ],
    "listen_dialogue": "Was machst du am Wochenende? — Am Samstag schlafe ich länger und räume die Wohnung auf. Am Sonntag treffe ich Freunde. Und im Sommer? — Im Sommer fahre ich in den Urlaub, meistens im Juli."
  }
}'::jsonb
WHERE day_number = 27 AND is_active = TRUE;
