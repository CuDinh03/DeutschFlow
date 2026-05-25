-- V82: Day 19 — Einkaufen & Preise

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Einkaufen & Preise", "vi": "Mua sắm & Giá cả"},
  "overview": {
    "de": "Im Supermarkt einkaufen: Preise, Mengen und möchten.",
    "vi": "Học cách hỏi giá, trả tiền và gọi hàng tại siêu thị/chợ. Từ ''möchten'' (muốn) rất lịch sự — người Đức dùng thường xuyên hơn ''wollen'' (cũng muốn nhưng thô hơn)."
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "möchten — Muốn (Lịch sự)"},
      "content": {"vi": "möchten = muốn (rất lịch sự, dùng khi mua hàng/đặt món)\nConjugation:\nic möchte | du möchtest\ner/sie/es möchte | wir möchten\nihr möchtet | sie/Sie möchten\n\nCấu trúc: möchten + Infinitiv (cuối câu)\nIch möchte ein Brot kaufen. (Tôi muốn mua một ổ bánh mì.)\nIch möchte bitte zahlen. (Tôi muốn trả tiền.)"},
      "tags": ["#Modalverben", "#möchten"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Số tiền & Đơn vị"},
      "content": {"vi": "Euro (€) và Cent:\n1 Euro = 100 Cent\nĐọc: 2,50 € = ''zwei Euro fünfzig''\n0,99 € = ''neunundneunzig Cent''\n4,20 € = ''vier Euro zwanzig''\n\nHữu ích:\nWas kostet das? — Cái này giá bao nhiêu?\nDas kostet 3 Euro. — Cái này 3 Euro.\nKann ich mit Karte zahlen? — Tôi có thể trả bằng thẻ không?"},
      "tags": ["#Preise", "#Zahlen", "#Euro"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Tại quầy tính tiền"},
      "content": {"vi": "— Guten Tag! Was darf es sein?\n— Ich möchte 500 Gramm Käse und ein Brot, bitte.\n— Gerne. Das macht 6 Euro 80.\n— Hier sind 10 Euro.\n— Und 3 Euro 20 zurück. Danke!\n— Danke! Auf Wiedersehen!"},
      "tags": ["#Einkaufen", "#Dialog"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_kauf_01", "german": "kaufen", "meaning": "mua",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich möchte frisches Obst kaufen.", "example_vi": "Tôi muốn mua trái cây tươi.",
      "speak_de": "Ich möchte kaufen", "tags": ["#Verb", "#Einkaufen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkaʊ̯fən/"], "common_errors_vi": ["au=/ao/ trong kaufen"], "ipa_target": "ˈkaʊ̯fən"}
    },
    {
      "id": "v_kauf_02", "german": "kosten", "meaning": "có giá / tốn",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Was kostet das Brot? — Es kostet 2 Euro.", "example_vi": "Ổ bánh mì giá bao nhiêu? — 2 Euro.",
      "speak_de": "Was kostet das?", "tags": ["#Verb", "#Preise", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkɔstən/"], "common_errors_vi": ["kostet: KOS-tet, t cuối rõ"], "ipa_target": "ˈkɔstən"}
    },
    {
      "id": "v_kauf_03", "german": "zahlen / bezahlen", "meaning": "trả tiền",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich möchte bitte zahlen.", "example_vi": "Tôi muốn trả tiền.",
      "speak_de": "Ich möchte zahlen", "tags": ["#Verb", "#Geld", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈtsaːlən/"], "common_errors_vi": ["z = /ts/, zahlen: TSAH-len"], "ipa_target": "ˈtsaːlən"}
    },
    {
      "id": "v_kauf_04", "german": "das Gramm / das Kilo", "meaning": "gam / kilo",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "500 Gramm Käse und ein Kilo Äpfel, bitte.", "example_vi": "500 gram phô mai và một kilo táo.",
      "speak_de": "500 Gramm Käse", "tags": ["#Mengen", "#Einkaufen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɡʁam/", "/ˈkiːlo/"], "common_errors_vi": ["Gramm: gr=/ɡʁ/, mm=m dài"], "ipa_target": "das ɡʁam"}
    },
    {
      "id": "v_kauf_05", "german": "die Flasche", "meaning": "chai",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Eine Flasche Wasser kostet 50 Cent.", "example_vi": "Một chai nước giá 50 xu.",
      "speak_de": "eine Flasche Wasser", "tags": ["#Mengen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈflaʃə/"], "common_errors_vi": ["Flasche: sch=/ʃ/"], "ipa_target": "diː ˈflaʃə"}
    },
    {
      "id": "v_kauf_06", "german": "das Wechselgeld", "meaning": "tiền thối lại",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Hier ist Ihr Wechselgeld: 3 Euro 20.", "example_vi": "Đây là tiền thối lại: 3 Euro 20.",
      "speak_de": "Ihr Wechselgeld", "tags": ["#Geld", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈvɛksl̩ɡɛlt/"], "common_errors_vi": ["Wechsel: w=/v/, ch=/ç/"], "ipa_target": "das ˈvɛksl̩ɡɛlt"}
    },
    {
      "id": "v_kauf_07", "german": "der Supermarkt", "meaning": "siêu thị",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Ich gehe jeden Samstag in den Supermarkt.", "example_vi": "Mỗi thứ Bảy tôi đi siêu thị.",
      "speak_de": "im Supermarkt", "tags": ["#Orte", "#Einkaufen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈzuːpɐmaʁkt/"], "common_errors_vi": ["Super: s=/z/ ở đầu, u=/uː/"], "ipa_target": "deːɐ̯ ˈzuːpɐmaʁkt"}
    }
  ],
  "phrases": [
    {"german": "Was darf es sein?", "meaning": "Tôi có thể giúp gì cho ông/bà?", "speak_de": "Was darf es sein?"},
    {"german": "Das macht zusammen 8 Euro 50.", "meaning": "Tổng cộng là 8 Euro 50.", "speak_de": "Das macht zusammen acht Euro fünfzig."},
    {"german": "Kann ich mit Karte zahlen?", "meaning": "Tôi có thể trả bằng thẻ không?", "speak_de": "Kann ich mit Karte zahlen?"}
  ],
  "examples": [
    {"german": "— Guten Tag! Ich möchte 200 Gramm Salami und eine Flasche Wasser. — Das macht 3 Euro 60. — Hier sind 5 Euro. — Und 1 Euro 40 zurück.", "translation": "— Xin chào! Tôi muốn 200 gram salami và một chai nước. — Tổng là 3 Euro 60. — Đây là 5 Euro. — Và 1 Euro 40 tiền thối.", "note": "Dialog đầy đủ khi mua hàng", "speak_de": "Ich möchte 200 Gramm Salami."},
    {"german": "Was kostet ein Kilo Äpfel? — 2 Euro 49 das Kilo. — Dann nehme ich zwei Kilo.", "translation": "Một kilo táo giá bao nhiêu? — 2 Euro 49 một kilo. — Vậy tôi lấy hai kilo.", "note": "dann nehme ich = vậy tôi lấy", "speak_de": "Was kostet ein Kilo Äpfel?"}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg19_01", "type": "FILL_BLANK",
        "sentence_de": "Ich ___ bitte ein Kilo Äpfel _____.",
        "hint_vi": "muốn ... mua",
        "answer": "möchte, kaufen", "accept_also": ["möchte / kaufen"]
      },
      {
        "id": "tg19_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "2,50€ đọc như thế nào?",
        "options": ["zwei Komma fünfzig", "zwei Euro fünfzig", "zwanzig Euro fünf", "zwei und fünfzig"],
        "correct": 1
      },
      {
        "id": "tg19_03", "type": "FILL_BLANK",
        "sentence_de": "Kann ich ___ Karte zahlen?",
        "hint_vi": "bằng (mit/mit der...)",
        "answer": "mit", "accept_also": ["mit der"]
      },
      {
        "id": "tg19_04", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Das macht 5 Euro'' nghĩa là gì?",
        "options": ["Cái đó làm ra 5 Euro", "Tổng cộng là 5 Euro", "5 Euro quá đắt", "Tôi có 5 Euro"],
        "correct": 1
      },
      {
        "id": "tg19_05", "type": "FILL_BLANK",
        "sentence_de": "___ kostet das? — Es ___ drei Euro zwanzig.",
        "hint_vi": "giá bao nhiêu ... có giá",
        "answer": "Was, kostet", "accept_also": ["Was / kostet"]
      }
    ],
    "practice": [
      {
        "id": "p19_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Tôi muốn một chai nước và 500 gram phô mai. Tổng cộng là bao nhiêu?",
        "answer": "Ich möchte eine Flasche Wasser und 500 Gramm Käse. Was macht das zusammen?",
        "accept_also": ["Ich möchte eine Flasche Wasser und 500 Gramm Käse. Wie viel kostet das?"]
      },
      {
        "id": "p19_02", "type": "REORDER",
        "words": ["Euro", "macht", "Das", "achtzig.", "sechs"],
        "correct_order": ["Das", "macht", "sechs", "Euro", "achtzig."],
        "translation": "Tổng cộng là 6 Euro 80."
      },
      {
        "id": "p19_03", "type": "FILL_BLANK",
        "sentence_de": "— ___ darf es sein? — Ich ___ 200 Gramm Käse, bitte.",
        "hint_vi": "Tôi có thể giúp gì ... muốn",
        "answer": "Was, möchte", "accept_also": ["Was / möchte"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Im Supermarkt\n\nMinh braucht heute Lebensmittel. Er geht in den Supermarkt. Er kauft: 1 Kilo Tomaten für 1,99 €, 500 Gramm Käse für 3,50 €, 2 Flaschen Wasser für 0,99 € und ein Brot für 2,29 €. An der Kasse fragt die Kassiererin: ''Haben Sie eine Kundenkarte?'' — ''Nein, leider nicht.'' — ''Das macht dann 8,77 €.'' Minh zahlt mit Karte.",
    "text_vi": "Tại siêu thị\n\nMinh hôm nay cần thực phẩm. Anh đi siêu thị. Anh mua: 1 kilo cà chua giá 1,99€, 500 gram phô mai 3,50€, 2 chai nước 0,99€ và một ổ bánh mì 2,29€. Tại quầy thanh toán, cô thu ngân hỏi: ''Ông có thẻ khách hàng không?'' — ''Không, tiếc là không.'' — ''Vậy tổng cộng là 8,77€.'' Minh trả bằng thẻ.",
    "questions": [
      {
        "id": "rq19_01", "type": "FILL_BLANK",
        "question_vi": "Minh trả tổng cộng bao nhiêu?",
        "answer": "8,77 Euro", "accept_also": ["8.77 Euro", "acht Euro siebenundsiebzig"]
      },
      {
        "id": "rq19_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "Minh trả bằng gì?",
        "options": ["Bar (tiền mặt)", "Karte (thẻ)", "Scheck (séc)", "Handy (điện thoại)"],
        "correct": 1
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Sie gehen einkaufen. Schreiben Sie einen Einkaufszettel (5-7 Produkte) mit Mengen und Preisen.",
    "task_vi": "Bạn đi mua sắm. Viết một danh sách mua hàng (5-7 sản phẩm) với số lượng và giá.",
    "min_sentences": 5,
    "example_answer": "Mein Einkaufszettel:\n1 Kilo Tomaten — ca. 2 Euro\n500 Gramm Käse — ca. 3,50 Euro\n2 Flaschen Wasser — ca. 1 Euro\n1 Brot — ca. 2,50 Euro\n1 Kilo Äpfel — ca. 2 Euro\nGesamtpreis: ca. 11 Euro"
  },
  "audio_content": {
    "listen_words": [
      {"text": "Was kostet das?", "meaning": "Cái này giá bao nhiêu?"},
      {"text": "Das macht 5 Euro 50.", "meaning": "Tổng cộng là 5,50 Euro."},
      {"text": "Kann ich mit Karte zahlen?", "meaning": "Tôi trả bằng thẻ được không?"},
      {"text": "Ich möchte kaufen.", "meaning": "Tôi muốn mua."},
      {"text": "500 Gramm Käse, bitte.", "meaning": "500 gram phô mai, làm ơn."}
    ],
    "listen_dialogue": "Guten Tag! Was darf es sein? — 500 Gramm Käse und ein Brot, bitte. — Das macht 5 Euro 80. Karte oder bar? — Mit Karte, bitte."
  }
}'::jsonb
WHERE day_number = 19 AND is_active = TRUE;
