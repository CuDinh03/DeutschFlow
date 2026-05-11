-- V118: Mock Goethe Exam System (Start Deutsch 1 format)

CREATE TABLE IF NOT EXISTS mock_exams (
  id                  BIGSERIAL PRIMARY KEY,
  cefr_level          VARCHAR(5)   NOT NULL DEFAULT 'A1',
  exam_format         VARCHAR(20)  NOT NULL DEFAULT 'GOETHE',
  title               VARCHAR(200) NOT NULL,
  description_vi      TEXT,
  sections_json       JSONB        NOT NULL DEFAULT '[]',
  total_points        INT          NOT NULL DEFAULT 60,
  pass_points         INT          NOT NULL DEFAULT 36,     -- 60% to pass
  time_limit_minutes  INT          DEFAULT 75,              -- Total: Lesen20+Hören20+Schreiben20+Sprechen15
  is_active           BOOLEAN      DEFAULT TRUE,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_exam_attempts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT       NOT NULL,
  exam_id         BIGINT       NOT NULL REFERENCES mock_exams(id),
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  deadline_at     TIMESTAMPTZ,               -- started_at + time_limit_minutes
  answers_json    JSONB        DEFAULT '{}', -- {section: {questionId: answer}}
  scores_json     JSONB        DEFAULT '{}', -- {lesen: 15, hoeren: 14, schreiben: 10, sprechen: 12}
  ai_feedback_json JSONB       DEFAULT '{}', -- AI feedback per section
  total_score     INT,
  passed          BOOLEAN,
  status          VARCHAR(20)  DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, ABANDONED
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_mea_user   ON mock_exam_attempts (user_id, status);
CREATE INDEX idx_mea_exam   ON mock_exam_attempts (exam_id);

-- Seed: Goethe Start Deutsch 1 (A1) mock exam
INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json)
VALUES (
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 — Probeprüfung',
  'Bài thi thử đúng format Goethe Start Deutsch 1. Gồm 4 phần: Lesen, Hören, Schreiben, Sprechen.',
  60, 36, 75,
  '[
    {
      "section": "LESEN",
      "title": "Lesen",
      "title_vi": "Đọc hiểu",
      "time_minutes": 20,
      "max_points": 15,
      "description_vi": "Đọc các bảng thông báo, form và quảng cáo",
      "teile": [
        {
          "teil": 1,
          "title": "Teil 1 — Bảng thông báo",
          "instructions_vi": "Bạn đọc các bảng thông báo. Đúng hay Sai?",
          "questions": [
            {"id": "L1Q1", "text_de": "Kein Rauchen erlaubt.", "statement_vi": "Bảng này cấm hút thuốc.", "correct": "RICHTIG"},
            {"id": "L1Q2", "text_de": "Geöffnet: Mo–Fr 8–18 Uhr", "statement_vi": "Cửa hàng mở cả thứ 7.", "correct": "FALSCH"},
            {"id": "L1Q3", "text_de": "Bitte klingeln!", "statement_vi": "Bạn phải bấm chuông.", "correct": "RICHTIG"},
            {"id": "L1Q4", "text_de": "Parkplatz nur für Kunden", "statement_vi": "Bãi đỗ xe cho tất cả mọi người.", "correct": "FALSCH"},
            {"id": "L1Q5", "text_de": "Treppe benutzen. Aufzug außer Betrieb.", "statement_vi": "Thang máy đang hỏng.", "correct": "RICHTIG"}
          ]
        },
        {
          "teil": 2,
          "title": "Teil 2 — Form điền",
          "instructions_vi": "Đọc thông tin và trả lời câu hỏi",
          "questions": [
            {"id": "L2Q1", "context_de": "Name: Müller, Vorname: Anna, Alter: 28, Beruf: Lehrerin", "question_vi": "Cô ấy bao nhiêu tuổi?", "correct": "28"},
            {"id": "L2Q2", "context_de": "Name: Müller, Vorname: Anna, Alter: 28, Beruf: Lehrerin", "question_vi": "Cô ấy làm nghề gì?", "correct": "Lehrerin"},
            {"id": "L2Q3", "context_de": "Kurs: Deutsch A1, Zeit: Dienstag 18–20 Uhr, Preis: 120€", "question_vi": "Khóa học vào ngày nào?", "correct": "Dienstag"},
            {"id": "L2Q4", "context_de": "Kurs: Deutsch A1, Zeit: Dienstag 18–20 Uhr, Preis: 120€", "question_vi": "Học phí bao nhiêu?", "correct": "120€"},
            {"id": "L2Q5", "context_de": "Adresse: Hauptstraße 12, 10115 Berlin", "question_vi": "Số nhà là bao nhiêu?", "correct": "12"}
          ]
        },
        {
          "teil": 3,
          "title": "Teil 3 — Ghép đôi",
          "instructions_vi": "Ghép thông báo với hình ảnh phù hợp",
          "questions": [
            {"id": "L3Q1", "text_de": "Frisches Obst und Gemüse", "options": ["Supermarkt", "Apotheke", "Bäckerei", "Arzt"], "correct": "Supermarkt"},
            {"id": "L3Q2", "text_de": "Tabletten, Hustensaft, Pflaster", "options": ["Supermarkt", "Apotheke", "Bäckerei", "Arzt"], "correct": "Apotheke"},
            {"id": "L3Q3", "text_de": "Brot, Brötchen, Kuchen", "options": ["Supermarkt", "Apotheke", "Bäckerei", "Arzt"], "correct": "Bäckerei"},
            {"id": "L3Q4", "text_de": "Sprechstunde 8–12 Uhr", "options": ["Supermarkt", "Apotheke", "Bäckerei", "Arzt"], "correct": "Arzt"},
            {"id": "L3Q5", "text_de": "Haarschnitt 25€", "options": ["Friseur", "Apotheke", "Bäckerei", "Bank"], "correct": "Friseur"}
          ]
        }
      ]
    },
    {
      "section": "HOEREN",
      "title": "Hören",
      "title_vi": "Nghe hiểu",
      "time_minutes": 20,
      "max_points": 15,
      "description_vi": "Nghe thông báo, hội thoại và tin nhắn điện thoại",
      "teile": [
        {
          "teil": 1,
          "title": "Teil 1 — Thông báo ngắn",
          "instructions_vi": "Nghe và chọn đáp án đúng",
          "questions": [
            {"id": "H1Q1", "audio_script_de": "Der Zug nach München fährt auf Gleis 7 ab.", "question_vi": "Tàu đến Munich đến sân ga nào?", "options": ["Gleis 5", "Gleis 7", "Gleis 9"], "correct": "Gleis 7"},
            {"id": "H1Q2", "audio_script_de": "Das Schwimmbad ist heute wegen Wartungsarbeiten geschlossen.", "question_vi": "Bể bơi hôm nay như thế nào?", "options": ["Bình thường", "Đóng cửa", "Mở muộn"], "correct": "Đóng cửa"},
            {"id": "H1Q3", "audio_script_de": "Im Supermarkt Sonderangebot: Äpfel 1 Kilo für 99 Cent.", "question_vi": "1 kg táo giá bao nhiêu?", "options": ["0,89€", "0,99€", "1,09€"], "correct": "0,99€"},
            {"id": "H1Q4", "audio_script_de": "Die Bibliothek schließt heute um 18 Uhr.", "question_vi": "Thư viện đóng cửa lúc mấy giờ?", "options": ["17 Uhr", "18 Uhr", "19 Uhr"], "correct": "18 Uhr"},
            {"id": "H1Q5", "audio_script_de": "Wegen Baustelle ist die Hauptstraße gesperrt.", "question_vi": "Tại sao đường bị đóng?", "options": ["Tai nạn", "Công trình xây dựng", "Lễ hội"], "correct": "Công trình xây dựng"}
          ]
        },
        {
          "teil": 2,
          "title": "Teil 2 — Hội thoại",
          "instructions_vi": "Nghe hội thoại và trả lời",
          "questions": [
            {"id": "H2Q1", "audio_script_de": "A: Wann treffen wir uns? B: Am Samstag um 15 Uhr.", "question_vi": "Họ gặp nhau khi nào?", "options": ["Freitag 15 Uhr", "Samstag 15 Uhr", "Sonntag 15 Uhr"], "correct": "Samstag 15 Uhr"},
            {"id": "H2Q2", "audio_script_de": "A: Was kostet das Hemd? B: 35 Euro. A: Das ist zu teuer.", "question_vi": "Áo sơ mi giá bao nhiêu?", "options": ["25€", "35€", "45€"], "correct": "35€"},
            {"id": "H2Q3", "audio_script_de": "A: Wie kommst du zur Arbeit? B: Mit der U-Bahn.", "question_vi": "Anh ấy đi làm bằng gì?", "options": ["Bus", "U-Bahn", "Fahrrad"], "correct": "U-Bahn"},
            {"id": "H2Q4", "audio_script_de": "A: Magst du Kaffee? B: Nein, ich trinke lieber Tee.", "question_vi": "Cô ấy thích uống gì?", "options": ["Kaffee", "Tee", "Wasser"], "correct": "Tee"},
            {"id": "H2Q5", "audio_script_de": "A: Wo wohnst du? B: In München, Schwabing.", "question_vi": "Anh ấy sống ở đâu?", "options": ["Berlin", "Hamburg", "München"], "correct": "München"}
          ]
        },
        {
          "teil": 3,
          "title": "Teil 3 — Tin nhắn điện thoại",
          "instructions_vi": "Nghe tin nhắn và điền thông tin",
          "questions": [
            {"id": "H3Q1", "audio_script_de": "Hallo, hier ist Klaus. Ich komme morgen um 10 Uhr. Ruf mich an: 0176-12345.", "question_vi": "Anh Klaus đến lúc mấy giờ?", "correct": "10 Uhr"},
            {"id": "H3Q2", "audio_script_de": "Hallo, hier ist Klaus. Ich komme morgen um 10 Uhr. Ruf mich an: 0176-12345.", "question_vi": "Số điện thoại của anh ấy?", "correct": "0176-12345"},
            {"id": "H3Q3", "audio_script_de": "Ich möchte einen Tisch für 4 Personen reservieren, am Freitag, 19 Uhr.", "question_vi": "Đặt bàn cho bao nhiêu người?", "correct": "4"},
            {"id": "H3Q4", "audio_script_de": "Ich möchte einen Tisch für 4 Personen reservieren, am Freitag, 19 Uhr.", "question_vi": "Đặt bàn vào ngày nào?", "correct": "Freitag"},
            {"id": "H3Q5", "audio_script_de": "Der Arzttermin ist am Montag um 14:30 Uhr, Praxis Dr. Schneider.", "question_vi": "Lịch hẹn bác sĩ lúc mấy giờ?", "correct": "14:30 Uhr"}
          ]
        }
      ]
    },
    {
      "section": "SCHREIBEN",
      "title": "Schreiben",
      "title_vi": "Viết",
      "time_minutes": 20,
      "max_points": 15,
      "description_vi": "Điền form và viết email ngắn",
      "teile": [
        {
          "teil": 1,
          "title": "Teil 1 — Điền form",
          "instructions_vi": "Điền thông tin vào form đăng ký",
          "fields": [
            {"id": "S1F1", "label_de": "Vorname", "label_vi": "Tên"},
            {"id": "S1F2", "label_de": "Familienname", "label_vi": "Họ"},
            {"id": "S1F3", "label_de": "Land", "label_vi": "Quốc gia"},
            {"id": "S1F4", "label_de": "Sprachen", "label_vi": "Ngôn ngữ"},
            {"id": "S1F5", "label_de": "Hobby", "label_vi": "Sở thích"}
          ]
        },
        {
          "teil": 2,
          "title": "Teil 2 — Viết email",
          "instructions_vi": "Viết email cho bạn Maria (30–40 từ). Nội dung: giới thiệu bản thân, đề xuất gặp nhau cuối tuần.",
          "prompt_de": "Schreiben Sie eine E-Mail an Ihre Freundin Maria. Stellen Sie sich vor und schlagen Sie ein Treffen am Wochenende vor.",
          "min_words": 30,
          "max_words": 40
        }
      ]
    },
    {
      "section": "SPRECHEN",
      "title": "Sprechen",
      "title_vi": "Nói",
      "time_minutes": 15,
      "max_points": 15,
      "description_vi": "Giới thiệu bản thân, hỏi đáp, đưa ra yêu cầu",
      "teile": [
        {
          "teil": 1,
          "title": "Teil 1 — Sich vorstellen",
          "instructions_vi": "Giới thiệu bản thân: tên, quê quán, nghề nghiệp, ngôn ngữ, sở thích.",
          "prompts_vi": ["Tên bạn là gì?", "Bạn đến từ đâu?", "Bạn làm nghề gì?", "Bạn nói những ngôn ngữ nào?", "Sở thích của bạn?"]
        },
        {
          "teil": 2,
          "title": "Teil 2 — Fragen und Antworten",
          "instructions_vi": "Hỏi và trả lời về cuộc sống hàng ngày.",
          "prompts_vi": ["Bạn sống ở đâu?", "Gia đình bạn như thế nào?", "Bạn thích ăn gì?"]
        },
        {
          "teil": 3,
          "title": "Teil 3 — Bitten und Vorschläge",
          "instructions_vi": "Đưa ra yêu cầu hoặc đề nghị. Thẻ gợi ý: Foto machen, Fenster öffnen, Uhrzeit fragen.",
          "cards": ["Foto machen?", "Fenster öffnen?", "Uhrzeit fragen?"]
        }
      ]
    }
  ]'::jsonb
);
