-- V92: Day 29 — Verkehrsmittel & Wegbeschreibung

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Verkehrsmittel & Wegbeschreibung", "vi": "Phương tiện giao thông & Chỉ đường"},
  "overview": {"de": "Verkehrsmittel, Dativ mit Präpositionen (mit, nach, zu) und Wegbeschreibung.", "vi": "Học các phương tiện giao thông và cách chỉ đường. Quan trọng: Dativ với giới từ mit/nach/zu — rất thường dùng trong cuộc sống ở Đức!"},
  "session_type": "LESSON",
  "theory_cards": [
    {"type":"RULE","title":{"vi":"Dativ-Präpositionen: mit, nach, zu, aus, von, bei, seit"},"content":{"vi":"Các giới từ luôn đi với Dativ:\nmit + Dat: Ich fahre mit dem Bus. (bằng xe buýt)\nnach + Dat: Ich fahre nach Berlin. (đến Berlin — thành phố)\nzu + Dat: Ich gehe zur Schule. (đến trường)\naus + Dat: Ich komme aus Vietnam.\nvon + Dat: Ich komme von der Arbeit.\nbei + Dat: Ich wohne bei meiner Tante.\n\nDativ-Artikel: dem (DER+DAS), der (DIE)\nzur = zu der | zum = zu dem"},"tags":["#Dativ","#Präpositionen"]},
    {"type":"RULE","title":{"vi":"Phương tiện giao thông + mit dem"},"content":{"vi":"mit dem Bus — bằng xe buýt (DER Bus)\nmit dem Zug / der Bahn — bằng tàu hỏa\nmit dem Auto — bằng ô tô (DAS Auto)\nmit dem Fahrrad — bằng xe đạp\nmit der U-Bahn — bằng tàu điện ngầm (DIE U-Bahn)\nmit der Straßenbahn — bằng tàu điện\nmit dem Flugzeug — bằng máy bay\nzu Fuß — đi bộ (không dùng mit!!)"},"tags":["#Verkehr","#Dativ"]},
    {"type":"EXAMPLE","title":{"vi":"Chỉ đường cơ bản"},"content":{"vi": "— Entschuldigung, wie komme ich zum Bahnhof?\n— Gehen Sie geradeaus, dann links abbiegen. Nach 200 Metern ist der Bahnhof auf der rechten Seite.\n— Wie weit ist es?\n— Ca. 5 Minuten zu Fuß.\n\nTừ vựng chỉ đường:\ngeradeaus — thẳng\nlinks — rẽ trái\nrechts — rẽ phải\nabbiegen — rẽ\ndie Ampel — đèn giao thông\ndie Kreuzung — ngã tư"},"tags":["#Wegbeschreibung","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_verk_01","german":"der Bahnhof","meaning":"ga tàu","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Der Hauptbahnhof ist sehr groß.","example_vi":"Ga trung tâm rất lớn.","speak_de":"zum Bahnhof","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈbaːnhoːf/"],"common_errors_vi":["Bahn-hof: Bahn=/baːn/, hof=/hoːf/"],"ipa_target":"deːɐ̯ ˈbaːnhoːf"}},
    {"id":"v_verk_02","german":"die U-Bahn","meaning":"tàu điện ngầm (metro)","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Ich fahre jeden Tag mit der U-Bahn zur Arbeit.","example_vi":"Mỗi ngày tôi đi metro đến chỗ làm.","speak_de":"mit der U-Bahn","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/uːˈbaːn/"],"common_errors_vi":["U-Bahn: U=/uː/ lang"],"ipa_target":"diː uːˈbaːn"}},
    {"id":"v_verk_03","german":"das Fahrrad","meaning":"xe đạp","gender":"DAS","color_code":"#22C55E","gender_label":"n","example_de":"Im Sommer fahre ich lieber mit dem Fahrrad.","example_vi":"Mùa hè tôi thích đi xe đạp hơn.","speak_de":"mit dem Fahrrad","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈfaːʁʁaːt/"],"common_errors_vi":["Fahr-rad: fahr=/faːɐ̯/, rad=/ʁaːt/"],"ipa_target":"das ˈfaːʁʁaːt"}},
    {"id":"v_verk_04","german":"geradeaus","meaning":"đi thẳng","gender":null,"color_code":null,"gender_label":null,"example_de":"Gehen Sie immer geradeaus, bis zur Ampel.","example_vi":"Đi thẳng đến đèn giao thông.","speak_de":"Gehen Sie geradeaus.","tags":["#Wegbeschreibung","#A1"],"ai_speech_hints":{"focus_phonemes":["/ɡəˈʁaːdəˈaʊ̯s/"],"common_errors_vi":["ge-ra-de-aus: Betonung auf aus"],"ipa_target":"ɡəˈʁaːdəˈaʊ̯s"}},
    {"id":"v_verk_05","german":"abbiegen","meaning":"rẽ (trái/phải)","gender":null,"color_code":null,"gender_label":null,"example_de":"Biegen Sie rechts ab — dann sehen Sie das Hotel.","example_vi":"Rẽ phải — rồi bạn sẽ thấy khách sạn.","speak_de":"Biegen Sie rechts ab.","tags":["#Wegbeschreibung","#TrennbareVerben","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈapˌbiːɡən/"],"common_errors_vi":["ab-biegen: Trennbar! biege...ab"],"ipa_target":"ˈapˌbiːɡən"}},
    {"id":"v_verk_06","german":"die Haltestelle","meaning":"trạm dừng (xe buýt/tàu)","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Die nächste Haltestelle ist am Marktplatz.","example_vi":"Trạm dừng tiếp theo ở quảng trường chợ.","speak_de":"die Haltestelle","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈhaltəˌʃtɛlə/"],"common_errors_vi":["Halte-stelle: st=/ʃt/"],"ipa_target":"diː ˈhaltəˌʃtɛlə"}},
    {"id":"v_verk_07","german":"zu Fuß","meaning":"đi bộ","gender":null,"color_code":null,"gender_label":null,"example_de":"Ich gehe zu Fuß — es sind nur 10 Minuten.","example_vi":"Tôi đi bộ — chỉ 10 phút thôi.","speak_de":"zu Fuß gehen","tags":["#Verkehr","#A1"],"ai_speech_hints":{"focus_phonemes":["/tsuː fuːs/"],"common_errors_vi":["Fuß: ß=ss, F=/f/ bật"],"ipa_target":"tsuː fuːs"}}
  ],
  "phrases": [
    {"german":"Wie komme ich am besten zum Bahnhof?","meaning":"Đi đến ga tàu thế nào là tốt nhất?","speak_de":"Wie komme ich zum Bahnhof?"},
    {"german":"Nehmen Sie die U-Bahn Linie 3.","meaning":"Hãy đi tàu điện ngầm tuyến 3.","speak_de":"Nehmen Sie die U-Bahn Linie drei."},
    {"german":"Ist es weit von hier?","meaning":"Từ đây có xa không?","speak_de":"Ist es weit von hier?"}
  ],
  "examples": [
    {"german":"— Entschuldigung! Wie komme ich zur nächsten U-Bahn-Station? — Gehen Sie geradeaus, dann an der Ampel links abbiegen. Die Station ist nach 300 Metern auf der rechten Seite.","translation":"— Xin lỗi! Đến trạm metro gần nhất thế nào? — Đi thẳng, rồi ở đèn giao thông rẽ trái. Trạm cách 300 mét bên tay phải.","note":"Imperativ Sie-Form = Gehen Sie / Biegen Sie","speak_de":"Gehen Sie geradeaus."},
    {"german":"Ich fahre nicht mit dem Auto — ich nehme immer die U-Bahn oder den Bus. Es ist günstiger und besser für die Umwelt.","translation":"Tôi không đi ô tô — tôi luôn đi metro hoặc xe buýt. Rẻ hơn và tốt cho môi trường.","note":"besser für die Umwelt = tốt cho môi trường","speak_de":"Ich nehme immer die U-Bahn."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg29_01","type":"FILL_BLANK","sentence_de":"Ich fahre ___ ___ Bus zur Arbeit.","hint_vi":"bằng xe buýt = mit + Dativ","answer":"mit dem","accept_also":["mit dem"]},
      {"id":"tg29_02","type":"MULTIPLE_CHOICE","question_vi":"''zu Fuß gehen'' dùng đúng trong câu nào?","options":["Ich fahre zu Fuß.","Ich gehe zu Fuß.","Ich nehme zu Fuß.","Ich komme zu Fuß ab."],"correct":1},
      {"id":"tg29_03","type":"FILL_BLANK","sentence_de":"___ Sie an der Kreuzung ___. (rechts abbiegen — Imperativ)","hint_vi":"Rẽ phải (Trennbar)","answer":"Biegen, ab","accept_also":["Biegen Sie / ab"]},
      {"id":"tg29_04","type":"MULTIPLE_CHOICE","question_vi":"''mit der U-Bahn'' — U-Bahn là giống gì?","options":["DER","DAS","DIE","kein Artikel"],"correct":2},
      {"id":"tg29_05","type":"FILL_BLANK","sentence_de":"Wie komme ich ___ Bahnhof? — Nehmen Sie ___ Bus Linie 5.","hint_vi":"zum (zu+dem) ... den (Akkusativ)","answer":"zum, den","accept_also":["zum / den"]}
    ],
    "practice": [
      {"id":"p29_01","type":"TRANSLATE","from":"vi","sentence":"Tôi đi làm bằng tàu điện ngầm mỗi ngày. Mất khoảng 20 phút.","answer":"Ich fahre jeden Tag mit der U-Bahn zur Arbeit. Es dauert ungefähr 20 Minuten.","accept_also":["Ich nehme täglich die U-Bahn. Es dauert ca. 20 Minuten."]},
      {"id":"p29_02","type":"REORDER","words":["ab.","an","Sie","der","Ampel","Biegen","links"],"correct_order":["Biegen","Sie","an","der","Ampel","links","ab."],"translation":"Hãy rẽ trái ở đèn giao thông."},
      {"id":"p29_03","type":"FILL_BLANK","sentence_de":"___ Sie ___ — nach 200 Metern ___ Sie rechts ___!","hint_vi":"Đi thẳng ... rẽ (Imperativ Trennbar)","answer":"Gehen, geradeaus, biegen, ab","accept_also":["Gehen / geradeaus / biegen / ab"]}
    ]
  },
  "reading_passage": {
    "text_de": "Mobilität in Deutschland\n\nIn deutschen Städten gibt es viele Möglichkeiten, sich fortzubewegen. Die U-Bahn und der Bus sind am beliebtesten. In Berlin zum Beispiel fährt die U-Bahn von 4 Uhr morgens bis 1 Uhr nachts. Das Ticket kostet 3,20 Euro für eine Fahrt. Viele Menschen kaufen aber eine Monatskarte für ca. 90 Euro. Das Fahrrad ist auch sehr populär — Deutschland hat viele Fahrradwege. Autos sind in der Stadt teuer: Parkplätze kosten viel Geld.",
    "text_vi": "Di chuyển ở Đức\n\nỞ các thành phố Đức có nhiều cách di chuyển. Metro và xe buýt phổ biến nhất. Ở Berlin ví dụ metro chạy từ 4 giờ sáng đến 1 giờ đêm. Một vé đi lẻ giá 3,20 Euro. Nhiều người mua vé tháng khoảng 90 Euro. Xe đạp cũng rất phổ biến — Đức có nhiều làn đường dành cho xe đạp. Ô tô trong thành phố đắt: chỗ đỗ xe tốn nhiều tiền.",
    "questions": [
      {"id":"rq29_01","type":"FILL_BLANK","question_vi":"Vé tàu một lần ở Berlin giá bao nhiêu?","answer":"3,20 Euro","accept_also":["3.20 Euro","drei Euro zwanzig"]},
      {"id":"rq29_02","type":"MULTIPLE_CHOICE","question_vi":"Vé tháng khoảng bao nhiêu?","options":["50 Euro","70 Euro","90 Euro","120 Euro"],"correct":2}
    ]
  },
  "writing_prompt": {
    "task_de": "Wie kommen Sie zur Arbeit oder zur Schule? Beschreiben Sie den Weg. (5-6 Sätze)",
    "task_vi": "Bạn đi làm hoặc đi học bằng phương tiện gì? Mô tả lộ trình. (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Ich wohne in der Nähe vom Hauptbahnhof.\nZur Arbeit fahre ich mit der U-Bahn, Linie 2.\nIch steige an der Haltestelle Marktplatz aus.\nDann gehe ich noch fünf Minuten zu Fuß.\nDas dauert insgesamt ca. 25 Minuten.\nIm Sommer fahre ich lieber mit dem Fahrrad."
  },
  "audio_content": {
    "listen_words": [
      {"text":"mit der U-Bahn","meaning":"bằng tàu điện ngầm"},
      {"text":"zu Fuß gehen","meaning":"đi bộ"},
      {"text":"Gehen Sie geradeaus!","meaning":"Đi thẳng!"},
      {"text":"Biegen Sie links ab.","meaning":"Rẽ trái."},
      {"text":"Wie komme ich zum Bahnhof?","meaning":"Đến ga tàu thế nào?"}
    ],
    "listen_dialogue": "Entschuldigung! Wie komme ich zur U-Bahn? — Gehen Sie geradeaus, dann rechts. Die Haltestelle ist nach 200 Metern. — Wie lange dauert das zu Fuß? — Etwa fünf Minuten."
  }
}'::jsonb
WHERE day_number = 29 AND is_active = TRUE;
