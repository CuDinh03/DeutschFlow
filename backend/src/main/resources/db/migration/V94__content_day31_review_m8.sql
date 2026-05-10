-- V94: Day 31 — Review Module 8 (Verkehr & Reisen)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 8", "vi": "Ôn tập Module 8 — Đi lại & Du lịch"},
  "overview": {"de": "Wiederholung: Verkehrsmittel, Wegbeschreibung, Dativ-Präpositionen, Fahrkarten, Perfekt.", "vi": "Ôn tập Module 8: phương tiện giao thông, chỉ đường, Dativ (mit/nach/zu), mua vé, và Perfekt cơ bản."},
  "session_type": "REVIEW",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Bảng tổng hợp: Phương tiện + mit dem/der"},"content":{"vi":"mit dem Bus (DER) | mit dem Zug (DER)\nmit dem Auto (DAS) | mit dem Fahrrad (DAS)\nmit dem Flugzeug (DAS)\nmit der U-Bahn (DIE) | mit der Straßenbahn (DIE)\nzu Fuß — ĐI BỘ (không dùng mit!)\n\nZiel (điểm đến):\nnach + Stadt/Land: nach Berlin, nach Vietnam\nzum/zur + Gebäude: zum Bahnhof, zur Schule"},"tags":["#Verkehr","#Dativ","#Review"]},
    {"type":"RULE","title":{"vi":"Perfekt — Ôn tập"},"content":{"vi":"haben + Partizip II (hầu hết động từ)\nIch habe gekauft. / Er hat gegessen. / Wir haben gearbeitet.\n\nsein + Partizip II (di chuyển + Zustandsänderung)\nIch bin gefahren. / Er ist gegangen. / Wir sind angekommen.\n\nPartizip II thường gặp:\nkaufen→gekauft | essen→gegessen | arbeiten→gearbeitet\nfahren→gefahren | gehen→gegangen | kommen→gekommen\nfliegen→geflogen | bleiben→geblieben"},"tags":["#Perfekt","#Review"]},
    {"type":"EXAMPLE","title":{"vi":"Dialog đặt vé + kể lại chuyến đi"},"content":{"vi":"Mua vé: ''Zweimal München hin und zurück, zweite Klasse. Muss ich umsteigen?''\nBị trễ: ''Leider hat der Zug Verspätung. Sie müssen am Gleis 3 warten.''\nKể lại: ''Letztes Jahr bin ich nach Wien geflogen. Ich habe das Hotel online gebucht. Die Stadt war wunderschön!''"},"tags":["#Review","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_rev8_01","german":"das Gleis","meaning":"sân ga (đường ray)","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Der Zug nach Hamburg fährt von Gleis 5 ab.","example_vi":"Tàu đến Hamburg khởi hành từ sân ga 5.","speak_de":"von Gleis fünf","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɡlaɪ̯s/"],"common_errors_vi":["gl=/ɡl/, ei=/ai/"],"ipa_target":"das ɡlaɪ̯s"}},
    {"id":"v_rev8_02","german":"der Anschluss","meaning":"chuyến kết nối / liên kết","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Ich habe meinen Anschluss verpasst.","example_vi":"Tôi đã lỡ chuyến kết nối.","speak_de":"den Anschluss verpassen","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈanʃlʊs/"],"common_errors_vi":["An-schluss: sch=/ʃ/"],"ipa_target":"deːɐ̯ ˈanʃlʊs"}},
    {"id":"v_rev8_03","german":"buchen","meaning":"đặt chỗ (online/qua điện thoại)","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich habe das Hotel online gebucht.","example_vi":"Tôi đã đặt khách sạn online.","speak_de":"online buchen","tags":["#Reisen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈbuːxən/"],"common_errors_vi":["buch: ch=/x/ (ach-Laut)"],"ipa_target":"ˈbuːxən"}},
    {"id":"v_rev8_04","german":"der Urlaub / die Reise","meaning":"kỳ nghỉ / chuyến đi","gender":"DER/DIE","color_code":"#3B82F6","gender_label":"m/f","example_de":"Meine Reise nach Berlin war wunderschön.","example_vi":"Chuyến đi Berlin của tôi thật tuyệt.","speak_de":"eine Reise machen","tags":["#Reisen","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʁaɪ̯zə/"],"common_errors_vi":["Reise: R uvular, ei=/ai/"],"ipa_target":"diː ˈʁaɪ̯zə"}},
    {"id":"v_rev8_05","german":"wunderschön","meaning":"tuyệt đẹp, tuyệt vời","gender":null,"color_code":null,"gender_label":null,"example_de":"Das war eine wunderschöne Reise!","example_vi":"Đó là một chuyến đi tuyệt vời!","speak_de":"wunderschön!","tags":["#Adjektiv","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈvʊndɐˌʃøːn/"],"common_errors_vi":["wunder: W=/v/, sch=/ʃ/, ö tròn môi"],"ipa_target":"ˈvʊndɐˌʃøːn"}}
  ],
  "phrases": [
    {"german":"Ich bin letztes Jahr nach Wien geflogen.","meaning":"Năm ngoái tôi đã bay đến Vienna.","speak_de":"Ich bin nach Wien geflogen."},
    {"german":"Wo muss ich umsteigen?","meaning":"Tôi phải chuyển tàu ở đâu?","speak_de":"Wo muss ich umsteigen?"},
    {"german":"Die Reise hat mir sehr gut gefallen.","meaning":"Chuyến đi tôi rất thích.","speak_de":"Die Reise hat mir sehr gut gefallen."}
  ],
  "examples": [
    {"german":"Letzte Woche bin ich nach München gefahren. Ich habe eine Hin- und Rückfahrkarte für 49 Euro gekauft. In München habe ich das Deutsches Museum besucht. Das war wunderschön!","translation":"Tuần trước tôi đã đi Munich. Tôi mua vé khứ hồi 49 Euro. Ở Munich tôi đã thăm bảo tàng Đức. Thật tuyệt!","note":"Perfekt mix: bin gefahren (sein), habe gekauft/besucht (haben)","speak_de":"Letzte Woche bin ich nach München gefahren."},
    {"german":"— Wie komme ich zum Hauptbahnhof? — Nehmen Sie die U-Bahn Linie 3 bis Marienplatz, dann steigen Sie um auf die S-Bahn. — Wie viele Stationen? — Fünf Stationen, ca. 15 Minuten.","translation":"— Đến ga trung tâm thế nào? — Đi metro tuyến 3 đến Marienplatz, rồi chuyển sang S-Bahn. — Mấy trạm? — 5 trạm, khoảng 15 phút.","note":"umsteigen auf = chuyển sang","speak_de":"Nehmen Sie die U-Bahn Linie drei."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg31_01","type":"FILL_BLANK","sentence_de":"Ich ___ letztes Jahr mit ___ Zug nach Hamburg ___. (fahren)","hint_vi":"bin...dem...gefahren (Perfekt + Dativ)","answer":"bin, dem, gefahren","accept_also":["bin / dem / gefahren"]},
      {"id":"tg31_02","type":"MULTIPLE_CHOICE","question_vi":"''zu Fuß gehen'' — Warum kein ''mit''?","options":["Zu Fuß ist kein Verkehrsmittel","Zu Fuß braucht kein Artikel","Es ist eine feste Wendung ohne Artikel","Zu Fuß ist veraltet"],"correct":2},
      {"id":"tg31_03","type":"FILL_BLANK","sentence_de":"Ich ___ das Hotel online ___. (buchen — Perfekt)","hint_vi":"haben + gebucht","answer":"habe, gebucht","accept_also":["habe / gebucht"]},
      {"id":"tg31_04","type":"MULTIPLE_CHOICE","question_vi":"''Hin- und Rückfahrt'' = ?","options":["Einfache Fahrt","Vé khứ hồi","Hạng nhất","Tàu cao tốc"],"correct":1},
      {"id":"tg31_05","type":"FILL_BLANK","sentence_de":"___ ___ U-Bahn fahre ich zur Schule.","hint_vi":"bằng metro = mit der","answer":"Mit der","accept_also":["mit der"]}
    ],
    "practice": [
      {"id":"p31_01","type":"TRANSLATE","from":"vi","sentence":"Năm ngoái tôi đã bay đến Berlin. Tôi đã đặt khách sạn online. Chuyến đi rất tuyệt.","answer":"Letztes Jahr bin ich nach Berlin geflogen. Ich habe das Hotel online gebucht. Die Reise war wunderschön.","accept_also":["Letztes Jahr bin ich nach Berlin geflogen. Ich habe online gebucht. Es war super!"]},
      {"id":"p31_02","type":"REORDER","words":["umsteigen?","ich","muss","Wo"],"correct_order":["Wo","muss","ich","umsteigen?"],"translation":"Tôi phải chuyển tàu ở đâu?"},
      {"id":"p31_03","type":"FILL_BLANK","sentence_de":"Wir ___ mit dem Fahrrad zur Arbeit ___. (fahren — Perfekt)","hint_vi":"sind...gefahren","answer":"sind, gefahren","accept_also":["sind / gefahren"]}
    ]
  },
  "reading_passage": {
    "text_de": "Reiseplanung nach Vietnam\n\nMinh möchte im Sommer nach Vietnam fliegen. Er plant die Reise: Er kauft Flugtickets für 650 Euro hin und zurück. Er bucht ein Hotel in Ho-Chi-Minh-Stadt für 2 Wochen. Er reserviert einen Mietwagen für Ausflüge. Sein Freund fragt: ''Wie lange dauert der Flug?'' — ''Ca. 12 Stunden mit Umsteigen in Dubai.'' Minh freut sich sehr — er hat seine Familie seit einem Jahr nicht gesehen.",
    "text_vi": "Lên kế hoạch về Việt Nam\n\nMinh muốn mùa hè bay về Việt Nam. Anh lên kế hoạch: Mua vé máy bay 650 Euro khứ hồi. Đặt khách sạn ở TP.HCM 2 tuần. Đặt xe thuê để đi tham quan. Bạn anh hỏi: ''Chuyến bay mất bao lâu?'' — ''Khoảng 12 tiếng, quá cảnh ở Dubai.'' Minh rất vui — anh chưa gặp gia đình được một năm.",
    "questions": [
      {"id":"rq31_01","type":"FILL_BLANK","question_vi":"Vé máy bay giá bao nhiêu?","answer":"650 Euro","accept_also":["sechshundertfünfzig Euro"]},
      {"id":"rq31_02","type":"MULTIPLE_CHOICE","question_vi":"Minh bay về Việt Nam vào mùa nào?","options":["Frühling","Sommer","Herbst","Winter"],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Planen Sie eine Traumreise! Wohin? Wie? Wann? Was machen Sie dort? Benutzen Sie Perfekt und Präsens. (6-7 Sätze)",
    "task_vi": "Lên kế hoạch cho chuyến đi mơ ước! Đi đâu? Đi bằng gì? Khi nào? Làm gì ở đó? Dùng cả Perfekt và Präsens. (6-7 câu)",
    "min_sentences": 6,
    "example_answer": "Im August möchte ich nach Japan fliegen.\nIch habe schon Flugtickets für 800 Euro gebucht.\nIch fliege mit dem Flugzeug — der Flug dauert 12 Stunden.\nIn Japan möchte ich Tokio und Kyoto besuchen.\nIch habe auch ein Hotel in Tokio gebucht.\nIn Japan nehme ich den Shinkansen — das ist der Hochgeschwindigkeitszug.\nIch freue mich sehr auf die Reise!"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Hin- und Rückfahrt","meaning":"vé khứ hồi"},
      {"text":"Muss ich umsteigen?","meaning":"Phải chuyển tàu không?"},
      {"text":"Ich bin gefahren.","meaning":"Tôi đã đi."},
      {"text":"Die Reise war wunderschön.","meaning":"Chuyến đi thật tuyệt."},
      {"text":"Ich habe online gebucht.","meaning":"Tôi đã đặt trực tuyến."}
    ],
    "listen_dialogue": "Letztes Jahr bin ich nach Barcelona geflogen. Ich habe das Ticket für 120 Euro gebucht. Die Stadt war wunderschön! Ich habe Flamenco gesehen und viel Tapas gegessen. Nächstes Jahr möchte ich nach Japan."
  }
}'::jsonb
WHERE day_number = 31 AND is_active = TRUE;
