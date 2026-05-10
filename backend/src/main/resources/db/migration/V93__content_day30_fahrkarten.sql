-- V93: Day 30 — Fahrkarten & Reisepläne + Perfekt intro

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Fahrkarten & Reisepläne", "vi": "Vé & Kế hoạch du lịch"},
  "overview": {"de": "Fahrkarten kaufen, Reisen planen und Perfekt kennenlernen.", "vi": "Học cách mua vé tàu, lên kế hoạch du lịch và giới thiệu Perfekt (thì hoàn thành) — cách nói về quá khứ thông dụng nhất trong tiếng Đức nói."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Mua vé tàu/máy bay — Từ vựng quan trọng"},"content":{"vi":"Einfache Fahrt — vé một chiều\nHin- und Rückfahrt — vé khứ hồi\nerste Klasse / zweite Klasse — hạng nhất / nhì\nder Nahverkehr — giao thông nội đô (Bus/U-Bahn)\nder Fernverkehr — tàu đường dài (ICE/IC)\ndie Reservierung — đặt chỗ trước\npünktlich / Verspätung — đúng giờ / trễ\n\nAt Schalter: Einmal Berlin hin und zurück, bitte!"},"tags":["#Fahrkarten","#Reisen"]},
    {"type":"RULE","title":{"vi":"Perfekt — Thì quá khứ trong hội thoại"},"content":{"vi":"Dùng để nói về quá khứ trong văn nói:\nSubjekt + haben/sein (vị trí 2) + Partizip II (cuối)\n\nIch habe gearbeitet. (Tôi đã làm việc.)\nIch bin gefahren. (Tôi đã đi.)\n\nPartizip II:\nregelmäßig: ge- + Stamm + -t: kaufen → gekauft\nunregelmäßig: fahren → gefahren, gehen → gegangen\n\nSein-Verben (di chuyển + Zustandsänderung):\nfahren, gehen, fliegen, kommen, reisen"},"tags":["#Perfekt","#Grammatik"]},
    {"type":"EXAMPLE","title":{"vi": "Kế hoạch + Kể lại chuyến đi"},"content":{"vi":"Kế hoạch (Futur với werden/Präsens):\nNächsten Sommer fliege ich nach Vietnam.\nIch kaufe die Tickets nächste Woche.\n\nKể lại (Perfekt):\nLetztes Jahr bin ich nach Berlin gefahren.\nIch habe das Brandenburger Tor besucht.\nDas Hotel hat 80 Euro pro Nacht gekostet."},"tags":["#Reisen","#Perfekt"]}
  ],
  "vocabulary": [
    {"id":"v_reis_01","german":"die Fahrkarte","meaning":"vé tàu/xe buýt","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich möchte eine Fahrkarte nach München kaufen.","example_vi":"Tôi muốn mua vé tàu đến Munich.","speak_de":"eine Fahrkarte kaufen","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfaːɐ̯kaʁtə/"],"common_errors_vi":["Fahr-karte: Fahr=/faːɐ̯/"],"ipa_target":"diː ˈfaːɐ̯kaʁtə"}},
    {"id":"v_reis_02","german":"der Zug","meaning":"tàu hỏa","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Zug nach Hamburg fährt um 14:32 ab.","example_vi":"Tàu đi Hamburg khởi hành lúc 14:32.","speak_de":"mit dem Zug","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/tsuːk/"],"common_errors_vi":["Z=/ts/, ug=/uːk/"],"ipa_target":"deːɐ̯ tsuːk"}},
    {"id":"v_reis_03","german":"einsteigen / aussteigen","meaning":"lên tàu / xuống tàu","gender":null,"color_code":null,"gender_label":null,"example_de":"Bitte einsteigen! Nächste Station: Hauptbahnhof.","example_vi":"Mời lên tàu! Trạm tiếp: Ga trung tâm.","speak_de":"bitte einsteigen","tags":["#TrennbareVerben","#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈaɪ̯nˌʃtaɪ̯ɡən/"],"common_errors_vi":["ein-stei-gen: ei=/ai/"],"ipa_target":"ˈaɪ̯nˌʃtaɪ̯ɡən"}},
    {"id":"v_reis_04","german":"umsteigen","meaning":"chuyển tàu/xe","gender":null,"color_code":null,"gender_label":null,"example_de":"Sie müssen in Frankfurt umsteigen.","example_vi":"Bạn phải chuyển tàu ở Frankfurt.","speak_de":"Sie müssen umsteigen","tags":["#TrennbareVerben","#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈʊmˌʃtaɪ̯ɡən/"],"common_errors_vi":["um-stei-gen: Trennbar, -um cuối câu"],"ipa_target":"ˈʊmˌʃtaɪ̯ɡən"}},
    {"id":"v_reis_05","german":"die Verspätung","meaning":"sự chậm trễ","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Der Zug hat 20 Minuten Verspätung.","example_vi":"Tàu trễ 20 phút.","speak_de":"Verspätung","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/fɛɐ̯ˈʃpɛːtʊŋ/"],"common_errors_vi":["ver-SPÄT-ung: ä=/ɛː/"],"ipa_target":"diː fɛɐ̯ˈʃpɛːtʊŋ"}},
    {"id":"v_reis_06","german":"letztes Jahr / nächstes Jahr","meaning":"năm ngoái / năm tới","gender":null,"color_code":null,"gender_label":null,"example_de":"Letztes Jahr bin ich nach Paris gefahren. Nächstes Jahr möchte ich nach Wien.","example_vi":"Năm ngoái tôi đã đến Paris. Năm tới tôi muốn đến Vienna.","speak_de":"letztes Jahr, nächstes Jahr","tags":["#Zeit","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈlɛtstəs/","/ˈnɛːçstəs/"],"common_errors_vi":["letztes: tz=/ts/, nächstes: ä=/ɛː/"],"ipa_target":"ˈlɛtstəs jaːɐ̯"}}
  ],
  "phrases": [
    {"german":"Einmal Berlin hin und zurück, zweite Klasse, bitte!","meaning":"Một vé Berlin khứ hồi, hạng hai, làm ơn!","speak_de":"Einmal Berlin hin und zurück, bitte!"},
    {"german":"Von welchem Gleis fährt der Zug ab?","meaning":"Tàu khởi hành từ sân ga số mấy?","speak_de":"Von welchem Gleis fährt der Zug ab?"},
    {"german":"Muss ich umsteigen?","meaning":"Tôi có phải chuyển tàu không?","speak_de":"Muss ich umsteigen?"}
  ],
  "examples": [
    {"german":"Am Schalter: Ich möchte einmal nach Hamburg, einfache Fahrt, zweite Klasse. — Um 15:30 fährt der nächste ICE. Gleis 7. Muss ich umsteigen? — Nein, direkt.","translation":"Tại quầy vé: Tôi muốn một vé Hamburg, một chiều, hạng hai. — Lúc 15:30 có ICE tiếp theo. Sân ga 7. Tôi có phải chuyển tàu không? — Không, thẳng.","note":"ICE = InterCityExpress, tàu cao tốc Đức","speak_de":"Einmal Hamburg, einfache Fahrt, bitte."},
    {"german":"Letztes Jahr bin ich mit dem Zug nach München gefahren. Das Ticket hat 49 Euro gekostet. Ich habe drei Stunden gebraucht.","translation":"Năm ngoái tôi đã đi tàu đến Munich. Vé giá 49 Euro. Tôi mất 3 tiếng.","note":"Perfekt: bin gefahren (sein-Verb), hat gekostet (haben-Verb)","speak_de":"Letztes Jahr bin ich nach München gefahren."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg30_01","type":"FILL_BLANK","sentence_de":"Ich ___ letztes Jahr nach Berlin ___. (fahren — Perfekt)","hint_vi":"Perfekt mit sein: bin...gefahren","answer":"bin, gefahren","accept_also":["bin / gefahren"]},
      {"id":"tg30_02","type":"MULTIPLE_CHOICE","question_vi":"''Hin- und Rückfahrt'' nghĩa là gì?","options":["Vé một chiều","Vé khứ hồi","Vé hạng nhất","Vé hàng tháng"],"correct":1},
      {"id":"tg30_03","type":"FILL_BLANK","sentence_de":"Sie ___ in Mannheim ___. (umsteigen — Präsens, müssen)","hint_vi":"phải chuyển tàu","answer":"müssen, umsteigen","accept_also":["müssen / umsteigen"]},
      {"id":"tg30_04","type":"MULTIPLE_CHOICE","question_vi":"Partizip II của ''kaufen'' là gì?","options":["kauft","gekaуft","kaufen","gekauft"],"correct":3},
      {"id":"tg30_05","type":"FILL_BLANK","sentence_de":"Der Zug hat 15 Minuten ___. Er kommt um 16:45 ___.","hint_vi":"trễ ... đến (an|kommen)","answer":"Verspätung, an","accept_also":["Verspätung / an"]}
    ],
    "practice": [
      {"id":"p30_01","type":"TRANSLATE","from":"vi","sentence":"Tôi muốn một vé đến Frankfurt khứ hồi. Tàu có trễ không?","answer":"Ich möchte einmal Frankfurt hin und zurück. Hat der Zug Verspätung?","accept_also":["Ich möchte eine Hin- und Rückfahrkarte nach Frankfurt. Hat der Zug Verspätung?"]},
      {"id":"p30_02","type":"REORDER","words":["gefahren.","nach","bin","ich","München","Letztes","Jahr"],"correct_order":["Letztes","Jahr","bin","ich","nach","München","gefahren."],"translation":"Năm ngoái tôi đã đến Munich."},
      {"id":"p30_03","type":"FILL_BLANK","sentence_de":"Ich ___ die Tickets online ___. (kaufen — Perfekt)","hint_vi":"haben+gekauft","answer":"habe, gekauft","accept_also":["habe / gekauft"]}
    ]
  },
  "reading_passage": {
    "text_de": "Eine Reise mit der Deutschen Bahn\n\nMinh möchte von Hamburg nach München fahren. Er geht zum Hauptbahnhof und kauft eine Fahrkarte: Hin- und Rückfahrt, zweite Klasse, 79 Euro. Der ICE fährt um 9:05 Uhr ab, Gleis 12. Er muss in Frankfurt umsteigen. Leider hat der Zug 25 Minuten Verspätung. Minh verpasst seinen Anschlusszug. Die nächste Verbindung fährt erst eine Stunde später. Er kommt um 15:30 Uhr in München an — statt um 14:00 Uhr.",
    "text_vi": "Chuyến đi với Deutsche Bahn\n\nMinh muốn đi từ Hamburg đến Munich. Anh đến ga trung tâm và mua vé: khứ hồi, hạng hai, 79 Euro. ICE khởi hành lúc 9:05, sân ga 12. Anh phải chuyển tàu ở Frankfurt. Tiếc là tàu trễ 25 phút. Minh lỡ chuyến kết nối. Chuyến tiếp theo phải đợi thêm một tiếng. Anh đến Munich lúc 15:30 — thay vì 14:00.",
    "questions": [
      {"id":"rq30_01","type":"FILL_BLANK","question_vi":"Vé khứ hồi Hamburg-Munich giá bao nhiêu?","answer":"79 Euro","accept_also":["neunundsiebzig Euro"]},
      {"id":"rq30_02","type":"MULTIPLE_CHOICE","question_vi":"Tại sao Minh đến muộn?","options":["Er hat den falschen Zug genommen.","Der Zug hatte Verspätung und er hat den Anschluss verpasst.","Die Fahrkarte war ungültig.","Der Bahnhof war geschlossen."],"correct":1}
    ]
  },
  "writing_prompt": {
    "task_de": "Erzählen Sie von einer Reise (echt oder erfunden). Benutzen Sie das Perfekt. (6-7 Sätze)",
    "task_vi": "Kể về một chuyến đi (thực tế hoặc tưởng tượng). Dùng Perfekt. (6-7 câu)",
    "min_sentences": 6,
    "example_answer": "Letztes Jahr bin ich nach Berlin gefahren.\nIch habe eine Hin- und Rückfahrkarte für 49 Euro gekauft.\nDer Zug ist pünktlich um 8 Uhr abgefahren.\nIch bin um 11 Uhr in Berlin angekommen.\nIch habe das Brandenburger Tor und das Holocaust-Denkmal besucht.\nAbends habe ich in einem Restaurant gegessen.\nEs war eine wunderbare Reise!"
  },
  "audio_content": {
    "listen_words": [
      {"text":"Einmal Berlin hin und zurück!","meaning":"Một vé Berlin khứ hồi!"},
      {"text":"Muss ich umsteigen?","meaning":"Tôi có phải chuyển tàu không?"},
      {"text":"Der Zug hat Verspätung.","meaning":"Tàu bị trễ."},
      {"text":"Ich bin gefahren.","meaning":"Tôi đã đi."},
      {"text":"Von welchem Gleis?","meaning":"Sân ga số mấy?"}
    ],
    "listen_dialogue": "Einmal Frankfurt, zweite Klasse, bitte. — Hin- und Rückfahrt? — Nur einfache Fahrt. — 39 Euro. Der Zug fährt um 13:15, Gleis 5 ab. Müssen Sie umsteigen? — Ja, in Mannheim. — Dort haben Sie 8 Minuten Aufenthalt."
  }
}'::jsonb
WHERE day_number = 30 AND is_active = TRUE;
