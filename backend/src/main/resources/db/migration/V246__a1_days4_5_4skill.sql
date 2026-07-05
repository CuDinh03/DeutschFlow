-- V246 — A1 Day 4 (Artikel der/die/das) + Day 5 (Konjugation der Verben) — nội dung 4 kỹ năng (Hybrid CORE).
-- Lấp 2 ngày RỖNG kế tiếp sau day 3, nới trần lộ trình lên day 5. Theo đúng template V245 (day 2):
-- theory_cards + vocabulary + skill_exercises{HOEREN,SPRECHEN,LESEN,SCHREIBEN}, chấm bởi PracticeExerciseGrader
-- (correct_index / correct_answer+accept_also / "spoken"). ADDITIVE — không phá luồng hoàn thành cũ.

-- ═══════════════ DAY 4 — Artikel: Der, Die, Das (Giới tính danh từ) ═══════════════
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Artikel: Der, Die, Das", "vi": "Mạo từ và Giới tính danh từ"},
  "overview": {"de": "Jedes Nomen hat ein Geschlecht: der (m), die (f), das (n).", "vi": "Mỗi danh từ tiếng Đức có một giống: der (đực), die (cái), das (trung)."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type": "rule", "title": {"de": "der / die / das", "vi": "Mạo từ xác định"},
     "content": {"de": "der Mann, die Frau, das Kind. Man lernt das Nomen immer mit dem Artikel.",
                 "vi": "der = giống đực, die = giống cái, das = giống trung. Hãy luôn học danh từ KÈM mạo từ (der Tisch, chứ không chỉ Tisch)."}},
    {"type": "rule", "title": {"de": "ein / eine", "vi": "Mạo từ không xác định"},
     "content": {"de": "ein Mann, eine Frau, ein Kind. ein = der/das, eine = die.",
                 "vi": "ein dùng cho der và das; eine dùng cho die. Dùng khi nói tới vật chưa xác định."}},
    {"type": "tip", "title": {"de": "Faustregeln", "vi": "Mẹo đoán giống"},
     "content": {"de": "Endung -ung/-heit/-keit → die; -chen → das; Tage und Monate → der.",
                 "vi": "Đuôi -ung/-heit/-keit thường là die; đuôi -chen là das; thứ và tháng là der (der Montag)."}}
  ],
  "vocabulary": [
    {"id": "d4v1", "german": "Tisch", "gender": "der", "meaning": "cái bàn", "example_de": "Der Tisch ist braun.", "example_vi": "Cái bàn màu nâu."},
    {"id": "d4v2", "german": "Lampe", "gender": "die", "meaning": "cái đèn", "example_de": "Die Lampe ist neu.", "example_vi": "Cái đèn thì mới."},
    {"id": "d4v3", "german": "Buch", "gender": "das", "meaning": "cuốn sách", "example_de": "Das Buch ist interessant.", "example_vi": "Cuốn sách thú vị."},
    {"id": "d4v4", "german": "Mann", "gender": "der", "meaning": "người đàn ông", "example_de": "Der Mann arbeitet.", "example_vi": "Người đàn ông làm việc."},
    {"id": "d4v5", "german": "Frau", "gender": "die", "meaning": "người phụ nữ", "example_de": "Die Frau ist nett.", "example_vi": "Người phụ nữ tử tế."},
    {"id": "d4v6", "german": "Kind", "gender": "das", "meaning": "đứa trẻ", "example_de": "Das Kind spielt.", "example_vi": "Đứa trẻ chơi đùa."}
  ],
  "phrases": [],
  "examples": [],
  "exercises": {"theory_gate": [], "practice": []},
  "skill_exercises": {
    "HOEREN": [
      {"type": "LISTEN_AND_CHOOSE", "instruction_vi": "Nghe và chọn mạo từ đúng",
       "audio_transcript": "Das Buch ist interessant.", "question_vi": "Mạo từ của Buch là gì?",
       "options": ["der", "die", "das"], "correct_index": 2, "explanation_vi": "Buch là giống trung: das Buch."},
      {"type": "LISTEN_AND_FILL", "instruction_vi": "Nghe và điền mạo từ",
       "audio_transcript": "Der Tisch ist braun.", "sentence_with_blank": "___ Tisch ist braun.",
       "correct_answer": "Der", "accept_also": ["der"], "explanation_vi": "Tisch là giống đực: der Tisch."}
    ],
    "SPRECHEN": [
      {"type": "SPEAKING_REPEAT", "instruction_vi": "Nghe và nhắc lại",
       "sentence_de": "Die Frau ist nett.", "sentence_vi": "Người phụ nữ tử tế.",
       "focus_sounds": ["/diː/", "/fʁaʊ/"], "explanation_vi": "die đọc /diː/ (i dài); Frau đọc /fʁaʊ/."},
      {"type": "SPEAKING_RESPONSE", "instruction_vi": "Trả lời: Was ist das?",
       "question_de": "Was ist das?", "question_vi": "Đây là cái gì?", "expected_answer": "Das ist ein Buch.",
       "grading_keywords": ["das", "ist"], "accept_also": ["Das ist ein Tisch."], "explanation_vi": "Mẫu: Das ist ein/eine + danh từ."}
    ],
    "LESEN": {
      "reading_passage": {"text_de": "Das ist mein Zimmer. Der Tisch ist braun und die Lampe ist neu. Auf dem Tisch liegt ein Buch. Das Kind spielt.",
                          "text_type": "Beschreibung", "text_vi_hint": "Mô tả căn phòng: bàn nâu, đèn mới, có cuốn sách trên bàn, đứa trẻ đang chơi."},
      "exercises": [
        {"type": "READ_AND_CHOOSE", "instruction_vi": "Đọc và chọn đáp án đúng",
         "question_vi": "Cái đèn thế nào?", "options": ["cũ", "mới", "hỏng"], "correct_index": 1,
         "explanation_vi": "die Lampe ist neu = cái đèn thì mới."},
        {"type": "READ_TRUE_FALSE", "instruction_vi": "Đọc và xác định Đúng/Sai",
         "statement_de": "Der Tisch ist rot.", "correct_answer": "falsch", "accept_also": ["false", "sai"],
         "explanation_vi": "Sai — der Tisch ist braun (nâu), không phải đỏ."}
      ]
    },
    "SCHREIBEN": [
      {"type": "FILL_GRAMMAR", "instruction_vi": "Điền mạo từ xác định",
       "sentence_with_blank": "___ Frau ist nett.", "hint_vi": "Frau là giống cái",
       "correct_answer": "Die", "accept_also": ["die"], "grammar_rule_vi": "Giống cái dùng die: die Frau."},
      {"type": "TRANSLATE_VI_DE", "instruction_vi": "Dịch sang tiếng Đức",
       "sentence_vi": "Đây là một cuốn sách.", "correct_answer": "Das ist ein Buch.",
       "accept_also": ["das ist ein buch"], "explanation_vi": "Das ist ein + danh từ giống trung/đực."},
      {"type": "REORDER_WORDS", "instruction_vi": "Sắp xếp thành câu đúng",
       "words": ["ist", "Der", "braun", "Tisch"], "correct_order": ["Der", "Tisch", "ist", "braun"],
       "correct_answer": "Der Tisch ist braun", "accept_also": ["der tisch ist braun"],
       "translation_vi": "Cái bàn màu nâu.", "explanation_vi": "Trật tự: Chủ ngữ + động từ + bổ ngữ."}
    ]
  }
}'::jsonb
WHERE title_de = 'Artikel: Der, Die, Das' AND is_active = TRUE;

-- ═══════════════ DAY 5 — Konjugation der Verben (Chia động từ) ═══════════════
UPDATE skill_tree_nodes SET content_json = '{
  "title": {"de": "Konjugation der Verben", "vi": "Chia động từ ở thì hiện tại"},
  "overview": {"de": "Regelmäßige Verben: ich -e, du -st, er/sie/es -t, wir/sie -en.", "vi": "Động từ thường đổi đuôi theo chủ ngữ: ich -e, du -st, er/sie/es -t, wir/sie -en."},
  "session_type": "LESSON",
  "theory_cards": [
    {"type": "rule", "title": {"de": "Regelmäßige Verben", "vi": "Động từ quy tắc"},
     "content": {"de": "kommen: ich komme, du kommst, er kommt, wir kommen, ihr kommt, sie kommen.",
                 "vi": "Bỏ đuôi -en rồi thêm: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en."}},
    {"type": "rule", "title": {"de": "sein und haben", "vi": "Hai động từ bất quy tắc"},
     "content": {"de": "sein: ich bin, du bist, er ist. haben: ich habe, du hast, er hat.",
                 "vi": "sein (thì/là) và haben (có) chia không theo quy tắc, phải học thuộc."}}
  ],
  "vocabulary": [
    {"id": "d5v1", "german": "kommen", "meaning": "đến", "example_de": "Ich komme aus Vietnam.", "example_vi": "Tôi đến từ Việt Nam."},
    {"id": "d5v2", "german": "wohnen", "meaning": "sống, ở", "example_de": "Du wohnst in Berlin.", "example_vi": "Bạn sống ở Berlin."},
    {"id": "d5v3", "german": "heißen", "meaning": "tên là", "example_de": "Er heißt Max.", "example_vi": "Anh ấy tên là Max."},
    {"id": "d5v4", "german": "machen", "meaning": "làm", "example_de": "Was machst du?", "example_vi": "Bạn đang làm gì?"},
    {"id": "d5v5", "german": "sein", "meaning": "thì, là", "example_de": "Ich bin müde.", "example_vi": "Tôi mệt."},
    {"id": "d5v6", "german": "haben", "meaning": "có", "example_de": "Sie hat ein Auto.", "example_vi": "Cô ấy có một cái xe."}
  ],
  "phrases": [],
  "examples": [],
  "exercises": {"theory_gate": [], "practice": []},
  "skill_exercises": {
    "HOEREN": [
      {"type": "LISTEN_AND_CHOOSE", "instruction_vi": "Nghe và chọn dạng đúng",
       "audio_transcript": "Du kommst aus Deutschland.", "question_vi": "Động từ kommen chia với du là gì?",
       "options": ["komme", "kommst", "kommt"], "correct_index": 1, "explanation_vi": "du + Verb-st: du kommst."},
      {"type": "LISTEN_AND_FILL", "instruction_vi": "Nghe và điền động từ",
       "audio_transcript": "Sie hat ein Auto.", "sentence_with_blank": "Sie ___ ein Auto.",
       "correct_answer": "hat", "accept_also": ["Hat"], "explanation_vi": "haben chia với sie (số ít): sie hat."}
    ],
    "SPRECHEN": [
      {"type": "SPEAKING_REPEAT", "instruction_vi": "Nghe và nhắc lại",
       "sentence_de": "Ich wohne in Berlin.", "sentence_vi": "Tôi sống ở Berlin.",
       "focus_sounds": ["/ɪç/", "/voːnə/"], "explanation_vi": "wohne đọc /voːnə/, w như v tiếng Anh."},
      {"type": "SPEAKING_RESPONSE", "instruction_vi": "Trả lời: Woher kommst du?",
       "question_de": "Woher kommst du?", "question_vi": "Bạn đến từ đâu?", "expected_answer": "Ich komme aus ...",
       "grading_keywords": ["komme", "aus"], "accept_also": ["Ich komme aus Vietnam."], "explanation_vi": "Mẫu: Ich komme aus + nước."}
    ],
    "LESEN": {
      "reading_passage": {"text_de": "Hallo! Ich heiße Linh. Ich komme aus Vietnam und wohne jetzt in München. Ich habe einen Bruder. Er heißt Nam.",
                          "text_type": "Vorstellung", "text_vi_hint": "Linh đến từ Việt Nam, sống ở München, có một anh/em trai tên Nam."},
      "exercises": [
        {"type": "READ_AND_CHOOSE", "instruction_vi": "Đọc và chọn đáp án đúng",
         "question_vi": "Linh sống ở đâu?", "options": ["Berlin", "München", "Hà Nội"], "correct_index": 1,
         "explanation_vi": "wohne jetzt in München = hiện sống ở München."},
        {"type": "READ_TRUE_FALSE", "instruction_vi": "Đọc và xác định Đúng/Sai",
         "statement_de": "Linh kommt aus Deutschland.", "correct_answer": "falsch", "accept_also": ["false", "sai"],
         "explanation_vi": "Sai — Linh kommt aus Vietnam."}
      ]
    },
    "SCHREIBEN": [
      {"type": "FILL_GRAMMAR", "instruction_vi": "Chia động từ trong ngoặc",
       "sentence_with_blank": "Ich ___ aus Vietnam. (kommen)", "hint_vi": "chủ ngữ ich",
       "correct_answer": "komme", "accept_also": [], "grammar_rule_vi": "ich + Verb-e: komm + e = komme."},
      {"type": "TRANSLATE_VI_DE", "instruction_vi": "Dịch sang tiếng Đức",
       "sentence_vi": "Bạn tên là gì?", "correct_answer": "Wie heißt du?",
       "accept_also": ["wie heißt du", "Wie heißen Sie?"], "explanation_vi": "Wie heißt du? (thân mật) / Wie heißen Sie? (trang trọng)."},
      {"type": "REORDER_WORDS", "instruction_vi": "Sắp xếp thành câu đúng",
       "words": ["in", "Ich", "Berlin", "wohne"], "correct_order": ["Ich", "wohne", "in", "Berlin"],
       "correct_answer": "Ich wohne in Berlin", "accept_also": ["ich wohne in berlin"],
       "translation_vi": "Tôi sống ở Berlin.", "explanation_vi": "Động từ đứng vị trí thứ 2: Ich + wohne + in Berlin."}
    ]
  }
}'::jsonb
WHERE title_de = 'Konjugation der Verben' AND is_active = TRUE;
