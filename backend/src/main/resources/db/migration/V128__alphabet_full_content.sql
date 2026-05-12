-- V128: Add full interactive content to "Das Alphabet" node
UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de":"Das Alphabet","vi":"Bảng chữ cái tiếng Đức"},
  "overview": {"de":"Das Alphabet hat 26 Buchstaben.","vi":"Học bảng chữ cái A-Z và các ký tự đặc trưng."},
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "GRAMMAR",
      "title": {"de": "Die Buchstaben", "vi": "Các chữ cái"},
      "content": {"de": "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z", "vi": "Bảng chữ cái tiếng Đức có 26 chữ cái cơ bản tương tự tiếng Anh, nhưng cách đọc khác nhau. Hãy nghe phát âm từng chữ cái ở phần từ vựng bên dưới."},
      "tags": ["#Alphabet"]
    },
    {
      "type": "GRAMMAR",
      "title": {"de": "Umlaute und Eszett", "vi": "Ký tự đặc biệt"},
      "content": {"de": "Ä ä, Ö ö, Ü ü, ß", "vi": "Tiếng Đức có thêm 3 biến âm (Umlaut) và 1 chữ s kép (Eszett/scharfes S)."},
      "tags": ["#Sonderzeichen"]
    }
  ],
  "vocabulary": [
    {
      "id": "alpha_a",
      "german": "A, a",
      "meaning": "Chữ A (Ví dụ: der Apfel - quả táo)",
      "example_de": "A wie Apfel",
      "example_vi": "A như Apfel",
      "speak_de": "A.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[aː]", "focus_phonemes": ["aː"]}
    },
    {
      "id": "alpha_b",
      "german": "B, b",
      "meaning": "Chữ B (Ví dụ: das Buch - quyển sách)",
      "example_de": "B wie Buch",
      "example_vi": "B như Buch",
      "speak_de": "B.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[beː]", "focus_phonemes": ["beː"]}
    },
    {
      "id": "alpha_c",
      "german": "C, c",
      "meaning": "Chữ C (Ví dụ: der Computer - máy tính)",
      "example_de": "C wie Computer",
      "example_vi": "C như Computer",
      "speak_de": "C.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[tseː]", "focus_phonemes": ["tseː"]}
    },
    {
      "id": "alpha_d",
      "german": "D, d",
      "meaning": "Chữ D (Ví dụ: das Dach - mái nhà)",
      "example_de": "D wie Dach",
      "example_vi": "D như Dach",
      "speak_de": "D.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[deː]", "focus_phonemes": ["deː"]}
    },
    {
      "id": "alpha_e",
      "german": "E, e",
      "meaning": "Chữ E (Ví dụ: der Elefant - con voi)",
      "example_de": "E wie Elefant",
      "example_vi": "E như Elefant",
      "speak_de": "E.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[eː]", "focus_phonemes": ["eː"]}
    },
    {
      "id": "alpha_f",
      "german": "F, f",
      "meaning": "Chữ F (Ví dụ: der Fisch - con cá)",
      "example_de": "F wie Fisch",
      "example_vi": "F như Fisch",
      "speak_de": "F.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛf]", "focus_phonemes": ["ɛf"]}
    },
    {
      "id": "alpha_g",
      "german": "G, g",
      "meaning": "Chữ G (Ví dụ: das Geld - tiền)",
      "example_de": "G wie Geld",
      "example_vi": "G như Geld",
      "speak_de": "G.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[geː]", "focus_phonemes": ["geː"]}
    },
    {
      "id": "alpha_h",
      "german": "H, h",
      "meaning": "Chữ H (Ví dụ: der Hund - con chó)",
      "example_de": "H wie Hund",
      "example_vi": "H như Hund",
      "speak_de": "H.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[haː]", "focus_phonemes": ["haː"]}
    },
    {
      "id": "alpha_i",
      "german": "I, i",
      "meaning": "Chữ I (Ví dụ: der Igel - con nhím)",
      "example_de": "I wie Igel",
      "example_vi": "I như Igel",
      "speak_de": "I.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[iː]", "focus_phonemes": ["iː"]}
    },
    {
      "id": "alpha_j",
      "german": "J, j",
      "meaning": "Chữ J (Ví dụ: die Jacke - áo khoác)",
      "example_de": "J wie Jacke",
      "example_vi": "J như Jacke",
      "speak_de": "J.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[jɔt]", "focus_phonemes": ["jɔt"]}
    },
    {
      "id": "alpha_k",
      "german": "K, k",
      "meaning": "Chữ K (Ví dụ: die Katze - con mèo)",
      "example_de": "K wie Katze",
      "example_vi": "K như Katze",
      "speak_de": "K.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[kaː]", "focus_phonemes": ["kaː"]}
    },
    {
      "id": "alpha_l",
      "german": "L, l",
      "meaning": "Chữ L (Ví dụ: die Lampe - cái đèn)",
      "example_de": "L wie Lampe",
      "example_vi": "L như Lampe",
      "speak_de": "L.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛl]", "focus_phonemes": ["ɛl"]}
    },
    {
      "id": "alpha_m",
      "german": "M, m",
      "meaning": "Chữ M (Ví dụ: die Maus - con chuột)",
      "example_de": "M wie Maus",
      "example_vi": "M như Maus",
      "speak_de": "M.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛm]", "focus_phonemes": ["ɛm"]}
    },
    {
      "id": "alpha_n",
      "german": "N, n",
      "meaning": "Chữ N (Ví dụ: die Nase - cái mũi)",
      "example_de": "N wie Nase",
      "example_vi": "N như Nase",
      "speak_de": "N.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛn]", "focus_phonemes": ["ɛn"]}
    },
    {
      "id": "alpha_o",
      "german": "O, o",
      "meaning": "Chữ O (Ví dụ: die Oma - người bà)",
      "example_de": "O wie Oma",
      "example_vi": "O như Oma",
      "speak_de": "O.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[oː]", "focus_phonemes": ["oː"]}
    },
    {
      "id": "alpha_p",
      "german": "P, p",
      "meaning": "Chữ P (Ví dụ: die Pizza - bánh pizza)",
      "example_de": "P wie Pizza",
      "example_vi": "P như Pizza",
      "speak_de": "P.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[peː]", "focus_phonemes": ["peː"]}
    },
    {
      "id": "alpha_q",
      "german": "Q, q",
      "meaning": "Chữ Q (Ví dụ: die Qualle - con sứa)",
      "example_de": "Q wie Qualle",
      "example_vi": "Q như Qualle",
      "speak_de": "Q.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[kuː]", "focus_phonemes": ["kuː"]}
    },
    {
      "id": "alpha_r",
      "german": "R, r",
      "meaning": "Chữ R (Ví dụ: der Regen - cơn mưa)",
      "example_de": "R wie Regen",
      "example_vi": "R như Regen",
      "speak_de": "R.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛʁ]", "focus_phonemes": ["ɛʁ"]}
    },
    {
      "id": "alpha_s",
      "german": "S, s",
      "meaning": "Chữ S (Ví dụ: die Sonne - mặt trời)",
      "example_de": "S wie Sonne",
      "example_vi": "S như Sonne",
      "speak_de": "S.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛs]", "focus_phonemes": ["ɛs"]}
    },
    {
      "id": "alpha_t",
      "german": "T, t",
      "meaning": "Chữ T (Ví dụ: der Tisch - cái bàn)",
      "example_de": "T wie Tisch",
      "example_vi": "T như Tisch",
      "speak_de": "T.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[teː]", "focus_phonemes": ["teː"]}
    },
    {
      "id": "alpha_u",
      "german": "U, u",
      "meaning": "Chữ U (Ví dụ: die Uhr - đồng hồ)",
      "example_de": "U wie Uhr",
      "example_vi": "U như Uhr",
      "speak_de": "U.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[uː]", "focus_phonemes": ["uː"]}
    },
    {
      "id": "alpha_v",
      "german": "V, v",
      "meaning": "Chữ V (Ví dụ: der Vogel - con chim)",
      "example_de": "V wie Vogel",
      "example_vi": "V như Vogel",
      "speak_de": "V.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[faʊ]", "focus_phonemes": ["faʊ"]}
    },
    {
      "id": "alpha_w",
      "german": "W, w",
      "meaning": "Chữ W (Ví dụ: das Wasser - nước)",
      "example_de": "W wie Wasser",
      "example_vi": "W như Wasser",
      "speak_de": "W.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[veː]", "focus_phonemes": ["veː"]}
    },
    {
      "id": "alpha_x",
      "german": "X, x",
      "meaning": "Chữ X (Ví dụ: das Xylofon - đàn mộc cầm)",
      "example_de": "X wie Xylofon",
      "example_vi": "X như Xylofon",
      "speak_de": "X.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɪks]", "focus_phonemes": ["ɪks"]}
    },
    {
      "id": "alpha_y",
      "german": "Y, y",
      "meaning": "Chữ Y (Ví dụ: das Yoga - môn yoga)",
      "example_de": "Y wie Yoga",
      "example_vi": "Y như Yoga",
      "speak_de": "Ypsilon.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ˈʏpsilɔn]", "focus_phonemes": ["ʏpsilɔn"]}
    },
    {
      "id": "alpha_z",
      "german": "Z, z",
      "meaning": "Chữ Z (Ví dụ: das Zebra - con ngựa vằn)",
      "example_de": "Z wie Zebra",
      "example_vi": "Z như Zebra",
      "speak_de": "Z.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[tsɛt]", "focus_phonemes": ["tsɛt"]}
    },
    {
      "id": "alpha_ae",
      "german": "Ä, ä",
      "meaning": "Chữ Ä (Ví dụ: der Ärger - sự tức giận)",
      "example_de": "Ä wie Ärger",
      "example_vi": "Ä như Ärger",
      "speak_de": "Ä.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛː]", "focus_phonemes": ["ɛː"]}
    },
    {
      "id": "alpha_oe",
      "german": "Ö, ö",
      "meaning": "Chữ Ö (Ví dụ: das Öl - dầu)",
      "example_de": "Ö wie Öl",
      "example_vi": "Ö như Öl",
      "speak_de": "Ö.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[øː]", "focus_phonemes": ["øː"]}
    },
    {
      "id": "alpha_ue",
      "german": "Ü, ü",
      "meaning": "Chữ Ü (Ví dụ: die Übung - bài tập)",
      "example_de": "Ü wie Übung",
      "example_vi": "Ü như Übung",
      "speak_de": "Ü.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[yː]", "focus_phonemes": ["yː"]}
    },
    {
      "id": "alpha_ss",
      "german": "ß (Eszett)",
      "meaning": "Chữ s kép (Ví dụ: der Fuß - bàn chân)",
      "example_de": "ß wie in Fuß",
      "example_vi": "ß như trong chữ Fuß",
      "speak_de": "Eszett.",
      "tags": ["#Alphabet"],
      "ai_speech_hints": {"ipa_target": "[ɛsˈtsɛt]", "focus_phonemes": ["tsɛt"]}
    }
  ],
  "reading_passage": {
    "text_de": "Im Deutschkurs:\n\nAnna: Guten Tag! Wie ist Ihr Name?\nLukas: Mein Name ist Lukas Müller.\nAnna: Wie buchstabiert man das?\nLukas: Meinen Vornamen buchstabiert man L - U - K - A - S. Und meinen Nachnamen: M - Ü - L - L - E - R. Wie buchstabiert man Ihren Namen?\nAnna: A - N - N - A.",
    "text_vi_hover": "Trong lớp học tiếng Đức: Xin chào! Tên của bạn là gì? Tên tôi là Lukas Müller. Đánh vần cái đó như thế nào? Tên của tôi đánh vần là L-U-K-A-S. Còn họ của tôi: M-Ü-L-L-E-R. Đánh vần tên của bạn như thế nào? A-N-N-A.",
    "questions": [
      {
        "question": "Wie buchstabiert Lukas seinen Vornamen?",
        "options": ["M - U - L - L - E - R", "L - U - K - A - S", "A - N - N - A"],
        "answerIndex": 1
      },
      {
        "question": "Welcher Umlaut ist im Nachnamen Müller?",
        "options": ["Ä", "Ö", "Ü", "ß"],
        "answerIndex": 2
      }
    ],
    "tap_translate_vocab_refs": ["alpha_l", "alpha_u", "alpha_k", "alpha_a", "alpha_s", "alpha_m", "alpha_ue", "alpha_e", "alpha_r"]
  },
  "audio_content": {
    "url": "/audio/buchstabieren.mp3",
    "transcript_sync": [
      {"word": "Hallo", "start": 0.0, "end": 0.5},
      {"word": "mein", "start": 0.5, "end": 0.8},
      {"word": "Name", "start": 0.8, "end": 1.2},
      {"word": "ist", "start": 1.2, "end": 1.5},
      {"word": "Lukas", "start": 1.5, "end": 2.0},
      {"word": "Müller.", "start": 2.0, "end": 2.6},
      {"word": "Ich", "start": 2.6, "end": 2.9},
      {"word": "buchstabiere", "start": 2.9, "end": 3.8},
      {"word": "meinen", "start": 3.8, "end": 4.1},
      {"word": "Vornamen:", "start": 4.1, "end": 4.8},
      {"word": "L.", "start": 4.8, "end": 5.5},
      {"word": "U.", "start": 5.5, "end": 6.2},
      {"word": "K.", "start": 6.2, "end": 6.9},
      {"word": "A.", "start": 6.9, "end": 7.6},
      {"word": "S.", "start": 7.6, "end": 8.3},
      {"word": "Und", "start": 8.3, "end": 8.6},
      {"word": "meinen", "start": 8.6, "end": 9.0},
      {"word": "Nachnamen:", "start": 9.0, "end": 9.7},
      {"word": "M.", "start": 9.7, "end": 10.4},
      {"word": "Ü.", "start": 10.4, "end": 11.1},
      {"word": "L.", "start": 11.1, "end": 11.8},
      {"word": "L.", "start": 11.8, "end": 12.5},
      {"word": "E.", "start": 12.5, "end": 13.2},
      {"word": "R.", "start": 13.2, "end": 13.9},
      {"word": "Wie", "start": 13.9, "end": 14.2},
      {"word": "buchstabiert", "start": 14.2, "end": 15.0},
      {"word": "man", "start": 15.0, "end": 15.3},
      {"word": "Ihren", "start": 15.3, "end": 15.6},
      {"word": "Namen?", "start": 15.6, "end": 16.2}
    ]
  },
  "phrases": [
    {
      "german": "Wie buchstabiert man das?",
      "meaning": "Đánh vần cái đó như thế nào?",
      "speak_de": "Wie buchstabiert man das?"
    },
    {
      "german": "Ich buchstabiere meinen Namen.",
      "meaning": "Tôi đánh vần tên của tôi.",
      "speak_de": "Ich buchstabiere meinen Namen."
    },
    {
      "german": "A wie Apfel, B wie Buch.",
      "meaning": "A như quả táo, B như quyển sách.",
      "speak_de": "A wie Apfel, B wie Buch."
    }
  ],
  "examples": [
    {
      "german": "M - Ü - L - L - E - R",
      "translation": "Tên tôi là Müller (đánh vần)",
      "speak_de": "M. Ü. L. L. E. R."
    }
  ],
  "writing_prompt": {
    "task_de": "Schreiben Sie, wie man Ihren Namen buchstabiert.",
    "task_vi": "Viết lại cách đánh vần họ và tên của bạn.",
    "bullet_points": [
      "Viết câu giới thiệu tên của bạn (Mein Name ist...)",
      "Viết từng chữ cái đánh vần tên của bạn (Ich buchstabiere: ...)"
    ],
    "min_words": 5
  },
  "exercises":{"theory_gate":[],"practice":[]}
}'::jsonb
WHERE title_de = 'Das Alphabet';
