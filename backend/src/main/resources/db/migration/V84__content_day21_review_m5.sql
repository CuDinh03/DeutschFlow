-- V84: Day 21 — Review Module 5 (Einkaufen & Essen)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 5", "vi": "Ôn tập Module 5 — Mua sắm & Đồ ăn"},
  "overview": {"de": "Wiederholung: Lebensmittel, Preise, möchten, kein/keine, Imperativ.", "vi": "Ôn tập Module 5: thực phẩm, bữa ăn, hỏi giá, dùng möchten, phủ định kein/keine, gọi món và Imperativ."},
  "session_type": "REVIEW",
  "theory_cards": [
    {"type": "RULE", "title": {"vi": "Bảng tổng hợp kein/keine/keinen"}, "content": {"vi": "Nominativ: kein (DAS/DER) | keine (DIE) | kein (DAS)\nAkkusativ: keinen (DER) | keine (DIE) | kein (DAS)\n\nVí dụ:\nIch habe keinen Kaffee. (DER → keinen)\nIch habe keine Milch. (DIE → keine)\nIch habe kein Brot. (DAS → kein)"}, "tags": ["#kein","#Negation"]},
    {"type": "RULE", "title": {"vi": "möchten vs. nehmen vs. kaufen"}, "content": {"vi": "Im Supermarkt: Ich möchte Käse kaufen.\nIm Restaurant: Ich nehme das Schnitzel.\nAn der Kasse: Was macht das? / Das kostet...\n\nLịch sự: immer bitte dazusagen!\nIch möchte bitte... | ...bitte | Danke schön!"}, "tags": ["#möchten","#Restaurant"]},
    {"type": "EXAMPLE", "title": {"vi": "Mini-Dialog Supermarkt + Restaurant"}, "content": {"vi": "Supermarkt: ''500g Käse, bitte. Was kostet das? — 3,50€. — Kann ich mit Karte zahlen? — Ja, natürlich.''\nRestaurant: ''Was empfehlen Sie? — Das Schnitzel. — Gut, ich nehme das. Und die Rechnung bitte am Ende.''"}, "tags": ["#Review","#Dialog"]}
  ],
  "vocabulary": [
    {"id":"v_rev5_01","german":"die Kartoffel","meaning":"khoai tây","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Deutschland ist berühmt für Kartoffeln.","example_vi":"Đức nổi tiếng về khoai tây.","speak_de":"die Kartoffel","tags":["#Lebensmittel","#A1"],"ai_speech_hints":{"focus_phonemes":["/kaʁˈtɔfl̩/"],"common_errors_vi":["Kar-TOF-fel: nhấn TOF"],"ipa_target":"diː kaʁˈtɔfl̩"}},
    {"id":"v_rev5_02","german":"die Wurst","meaning":"xúc xích / thịt nguội","gender":"DIE","color_code":"#EF4444","gender_label":"f","example_de":"Deutschland hat über 1.500 Wurstsorten.","example_vi":"Đức có hơn 1.500 loại xúc xích.","speak_de":"die Wurst","tags":["#Lebensmittel","#A1"],"ai_speech_hints":{"focus_phonemes":["/vʊʁst/"],"common_errors_vi":["Wurst: W=/v/, ur=/ʊʁ/"],"ipa_target":"diː vʊʁst"}},
    {"id":"v_rev5_03","german":"der Markt","meaning":"chợ","gender":"DER","color_code":"#3B82F6","gender_label":"m","example_de":"Samstags gehe ich auf den Wochenmarkt.","example_vi":"Thứ Bảy tôi đi chợ tuần.","speak_de":"auf dem Markt","tags":["#Orte","#A1"],"ai_speech_hints":{"focus_phonemes":["/maʁkt/"],"common_errors_vi":["Markt: ar=/aʁ/"],"ipa_target":"deːɐ̯ maʁkt"}},
    {"id":"v_rev5_04","german":"billig / teuer","meaning":"rẻ / đắt","gender":null,"color_code":null,"gender_label":null,"example_de":"Das ist zu teuer! Haben Sie etwas Billigeres?","example_vi":"Đắt quá! Có cái rẻ hơn không?","speak_de":"billig oder teuer","tags":["#Adjektiv","#Preise","#A1"],"ai_speech_hints":{"focus_phonemes":["/ˈbɪlɪç/","/ˈtɔʏ̯ɐ/"],"common_errors_vi":["billig: ch cuối=/ç/; teuer: eu=/ɔʏ/"],"ipa_target":"ˈbɪlɪç / ˈtɔʏ̯ɐ"}},
    {"id":"v_rev5_05","german":"noch etwas?","meaning":"còn gì nữa không?","gender":null,"color_code":null,"gender_label":null,"example_de":"Noch etwas? — Ja, ein Wasser bitte.","example_vi":"Còn gì nữa không? — Vâng, một chai nước.","speak_de":"Noch etwas?","tags":["#Kommunikation","#A1"],"ai_speech_hints":{"focus_phonemes":["/nɔx ˈɛtvas/"],"common_errors_vi":["noch: ch=/x/"],"ipa_target":"nɔx ˈɛtvas"}}
  ],
  "phrases": [
    {"german":"Das ist zu teuer!","meaning":"Đắt quá!","speak_de":"Das ist zu teuer!"},
    {"german":"Haben Sie etwas Billigeres?","meaning":"Có cái rẻ hơn không?","speak_de":"Haben Sie etwas Billigeres?"},
    {"german":"Nehmen Sie noch etwas?","meaning":"Ông/bà lấy thêm gì nữa không?","speak_de":"Nehmen Sie noch etwas?"}
  ],
  "examples": [
    {"german":"Auf dem Markt kaufe ich frisches Gemüse und Obst. Es ist billiger als im Supermarkt.","translation":"Ở chợ tôi mua rau củ và trái cây tươi. Rẻ hơn ở siêu thị.","note":"billiger als = rẻ hơn","speak_de":"Es ist billiger als im Supermarkt."},
    {"german":"Im Restaurant nehme ich immer das Tagesgericht — es ist günstig und frisch.","translation":"Trong nhà hàng tôi luôn chọn món trong ngày — vừa rẻ vừa tươi.","note":"günstig = rẻ/tốt giá","speak_de":"Das Tagesgericht ist günstig."}
  ],
  "exercises": {
    "theory_gate": [
      {"id":"tg21_01","type":"FILL_BLANK","sentence_de":"Ich habe ___ Käse. Kann ich ___ Brot kaufen?","hint_vi":"không có ... một ổ","answer":"keinen, ein","accept_also":["keinen / ein"]},
      {"id":"tg21_02","type":"MULTIPLE_CHOICE","question_vi":"''Das ist zu teuer!'' — Phản ứng lịch sự tiếp theo?","options":["Ich kaufe es trotzdem.","Haben Sie etwas Billigeres?","Ich will nichts!","Auf Wiedersehen!"],"correct":1},
      {"id":"tg21_03","type":"FILL_BLANK","sentence_de":"— ___ macht das? — Das ___ 8 Euro 50.","hint_vi":"bao nhiêu ... có giá","answer":"Was, kostet","accept_also":["Was / kostet"]},
      {"id":"tg21_04","type":"MULTIPLE_CHOICE","question_vi":"Phủ định đúng với DIE-Nomen (Milch)?","options":["kein Milch","keinen Milch","keine Milch","keine Milch"],"correct":3},
      {"id":"tg21_05","type":"FILL_BLANK","sentence_de":"___ Sie mir bitte ein Glas Wasser!","hint_vi":"Mang (Imperativ)","answer":"Bringen","accept_also":["bringen"]}
    ],
    "practice": [
      {"id":"p21_01","type":"TRANSLATE","from":"vi","sentence":"Tôi không có tiền mặt. Tôi có thể trả bằng thẻ không?","answer":"Ich habe kein Bargeld. Kann ich mit Karte zahlen?","accept_also":["Ich habe kein Geld. Kann ich mit Karte zahlen?"]},
      {"id":"p21_02","type":"REORDER","words":["Billigeres?","Sie","etwas","Haben"],"correct_order":["Haben","Sie","etwas","Billigeres?"],"translation":"Có cái rẻ hơn không?"},
      {"id":"p21_03","type":"FILL_BLANK","sentence_de":"Im Restaurant ___ ich das Schnitzel und ___ kein Fleisch.","hint_vi":"chọn ... (cô ấy) không ăn","answer":"nehme ich, esse ich keine","accept_also":["nehme, esse"]}
    ]
  },
  "reading_passage": {
    "text_de": "Ein Einkaufstag\n\nHeute ist Samstag. Lan geht auf den Wochenmarkt. Sie kauft frisches Gemüse: Tomaten, Gurken und Paprika. Alles zusammen kostet 4,50 €. Dann geht sie in den Supermarkt. Sie braucht noch Brot, Käse und Milch. An der Kasse zahlt sie 8,30 €. Abends kocht sie vietnamesisches Essen für ihre Familie.",
    "text_vi": "Một ngày đi mua sắm\n\nHôm nay là thứ Bảy. Lan đi chợ tuần. Cô mua rau củ tươi: cà chua, dưa leo và ớt chuông. Tất cả tốn 4,50€. Rồi cô đi siêu thị. Cô còn cần bánh mì, phô mai và sữa. Tại quầy tính tiền cô trả 8,30€. Buổi tối cô nấu đồ ăn Việt cho gia đình.",
    "questions": [
      {"id":"rq21_01","type":"MULTIPLE_CHOICE","question_vi":"Lan đi đâu trước?","options":["Supermarkt","Restaurant","Wochenmarkt","Bäckerei"],"correct":2},
      {"id":"rq21_02","type":"FILL_BLANK","question_vi":"Tổng tiền chợ và siêu thị là bao nhiêu?","answer":"12,80 Euro","accept_also":["12.80 Euro","4,50 und 8,30"]}
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie über Ihren letzten Einkauf: Wo? Was? Wie viel? (5-6 Sätze)",
    "task_vi": "Viết về lần mua sắm gần nhất của bạn: Ở đâu? Mua gì? Bao nhiêu tiền? (5-6 câu)",
    "min_sentences": 5,
    "example_answer": "Gestern bin ich in den Supermarkt gegangen.\nIch habe Gemüse, Obst und Brot gekauft.\nEin Kilo Tomaten kostet 1,99 Euro.\nAlles zusammen hat 12 Euro gekostet.\nIch habe mit Karte gezahlt."
  },
  "audio_content": {
    "listen_words": [
      {"text":"billig / teuer","meaning":"rẻ / đắt"},
      {"text":"Noch etwas?","meaning":"Còn gì nữa không?"},
      {"text":"die Wurst","meaning":"xúc xích"},
      {"text":"Haben Sie etwas Billigeres?","meaning":"Có rẻ hơn không?"},
      {"text":"das Wechselgeld","meaning":"tiền thối"}
    ],
    "listen_dialogue": "Was kostet das? — 5 Euro 50. — Das ist zu teuer! Haben Sie etwas Billigeres? — Ja, hier für 3 Euro 90. — Gut, ich nehme das."
  }
}'::jsonb
WHERE day_number = 21 AND is_active = TRUE;
