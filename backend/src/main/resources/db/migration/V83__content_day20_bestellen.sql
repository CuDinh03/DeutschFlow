-- V83: Day 20 — Essen bestellen (Gọi đồ ăn + Imperativ)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Essen bestellen", "vi": "Gọi đồ ăn tại nhà hàng"},
  "overview": {
    "de": "Im Restaurant bestellen: möchten, Imperativ, Speisekarte.",
    "vi": "Học cách gọi món, hỏi về thực đơn và dùng Imperativ (mệnh lệnh thức). Đây là kỹ năng thiết yếu khi đi nhà hàng hoặc làm trong ngành dịch vụ ăn uống."
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Imperativ (Mệnh lệnh thức) — Sie-Form"},
      "content": {"vi": "Imperativ với Sie: Infinitiv + Sie (đảo ngữ)\nKommen Sie bitte! — Xin hãy đến!\nNehmen Sie Platz! — Hãy ngồi xuống!\nBitte warten Sie! — Xin hãy đợi!\nTrinken Sie viel Wasser! — Hãy uống nhiều nước!\n\nLưu ý: Imperativ với Sie luôn lịch sự.\nDùng trong nhà hàng: ''Bringen Sie mir bitte die Karte!''"},
      "tags": ["#Imperativ", "#Grammatik", "#Sie-Form"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Gọi món: Từ vựng nhà hàng"},
      "content": {"vi": "die Speisekarte — thực đơn\ndas Gericht — món ăn\ndie Vorspeise — món khai vị\ndas Hauptgericht — món chính\nder Nachtisch — món tráng miệng\ndie Rechnung — hóa đơn\nder Kellner / die Kellnerin — phục vụ\nbestellen — gọi món\nbringen — mang đến"},
      "tags": ["#Restaurant", "#Vokabular"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Dialog tại nhà hàng"},
      "content": {"vi": "Kellner: Guten Abend! Was möchten Sie trinken?\nGast: Ich möchte bitte ein Wasser.\nKellner: Und zum Essen?\nGast: Ich nehme das Schnitzel mit Pommes.\nKellner: Gerne. Noch etwas?\nGast: Nein danke. Bringen Sie mir bitte die Rechnung.\nKellner: Sofort!"},
      "tags": ["#Restaurant", "#Dialog"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_rest_01", "german": "bestellen", "meaning": "gọi món / đặt hàng",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich möchte bitte bestellen.", "example_vi": "Tôi muốn gọi món.",
      "speak_de": "Ich möchte bestellen", "tags": ["#Verb", "#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/bəˈʃtɛlən/"], "common_errors_vi": ["be-STELL-en: nhấn vào stell"], "ipa_target": "bəˈʃtɛlən"}
    },
    {
      "id": "v_rest_02", "german": "die Speisekarte", "meaning": "thực đơn",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Bringen Sie mir bitte die Speisekarte!", "example_vi": "Làm ơn mang cho tôi thực đơn!",
      "speak_de": "die Speisekarte, bitte", "tags": ["#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʃpaɪ̯zəkaʁtə/"], "common_errors_vi": ["Speise: ei=/ai/, sp=/ʃp/"], "ipa_target": "diː ˈʃpaɪ̯zəkaʁtə"}
    },
    {
      "id": "v_rest_03", "german": "das Schnitzel", "meaning": "thịt bê áo bột (món Đức nổi tiếng)",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Das Wiener Schnitzel ist das bekannteste deutsche Gericht.", "example_vi": "Schnitzel kiểu Vienna là món Đức nổi tiếng nhất.",
      "speak_de": "ein Schnitzel, bitte", "tags": ["#Essen", "#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʃnɪtsl̩/"], "common_errors_vi": ["Schn=/ʃn/, tz=/ts/"], "ipa_target": "das ˈʃnɪtsl̩"}
    },
    {
      "id": "v_rest_04", "german": "die Rechnung", "meaning": "hóa đơn",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Entschuldigung, die Rechnung bitte!", "example_vi": "Xin lỗi, cho tôi hóa đơn!",
      "speak_de": "die Rechnung, bitte", "tags": ["#Restaurant", "#Geld", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʁɛçnʊŋ/"], "common_errors_vi": ["Rech: R=uvular /ʁ/, ch=/ç/"], "ipa_target": "diː ˈʁɛçnʊŋ"}
    },
    {
      "id": "v_rest_05", "german": "empfehlen", "meaning": "gợi ý / giới thiệu",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Was empfehlen Sie heute?", "example_vi": "Hôm nay ông/bà gợi ý gì?",
      "speak_de": "Was empfehlen Sie?", "tags": ["#Verb", "#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɛmpˈfeːlən/"], "common_errors_vi": ["emp-FEHL-en: pf=/pf/, eh=/eː/"], "ipa_target": "ɛmpˈfeːlən"}
    },
    {
      "id": "v_rest_06", "german": "der Nachtisch", "meaning": "món tráng miệng",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Als Nachtisch möchte ich bitte Eis.", "example_vi": "Món tráng miệng tôi muốn kem.",
      "speak_de": "als Nachtisch", "tags": ["#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈnaxtɪʃ/"], "common_errors_vi": ["nach-tisch: ch=/x/ (ach-Laut), sch=/ʃ/"], "ipa_target": "deːɐ̯ ˈnaxtɪʃ"}
    }
  ],
  "phrases": [
    {"german": "Ich nehme das Tagesgericht, bitte.", "meaning": "Tôi chọn món trong ngày, làm ơn.", "speak_de": "Ich nehme das Tagesgericht."},
    {"german": "Was empfehlen Sie heute?", "meaning": "Hôm nay ông/bà gợi ý gì?", "speak_de": "Was empfehlen Sie heute?"},
    {"german": "Alles zusammen oder getrennt?", "meaning": "Thanh toán chung hay riêng?", "speak_de": "Alles zusammen oder getrennt?"}
  ],
  "examples": [
    {"german": "— Was darf ich Ihnen bringen? — Ich nehme das Schnitzel mit Salat und ein Mineralwasser. — Und als Nachtisch? — Einen Kaffee, bitte.", "translation": "— Tôi có thể mang gì cho ông/bà? — Tôi chọn schnitzel với salad và nước khoáng. — Tráng miệng? — Một tách cà phê.", "note": "Rất thực tế cho nhà hàng", "speak_de": "Ich nehme das Schnitzel mit Salat."},
    {"german": "Entschuldigung! Bringen Sie mir bitte die Rechnung. — Sofort! Das macht 18 Euro 50. Alles zusammen?", "translation": "Xin lỗi! Làm ơn cho tôi hóa đơn. — Ngay! Tổng là 18 Euro 50. Thanh toán chung?", "note": "Sofort = ngay lập tức", "speak_de": "Bringen Sie mir bitte die Rechnung."}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg20_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Imperativ lịch sự ''Ngồi xuống'' tiếng Đức?",
        "options": ["Sitz!", "Sitzen!", "Nehmen Sie Platz!", "Platz nehmen!"],
        "correct": 2
      },
      {
        "id": "tg20_02", "type": "FILL_BLANK",
        "sentence_de": "___ Sie mir bitte die Speisekarte!",
        "hint_vi": "Mang (Imperativ Sie-Form)",
        "answer": "Bringen", "accept_also": ["bringen"]
      },
      {
        "id": "tg20_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "''die Rechnung'' trong nhà hàng nghĩa là?",
        "options": ["Thực đơn", "Hóa đơn", "Món tráng miệng", "Khai vị"],
        "correct": 1
      },
      {
        "id": "tg20_04", "type": "FILL_BLANK",
        "sentence_de": "Ich ___ das Schnitzel mit Pommes.",
        "hint_vi": "lấy / chọn (nehmen)",
        "answer": "nehme", "accept_also": ["nehme"]
      },
      {
        "id": "tg20_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Alles zusammen?'' có nghĩa là?",
        "options": ["Tất cả đều ngon?", "Thanh toán chung không?", "Có muốn thêm gì không?", "Xong chưa?"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p20_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Làm ơn mang cho tôi thực đơn. Hôm nay có gì đặc biệt?",
        "answer": "Bringen Sie mir bitte die Speisekarte. Was empfehlen Sie heute?",
        "accept_also": ["Bitte die Speisekarte! Was empfehlen Sie?"]
      },
      {
        "id": "p20_02", "type": "REORDER",
        "words": ["Nachtisch", "bitte!", "möchte", "als", "Ich", "Eis"],
        "correct_order": ["Ich", "möchte", "als", "Nachtisch", "Eis,", "bitte!"],
        "translation": "Làm ơn cho tôi kem tráng miệng!"
      },
      {
        "id": "p20_03", "type": "FILL_BLANK",
        "sentence_de": "Entschuldigung, ___ Sie mir bitte die ___!",
        "hint_vi": "mang ... hóa đơn",
        "answer": "bringen, Rechnung", "accept_also": ["Bringen / Rechnung"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Im Restaurant ''Zum Wohl''\n\nMinh und seine Kollegen essen im Restaurant ''Zum Wohl''. Der Kellner kommt: ''Guten Abend! Was möchten Sie trinken?'' Minh bestellt ein Mineralwasser. Sein Kollege Thomas nimmt ein Bier. Zum Essen wählen sie das Tagesgericht: Schnitzel mit Kartoffelsalat. Es kostet 12,50 Euro pro Person. Nach dem Essen möchte Minh die Rechnung. ''Alles zusammen oder getrennt?'' fragt der Kellner. — ''Getrennt, bitte!'', sagt Thomas.",
    "text_vi": "Tại nhà hàng ''Zum Wohl''\n\nMinh và đồng nghiệp ăn tại nhà hàng ''Zum Wohl''. Người phục vụ đến: ''Chào buổi tối! Quý khách muốn uống gì?'' Minh gọi nước khoáng. Đồng nghiệp Thomas gọi bia. Họ chọn món trong ngày: schnitzel với salad khoai tây. Giá 12,50 Euro mỗi người. Sau bữa ăn Minh muốn hóa đơn. ''Thanh toán chung hay riêng?'' người phục vụ hỏi. — ''Riêng, xin cảm ơn!'', Thomas nói.",
    "questions": [
      {
        "id": "rq20_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Minh gọi gì để uống?",
        "options": ["Bier", "Kaffee", "Mineralwasser", "Wein"],
        "correct": 2
      },
      {
        "id": "rq20_02", "type": "FILL_BLANK",
        "question_vi": "Món trong ngày giá bao nhiêu?",
        "answer": "12,50 Euro", "accept_also": ["zwölf Euro fünfzig", "12.50 Euro"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie einen Dialog im Restaurant: Sie bestellen Essen und Trinken und fragen nach der Rechnung.",
    "task_vi": "Viết đoạn hội thoại trong nhà hàng: bạn gọi đồ ăn, đồ uống và hỏi hóa đơn.",
    "min_sentences": 6,
    "example_answer": "Kellner: Guten Abend! Was darf ich bringen?\nIch: Die Speisekarte, bitte.\nKellner: Hier, bitte.\nIch: Ich nehme das Schnitzel und ein Wasser.\nKellner: Sofort!\n(Später)\nIch: Entschuldigung! Die Rechnung, bitte.\nKellner: Das macht 15 Euro 50."
  },
  "audio_content": {
    "listen_words": [
      {"text": "Ich möchte bestellen.", "meaning": "Tôi muốn gọi món."},
      {"text": "Bringen Sie mir die Speisekarte!", "meaning": "Mang cho tôi thực đơn!"},
      {"text": "Was empfehlen Sie?", "meaning": "Ông/bà gợi ý gì?"},
      {"text": "Die Rechnung, bitte!", "meaning": "Hóa đơn, làm ơn!"},
      {"text": "Alles zusammen oder getrennt?", "meaning": "Chung hay riêng?"}
    ],
    "listen_dialogue": "Guten Abend! Was möchten Sie trinken? — Ein Wasser, bitte. Und was empfehlen Sie heute? — Das Schnitzel ist sehr gut. — Gut, ich nehme das Schnitzel."
  }
}'::jsonb
WHERE day_number = 20 AND is_active = TRUE;
