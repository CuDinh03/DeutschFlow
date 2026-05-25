-- V74: Day 11 — Begrüßung & Verabschiedung
-- Full content_json: vocabulary, theory_cards, phrases, exercises (5 theory_gate + 3 practice), reading_passage, writing_prompt

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Begrüßung & Verabschiedung", "vi": "Chào hỏi & Tạm biệt"},
  "overview": {
    "de": "Formelle und informelle Begrüßungen auf Deutsch.",
    "vi": "Tiếng Đức có 2 cấp độ lịch sự: trang trọng (Sie) dùng với người lạ/cấp trên, thân mật (du) dùng với bạn bè/gia đình. Chọn sai sẽ bị coi là bất lịch sự!"
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Chào trang trọng (Sie-Form)"},
      "content": {"vi": "Guten Morgen! — Chào buổi sáng (đến ~11h)\nGuten Tag! — Chào buổi ngày (11h–18h)\nGuten Abend! — Chào buổi tối (sau 18h)\nAuf Wiedersehen! — Tạm biệt (trang trọng)\nTschüss! — Tạm biệt (thân mật)\n\n⚠️ Người Việt hay dùng ''Guten Morgen'' cả ngày — SAI!"},
      "tags": ["#Begrüßung", "#Sie-Form"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Chào thân mật (du-Form)"},
      "content": {"vi": "Hallo! — Xin chào (dùng được cả ngày)\nHi! — Chào (rất thân mật)\nTschüss! / Tschau! — Tạm biệt\nBis später! — Hẹn gặp lại sau\nBis morgen! — Hẹn ngày mai\n\n💡 ''Hallo'' là an toàn nhất khi chưa biết dùng cái nào!"},
      "tags": ["#Begrüßung", "#du-Form"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Hỏi thăm sức khỏe"},
      "content": {"vi": "Wie geht es Ihnen? — Bạn (ông/bà) có khỏe không? (trang trọng)\nWie geht es dir? — Bạn khỏe không? (thân mật)\nDanke, gut. — Cảm ơn, tôi khỏe.\nEs geht. — Tạm ổn.\nNicht so gut. — Không được tốt lắm."},
      "tags": ["#Befinden", "#Kommunikation"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_begr_01", "german": "Guten Morgen", "meaning": "chào buổi sáng",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Guten Morgen, Frau Müller!", "example_vi": "Chào buổi sáng, bà Müller!",
      "speak_de": "Guten Morgen", "tags": ["#Begrüßung", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈɡuːtən ˈmɔʁɡən/"], "common_errors_vi": ["Đọc Morgen là /moocghen/, cần /mɔʁɡən/"], "ipa_target": "ˈɡuːtən ˈmɔʁɡən"}
    },
    {
      "id": "v_begr_02", "german": "Guten Tag", "meaning": "xin chào (ban ngày)",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Guten Tag! Wie geht es Ihnen?", "example_vi": "Xin chào! Ông/bà có khỏe không?",
      "speak_de": "Guten Tag", "tags": ["#Begrüßung", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/taːk/"], "common_errors_vi": ["Tag: g cuối đọc /k/ không phải /g/"], "ipa_target": "ˈɡuːtən taːk"}
    },
    {
      "id": "v_begr_03", "german": "Auf Wiedersehen", "meaning": "tạm biệt (trang trọng)",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Auf Wiedersehen, bis morgen!", "example_vi": "Tạm biệt, hẹn ngày mai!",
      "speak_de": "Auf Wiedersehen", "tags": ["#Abschied", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈviːdɐzeːən/"], "common_errors_vi": ["Wieder đọc /viidə/, sehen đọc /zeːən/"], "ipa_target": "aʊ̯f ˈviːdɐzeːən"}
    },
    {
      "id": "v_begr_04", "german": "Tschüss", "meaning": "tạm biệt (thân mật)",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Tschüss! Bis später!", "example_vi": "Bye! Hẹn gặp lại sau!",
      "speak_de": "Tschüss", "tags": ["#Abschied", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/tʃʏs/"], "common_errors_vi": ["tsch = /tʃ/ như ch tiếng Anh, ü = tròn môi"], "ipa_target": "tʃʏs"}
    },
    {
      "id": "v_begr_05", "german": "Danke", "meaning": "cảm ơn",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Danke schön!", "example_vi": "Cảm ơn rất nhiều!",
      "speak_de": "Danke schön", "tags": ["#Höflichkeit", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈdaŋkə/"], "common_errors_vi": ["Đọc /đan-kơ/, ng cuối nhẹ"], "ipa_target": "ˈdaŋkə ˈʃøːn"}
    },
    {
      "id": "v_begr_06", "german": "Bitte", "meaning": "làm ơn / không có gì",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Danke! — Bitte!", "example_vi": "Cảm ơn! — Không có gì!",
      "speak_de": "Bitte", "tags": ["#Höflichkeit", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈbɪtə/"], "common_errors_vi": ["e cuối đọc /ə/ nhẹ, không bỏ"], "ipa_target": "ˈbɪtə"}
    },
    {
      "id": "v_begr_07", "german": "Entschuldigung", "meaning": "xin lỗi",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Entschuldigung! Wo ist die Toilette?", "example_vi": "Xin lỗi! Nhà vệ sinh ở đâu?",
      "speak_de": "Entschuldigung", "tags": ["#Höflichkeit", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɛntˈʃʊldɪɡʊŋ/"], "common_errors_vi": ["Từ dài, nhấn vào Schul: ent-SCHUL-di-gung"], "ipa_target": "ɛntˈʃʊldɪɡʊŋ"}
    },
    {
      "id": "v_begr_08", "german": "Wie geht es Ihnen?", "meaning": "Ông/bà có khỏe không?",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Guten Tag! Wie geht es Ihnen? — Danke, gut.", "example_vi": "Chào! Ông có khỏe không? — Cảm ơn, khỏe.",
      "speak_de": "Wie geht es Ihnen", "tags": ["#Befinden", "#Sie-Form", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈiːnən/"], "common_errors_vi": ["Ihnen đọc /iːnən/ với I dài"], "ipa_target": "viː ɡeːt ɛs ˈiːnən"}
    }
  ],
  "phrases": [
    {"german": "Guten Morgen! Wie geht es Ihnen?", "meaning": "Chào buổi sáng! Ông/bà có khỏe không?", "speak_de": "Guten Morgen! Wie geht es Ihnen?"},
    {"german": "Danke, gut. Und Ihnen?", "meaning": "Cảm ơn, khỏe. Còn ông/bà?", "speak_de": "Danke, gut. Und Ihnen?"},
    {"german": "Auf Wiedersehen! Bis morgen!", "meaning": "Tạm biệt! Hẹn ngày mai!", "speak_de": "Auf Wiedersehen! Bis morgen!"}
  ],
  "examples": [
    {"german": "Guten Tag, Herr Schmidt! Wie geht es Ihnen? — Danke, gut. Und Ihnen?", "translation": "Chào ông Schmidt! Ông có khỏe không? — Cảm ơn, khỏe. Còn bạn?", "note": "Sie-Form = trang trọng", "speak_de": "Guten Tag, Herr Schmidt! Wie geht es Ihnen?"},
    {"german": "Hallo Anna! Wie geht es dir? — Nicht so gut, ich bin müde.", "translation": "Chào Anna! Bạn khỏe không? — Không tốt lắm, tôi mệt.", "note": "du-Form = thân mật", "speak_de": "Hallo Anna! Wie geht es dir?"}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg11_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Bạn gặp sếp lúc 9 giờ sáng. Câu nào đúng?",
        "options": ["Hallo Chef!", "Guten Morgen, Herr Direktor!", "Hi!", "Tschüss!"],
        "correct": 1
      },
      {
        "id": "tg11_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Wie geht es Ihnen?'' dùng với ai?",
        "options": ["Bạn thân", "Người lạ/cấp trên (Sie-Form)", "Trẻ em", "Thú cưng"],
        "correct": 1
      },
      {
        "id": "tg11_03", "type": "FILL_BLANK",
        "sentence_de": "___ Tag! Wie geht es Ihnen?",
        "hint_vi": "Chào (ban ngày)",
        "answer": "Guten", "accept_also": ["guten"]
      },
      {
        "id": "tg11_04", "type": "MULTIPLE_CHOICE",
        "question_vi": "Trả lời ''Danke, gut. ___?'' khi hỏi lại sếp?",
        "options": ["Und du?", "Und Ihnen?", "Und er?", "Und ihr?"],
        "correct": 1
      },
      {
        "id": "tg11_05", "type": "FILL_BLANK",
        "sentence_de": "Auf ___! Bis morgen!",
        "hint_vi": "Tạm biệt (trang trọng)",
        "answer": "Wiedersehen", "accept_also": ["wiedersehen"]
      }
    ],
    "practice": [
      {
        "id": "p11_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Chào buổi tối! Tôi có thể giúp gì cho ông không?",
        "answer": "Guten Abend! Kann ich Ihnen helfen?",
        "accept_also": ["Guten Abend! Wie kann ich Ihnen helfen?"]
      },
      {
        "id": "p11_02", "type": "REORDER",
        "words": ["Ihnen?", "geht", "Wie", "es"],
        "correct_order": ["Wie", "geht", "es", "Ihnen?"],
        "translation": "Ông/bà có khỏe không?"
      },
      {
        "id": "p11_03", "type": "FILL_BLANK",
        "sentence_de": "___ schön! — Bitte sehr!",
        "hint_vi": "Cảm ơn rất nhiều",
        "answer": "Danke", "accept_also": ["danke"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Im Büro\n\nGuten Morgen, Frau Weber! Wie geht es Ihnen?\n— Danke, gut. Und Ihnen, Herr Bauer?\n— Auch gut, danke. Ist Frau Klein schon da?\n— Ja, sie ist im Büro.\n— Vielen Dank! Auf Wiedersehen!\n— Tschüss!",
    "text_vi": "Tại văn phòng\n\nChào buổi sáng, bà Weber! Bà có khỏe không?\n— Cảm ơn, khỏe. Còn ông Bauer?\n— Cũng khỏe, cảm ơn. Bà Klein đã đến chưa?\n— Vâng, bà ấy ở trong văn phòng.\n— Cảm ơn nhiều! Tạm biệt!\n— Tạm biệt!",
    "questions": [
      {
        "id": "rq11_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Đây là cuộc trò chuyện ở đâu?",
        "options": ["Siêu thị", "Văn phòng", "Trường học", "Bệnh viện"],
        "correct": 1
      },
      {
        "id": "rq11_02", "type": "FILL_BLANK",
        "question_vi": "Ông Bauer trả lời sức khỏe thế nào?",
        "answer": "Auch gut", "accept_also": ["auch gut, danke"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie einen kurzen Dialog: Sie treffen Ihren Chef am Morgen. Benutzen Sie: Guten Morgen, Wie geht es Ihnen, Danke, Auf Wiedersehen.",
    "task_vi": "Viết đoạn hội thoại ngắn: Bạn gặp sếp vào buổi sáng. Dùng: Guten Morgen, Wie geht es Ihnen, Danke, Auf Wiedersehen.",
    "min_sentences": 4,
    "example_answer": "Guten Morgen, Herr Direktor!\nGuten Morgen! Wie geht es Ihnen?\nDanke, gut. Und Ihnen?\nAuch gut, danke. Auf Wiedersehen!\nAuf Wiedersehen!"
  },
  "audio_content": {
    "listen_words": [
      {"text": "Guten Morgen", "meaning": "chào buổi sáng"},
      {"text": "Guten Tag", "meaning": "xin chào"},
      {"text": "Auf Wiedersehen", "meaning": "tạm biệt"},
      {"text": "Wie geht es Ihnen?", "meaning": "Ông/bà có khỏe không?"},
      {"text": "Danke schön", "meaning": "cảm ơn nhiều"}
    ],
    "listen_dialogue": "Guten Morgen! Wie geht es Ihnen? Danke, gut. Auf Wiedersehen!"
  }
}'::jsonb
WHERE day_number = 11 AND is_active = TRUE;
