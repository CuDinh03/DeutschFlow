-- V75: Day 12 — Sich vorstellen (Giới thiệu bản thân)
-- Full content_json: vocabulary, theory_cards, exercises (5 theory_gate + 3 practice), reading, writing, audio

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Sich vorstellen", "vi": "Giới thiệu bản thân"},
  "overview": {
    "de": "Name, Alter, Herkunft, Beruf und Wohnort vorstellen.",
    "vi": "Bài học quan trọng nhất của A1. Học cách giới thiệu: tên, tuổi, quê hương, nghề nghiệp, nơi ở. Đây là những gì bạn cần trong mọi cuộc gặp gỡ ở Đức."
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Động từ heißen, sein, kommen, wohnen"},
      "content": {"vi": "Ich heiße ... — Tôi tên là ...\nIch bin ... Jahre alt. — Tôi ... tuổi.\nIch komme aus ... — Tôi đến từ ...\nIch wohne in ... — Tôi sống ở ...\nIch bin ... (Beruf). — Tôi là ... (nghề)\n\n💡 Conjugation: ich + Verbstamm + e\nheiß-en → ich heiße\nkomm-en → ich komme\nwohn-en → ich wohne"},
      "tags": ["#Verben", "#Vorstellen"]
    },
    {
      "type": "RULE",
      "title": {"vi": "W-Fragen khi hỏi về người khác"},
      "content": {"vi": "Wie heißen Sie? — Ông/bà tên gì?\nWie alt sind Sie? — Ông/bà bao nhiêu tuổi?\nWoher kommen Sie? — Ông/bà đến từ đâu?\nWo wohnen Sie? — Ông/bà sống ở đâu?\nWas sind Sie von Beruf? — Ông/bà làm nghề gì?\n\n⚠️ Dùng ''du'' với bạn bè: Wie heißt du?"},
      "tags": ["#W-Fragen", "#Sie-Form", "#du-Form"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Mẫu tự giới thiệu hoàn chỉnh"},
      "content": {"vi": "Ich heiße Nguyen Van An.\nIch komme aus Vietnam.\nIch wohne in Berlin.\nIch bin 28 Jahre alt.\nIch bin Koch von Beruf.\n\n→ Dịch: Tôi tên Nguyễn Văn An. Tôi đến từ Việt Nam. Tôi sống ở Berlin. Tôi 28 tuổi. Tôi làm đầu bếp."},
      "tags": ["#Vorstellen", "#Beruf"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_vor_01", "german": "heißen", "meaning": "tên là",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich heiße Maria. Wie heißen Sie?", "example_vi": "Tôi tên Maria. Ông/bà tên gì?",
      "speak_de": "Ich heiße", "tags": ["#Verb", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈhaɪ̯sən/"], "common_errors_vi": ["ei đọc /ai/ không phải /ei/"], "ipa_target": "ˈhaɪ̯sən"}
    },
    {
      "id": "v_vor_02", "german": "kommen aus", "meaning": "đến từ",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich komme aus Vietnam.", "example_vi": "Tôi đến từ Việt Nam.",
      "speak_de": "Ich komme aus Vietnam", "tags": ["#Verb", "#Herkunft", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkɔmə/"], "common_errors_vi": ["komme: nhấn KOM-me"], "ipa_target": "ˈkɔmə aʊ̯s"}
    },
    {
      "id": "v_vor_03", "german": "wohnen in", "meaning": "sống ở",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich wohne in Hamburg.", "example_vi": "Tôi sống ở Hamburg.",
      "speak_de": "Ich wohne in Hamburg", "tags": ["#Verb", "#Wohnort", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈvoːnə/"], "common_errors_vi": ["w đọc /v/ tiếng Đức, không phải /w/"], "ipa_target": "ˈvoːnə ɪn"}
    },
    {
      "id": "v_vor_04", "german": "das Alter", "meaning": "tuổi tác",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Ich bin 25 Jahre alt.", "example_vi": "Tôi 25 tuổi.",
      "speak_de": "Ich bin fünfundzwanzig Jahre alt", "tags": ["#Nomen", "#Zahlen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈjaːʁə/"], "common_errors_vi": ["Jahre: J đọc /j/ như y tiếng Anh"], "ipa_target": "ˈaltɐ"}
    },
    {
      "id": "v_vor_05", "german": "die Sprache", "meaning": "ngôn ngữ",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Ich spreche Deutsch und Vietnamesisch.", "example_vi": "Tôi nói tiếng Đức và tiếng Việt.",
      "speak_de": "Ich spreche Deutsch und Vietnamesisch", "tags": ["#Nomen", "#Sprachen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʃpʁaːxə/"], "common_errors_vi": ["spr = /ʃpʁ/, ch cuối = ich-Laut"], "ipa_target": "diː ˈʃpʁaːxə"}
    },
    {
      "id": "v_vor_06", "german": "verheiratet / ledig", "meaning": "đã kết hôn / độc thân",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich bin verheiratet und habe zwei Kinder.", "example_vi": "Tôi đã kết hôn và có hai con.",
      "speak_de": "Ich bin verheiratet", "tags": ["#Adjektiv", "#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/fɛɐ̯ˈhaɪ̯ʁatət/"], "common_errors_vi": ["ver- đọc /fɛɐ̯/, ei = /ai/"], "ipa_target": "fɛɐ̯ˈhaɪ̯ʁatət"}
    },
    {
      "id": "v_vor_07", "german": "die Adresse", "meaning": "địa chỉ",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine Adresse ist Hauptstraße 5, Berlin.", "example_vi": "Địa chỉ của tôi là phố Hauptstraße 5, Berlin.",
      "speak_de": "Meine Adresse ist", "tags": ["#Nomen", "#Wohnort", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/aˈdʁɛsə/"], "common_errors_vi": ["Adresse: nhấn vào dres-SE"], "ipa_target": "diː aˈdʁɛsə"}
    }
  ],
  "phrases": [
    {"german": "Ich heiße ... und komme aus ...", "meaning": "Tôi tên ... và đến từ ...", "speak_de": "Ich heiße Anna und komme aus Deutschland."},
    {"german": "Darf ich mich vorstellen?", "meaning": "Tôi có thể tự giới thiệu không?", "speak_de": "Darf ich mich vorstellen?"},
    {"german": "Angenehm! / Freut mich!", "meaning": "Hân hạnh được gặp!", "speak_de": "Freut mich!"}
  ],
  "examples": [
    {"german": "Guten Tag! Ich heiße Linh. Ich komme aus Vietnam und wohne jetzt in München. Ich bin 26 Jahre alt und studiere Informatik.", "translation": "Xin chào! Tôi tên Linh. Tôi đến từ Việt Nam và hiện sống ở Munich. Tôi 26 tuổi và đang học tin học.", "note": "Tự giới thiệu hoàn chỉnh", "speak_de": "Guten Tag! Ich heiße Linh."},
    {"german": "Wie heißen Sie? — Mein Name ist Weber. Peter Weber.", "translation": "Ông tên gì? — Tên tôi là Weber. Peter Weber.", "note": "Cách giới thiệu tên trang trọng", "speak_de": "Wie heißen Sie?"}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg12_01", "type": "FILL_BLANK",
        "sentence_de": "Ich ___ Anna. Ich ___ aus Österreich.",
        "hint_vi": "tên là ... đến từ",
        "answer": "heiße, komme", "accept_also": ["heiße / komme"]
      },
      {
        "id": "tg12_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "Cách hỏi tuổi lịch sự với người lạ?",
        "options": ["Wie alt bist du?", "Wie alt sind Sie?", "Wann geboren?", "Alt wie?"],
        "correct": 1
      },
      {
        "id": "tg12_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Woher kommen Sie?'' hỏi về cái gì?",
        "options": ["Tên", "Tuổi", "Quê hương", "Nghề nghiệp"],
        "correct": 2
      },
      {
        "id": "tg12_04", "type": "FILL_BLANK",
        "sentence_de": "Ich ___ in Berlin. Meine ___ ist Berliner Straße 10.",
        "hint_vi": "sống ở ... địa chỉ",
        "answer": "wohne, Adresse", "accept_also": ["wohne / Adresse"]
      },
      {
        "id": "tg12_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "Trả lời ''Freut mich!'' bằng gì?",
        "options": ["Tschüss!", "Freut mich auch!", "Guten Morgen!", "Danke für nichts!"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p12_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Tôi tên Minh, tôi đến từ Hà Nội và sống ở Frankfurt.",
        "answer": "Ich heiße Minh, ich komme aus Hanoi und wohne in Frankfurt.",
        "accept_also": ["Ich heiße Minh. Ich komme aus Hanoi. Ich wohne in Frankfurt."]
      },
      {
        "id": "p12_02", "type": "REORDER",
        "words": ["alt?", "sind", "Wie", "Sie"],
        "correct_order": ["Wie", "alt", "sind", "Sie?"],
        "translation": "Ông/bà bao nhiêu tuổi?"
      },
      {
        "id": "p12_03", "type": "FILL_BLANK",
        "sentence_de": "Ich bin Lehrerin ___ Beruf und spreche Deutsch und Englisch.",
        "hint_vi": "theo nghề nghiệp",
        "answer": "von", "accept_also": ["von"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Hallo! Ich bin Minh.\n\nHallo! Mein Name ist Nguyen Van Minh. Ich heiße Minh. Ich komme aus Vietnam, aus Ho-Chi-Minh-Stadt. Jetzt wohne ich in Hamburg. Ich bin 30 Jahre alt. Ich bin Koch von Beruf. Ich spreche Vietnamesisch und ein bisschen Deutsch. Ich bin ledig.",
    "text_vi": "Xin chào! Tôi là Minh.\n\nXin chào! Tên tôi là Nguyễn Văn Minh. Tôi tên Minh. Tôi đến từ Việt Nam, từ thành phố Hồ Chí Minh. Bây giờ tôi sống ở Hamburg. Tôi 30 tuổi. Tôi làm đầu bếp. Tôi nói tiếng Việt và một chút tiếng Đức. Tôi độc thân.",
    "questions": [
      {
        "id": "rq12_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Minh đến từ thành phố nào?",
        "options": ["Hanoi", "Hamburg", "Ho-Chi-Minh-Stadt", "Berlin"],
        "correct": 2
      },
      {
        "id": "rq12_02", "type": "FILL_BLANK",
        "question_vi": "Minh làm nghề gì?",
        "answer": "Koch", "accept_also": ["Er ist Koch", "Koch von Beruf"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Stellen Sie sich vor! Schreiben Sie 5-6 Sätze: Name, Herkunft, Wohnort, Alter, Beruf, Sprachen.",
    "task_vi": "Tự giới thiệu bản thân! Viết 5-6 câu: tên, quê hương, nơi ở, tuổi, nghề nghiệp, ngôn ngữ.",
    "min_sentences": 5,
    "example_answer": "Ich heiße Lan.\nIch komme aus Hanoi, Vietnam.\nJetzt wohne ich in München.\nIch bin 24 Jahre alt.\nIch bin Krankenpflegerin von Beruf.\nIch spreche Vietnamesisch, Deutsch und Englisch."
  },
  "audio_content": {
    "listen_words": [
      {"text": "Ich heiße ...", "meaning": "Tôi tên là ..."},
      {"text": "Ich komme aus Vietnam.", "meaning": "Tôi đến từ Việt Nam."},
      {"text": "Ich wohne in Berlin.", "meaning": "Tôi sống ở Berlin."},
      {"text": "Wie heißen Sie?", "meaning": "Ông/bà tên gì?"},
      {"text": "Freut mich!", "meaning": "Hân hạnh gặp bạn!"}
    ],
    "listen_dialogue": "Guten Tag! Ich heiße Linh. Ich komme aus Vietnam und wohne jetzt in München. Freut mich!"
  }
}'::jsonb
WHERE day_number = 12 AND is_active = TRUE;
