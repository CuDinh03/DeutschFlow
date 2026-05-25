-- V118: Mock Goethe Exam Schema
-- Phase 3: Start Deutsch 1 (A1) mock exam support

CREATE TABLE IF NOT EXISTS mock_exams (
  id                   BIGSERIAL PRIMARY KEY,
  cefr_level           VARCHAR(5)   NOT NULL,
  exam_format          VARCHAR(30)  DEFAULT 'GOETHE',
  title                VARCHAR(200) NOT NULL,
  description_vi       TEXT,
  sections_json        JSONB,         -- exam structure
  total_points         INT NOT NULL DEFAULT 100,
  pass_points          INT NOT NULL DEFAULT 60,
  time_limit_minutes   INT,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_exam_attempts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  exam_id      BIGINT NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  answers_json JSONB,
  scores_json  JSONB,
  total_score  INT,
  passed       BOOLEAN,
  status       VARCHAR(20) DEFAULT 'IN_PROGRESS',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mea_user ON mock_exam_attempts (user_id, status);
CREATE INDEX IF NOT EXISTS idx_me_cefr  ON mock_exams (cefr_level) WHERE is_active = TRUE;

-- Seed: Goethe Start Deutsch 1 (A1) practice exam
INSERT INTO mock_exams (cefr_level, exam_format, title, description_vi, total_points, pass_points, time_limit_minutes, sections_json)
VALUES (
  'A1', 'GOETHE',
  'Goethe Start Deutsch 1 — Probeprüfung 1',
  'Bài thi thử theo đúng format Goethe Start Deutsch 1. Gồm 4 phần: Lesen, Hören, Schreiben, Sprechen.',
  100, 60, 75,
  '{
    "sections": [
      {
        "name": "LESEN",
        "label_vi": "Đọc hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {
            "teil": 1,
            "type": "MATCH",
            "instruction_vi": "Ghép thông báo (a-e) với tình huống (1-5)",
            "items": []
          },
          {
            "teil": 2,
            "type": "TRUE_FALSE_NOT_STATED",
            "instruction_vi": "Đọc form và chọn Richtig/Falsch",
            "items": []
          },
          {
            "teil": 3,
            "type": "MATCH_AD",
            "instruction_vi": "Tìm quảng cáo phù hợp với từng người",
            "items": []
          }
        ]
      },
      {
        "name": "HOEREN",
        "label_vi": "Nghe hiểu",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {"teil": 1, "type": "MULTIPLE_CHOICE", "instruction_vi": "Nghe và chọn đáp án đúng", "items": []},
          {"teil": 2, "type": "TRUE_FALSE", "instruction_vi": "Nghe và chọn Richtig/Falsch", "items": []},
          {"teil": 3, "type": "MULTIPLE_CHOICE", "instruction_vi": "Nghe tin nhắn thoại", "items": []}
        ]
      },
      {
        "name": "SCHREIBEN",
        "label_vi": "Viết",
        "time_minutes": 20,
        "max_points": 25,
        "teile": [
          {"teil": 1, "type": "FILL_FORM", "instruction_vi": "Điền thông tin cá nhân vào form đăng ký", "items": []},
          {"teil": 2, "type": "WRITE_EMAIL", "instruction_vi": "Viết email ~30 từ trả lời thư của bạn", "items": []}
        ]
      },
      {
        "name": "SPRECHEN",
        "label_vi": "Nói",
        "time_minutes": 15,
        "max_points": 25,
        "teile": [
          {"teil": 1, "type": "SELF_INTRO", "instruction_vi": "Giới thiệu bản thân (tên, tuổi, quê quán, nghề nghiệp)", "items": []},
          {"teil": 2, "type": "QA_DAILY", "instruction_vi": "Hỏi và trả lời về cuộc sống hàng ngày", "items": []},
          {"teil": 3, "type": "REQUEST_SUGGEST", "instruction_vi": "Đưa ra yêu cầu và hồi đáp", "items": []}
        ]
      }
    ]
  }'::jsonb
);
