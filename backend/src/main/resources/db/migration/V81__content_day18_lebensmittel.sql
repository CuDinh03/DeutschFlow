-- V81: Day 18 — Lebensmittel & Mahlzeiten

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Lebensmittel & Mahlzeiten", "vi": "Thực phẩm & Bữa ăn"},
  "overview": {
    "de": "Lebensmittel, Mahlzeiten und Essgewohnheiten auf Deutsch.",
    "vi": "Học từ vựng thực phẩm và bữa ăn — thiết yếu khi đi chợ, vào siêu thị hay nói chuyện với đồng nghiệp ở Đức. Người Đức ăn sáng rất quan trọng (Frühstück)!"
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "3 bữa ăn trong ngày"},
      "content": {"vi": "das Frühstück — bữa sáng (7-9h): Brot, Käse, Ei, Kaffee\ndas Mittagessen — bữa trưa (12-13h): Hauptmahlzeit\ndas Abendessen — bữa tối (18-19h): oft kalt\n\n💡 Người Đức ăn nặng nhất vào bữa trưa. Bữa tối thường là bánh mì lạnh (''Abendbrot'').\nFrühstück quan trọng → từ ''früh'' (sớm) + ''stücken'' (ăn)"},
      "tags": ["#Mahlzeiten", "#Kultur"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Dùng kein/keine để phủ định Nomen"},
      "content": {"vi": "Phủ định với Nomen → dùng kein/keine:\nIch esse kein Fleisch. (Tôi không ăn thịt.)\nIch trinke keinen Kaffee. (Tôi không uống cà phê.)\nIch habe keine Milch. (Tôi không có sữa.)\n\nkein + DAS/DER-Nomen\nkeine + DIE-Nomen\nkeinen + DER-Nomen (Akkusativ)"},
      "tags": ["#Negation", "#kein", "#Akkusativ"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Sở thích ăn uống"},
      "content": {"vi": "Ich esse gern Brot mit Käse. (Tôi thích ăn bánh mì với phô mai.)\nIch trinke lieber Tee als Kaffee. (Tôi thích trà hơn cà phê.)\nIch esse kein Schweinefleisch. (Tôi không ăn thịt heo.)\nIch bin Vegetarier/Vegetarierin. (Tôi ăn chay.)"},
      "tags": ["#Essen", "#Vorlieben"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_essen_01", "german": "das Brot", "meaning": "bánh mì (ổ/miếng)",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Ich esse zum Frühstück Brot mit Butter.", "example_vi": "Bữa sáng tôi ăn bánh mì với bơ.",
      "speak_de": "das Brot", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/bʁoːt/"], "common_errors_vi": ["Brot: br=/bʁ/, t cuối rõ"], "ipa_target": "das bʁoːt"}
    },
    {
      "id": "v_essen_02", "german": "der Käse", "meaning": "phô mai",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "In Deutschland gibt es viele Käsesorten.", "example_vi": "Ở Đức có nhiều loại phô mai.",
      "speak_de": "der Käse", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkɛːzə/"], "common_errors_vi": ["ä = /ɛː/, s giữa = /z/"], "ipa_target": "deːɐ̯ ˈkɛːzə"}
    },
    {
      "id": "v_essen_03", "german": "das Fleisch", "meaning": "thịt",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Ich esse kein Fleisch — ich bin Vegetarierin.", "example_vi": "Tôi không ăn thịt — tôi ăn chay.",
      "speak_de": "das Fleisch", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/flaɪ̯ʃ/"], "common_errors_vi": ["ei=/ai/, sch=/ʃ/"], "ipa_target": "das flaɪ̯ʃ"}
    },
    {
      "id": "v_essen_04", "german": "das Gemüse", "meaning": "rau củ",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Ich esse täglich frisches Gemüse.", "example_vi": "Tôi ăn rau củ tươi hàng ngày.",
      "speak_de": "frisches Gemüse", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɡəˈmyːzə/"], "common_errors_vi": ["Ge- là tiền tố, ü tròn môi"], "ipa_target": "das ɡəˈmyːzə"}
    },
    {
      "id": "v_essen_05", "german": "die Milch", "meaning": "sữa",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Ich trinke jeden Morgen ein Glas Milch.", "example_vi": "Mỗi sáng tôi uống một ly sữa.",
      "speak_de": "ein Glas Milch", "tags": ["#Getränke", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/mɪlç/"], "common_errors_vi": ["ch cuối = ich-Laut /ç/"], "ipa_target": "diː mɪlç"}
    },
    {
      "id": "v_essen_06", "german": "der Kaffee / der Tee", "meaning": "cà phê / trà",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Möchten Sie Kaffee oder Tee?", "example_vi": "Ông/bà muốn cà phê hay trà?",
      "speak_de": "Kaffee oder Tee?", "tags": ["#Getränke", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkafe/"], "common_errors_vi": ["Kaffee: ff=/f/, e cuối /ə/"], "ipa_target": "deːɐ̯ ˈkafe"}
    },
    {
      "id": "v_essen_07", "german": "das Obst", "meaning": "trái cây",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Jeden Tag esse ich Obst.", "example_vi": "Mỗi ngày tôi ăn trái cây.",
      "speak_de": "frisches Obst", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/oːpst/"], "common_errors_vi": ["Obst: b trước st đọc /p/"], "ipa_target": "das oːpst"}
    },
    {
      "id": "v_essen_08", "german": "das Ei / die Eier", "meaning": "trứng / những quả trứng",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Zum Frühstück esse ich zwei Eier.", "example_vi": "Bữa sáng tôi ăn hai quả trứng.",
      "speak_de": "zwei Eier", "tags": ["#Lebensmittel", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/aɪ̯/", "/ˈaɪ̯ɐ/"], "common_errors_vi": ["Ei=/ai/, Eier=/ai-er/"], "ipa_target": "das aɪ̯"}
    }
  ],
  "phrases": [
    {"german": "Was essen Sie zum Frühstück?", "meaning": "Ông/bà ăn gì vào bữa sáng?", "speak_de": "Was essen Sie zum Frühstück?"},
    {"german": "Ich esse gern Brot mit Käse und trinke Kaffee.", "meaning": "Tôi thích ăn bánh mì với phô mai và uống cà phê.", "speak_de": "Ich esse gern Brot mit Käse."},
    {"german": "Ich esse kein Fleisch.", "meaning": "Tôi không ăn thịt.", "speak_de": "Ich esse kein Fleisch."}
  ],
  "examples": [
    {"german": "Zum Frühstück esse ich Brot mit Butter und Käse. Ich trinke einen Kaffee. Manchmal esse ich auch ein Ei.", "translation": "Bữa sáng tôi ăn bánh mì với bơ và phô mai. Tôi uống cà phê. Đôi khi tôi cũng ăn một quả trứng.", "note": "Zum Frühstück = vào bữa sáng", "speak_de": "Zum Frühstück esse ich Brot."},
    {"german": "Ich esse kein Schweinefleisch und keine Wurst. Aber ich esse gern Fisch und viel Gemüse.", "translation": "Tôi không ăn thịt heo và xúc xích. Nhưng tôi thích ăn cá và nhiều rau.", "note": "kein/keine = không (phủ định Nomen)", "speak_de": "Ich esse kein Fleisch."}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg18_01", "type": "FILL_BLANK",
        "sentence_de": "Ich esse ___ Fleisch. Ich bin Vegetarierin.",
        "hint_vi": "không (phủ định DAS-Nomen)",
        "answer": "kein", "accept_also": ["kein"]
      },
      {
        "id": "tg18_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "Người Đức ăn bữa nào nặng nhất?",
        "options": ["Frühstück", "Mittagessen", "Abendessen", "Snack"],
        "correct": 1
      },
      {
        "id": "tg18_03", "type": "FILL_BLANK",
        "sentence_de": "Möchten Sie ___ Kaffee oder ___ Tee?",
        "hint_vi": "dùng kein/keinen cho nam không?",
        "answer": "einen, einen", "accept_also": ["einen / einen", "Kaffee oder Tee"]
      },
      {
        "id": "tg18_04", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Abendbrot'' thực sự là gì?",
        "options": ["Bánh mì lớn", "Bữa tối thường là bánh mì lạnh", "Bữa trưa", "Bánh ngọt buổi chiều"],
        "correct": 1
      },
      {
        "id": "tg18_05", "type": "FILL_BLANK",
        "sentence_de": "Ich trinke jeden Morgen ___ Glas Milch.",
        "hint_vi": "một (ein/eine/einen với Milch?)",
        "answer": "ein", "accept_also": ["ein"]
      }
    ],
    "practice": [
      {
        "id": "p18_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Mỗi sáng tôi ăn bánh mì với phô mai và uống một tách cà phê.",
        "answer": "Jeden Morgen esse ich Brot mit Käse und trinke eine Tasse Kaffee.",
        "accept_also": ["Zum Frühstück esse ich Brot mit Käse und trinke Kaffee."]
      },
      {
        "id": "p18_02", "type": "REORDER",
        "words": ["Fleisch.", "ich", "esse", "kein", "Vegetarierin.", "Ich", "bin"],
        "correct_order": ["Ich", "esse", "kein", "Fleisch.", "Ich", "bin", "Vegetarierin."],
        "translation": "Tôi không ăn thịt. Tôi ăn chay."
      },
      {
        "id": "p18_03", "type": "FILL_BLANK",
        "sentence_de": "Ich esse ___ Schweinefleisch und ___ Wurst, aber ich esse gern Fisch.",
        "hint_vi": "không thịt heo (DAS) ... không xúc xích (DIE)",
        "answer": "kein, keine", "accept_also": ["kein / keine"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Essgewohnheiten in Deutschland\n\nDeutsche essen gerne Brot. Es gibt über 300 verschiedene Brotsorten in Deutschland! Zum Frühstück gibt es Brot mit Butter, Käse oder Marmelade und einen Kaffee. Das Mittagessen ist die wichtigste Mahlzeit. Es gibt oft Fleisch mit Gemüse und Kartoffeln. Abends essen viele Deutsche nur Brot und Käse — das nennt man ''Abendbrot''. Immer mehr Menschen essen vegetarisch oder vegan.",
    "text_vi": "Thói quen ăn uống ở Đức\n\nNgười Đức thích ăn bánh mì. Có hơn 300 loại bánh mì khác nhau ở Đức! Bữa sáng thường có bánh mì với bơ, phô mai hoặc mứt và một tách cà phê. Bữa trưa là bữa ăn quan trọng nhất. Thường có thịt với rau và khoai tây. Buổi tối nhiều người Đức chỉ ăn bánh mì và phô mai — người ta gọi đó là ''Abendbrot''. Ngày càng nhiều người ăn chay.",
    "questions": [
      {
        "id": "rq18_01", "type": "FILL_BLANK",
        "question_vi": "Ở Đức có bao nhiêu loại bánh mì?",
        "answer": "über 300", "accept_also": ["300", "mehr als 300"]
      },
      {
        "id": "rq18_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Abendbrot'' là gì?",
        "options": ["Bữa sáng", "Bữa tối với bánh mì lạnh", "Bánh ngọt", "Bữa trưa"],
        "correct": 1
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Was essen und trinken Sie? Beschreiben Sie Ihre drei Mahlzeiten (Frühstück, Mittagessen, Abendessen).",
    "task_vi": "Bạn ăn và uống gì? Hãy miêu tả 3 bữa ăn của bạn (sáng, trưa, tối).",
    "min_sentences": 5,
    "example_answer": "Zum Frühstück esse ich Brot mit Käse und trinke Kaffee.\nZum Mittagessen esse ich Reis mit Gemüse und Fisch.\nZum Abendessen esse ich manchmal Suppe oder Salat.\nIch trinke gern Wasser und Tee.\nIch esse kein Schweinefleisch."
  },
  "audio_content": {
    "listen_words": [
      {"text": "das Brot", "meaning": "bánh mì"},
      {"text": "der Käse", "meaning": "phô mai"},
      {"text": "Ich esse kein Fleisch.", "meaning": "Tôi không ăn thịt."},
      {"text": "Was essen Sie zum Frühstück?", "meaning": "Bữa sáng bạn ăn gì?"},
      {"text": "das Mittagessen", "meaning": "bữa trưa"}
    ],
    "listen_dialogue": "Was essen Sie zum Frühstück? — Ich esse Brot mit Käse und trinke Kaffee. Und Sie? — Ich esse keine Milchprodukte. Ich trinke nur Tee."
  }
}'::jsonb
WHERE day_number = 18 AND is_active = TRUE;
