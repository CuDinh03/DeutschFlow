-- V78: Day 15 — Familienmitglieder & Possessivpronomen

UPDATE skill_tree_nodes
SET content_json = '{
  "title": {"de": "Familienmitglieder", "vi": "Các thành viên gia đình"},
  "overview": {
    "de": "Familie auf Deutsch: Verwandtschaftsbezeichnungen und Possessivpronomen.",
    "vi": "Học tên các thành viên gia đình bằng tiếng Đức và cách dùng tính từ sở hữu mein/dein/sein/ihr. Rất quan trọng khi nói chuyện hàng ngày và điền đơn xin việc/visa."
  },
  "session_type": "LESSON",
  "theory_cards": [
    {
      "type": "RULE",
      "title": {"vi": "Possessivpronomen: mein, dein, sein, ihr"},
      "content": {"vi": "mein/meine = của tôi\ndein/deine = của bạn (thân mật)\nsein/seine = của anh ấy\nihr/ihre = của cô ấy\n\nQuy tắc: Nomen DER → mein | Nomen DIE → meine | Nomen DAS → mein\nder Vater → mein Vater\ndie Mutter → meine Mutter\ndas Kind → mein Kind"},
      "tags": ["#Possessivpronomen", "#Grammatik"]
    },
    {
      "type": "RULE",
      "title": {"vi": "Gia đình: Số ít & Số nhiều"},
      "content": {"vi": "der Vater → die Väter (cha)\ndie Mutter → die Mütter (mẹ)\nder Bruder → die Brüder (anh/em trai)\ndie Schwester → die Schwestern (chị/em gái)\ndas Kind → die Kinder (đứa trẻ)\nder Sohn → die Söhne (con trai)\ndie Tochter → die Töchter (con gái)\nder Großvater / die Großmutter (ông/bà)"},
      "tags": ["#Familie", "#Plural"]
    },
    {
      "type": "EXAMPLE",
      "title": {"vi": "Giới thiệu gia đình"},
      "content": {"vi": "Das ist meine Familie.\nMein Vater heißt Hung. Er ist 55 Jahre alt.\nMeine Mutter heißt Lan. Sie ist Lehrerin.\nIch habe einen Bruder und eine Schwester.\nMein Bruder ist verheiratet und hat zwei Kinder."},
      "tags": ["#Familie", "#Vorstellen"]
    }
  ],
  "vocabulary": [
    {
      "id": "v_fam_01", "german": "der Vater", "meaning": "người cha",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Mein Vater ist 60 Jahre alt.", "example_vi": "Cha tôi 60 tuổi.",
      "speak_de": "mein Vater", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈfaːtɐ/"], "common_errors_vi": ["V tiếng Đức = /f/, không phải /v/"], "ipa_target": "deːɐ̯ ˈfaːtɐ"}
    },
    {
      "id": "v_fam_02", "german": "die Mutter", "meaning": "người mẹ",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine Mutter ist Ärztin.", "example_vi": "Mẹ tôi là bác sĩ.",
      "speak_de": "meine Mutter", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈmʊtɐ/"], "common_errors_vi": ["u trong Mutter ngắn: /ʊ/"], "ipa_target": "diː ˈmʊtɐ"}
    },
    {
      "id": "v_fam_03", "german": "der Bruder", "meaning": "anh/em trai",
      "gender": "DER", "color_code": "#3B82F6", "gender_label": "m",
      "example_de": "Ich habe einen Bruder.", "example_vi": "Tôi có một người anh/em trai.",
      "speak_de": "Ich habe einen Bruder", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈbʁuːdɐ/"], "common_errors_vi": ["br = /bʁ/, r cuối = /ɐ/"], "ipa_target": "deːɐ̯ ˈbʁuːdɐ"}
    },
    {
      "id": "v_fam_04", "german": "die Schwester", "meaning": "chị/em gái",
      "gender": "DIE", "color_code": "#EF4444", "gender_label": "f",
      "example_de": "Meine Schwester wohnt in Hamburg.", "example_vi": "Chị/em gái tôi sống ở Hamburg.",
      "speak_de": "meine Schwester", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈʃvɛstɐ/"], "common_errors_vi": ["Schw = /ʃv/, nicht /ʃb/"], "ipa_target": "diː ˈʃvɛstɐ"}
    },
    {
      "id": "v_fam_05", "german": "das Kind", "meaning": "đứa trẻ / con",
      "gender": "DAS", "color_code": "#22C55E", "gender_label": "n",
      "example_de": "Ich habe zwei Kinder.", "example_vi": "Tôi có hai đứa con.",
      "speak_de": "Ich habe zwei Kinder", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/kɪnt/"], "common_errors_vi": ["Kind: d cuối đọc /t/"], "ipa_target": "das kɪnt"}
    },
    {
      "id": "v_fam_06", "german": "der Großvater / die Großmutter", "meaning": "ông / bà",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Mein Großvater ist 80 Jahre alt.", "example_vi": "Ông tôi 80 tuổi.",
      "speak_de": "mein Großvater", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈɡʁoːsfaːtɐ/"], "common_errors_vi": ["groß: ß = ss, GROSS-va-ter"], "ipa_target": "deːɐ̯ ˈɡʁoːsfaːtɐ"}
    },
    {
      "id": "v_fam_07", "german": "der Ehemann / die Ehefrau", "meaning": "chồng / vợ",
      "gender": "DER/DIE", "color_code": "#3B82F6", "gender_label": "m/f",
      "example_de": "Mein Ehemann arbeitet als Ingenieur.", "example_vi": "Chồng tôi làm kỹ sư.",
      "speak_de": "mein Ehemann", "tags": ["#Familie", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈeːəman/"], "common_errors_vi": ["Ehe: EH-e, không nuốt e cuối"], "ipa_target": "deːɐ̯ ˈeːəman"}
    },
    {
      "id": "v_fam_08", "german": "haben", "meaning": "có (sở hữu)",
      "gender": null, "color_code": null, "gender_label": null,
      "example_de": "Ich habe einen Sohn und eine Tochter.", "example_vi": "Tôi có một con trai và một con gái.",
      "speak_de": "Ich habe einen Sohn und eine Tochter", "tags": ["#Verb", "#A1"],
      "ai_speech_hints": {"focus_phonemes": ["/ˈhaːbən/"], "common_errors_vi": ["haben: H bật nhẹ /h/"], "ipa_target": "ˈhaːbən"}
    }
  ],
  "phrases": [
    {"german": "Das ist meine Familie.", "meaning": "Đây là gia đình tôi.", "speak_de": "Das ist meine Familie."},
    {"german": "Ich habe einen Bruder und zwei Schwestern.", "meaning": "Tôi có một anh trai và hai chị/em gái.", "speak_de": "Ich habe einen Bruder und zwei Schwestern."},
    {"german": "Meine Eltern wohnen in Vietnam.", "meaning": "Bố mẹ tôi sống ở Việt Nam.", "speak_de": "Meine Eltern wohnen in Vietnam."}
  ],
  "examples": [
    {"german": "Mein Vater heißt Nam und ist Koch. Meine Mutter heißt Lan und ist Lehrerin. Ich habe eine Schwester. Sie heißt Hoa und ist Ärztin.", "translation": "Cha tôi tên Nam và là đầu bếp. Mẹ tôi tên Lan và là giáo viên. Tôi có một chị gái. Cô ấy tên Hoa và là bác sĩ.", "note": "Dùng sein/seine cho cha, ihr/ihre cho mẹ", "speak_de": "Mein Vater heißt Nam."},
    {"german": "Haben Sie Geschwister? — Ja, ich habe einen Bruder. Er ist jünger als ich.", "translation": "Ông/bà có anh chị em không? — Vâng, tôi có một người em trai. Em ấy nhỏ hơn tôi.", "note": "Geschwister = anh chị em (tổng)", "speak_de": "Haben Sie Geschwister?"}
  ],
  "exercises": {
    "theory_gate": [
      {
        "id": "tg15_01", "type": "FILL_BLANK",
        "sentence_de": "___ Vater ist Koch. ___ Mutter ist Lehrerin.",
        "hint_vi": "của tôi (nam) ... của tôi (nữ)",
        "answer": "Mein, Meine", "accept_also": ["Mein / Meine"]
      },
      {
        "id": "tg15_02", "type": "MULTIPLE_CHOICE",
        "question_vi": "''die Kinder'' là số nhiều của gì?",
        "options": ["der Kind", "das Kind", "die Kind", "des Kindes"],
        "correct": 1
      },
      {
        "id": "tg15_03", "type": "MULTIPLE_CHOICE",
        "question_vi": "Chọn câu ĐÚNG:",
        "options": ["Ich habe ein Bruder.", "Ich habe einen Bruder.", "Ich habe einer Bruder.", "Ich habe eine Bruder."],
        "correct": 1
      },
      {
        "id": "tg15_04", "type": "FILL_BLANK",
        "sentence_de": "Mein Onkel und ___ Tante wohnen in München.",
        "hint_vi": "của tôi (nữ/DIE)",
        "answer": "meine", "accept_also": ["Meine"]
      },
      {
        "id": "tg15_05", "type": "MULTIPLE_CHOICE",
        "question_vi": "''Geschwister'' nghĩa là gì?",
        "options": ["Vợ/chồng", "Anh chị em ruột", "Bạn bè", "Hàng xóm"],
        "correct": 1
      }
    ],
    "practice": [
      {
        "id": "p15_01", "type": "TRANSLATE",
        "from": "vi", "sentence": "Tôi có hai chị em gái. Họ sống ở Hà Nội.",
        "answer": "Ich habe zwei Schwestern. Sie wohnen in Hanoi.",
        "accept_also": ["Ich habe 2 Schwestern. Sie leben in Hanoi."]
      },
      {
        "id": "p15_02", "type": "REORDER",
        "words": ["Kinder.", "habe", "drei", "Ich"],
        "correct_order": ["Ich", "habe", "drei", "Kinder."],
        "translation": "Tôi có ba đứa con."
      },
      {
        "id": "p15_03", "type": "FILL_BLANK",
        "sentence_de": "___ Ehemann arbeitet bei Siemens und ___ Ehefrau ist Ärztin.",
        "hint_vi": "Của anh ấy ... của cô ấy",
        "answer": "Sein, Ihre", "accept_also": ["sein, ihre"]
      }
    ]
  },
  "reading_passage": {
    "text_de": "Meine Familie\n\nIch heiße Lan und komme aus Vietnam. Meine Familie ist groß. Mein Vater heißt Thanh und ist 62 Jahre alt. Er ist Rentner. Meine Mutter heißt Mai. Sie ist 58 Jahre alt und ist Hausfrau. Ich habe zwei Brüder und eine Schwester. Mein älterer Bruder Duc ist verheiratet und hat ein Kind. Mein jüngerer Bruder Minh studiert noch. Meine Schwester Hoa ist Ärztin in Saigon. Ich wohne jetzt in Deutschland.",
    "text_vi": "Gia đình tôi\n\nTôi tên Lan và đến từ Việt Nam. Gia đình tôi đông người. Cha tôi tên Thành và 62 tuổi. Ông là người về hưu. Mẹ tôi tên Mai, 58 tuổi và là nội trợ. Tôi có hai anh em trai và một chị em gái. Anh trai lớn Đức đã kết hôn và có một đứa con. Người anh/em trai nhỏ Minh vẫn đang học. Chị/em gái Hoa là bác sĩ ở Sài Gòn. Tôi hiện đang sống ở Đức.",
    "questions": [
      {
        "id": "rq15_01", "type": "MULTIPLE_CHOICE",
        "question_vi": "Lan có bao nhiêu anh chị em?",
        "options": ["1", "2", "3", "4"],
        "correct": 2
      },
      {
        "id": "rq15_02", "type": "FILL_BLANK",
        "question_vi": "Hoa làm nghề gì?",
        "answer": "Ärztin", "accept_also": ["Sie ist Ärztin"]
      }
    ]
  },
  "writing_prompt": {
    "task_de": "Beschreiben Sie Ihre Familie! Schreiben Sie über 3-4 Familienmitglieder: Name, Alter, Beruf, Wohnort.",
    "task_vi": "Hãy mô tả gia đình bạn! Viết về 3-4 thành viên: tên, tuổi, nghề nghiệp, nơi sống.",
    "min_sentences": 5,
    "example_answer": "Meine Familie hat fünf Personen.\nMein Vater heißt Hung. Er ist 57 Jahre alt und ist Koch.\nMeine Mutter heißt Hoa. Sie ist Lehrerin.\nIch habe einen jüngeren Bruder. Er heißt Tuan und studiert Informatik.\nWir wohnen alle in Ho-Chi-Minh-Stadt."
  },
  "audio_content": {
    "listen_words": [
      {"text": "mein Vater", "meaning": "cha tôi"},
      {"text": "meine Mutter", "meaning": "mẹ tôi"},
      {"text": "Ich habe einen Bruder.", "meaning": "Tôi có một anh/em trai."},
      {"text": "Haben Sie Geschwister?", "meaning": "Ông/bà có anh chị em không?"},
      {"text": "Meine Eltern wohnen in Vietnam.", "meaning": "Bố mẹ tôi sống ở Việt Nam."}
    ],
    "listen_dialogue": "Haben Sie Geschwister? — Ja, ich habe einen Bruder und zwei Schwestern. Meine Eltern wohnen in Vietnam."
  }
}'::jsonb
WHERE day_number = 15 AND is_active = TRUE;
