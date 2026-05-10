-- V91: Day 28 — Review Module 7 (Zeit & Tagesablauf)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 7", "vi": "Ôn tập Module 7 — Thời gian & Thói quen"},
  "overview": {"de": "Wiederholung: Uhrzeit, Tagesablauf, Trennbare Verben, Wochentage, Monate, Jahreszeiten.", "vi": "Ôn tập toàn bộ Module 7: đọc giờ (halb/Viertel), thói quen ngày (Trennbare Verben), thứ/tháng/mùa và giới từ am/im/um/von...bis."},
  "session_type": "REVIEW",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Bảng tổng hợp Zeitpräpositionen"},"content":{"vi":"UM → Uhrzeit: um 8 Uhr, um halb drei\nAM → Wochentag + Tageszeit: am Montag, am Morgen\nIM → Monat + Jahreszeit: im Juli, im Winter\nVON...BIS → Zeitraum: von 9 bis 17 Uhr, von Montag bis Freitag\nSEIT → seit wann: Ich lerne seit 3 Monaten Deutsch.\nVOR → trước đây: vor einem Jahr (một năm trước)"},"tags":["#Zeitpräpositionen","#Review"]},
    {"type":"RULE","title":{"vi":"Trennbare Verben — Bảng ôn tập"},"content":{"vi":"auf|stehen — stehe...auf — dậy\nan|fangen — fängt...an — bắt đầu\nfern|sehen — sieht...fern — xem TV\nan|rufen — rufe...an — gọi điện\nauf|räumen — räume...auf — dọn dẹp\nein|kaufen — kaufe...ein — mua sắm\naus|gehen — gehe...aus — ra ngoài\nab|fahren — fährt...ab — khởi hành\nzurück|kommen — komme...zurück — trở về"},"tags":["#TrennbareVerben","#Review"]},
    {"type":"EXAMPLE","title":{"vi":"Dialog tổng hợp"},"content":{"vi":"— Wie ist dein Tagesablauf?\n— Ich stehe um halb sieben auf. Am Montag fängt die Arbeit um 8 an. Im Winter fahre ich mit der U-Bahn, im Sommer mit dem Fahrrad. Von 12 bis 13 Uhr ist Mittagspause. Um 17 Uhr komme ich zurück. Abends rufe ich meistens meine Familie an.\n— Was machst du am Wochenende?\n— Am Samstag kaufe ich ein und räume auf. Am Sonntag gehe ich spazieren."},"tags":["#Review","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_rev7_01","german":"seit","meaning":"từ (khoảng thời gian đến nay)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich lebe seit zwei Jahren in Deutschland.","example_vi":"Tôi sống ở Đức được hai năm.","speak_de":"seit zwei Jahren","tags":["#Präpositionen","#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/zaɪ̯t/"],"common_errors_vi":["seit: s=/z/, ei=/ai/"],"ipa_target":"zaɪ̯t"}},
    {"id":"v_rev7_02","german":"das Datum","meaning":"ngày tháng","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Welches Datum ist heute? — Heute ist der 15. Mai.","example_vi":"Hôm nay là ngày mấy? — Hôm nay là 15 tháng 5.","speak_de":"Welches Datum ist heute?","tags":["#Kalender","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈdaːtʊm/"],"common_errors_vi":["DA-tum: a dài /aː/"],"ipa_target":"das ˈdaːtʊm"}},
    {"id":"v_rev7_03","german":"der Feiertag","meaning":"ngày lễ","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Am 3. Oktober ist der Deutsche Tag der Deutschen Einheit — ein Feiertag.","example_vi":"Ngày 3/10 là Ngày Thống nhất nước Đức — một ngày lễ.","speak_de":"ein Feiertag","tags":["#Kalender","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfaɪ̯ɐˌtaːk/"],"common_errors_vi":["Feier: ei=/ai/, -tag: g→/k/"],"ipa_target":"deːɐ̯ ˈfaɪ̯ɐˌtaːk"}},
    {"id":"v_rev7_04","german":"regelmäßig","meaning":"đều đặn, thường xuyên","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich lerne regelmäßig Deutsch — jeden Tag eine Stunde.","example_vi":"Tôi học tiếng Đức đều đặn — mỗi ngày một tiếng.","speak_de":"regelmäßig lernen","tags":["#Adverb","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʁeːɡl̩mɛːsɪç/"],"common_errors_vi":["regel-MÄ-ßig: ä=/ɛ/, ß=ss"],"ipa_target":"ˈʁeːɡl̩mɛːsɪç"}},
    {"id":"v_rev7_05","german":"spazieren gehen","meaning":"đi dạo","gender":null,"color_code":null,"gender_label":null,"example_de":"Am Wochenende gehe ich gern spazieren.","example_vi":"Cuối tuần tôi thích đi dạo.","speak_de":"spazieren gehen","tags":["#Freizeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ʃpaˈtsiːʁən/"],"common_errors_vi":["sp=/ʃp/, -ieren: eeren"],"ipa_target":"ʃpaˈtsiːʁən ˈɡeːən"}}
  ],
  "phrases": [
    {"german":"Ich lebe seit drei Jahren in Deutschland.","meaning":"Tôi sống ở Đức được ba năm.","speak_de":"Ich lebe seit drei Jahren in Deutschland."},
    {"german":"Was machst du am Wochenende normalerweise?","meaning":"Cuối tuần bạn thường làm gì?","speak_de":"Was machst du am Wochenende?"},
    {"german":"Im Winter stehe ich später auf als im Sommer.","meaning":"Mùa đông tôi dậy muộn hơn mùa hè.","speak_de":"Im Winter stehe ich später auf."}
  ],
  "examples": [
    {"german":"Mein typischer Tag: Um 6:30 stehe ich auf. Am Montag und Mittwoch habe ich Deutschkurs von 18 bis 20 Uhr. Am Freitag gehe ich nach der Arbeit aus. Am Wochenende schlafe ich bis halb neun.","translation":"Ngày điển hình của tôi: 6:30 dậy. Thứ Hai và Tư có lớp tiếng Đức 18-20h. Thứ Sáu sau giờ làm tôi ra ngoài. Cuối tuần ngủ đến 8:30.","note":"Kết hợp tất cả giới từ thời gian","speak_de":"Am Montag habe ich Deutschkurs."},
    {"german":"Seit einem Jahr lerne ich Deutsch. Im Juli mache ich die A1-Prüfung. Ich hoffe, dass ich bestehe!","translation":"Tôi học tiếng Đức được một năm. Tháng 7 tôi thi A1. Tôi hy vọng sẽ đậu!","note":"seit + Dativ; im Juli + tháng","speak_de":"Seit einem Jahr lerne ich Deutsch."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg28_01","type":"FILL_BLANK","sentence_de":"___ Montag stehe ich früh ___. ___ Winter ist das schwer!","hint_vi":"am ... auf ... im","answer":"Am, auf, Im","accept_also":["am / auf / im"]},
      {"id":"tg28_02","type":"MULTIPLE_CHOICE","question_vi":"''seit'' dùng khi nào?","options":["Hành động đã kết thúc","Hành động bắt đầu quá khứ và vẫn còn tiếp tục","Hành động trong tương lai","Hành động xảy ra một lần"],"correct":1},
      {"id":"tg28_03","type":"FILL_BLANK","sentence_de":"Ich ___ jeden Abend meine Eltern ___ und sehe danach ___.","hint_vi":"rufe...an / fern","answer":"rufe, an, fern","accept_also":["rufe / an / fern"]},
      {"id":"tg28_04","type":"MULTIPLE_CHOICE","question_vi":"''halb acht'' = mấy giờ?","options":["8:30","7:30","8:15","7:45"],"correct":1},
      {"id":"tg28_05","type":"FILL_BLANK","sentence_de":"Ich arbeite ___ Montag ___ Freitag, ___ 9 ___ 17 Uhr.","hint_vi":"từ...đến...từ...đến","answer":"von, bis, von, bis","accept_also":["von / bis / von / bis"]}
    ],
    "practice": [
      {"id":"p28_01","type":"TRANSLATE","from":"vi","sentence":"Tôi học tiếng Đức được 6 tháng. Thứ Ba và Năm tôi có lớp từ 7 đến 9 giờ tối.","answer":"Ich lerne seit sechs Monaten Deutsch. Am Dienstag und Donnerstag habe ich Kurs von 19 bis 21 Uhr.","accept_also":["Ich lerne Deutsch seit 6 Monaten. Dienstags und donnerstags habe ich von 19 bis 21 Uhr Unterricht."]},
      {"id":"p28_02","type":"REORDER","words":["auf.","um","stehe","halb","Ich","sieben"],"correct_order":["Ich","stehe","um","halb","sieben","auf."],"translation":"Tôi dậy lúc 6:30."},
      {"id":"p28_03","type":"FILL_BLANK","sentence_de":"___ Sommer ___ ich gern ___. ___ Wochenende ___ ich aus.","hint_vi":"Im ... gehe...spazieren ... Am ... gehe","answer":"Im, gehe, spazieren, Am, gehe","accept_also":["Im / gehe / spazieren / Am / gehe"]}
    ]
  },
  "reading_passage": {
    "text_de": "Minh über sein Leben in Deutschland\n\nIch lebe seit anderthalb Jahren in Hamburg. Mein Alltag ist regelmäßig. Von Montag bis Freitag arbeite ich im Restaurant. Am Wochenende schlafe ich länger — meistens bis halb neun. Im Sommer gehe ich am Sonntag spazieren oder fahre Fahrrad. Im Winter ist es zu kalt für Sport, also sehe ich manchmal fern. Seit einem Jahr lerne ich Deutsch. Am Dienstag und Donnerstag habe ich Unterricht von 18 bis 20 Uhr. Im Juli mache ich die A1-Prüfung!",
    "text_vi": "Minh về cuộc sống ở Đức\n\nTôi sống ở Hamburg được một năm rưỡi. Cuộc sống hàng ngày của tôi đều đặn. Từ thứ Hai đến thứ Sáu tôi làm việc trong nhà hàng. Cuối tuần tôi ngủ lâu hơn — thường đến 8:30. Mùa hè Chủ nhật tôi đi dạo hoặc đạp xe. Mùa đông lạnh quá, không thể tập thể thao, nên đôi khi tôi xem TV. Từ một năm nay tôi học tiếng Đức. Thứ Ba và Năm có lớp từ 18-20 giờ. Tháng 7 tôi thi A1!",
    "questions": [
      {"id":"rq28_01","type":"FILL_BLANK","question_vi":"Minh sống ở Đức được bao lâu?","answer":"anderthalb Jahre","accept_also":["seit anderthalb Jahren","eineinhalb Jahre","1,5 Jahre"]},
      {"id":"rq28_02","type":"MULTIPLE_CHOICE","question_vi":"Minh thi A1 vào tháng nào?","options":["im Juni","im Juli","im August","im September"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie über Ihren Wochenplan: Was machen Sie an welchen Tagen? Wann? (7-8 Sätze)",
    "task_vi": "Viết về lịch tuần của bạn: Bạn làm gì vào những ngày nào? Lúc mấy giờ? (7-8 câu)",
    "min_sentences": 7,
    "example_answer": "Von Montag bis Freitag arbeite ich von 8 bis 17 Uhr.\nAm Montag und Mittwoch habe ich Deutschkurs von 18 bis 20 Uhr.\nAm Dienstag rufe ich meine Familie in Vietnam an.\nAm Donnerstag gehe ich nach der Arbeit ins Fitnessstudio.\nAm Freitag gehe ich manchmal mit Kollegen aus.\nAm Samstag kaufe ich ein und räume die Wohnung auf.\nAm Sonntag schlafe ich länger und gehe spazieren.\nIm Sommer fahre ich im August in den Urlaub nach Vietnam."
  },
  "audio_content": {
    "listen_words": [
      {"text":"seit zwei Jahren","meaning":"từ hai năm nay"},
      {"text":"von Montag bis Freitag","meaning":"từ thứ Hai đến thứ Sáu"},
      {"text":"im Sommer / im Winter","meaning":"mùa hè / mùa đông"},
      {"text":"regelmäßig lernen","meaning":"học đều đặn"},
      {"text":"spazieren gehen","meaning":"đi dạo"}
    ],
    "listen_dialogue": "Wie lange lernst du schon Deutsch? — Seit einem Jahr. — Und wann hast du Unterricht? — Am Dienstag und Donnerstag, von 18 bis 20 Uhr. — Machst du im Sommer Urlaub? — Ja, im August fliege ich nach Vietnam."
  }
}'::jsonb
WHERE day_number = 28 AND is_active = TRUE;
