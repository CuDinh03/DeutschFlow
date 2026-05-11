-- V77: Day 14 — Review Module 3 (Chào hỏi, Giới thiệu, Nghề nghiệp)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Review: Modul 3", "vi": "Ôn tập Module 3 — Chào hỏi & Giới thiệu"},
  "overview": {
    "de": "Wiederholung: Begrüßung, Vorstellen, Berufe und Sprachen.",
    "vi": "Ôn lại toàn bộ Module 3: chào hỏi trang trọng/thân mật, tự giới thiệu bản thân đầy đủ, nghề nghiệp nam/nữ, và các ngôn ngữ. Bài review giúp củng cố trước khi sang Module 4."
  },
  "session_type": "REVIEW",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Tổng hợp: Chào hỏi"},
      "content": {"vi": "TRANG TRỌNG (Sie): Guten Morgen/Tag/Abend | Wie geht es Ihnen? | Auf Wiedersehen\nTHÂN MẬT (du): Hallo / Hi | Wie geht es dir? | Tschüss / Bis später\nLÚC NÀO CŨNG DÙNG ĐƯỢC: Hallo | Tschüss | Danke | Bitte | Entschuldigung"},
      "tags": ["#Review", "#Begrüßung"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Tổng hợp: Tự giới thiệu"},
      "content": {"vi": "Ich heiße ... (tên)\nIch komme aus ... (quê hương)\nIch wohne in ... (nơi ở)\nIch bin ... Jahre alt. (tuổi)\nIch bin ... von Beruf. (nghề)\nIch spreche ... (ngôn ngữ)\nIch bin verheiratet / ledig. (hôn nhân)"},
      "tags": ["#Review", "#Vorstellen"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Hội thoại mẫu hoàn chỉnh"},
      "content": {"vi": "— Guten Tag! Mein Name ist Weber.\n— Freut mich! Ich heiße Nguyen. Ich komme aus Vietnam.\n— Interessant! Was machen Sie beruflich?\n— Ich bin Koch. Ich arbeite im Restaurant ''Lotus''. Und Sie?\n— Ich bin Lehrerin. Ich unterrichte Deutsch.\n— Oh, schön! Ich lerne gerade Deutsch.\n— Sehr gut! Auf Wiedersehen!\n— Auf Wiedersehen!"},
      "tags": ["#Review", "#Dialog"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_rev3_01", "german": "die Nationalität", "meaning": "quốc tịch",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine Nationalität ist vietnamesisch.", "example_vi": "Quốc tịch của tôi là Việt Nam.",
      "speak_de": "Meine Nationalität ist vietnamesisch", "tags": ["#Herkunft", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/natsjonaˈliːtɛːt/"], "common_errors_vi": ["Nhấn vào -tät: na-tio-na-li-TÄT"], "ipa_target": "diː natsjonaˈliːtɛːt"}
    },
    {
      "id": "v_rev3_02", "german": "der Familienstand", "meaning": "tình trạng hôn nhân",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Mein Familienstand: ledig.", "example_vi": "Tình trạng hôn nhân: độc thân.",
      "speak_de": "Mein Familienstand ist ledig", "tags": ["#Familie", "#Vorstellen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/faˈmiːliənʃtant/"], "common_errors_vi": ["Wort dài: fa-MI-li-en-stand"], "ipa_target": "deːɐ̯ faˈmiːliənʃtant"}
    },
    {
      "id": "v_rev3_03", "german": "die Telefonnummer", "meaning": "số điện thoại",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine Telefonnummer ist 0123 456789.", "example_vi": "Số điện thoại của tôi là 0123 456789.",
      "speak_de": "Meine Telefonnummer ist", "tags": ["#Kontakt", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/teleˈfoːnnʊmɐ/"], "common_errors_vi": ["tele-FON: f đọc /f/"], "ipa_target": "diː teleˈfoːnnʊmɐ"}
    },
    {
      "id": "v_rev3_04", "german": "die E-Mail-Adresse", "meaning": "địa chỉ email",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine E-Mail ist info@example.de", "example_vi": "Email của tôi là info@example.de",
      "speak_de": "Meine E-Mail-Adresse ist", "tags": ["#Kontakt", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/iːmeɪ̯l/"], "common_errors_vi": ["E-Mail đọc như tiếng Anh /iːmeɪ̯l/"], "ipa_target": "diː iːmeɪ̯l aˈdʁɛsə"}
    },
    {
      "id": "v_rev3_05", "german": "interessant", "meaning": "thú vị, hay",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Das ist sehr interessant!", "example_vi": "Thật thú vị!",
      "speak_de": "Das ist sehr interessant!", "tags": ["#Adjektiv", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɪntəʁeˈsant/"], "common_errors_vi": ["Nhấn cuối: in-te-re-SANT"], "ipa_target": "ɪntəʁeˈsant"}
    }
  ],
  "phrases": [
    {"german": "Darf ich fragen, woher Sie kommen?", "meaning": "Tôi có thể hỏi bạn đến từ đâu không?", "speak_de": "Darf ich fragen, woher Sie kommen?"},
    {"german": "Schön, Sie kennenzulernen!", "meaning": "Rất vui được làm quen với ông/bà!", "speak_de": "Schön, Sie kennenzulernen!"},
    {"german": "Ich bin gerade erst angekommen.", "meaning": "Tôi vừa mới đến.", "speak_de": "Ich bin gerade erst angekommen."}
  ],
  "examples": [
    {"german": "Darf ich mich vorstellen? Ich bin Minh Nguyen, Koch aus Vietnam, wohnhaft in Berlin.", "translation": "Cho phép tôi tự giới thiệu? Tôi là Minh Nguyễn, đầu bếp từ Việt Nam, hiện sống ở Berlin.", "note": "Cách giới thiệu trang trọng", "speak_de": "Darf ich mich vorstellen?"},
    {"german": "Angenehm! Ich heiße Schmidt. Hier ist meine Visitenkarte.", "translation": "Hân hạnh! Tôi tên Schmidt. Đây là card visit của tôi.", "note": "Sau khi gặp mặt trang trọng", "speak_de": "Angenehm!"}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg14_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Chọn câu giới thiệu ĐẦY ĐỦ nhất:",
        "options": [
          "Ich heiße Linh.",
          "Ich heiße Linh, komme aus Hanoi und bin Lehrerin.",
          "Ich bin 25.",
          "Ich wohne in Berlin."
        ],
        "correct": 1
      },
      {
        "id": "tg14_02", "type": "FILL_BLANK",
        "sentence_de": "— Guten Morgen! — Guten Morgen! Wie ___ es Ihnen? — Danke, ___.",
        "hint_vi": "khỏe không ... tốt",
        "answer": "geht, gut", "accept_also": ["geht / gut"]
      },
      {
        "id": "tg14_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Sie sind Ingenieurin'' — Sie ở đây chỉ ai?",
        "options": ["''bạn'' thân mật", "''cô ấy'' ngôi 3", "''ông/bà'' trang trọng", "''họ'' số nhiều"],
        "correct": 2
      },
      {
        "id": "tg14_04", "type": "MULTIPLE_CHOICE",
        "question_vi": "Bạn gặp bạn thân. Câu nào ĐÚNG?",
        "options": ["Auf Wiedersehen!", "Guten Tag!", "Hallo! Wie geht es dir?", "Wie geht es Ihnen?"],
        "correct": 2
      },
      {
        "id": "tg14_05", "type": "FILL_BLANK",
        "sentence_de": "Ich bin ___ Beruf Kellnerin und spreche ___ bisschen Deutsch.",
        "hint_vi": "theo nghề ... một",
        "answer": "von, ein", "accept_also": ["von / ein"]
      }
    ],
    "practice": [
      {
        "id": "p14_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Xin chào! Tôi tên Hoa. Tôi đến từ Việt Nam và làm y tá ở Đức.",
        "answer": "Hallo! Ich heiße Hoa. Ich komme aus Vietnam und arbeite als Krankenpflegerin in Deutschland.",
        "accept_also": ["Hallo! Ich heiße Hoa. Ich komme aus Vietnam und bin Krankenpflegerin in Deutschland."]
      },
      {
        "id": "p14_02", "type": "REORDER",
        "words": ["kennenzulernen!", "Sie", "Schön,"],
        "correct_order": ["Schön,", "Sie", "kennenzulernen!"],
        "translation": "Rất vui được làm quen với ông/bà!"
      },
      {
        "id": "p14_03", "type": "FILL_BLANK",
        "sentence_de": "— Wie ___ Sie? — Mein ___ ist Weber. — Angenehm!",
        "hint_vi": "tên gì ... tên",
        "answer": "heißen, Name", "accept_also": ["heißen / Name"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Das Formular\n\nBitte füllen Sie das Formular aus:\nVorname: Thi\nNachname: Nguyen\nGeburtsdatum: 15.03.1995\nGeburtsort: Ho-Chi-Minh-Stadt, Vietnam\nNationalität: vietnamesisch\nWohnort: Frankfurt am Main\nBeruf: Köchin\nSprachen: Vietnamesisch, Deutsch (B1), Englisch (A2)\nFamilienstand: ledig",
    "text_vi": "Mẫu đơn\n\nVui lòng điền vào mẫu đơn:\nTên: Thị\nHọ: Nguyễn\nNgày sinh: 15.03.1995\nNơi sinh: TP. Hồ Chí Minh, Việt Nam\nQuốc tịch: Việt Nam\nNơi ở: Frankfurt am Main\nNghề nghiệp: Đầu bếp nữ\nNgôn ngữ: Tiếng Việt, Tiếng Đức (B1), Tiếng Anh (A2)\nTình trạng hôn nhân: độc thân",
    "questions": [
      {
        "id": "rq14_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Nguyen Thi đang ở đâu?",
        "options": ["Ho-Chi-Minh-Stadt", "Frankfurt am Main", "Berlin", "Hamburg"],
        "correct": 1
      },
      {
        "id": "rq14_02", "type": "FILL_BLANK",
        "question_vi": "Cô ấy nói được mấy ngôn ngữ?",
        "answer": "drei", "accept_also": ["3", "drei Sprachen"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Füllen Sie das Formular aus und schreiben Sie danach einen kurzen Text (5 Sätze) über sich selbst.",
    "task_vi": "Điền thông tin của bạn vào mẫu và viết đoạn văn ngắn (5 câu) về bản thân.",
    "min_sentences": 5,
    "example_answer": "Ich heiße Minh Nguyen.\nIch komme aus Ho-Chi-Minh-Stadt in Vietnam.\nJetzt wohne ich in Frankfurt am Main.\nIch bin 29 Jahre alt und bin Koch von Beruf.\nIch spreche Vietnamesisch und lerne Deutsch."
  },
  "audio_content": {
    "listen_words": [
      {"text": "die Nationalität", "meaning": "quốc tịch"},
      {"text": "der Familienstand", "meaning": "tình trạng hôn nhân"},
      {"text": "Schön, Sie kennenzulernen!", "meaning": "Rất vui được gặp!"},
      {"text": "Darf ich mich vorstellen?", "meaning": "Cho phép tôi tự giới thiệu?"},
      {"text": "Das ist sehr interessant!", "meaning": "Thật thú vị!"}
    ],
    "listen_dialogue": "Guten Tag! Darf ich mich vorstellen? Ich bin Minh, Koch aus Vietnam. — Angenehm! Ich heiße Weber. Schön, Sie kennenzulernen!"
  }
}'::jsonb
WHERE day_number = 14 AND is_active = TRUE;
