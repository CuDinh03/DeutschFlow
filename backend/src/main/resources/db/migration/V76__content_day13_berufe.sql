-- V76: Day 13 — Berufe & Sprachen (Nghề nghiệp & Ngôn ngữ)

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Berufe & Sprachen", "vi": "Nghề nghiệp & Ngôn ngữ"},
  "overview": {
    "de": "Wichtige Berufe und Sprachen auf Deutsch. Maskulin vs. Feminin.",
    "vi": "Tiếng Đức có quy tắc riêng cho nghề nghiệp: nam/nữ khác nhau! Bác sĩ nam = Arzt, bác sĩ nữ = Ärztin. Quy tắc: thêm -in cho nữ giới. Rất quan trọng khi đi làm ở Đức!"
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Nghề nghiệp: Nam vs Nữ (-in)"},
      "content": {"vi": "Nam → Nữ: thêm -in (và thường đổi nguyên âm)\nder Koch → die Köchin (đầu bếp)\nder Arzt → die Ärztin (bác sĩ)\nder Lehrer → die Lehrerin (giáo viên)\nder Kellner → die Kellnerin (phục vụ)\nder Ingenieur → die Ingenieurin (kỹ sư)\n\n💡 Cách đơn giản: Ich bin Koch. (nam) / Ich bin Köchin. (nữ)"},
      "tags": ["#Beruf", "#Genus", "#Feminin"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Ngôn ngữ trên thế giới"},
      "content": {"vi": "Ich spreche Deutsch. — Tôi nói tiếng Đức.\nIch spreche Vietnamesisch. — Tôi nói tiếng Việt.\nIch spreche ein bisschen Englisch. — Tôi nói một chút tiếng Anh.\nIch lerne Deutsch. — Tôi đang học tiếng Đức.\n\n⚠️ Ngôn ngữ KHÔNG cần Artikel:\n✅ Ich spreche Deutsch.\n❌ Ich spreche das Deutsch."},
      "tags": ["#Sprachen", "#Verb"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Hỏi về nghề nghiệp"},
      "content": {"vi": "Was sind Sie von Beruf? — Ông/bà làm nghề gì?\n→ Ich bin Arzt. / Ich bin Ärztin.\n\nWas machen Sie beruflich? — Ông/bà làm gì nghề nghiệp?\n→ Ich arbeite als Koch in einem Restaurant.\n(Tôi làm đầu bếp trong một nhà hàng.)"},
      "tags": ["#Beruf", "#Fragen"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_beruf_01", "german": "der Koch / die Köchin", "meaning": "đầu bếp (nam/nữ)",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Er ist Koch in einem Sternerestaurant.", "example_vi": "Anh ấy là đầu bếp trong nhà hàng 1 sao.",
      "speak_de": "Ich bin Koch", "tags": ["#Beruf", "#Gastronomie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/kɔx/", "/ˈkøːçɪn/"], "common_errors_vi": ["Koch: ch sau o = ach-Laut /x/"], "ipa_target": "deːɐ̯ kɔx"}
    },
    {
      "id": "v_beruf_02", "german": "der Arzt / die Ärztin", "meaning": "bác sĩ (nam/nữ)",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Sie ist Ärztin in einem Krankenhaus.", "example_vi": "Cô ấy là bác sĩ trong bệnh viện.",
      "speak_de": "Ich bin Ärztin", "tags": ["#Beruf", "#Medizin", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/aːɐ̯tst/", "/ˈɛːɐ̯tstɪn/"], "common_errors_vi": ["ä = /ɛː/ như e kéo dài"], "ipa_target": "deːɐ̯ aːɐ̯tst"}
    },
    {
      "id": "v_beruf_03", "german": "der Lehrer / die Lehrerin", "meaning": "giáo viên (nam/nữ)",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Ich bin Lehrerin und unterrichte Deutsch.", "example_vi": "Tôi là giáo viên và dạy tiếng Đức.",
      "speak_de": "Ich bin Lehrerin", "tags": ["#Beruf", "#Schule", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈleːʁɐ/"], "common_errors_vi": ["Lehrer: ehr = /eːɐ̯/"], "ipa_target": "deːɐ̯ ˈleːʁɐ"}
    },
    {
      "id": "v_beruf_04", "german": "der Ingenieur / die Ingenieurin", "meaning": "kỹ sư (nam/nữ)",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Er arbeitet als Ingenieur bei BMW.", "example_vi": "Anh ấy làm kỹ sư tại BMW.",
      "speak_de": "Ich bin Ingenieur", "tags": ["#Beruf", "#Technik", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ɪnʒeˈnjøːɐ̯/"], "common_errors_vi": ["Nhấn vào -eur: in-ge-ni-EUR"], "ipa_target": "deːɐ̯ ɪnʒeˈnjøːɐ̯"}
    },
    {
      "id": "v_beruf_05", "german": "der Kellner / die Kellnerin", "meaning": "phục vụ (nam/nữ)",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Die Kellnerin bringt die Speisekarte.", "example_vi": "Người phục vụ nữ mang thực đơn đến.",
      "speak_de": "die Kellnerin", "tags": ["#Beruf", "#Restaurant", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈkɛlnɐ/"], "common_errors_vi": ["Kellner: KELL-ner, ll = /l/ đôi"], "ipa_target": "deːɐ̯ ˈkɛlnɐ"}
    },
    {
      "id": "v_beruf_06", "german": "arbeiten", "meaning": "làm việc",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich arbeite in einem Büro.", "example_vi": "Tôi làm việc trong văn phòng.",
      "speak_de": "Ich arbeite", "tags": ["#Verb", "#Beruf", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈaʁbaɪ̯tən/"], "common_errors_vi": ["ar-bei-ten: ei = /ai/"], "ipa_target": "ˈaʁbaɪ̯tən"}
    },
    {
      "id": "v_beruf_07", "german": "lernen", "meaning": "học (tự học)",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich lerne Deutsch seit drei Monaten.", "example_vi": "Tôi học tiếng Đức được ba tháng.",
      "speak_de": "Ich lerne Deutsch", "tags": ["#Verb", "#Lernen", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈlɛʁnən/"], "common_errors_vi": ["ler-nen: er = /ɛʁ/"], "ipa_target": "ˈlɛʁnən"}
    }
  ],
  "phrases": [
    {"german": "Was sind Sie von Beruf?", "meaning": "Ông/bà làm nghề gì?", "speak_de": "Was sind Sie von Beruf?"},
    {"german": "Ich arbeite als Koch in einem Restaurant.", "meaning": "Tôi làm đầu bếp trong nhà hàng.", "speak_de": "Ich arbeite als Koch in einem Restaurant."},
    {"german": "Ich spreche ein bisschen Deutsch.", "meaning": "Tôi nói một chút tiếng Đức.", "speak_de": "Ich spreche ein bisschen Deutsch."}
  ],
  "examples": [
    {"german": "— Was sind Sie von Beruf? — Ich bin Krankenpfleger. Und Sie? — Ich bin Ingenieurin bei Siemens.", "translation": "— Ông làm nghề gì? — Tôi là điều dưỡng. Còn bà? — Tôi là kỹ sư tại Siemens.", "note": "Chú ý: nữ thêm -in/-erin", "speak_de": "Was sind Sie von Beruf?"},
    {"german": "Ich spreche Vietnamesisch, Englisch und ein bisschen Deutsch.", "translation": "Tôi nói tiếng Việt, tiếng Anh và một chút tiếng Đức.", "note": "Không dùng Artikel với tên ngôn ngữ", "speak_de": "Ich spreche Vietnamesisch und Deutsch."}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg13_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Nữ bác sĩ tiếng Đức là gì?",
        "options": ["die Arzt", "die Ärztin", "der Ärztin", "das Arzt"],
        "correct": 1
      },
      {
        "id": "tg13_02", "type": "FILL_BLANK",
        "sentence_de": "Ich bin ___ von Beruf und arbeite in einem Hotel.",
        "hint_vi": "Điền nghề nghiệp phù hợp (vd: Köchin, Kellner...)",
        "answer": "Köchin", "accept_also": ["Kellner", "Kellnerin", "Koch", "Lehrer", "Lehrerin"]
      },
      {
        "id": "tg13_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "Câu nào ĐÚNG về ngôn ngữ?",
        "options": ["Ich spreche das Deutsch.", "Ich spreche Deutsch.", "Ich spreche ein Deutsch.", "Ich spreche der Deutsch."],
        "correct": 1
      },
      {
        "id": "tg13_04", "type": "FILL_BLANK",
        "sentence_de": "Er ___ als Ingenieur bei Bosch.",
        "hint_vi": "làm việc",
        "answer": "arbeitet", "accept_also": ["arbeitet"]
      },
      {
        "id": "tg13_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "''ein bisschen'' nghĩa là gì?",
        "options": ["rất nhiều", "một ít/một chút", "không có gì", "rất tốt"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p13_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Cô ấy là giáo viên và dạy tiếng Đức.",
        "answer": "Sie ist Lehrerin und unterrichtet Deutsch.",
        "accept_also": ["Sie ist Lehrerin und sie unterrichtet Deutsch."]
      },
      {
        "id": "p13_02", "type": "REORDER",
        "words": ["Beruf?", "sind", "von", "Was", "Sie"],
        "correct_order": ["Was", "sind", "Sie", "von", "Beruf?"],
        "translation": "Ông/bà làm nghề gì?"
      },
      {
        "id": "p13_03", "type": "FILL_BLANK",
        "sentence_de": "Ich ___ Vietnamesisch, Englisch und ___ bisschen Deutsch.",
        "hint_vi": "nói ... một",
        "answer": "spreche, ein", "accept_also": ["spreche / ein"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Berufe in Deutschland\n\nIn Deutschland arbeiten viele Vietnamesen in verschiedenen Berufen. Mai ist Köchin in einem vietnamesischen Restaurant in Berlin. Ihr Mann Duc ist Ingenieur bei einem Automobilunternehmen. Ihre Freundin Lan ist Krankenpflegerin im Krankenhaus. Sie alle lernen Deutsch und sprechen gut Deutsch.",
    "text_vi": "Nghề nghiệp ở Đức\n\nỞ Đức có nhiều người Việt Nam làm các nghề khác nhau. Mai là đầu bếp nữ trong một nhà hàng Việt Nam ở Berlin. Chồng cô ấy, Đức, là kỹ sư tại một công ty ô tô. Bạn của cô ấy, Lan, là điều dưỡng trong bệnh viện. Tất cả họ đều học tiếng Đức và nói tiếng Đức tốt.",
    "questions": [
      {
        "id": "rq13_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Mai làm nghề gì?",
        "options": ["Lehrerin", "Köchin", "Ärztin", "Ingenieurin"],
        "correct": 1
      },
      {
        "id": "rq13_02", "type": "FILL_BLANK",
        "question_vi": "Duc làm việc ở đâu?",
        "answer": "bei einem Automobilunternehmen", "accept_also": ["Automobilunternehmen", "bei einem Automobilunternehmen"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Schreiben Sie über Ihre Familie: Was sind sie von Beruf? Welche Sprachen sprechen sie?",
    "task_vi": "Viết về gia đình bạn: Họ làm nghề gì? Họ nói ngôn ngữ gì?",
    "min_sentences": 4,
    "example_answer": "Mein Vater ist Koch. Er arbeitet in einem Restaurant.\nMeine Mutter ist Lehrerin. Sie unterrichtet Mathematik.\nMein Bruder studiert Informatik.\nWir sprechen alle Vietnamesisch. Ich lerne Deutsch."
  },
  "audio_content": {
    "listen_words": [
      {"text": "der Koch", "meaning": "đầu bếp nam"},
      {"text": "die Ärztin", "meaning": "bác sĩ nữ"},
      {"text": "Ich arbeite als Ingenieur.", "meaning": "Tôi làm kỹ sư."},
      {"text": "Was sind Sie von Beruf?", "meaning": "Ông/bà làm nghề gì?"},
      {"text": "Ich spreche ein bisschen Deutsch.", "meaning": "Tôi nói một chút tiếng Đức."}
    ],
    "listen_dialogue": "Was sind Sie von Beruf? — Ich bin Köchin. Und Sie? — Ich bin Ingenieur. — Freut mich!"
  }
}'::jsonb
WHERE day_number = 13 AND is_active = TRUE;
