-- Đợt 0 — Mảng Luyện thi Nói (plans/2026-08-19-ke-hoach-luyen-thi-noi.md)
-- 5 bảng + seed blueprint (Goethe/telc A1–B2, rubric 2 hệ tách bạch) + ngân hàng đề A1.
-- Quy ước: blueprint = điều phối (parts_json) + quy điểm (rubric_json); task = nội dung (stimulus_json).
-- Thêm hệ/cấp mới = thêm dữ liệu, không thêm code.

CREATE TABLE speaking_exam_blueprints (
    id           BIGSERIAL PRIMARY KEY,
    provider     VARCHAR(16)  NOT NULL,              -- GOETHE | TELC
    level        VARCHAR(4)   NOT NULL,              -- A1..C2
    version      INT          NOT NULL DEFAULT 1,
    title        VARCHAR(160) NOT NULL,
    parts_json   JSONB        NOT NULL,
    rubric_json  JSONB        NOT NULL,
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_speaking_exam_blueprint UNIQUE (provider, level, version)
);

CREATE TABLE speaking_exam_tasks (
    id              BIGSERIAL PRIMARY KEY,
    provider        VARCHAR(16),                     -- NULL = dùng chung mọi hệ (vd thẻ A1 Goethe ≡ telc)
    level           VARCHAR(4)   NOT NULL,
    teil_no         INT     NOT NULL,
    archetype       VARCHAR(32)  NOT NULL,
    stimulus_json   JSONB        NOT NULL,
    asset_refs_json JSONB,
    status          VARCHAR(16)  NOT NULL DEFAULT 'APPROVED',   -- DRAFT | APPROVED | RETIRED
    source          VARCHAR(16)  NOT NULL DEFAULT 'CURATED',    -- CURATED | GENERATED
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_speaking_exam_tasks_pick ON speaking_exam_tasks (level, teil_no, archetype, status);

CREATE TABLE speaking_exam_sessions (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blueprint_id     BIGINT      NOT NULL REFERENCES speaking_exam_blueprints (id),
    mode             VARCHAR(8)  NOT NULL,            -- DRILL | MOCK
    state            VARCHAR(16) NOT NULL,            -- PREP | IN_PART | BETWEEN | DONE | GRADING | RESULTS | ABORTED
    drill_teil_no    INT,
    current_part     INT    NOT NULL DEFAULT 0,
    current_step     INT    NOT NULL DEFAULT 0,
    plan_json        JSONB       NOT NULL,            -- đề đã rút cho từng Teil + kịch bản bước
    notes_text       TEXT,                            -- Konzeptpapier của thí sinh
    prep_started_at  TIMESTAMPTZ,
    part_started_at  TIMESTAMPTZ,
    part_deadline_at TIMESTAMPTZ,
    grading_job_id   BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ
);
CREATE INDEX idx_speaking_exam_sessions_user ON speaking_exam_sessions (user_id, created_at DESC);

CREATE TABLE speaking_exam_turns (
    id             BIGSERIAL PRIMARY KEY,
    session_id     BIGINT      NOT NULL REFERENCES speaking_exam_sessions (id) ON DELETE CASCADE,
    part_no        INT    NOT NULL,
    seq            INT         NOT NULL,
    role           VARCHAR(12) NOT NULL,              -- CANDIDATE | PRUEFER | PARTNER
    transcript     TEXT,
    audio_ref      VARCHAR(255),
    stt_json       JSONB,                             -- verbose STT: words/timestamps/avgLogprob/duration
    turn_eval_json JSONB,                             -- drill: điểm nhanh + sửa lỗi
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_speaking_exam_turn_seq UNIQUE (session_id, seq)
);

CREATE TABLE speaking_exam_results (
    id               BIGSERIAL PRIMARY KEY,
    session_id       BIGINT      NOT NULL UNIQUE REFERENCES speaking_exam_sessions (id) ON DELETE CASCADE,
    user_id          BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         VARCHAR(16) NOT NULL,
    level            VARCHAR(4)  NOT NULL,
    rubric_version   INT         NOT NULL,
    score_sheet_json JSONB       NOT NULL,            -- Ergebnisbogen đầy đủ (tiêu chí, bằng chứng, tin cậy)
    total_points     NUMERIC(6,2),
    total_low        NUMERIC(6,2),
    total_high       NUMERIC(6,2),
    max_points       NUMERIC(6,2),
    passed           BOOLEAN,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_speaking_exam_results_user ON speaking_exam_results (user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED BLUEPRINTS — parts_json (điều phối) + rubric_json (quy điểm, code quyết)
-- Thang: A_E (Goethe B1/B2/A2), A_D (telc B1/B2), VHN (volle/halbe/null: A1 hai hệ, telc A2).
-- "approximation" ghi rõ chỗ tài liệu công khai không in bảng chi tiết (xấp xỉ theo thang công bố).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO speaking_exam_blueprints (provider, level, version, title, parts_json, rubric_json) VALUES
-- Goethe A1 (Start Deutsch 1)
('GOETHE', 'A1', 1, 'Goethe-Zertifikat A1 — Sprechen', $p$
{"prepSec":0,"parts":[
 {"teilNo":1,"archetype":"SELF_INTRO","title":"Sich vorstellen","durationSec":180,"flow":"EXAMINER_LED","partnerRole":"NONE","stimulusType":"KEYWORD_CARD","cardsNeeded":1,"maxCandidateTurns":3},
 {"teilNo":2,"archetype":"CARD_QA","title":"Um Informationen bitten und Informationen geben","durationSec":240,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"THEME_CARD","cardsNeeded":4,"rounds":2,"maxCandidateTurns":4},
 {"teilNo":3,"archetype":"REQUEST_RESPOND","title":"Bitten formulieren und darauf reagieren","durationSec":240,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"PICTURE_CARD","cardsNeeded":4,"rounds":2,"maxCandidateTurns":4}
]}$p$, $r$
{"scheme":"GOETHE","scale":"VHN","rawMax":15,"rawMultiplier":1.66,"maxTotal":25,"passMin":null,"speakingOnlyMin":null,
 "parts":[
  {"teilNo":1,"items":[{"code":"VORSTELLUNG","label":"Sich vorstellen","max":1},{"code":"BUCHSTABIEREN","label":"Buchstabieren","max":1},{"code":"ZAHL","label":"Nummer nennen","max":1}]},
  {"teilNo":2,"items":[{"code":"FRAGE_1","label":"Frage 1","max":1.5},{"code":"ANTWORT_1","label":"Antwort 1","max":1.5},{"code":"FRAGE_2","label":"Frage 2","max":1.5},{"code":"ANTWORT_2","label":"Antwort 2","max":1.5}]},
  {"teilNo":3,"items":[{"code":"BITTE_1","label":"Bitte 1","max":1.5},{"code":"REAKTION_1","label":"Reaktion 1","max":1.5},{"code":"BITTE_2","label":"Bitte 2","max":1.5},{"code":"REAKTION_2","label":"Reaktion 2","max":1.5}]}],
 "global":[],
 "notes":"Điểm toàn kỳ thi: viết 75 + nói 25, đỗ ≥60 tổng; không có ngưỡng nói riêng."}$r$),
-- telc Deutsch A1 (cùng gốc đề với Goethe A1; thô 15, tổng kỳ thi 60, đỗ ≥36)
('TELC', 'A1', 1, 'telc Deutsch A1 — Mündliche Prüfung', $p$
{"prepSec":0,"parts":[
 {"teilNo":1,"archetype":"SELF_INTRO","title":"Sich vorstellen","durationSec":180,"flow":"EXAMINER_LED","partnerRole":"NONE","stimulusType":"KEYWORD_CARD","cardsNeeded":1,"maxCandidateTurns":3},
 {"teilNo":2,"archetype":"CARD_QA","title":"Um Informationen bitten und Informationen geben","durationSec":240,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"THEME_CARD","cardsNeeded":4,"rounds":2,"maxCandidateTurns":4},
 {"teilNo":3,"archetype":"REQUEST_RESPOND","title":"Bitten formulieren und darauf reagieren","durationSec":240,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"PICTURE_CARD","cardsNeeded":4,"rounds":2,"maxCandidateTurns":4}
]}$p$, $r$
{"scheme":"TELC","scale":"VHN","rawMax":15,"rawMultiplier":null,"maxTotal":15,"passMin":null,"speakingOnlyMin":null,
 "parts":[
  {"teilNo":1,"items":[{"code":"VORSTELLUNG","label":"Sich vorstellen","max":1},{"code":"BUCHSTABIEREN","label":"Buchstabieren","max":1},{"code":"ZAHL","label":"Zahlen","max":1}]},
  {"teilNo":2,"items":[{"code":"FRAGE_1","label":"Frage 1","max":1.5},{"code":"ANTWORT_1","label":"Antwort 1","max":1.5},{"code":"FRAGE_2","label":"Frage 2","max":1.5},{"code":"ANTWORT_2","label":"Antwort 2","max":1.5}]},
  {"teilNo":3,"items":[{"code":"BITTE_1","label":"Bitte 1","max":1.5},{"code":"REAKTION_1","label":"Reaktion 1","max":1.5},{"code":"BITTE_2","label":"Bitte 2","max":1.5},{"code":"REAKTION_2","label":"Reaktion 2","max":1.5}]}],
 "global":[],
 "notes":"Tổng kỳ thi 60 (H15/L15/S15/Sprechen15), đỗ ≥36; không có ngưỡng nói riêng."}$r$),
-- Goethe A2 (thang A–E, 25 điểm, NGƯỠNG NÓI RIÊNG ≥15)
('GOETHE', 'A2', 1, 'Goethe-Zertifikat A2 — Sprechen', $p$
{"prepSec":0,"parts":[
 {"teilNo":1,"archetype":"CARD_QA","title":"Fragen zur Person","durationSec":180,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"KEYWORD_CARD","cardsNeeded":8,"rounds":4,"maxCandidateTurns":8},
 {"teilNo":2,"archetype":"ABOUT_ME","title":"Von sich erzählen","durationSec":180,"flow":"MONOLOGUE","partnerRole":"NONE","stimulusType":"PROMPT_CARD","cardsNeeded":1,"maxCandidateTurns":3},
 {"teilNo":3,"archetype":"PLAN_NEGOTIATE","title":"Gemeinsam etwas planen","durationSec":300,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"CALENDAR_PAIR","cardsNeeded":1,"maxCandidateTurns":8}
]}$p$, $r$
{"scheme":"GOETHE","scale":"A_E","bandFractions":{"A":1,"B":0.75,"C":0.5,"D":0.25,"E":0},"maxTotal":25,"passMin":null,"speakingOnlyMin":15,"zeroPartIfErfuellungLowest":true,
 "parts":[
  {"teilNo":1,"criteria":[{"code":"ERFUELLUNG","label":"Aufgabenerfüllung","max":4}]},
  {"teilNo":2,"criteria":[{"code":"ERFUELLUNG","label":"Aufgabenerfüllung","max":4}]},
  {"teilNo":3,"criteria":[{"code":"ERFUELLUNG","label":"Aufgabenerfüllung","max":4}]}],
 "global":[{"code":"WORTSCHATZ","label":"Wortschatz","max":4},{"code":"STRUKTUREN","label":"Strukturen","max":4},{"code":"AUSSPRACHE","label":"Aussprache","max":5}],
 "approximation":"Phân bổ 4/4/4 + 4/4/5 = 25 nội suy từ Bewertungsbogen A2 (tài liệu công khai không in bảng điểm chi tiết) — cần giáo viên xác nhận.",
 "notes":"Đỗ: ≥15/25 nói VÀ ≥45/75 viết — thiếu một bên là trượt."}$r$),
-- telc Deutsch A2 (Start Deutsch 2): thô 15, ×1,66 quy thang 100 của toàn kỳ
('TELC', 'A2', 1, 'telc Deutsch A2 — Mündliche Prüfung', $p$
{"prepSec":0,"parts":[
 {"teilNo":1,"archetype":"SELF_INTRO","title":"Sich vorstellen","durationSec":180,"flow":"EXAMINER_LED","partnerRole":"NONE","stimulusType":"KEYWORD_CARD","cardsNeeded":1,"maxCandidateTurns":3},
 {"teilNo":2,"archetype":"CARD_QA","title":"Ein Alltagsgespräch führen","durationSec":240,"flow":"ALTERNATING_QA","partnerRole":"PARTNER","stimulusType":"QUESTION_WORD_CARD","cardsNeeded":4,"rounds":2,"maxCandidateTurns":4},
 {"teilNo":3,"archetype":"PLAN_NEGOTIATE","title":"Etwas aushandeln","durationSec":240,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"CALENDAR_PAIR","cardsNeeded":1,"maxCandidateTurns":8}
]}$p$, $r$
{"scheme":"TELC","scale":"VHN","rawMax":15,"rawMultiplier":1.66,"maxTotal":25,"passMin":null,"speakingOnlyMin":null,
 "parts":[
  {"teilNo":1,"items":[{"code":"VORSTELLUNG","label":"Sich vorstellen","max":3}]},
  {"teilNo":2,"items":[{"code":"FRAGE_1","label":"Frage 1","max":1.5},{"code":"ANTWORT_1","label":"Antwort 1","max":1.5},{"code":"FRAGE_2","label":"Frage 2","max":1.5},{"code":"ANTWORT_2","label":"Antwort 2","max":1.5}]},
  {"teilNo":3,"items":[{"code":"VORSCHLAEGE","label":"Vorschläge machen","max":3},{"code":"REAGIEREN","label":"Auf Vorschläge reagieren","max":3}]}],
 "global":[],
 "approximation":"Chia điểm từng Teil (3/6/6) nội suy theo cấu trúc Start Deutsch; không tìm thấy ngưỡng nói riêng.",
 "notes":"Đỗ 60% toàn kỳ."}$r$),
-- Goethe B1 (modular; 100 điểm; đỗ ≥60) — phân bổ chính thức
('GOETHE', 'B1', 1, 'Goethe-Zertifikat B1 — Modul Sprechen', $p$
{"prepSec":900,"parts":[
 {"teilNo":1,"archetype":"PLAN_NEGOTIATE","title":"Gemeinsam etwas planen","durationSec":180,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"PLANNING_CARD","cardsNeeded":1,"maxCandidateTurns":8},
 {"teilNo":2,"archetype":"PRESENT","title":"Ein Thema präsentieren","durationSec":240,"flow":"MONOLOGUE","partnerRole":"NONE","stimulusType":"FOLIEN_DECK","cardsNeeded":2,"maxCandidateTurns":2},
 {"teilNo":3,"archetype":"FEEDBACK_FOLLOWUP","title":"Über ein Thema sprechen","durationSec":120,"flow":"FEEDBACK","partnerRole":"PARTNER","stimulusType":"PARTNER_PRESENTATION","cardsNeeded":1,"maxCandidateTurns":4}
]}$p$, $r$
{"scheme":"GOETHE","scale":"A_E","bandFractions":{"A":1,"B":0.75,"C":0.5,"D":0.25,"E":0},"maxTotal":100,"passMin":60,"speakingOnlyMin":null,"zeroPartIfErfuellungLowest":true,
 "parts":[
  {"teilNo":1,"criteria":[{"code":"ERFUELLUNG","label":"Erfüllung der Aufgabenstellung","max":8},{"code":"INTERAKTION","label":"Interaktion","max":4},{"code":"WORTSCHATZ","label":"Wortschatz","max":8},{"code":"STRUKTUREN","label":"Strukturen","max":8}]},
  {"teilNo":2,"criteria":[{"code":"ERFUELLUNG","label":"Erfüllung der Aufgabenstellung","max":12},{"code":"KOHAERENZ","label":"Kohärenz","max":4},{"code":"WORTSCHATZ","label":"Wortschatz","max":12},{"code":"STRUKTUREN","label":"Strukturen","max":12}]},
  {"teilNo":3,"criteria":[{"code":"ERFUELLUNG","label":"Erfüllung der Aufgabenstellung","max":16}]}],
 "global":[{"code":"AUSSPRACHE","label":"Aussprache","max":16}],
 "notes":"T1 28 + T2 40 + T3 16 + Aussprache 16 = 100 (bfu.goethe.de / ZB1-Kriterien)."}$r$),
-- telc Deutsch B1 (Zertifikat Deutsch): 4 tiêu chí A–D; 15/30/30 = 75; NGƯỠNG NÓI RIÊNG ≥45
('TELC', 'B1', 1, 'telc Deutsch B1 — Mündliche Prüfung', $p$
{"prepSec":1200,"parts":[
 {"teilNo":1,"archetype":"TOPIC_EXCHANGE","title":"Kontaktaufnahme","durationSec":210,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"CONTACT_CARD","cardsNeeded":1,"maxCandidateTurns":6},
 {"teilNo":2,"archetype":"TOPIC_EXCHANGE","title":"Gespräch über ein Thema","durationSec":330,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"TOPIC_GRAPHIC_PAIR","cardsNeeded":1,"maxCandidateTurns":8},
 {"teilNo":3,"archetype":"PLAN_NEGOTIATE","title":"Gemeinsam eine Aufgabe lösen","durationSec":300,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"PLANNING_CARD","cardsNeeded":1,"maxCandidateTurns":8}
]}$p$, $r$
{"scheme":"TELC","scale":"A_D","maxTotal":75,"passMin":null,"speakingOnlyMin":45,"zeroPartIfErfuellungLowest":false,
 "parts":[
  {"teilNo":1,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":3,"bandPoints":{"A":3,"B":2,"C":1,"D":0}}]},
  {"teilNo":2,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":6,"bandPoints":{"A":6,"B":4,"C":2,"D":0}}]},
  {"teilNo":3,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":8,"bandPoints":{"A":8,"B":6,"C":4,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":6,"bandPoints":{"A":6,"B":4,"C":2,"D":0}}]}],
 "global":[],
 "approximation":"Điểm trung gian B/C của từng tiêu chí nội suy (max 4→4/3/2/0, 3→3/2/1/0, 8→8/6/4/0, 6→6/4/2/0) — xác nhận với Bewertungsbogen telc.",
 "notes":"Mündlich 75 = 25% của 300; đỗ kép: ≥45/75 nói VÀ ≥135/225 viết."}$r$),
-- Goethe B2 (modular 2019): T1 44 + T2 56 (Aussprache 16 chấm chung) = 100; đỗ ≥60
('GOETHE', 'B2', 1, 'Goethe-Zertifikat B2 — Modul Sprechen', $p$
{"prepSec":900,"parts":[
 {"teilNo":1,"archetype":"PRESENT","title":"Vortrag halten","durationSec":300,"flow":"MONOLOGUE","partnerRole":"PARTNER","stimulusType":"TOPIC_CHOICE","cardsNeeded":2,"maxCandidateTurns":4},
 {"teilNo":2,"archetype":"DISCUSS","title":"Diskussion führen","durationSec":300,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"DEBATE_CARD","cardsNeeded":1,"maxCandidateTurns":8}
]}$p$, $r$
{"scheme":"GOETHE","scale":"A_E","bandFractions":{"A":1,"B":0.75,"C":0.5,"D":0.25,"E":0},"maxTotal":100,"passMin":60,"speakingOnlyMin":null,"zeroPartIfErfuellungLowest":true,
 "parts":[
  {"teilNo":1,"criteria":[{"code":"ERFUELLUNG","label":"Erfüllung der Aufgabenstellung","max":16},{"code":"KOHAERENZ_FLUESSIGKEIT","label":"Kohärenz / Flüssigkeit","max":8},{"code":"WORTSCHATZ","label":"Wortschatz","max":8},{"code":"STRUKTUREN","label":"Strukturen","max":8},{"code":"FRAGEN_ANTWORTEN","label":"Fragen / Antworten","max":4}]},
  {"teilNo":2,"criteria":[{"code":"ERFUELLUNG","label":"Erfüllung der Aufgabenstellung","max":16},{"code":"INTERAKTION_REGISTER","label":"Interaktion / Register","max":8},{"code":"WORTSCHATZ","label":"Wortschatz","max":8},{"code":"STRUKTUREN","label":"Strukturen","max":8}]}],
 "global":[{"code":"AUSSPRACHE","label":"Aussprache","max":16}],
 "notes":"Thang 16/12/8/4/0 · 8/6/4/2/0 · 4/3/2/1/0; T1=44, T2=40 + Aussprache 16 = 56 (Klett-Lehrerhandbuch, khớp phiếu chấm chính thức)."}$r$),
-- telc Deutsch B2: 3 Teil × 25 (7/7/7/4) = 75; A* quy điểm = A; NGƯỠNG NÓI RIÊNG ≥45
('TELC', 'B2', 1, 'telc Deutsch B2 — Mündliche Prüfung', $p$
{"prepSec":1200,"parts":[
 {"teilNo":1,"archetype":"PRESENT","title":"Präsentation","durationSec":150,"flow":"MONOLOGUE","partnerRole":"PARTNER","stimulusType":"TOPIC_CHOICE","cardsNeeded":5,"maxCandidateTurns":3},
 {"teilNo":2,"archetype":"DISCUSS","title":"Diskussion","durationSec":150,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"DEBATE_TEXT","cardsNeeded":1,"maxCandidateTurns":6},
 {"teilNo":3,"archetype":"PLAN_NEGOTIATE","title":"Problemlösung","durationSec":150,"flow":"DIALOGUE","partnerRole":"PARTNER","stimulusType":"PLANNING_CARD","cardsNeeded":1,"maxCandidateTurns":6}
]}$p$, $r$
{"scheme":"TELC","scale":"A_D","maxTotal":75,"passMin":null,"speakingOnlyMin":45,"zeroPartIfErfuellungLowest":false,"aStarEqualsA":true,
 "parts":[
  {"teilNo":1,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}}]},
  {"teilNo":2,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}}]},
  {"teilNo":3,"criteria":[{"code":"AUSDRUCKSFAEHIGKEIT","label":"Ausdrucksfähigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUFGABENBEWAELTIGUNG","label":"Aufgabenbewältigung","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"FORMALE_RICHTIGKEIT","label":"Formale Richtigkeit","max":7,"bandPoints":{"A":7,"B":5,"C":3,"D":0}},{"code":"AUSSPRACHE_INTONATION","label":"Aussprache und Intonation","max":4,"bandPoints":{"A":4,"B":3,"C":2,"D":0}}]}],
 "global":[],
 "approximation":"Điểm trung gian B/C nội suy (7→7/5/3/0, 4→4/3/2/0) — xác nhận với Bewertungsbogen telc.",
 "notes":"Mündlich 75 = 25% của 300; đỗ kép 60%/60%; A* là cờ vượt cấp, quy điểm = A."}$r$);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED NGÂN HÀNG ĐỀ A1 (dùng chung Goethe/telc: provider NULL)
-- T1: thẻ từ khóa + từ để đánh vần + số. T2: Themenkarte (chuyển ~35 thẻ hardcode từ SprechenTeil2Service
-- vào DB). T3: Bildkarte (đồ vật) — asset hình bổ sung ở đợt UI.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json) VALUES
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"Straße","number":"0176 2345 6789"} $j$),
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"Familienname","number":"030 987 6543"} $j$),
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"Wohnort","number":"Postleitzahl 80331"} $j$),
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"Vorname","number":"0151 1122 3344"} $j$),
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"Hausnummer","number":"Hausnummer 47b"} $j$),
(NULL,'A1',1,'SELF_INTRO',$j$ {"type":"KEYWORD_CARD","keywords":["Name?","Alter?","Land?","Wohnort?","Sprachen?","Beruf?","Hobby?"],"spell":"E-Mail","number":"0211 55 66 77"} $j$);

INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT NULL, 'A1', 2, 'CARD_QA', jsonb_build_object('type','THEME_CARD','thema', t.thema, 'wort', t.wort)
FROM (VALUES
 ('Essen und Trinken','Brot'),('Essen und Trinken','Fleisch'),('Essen und Trinken','Wasser'),('Essen und Trinken','Kaffee'),
 ('Essen und Trinken','Obst'),('Essen und Trinken','Gemüse'),('Essen und Trinken','Bier'),('Essen und Trinken','Restaurant'),
 ('Einkaufen','Kasse'),('Einkaufen','Schuhe'),('Einkaufen','Kleidung'),('Einkaufen','Geld'),('Einkaufen','Zeitung'),('Einkaufen','Supermarkt'),
 ('Wohnen','Küche'),('Wohnen','Miete'),('Wohnen','Schlafzimmer'),('Wohnen','Balkon'),('Wohnen','Garten'),('Wohnen','Fernseher'),
 ('Familie','Kinder'),('Familie','Eltern'),('Familie','Geschwister'),('Familie','Wochenende'),('Familie','Ausflug'),
 ('Arbeit','Kollegen'),('Arbeit','Pause'),('Arbeit','Computer'),('Arbeit','Urlaub'),('Arbeit','Spaß'),
 ('Freizeit','Sport'),('Freizeit','Musik'),('Freizeit','Fahrrad'),('Freizeit','Kino'),('Freizeit','Lesen'),
 ('Tagesablauf','Frühstück'),('Tagesablauf','Schlafen'),('Tagesablauf','Arbeit'),('Tagesablauf','Abend'),
 ('Reisen','Zug'),('Reisen','Hotel'),('Reisen','Koffer'),('Reisen','Flugzeug'),
 ('Gesundheit','Arzt'),('Gesundheit','Sport'),('Gesundheit','Schlafen'),('Gesundheit','Medikamente'),
 ('Wetter','Regen'),('Wetter','Sommer'),('Wetter','Schnee')
) AS t(thema, wort);

INSERT INTO speaking_exam_tasks (provider, level, teil_no, archetype, stimulus_json)
SELECT NULL, 'A1', 3, 'REQUEST_RESPOND', jsonb_build_object('type','PICTURE_CARD','object', t.obj, 'article', t.art, 'iconKey', t.icon)
FROM (VALUES
 ('Uhr','die','clock'),('Handy','das','smartphone'),('Buch','das','book'),('Fenster','das','window'),('Tür','die','door'),
 ('Stift','der','pen'),('Brille','die','glasses'),('Schlüssel','der','key'),('Tasse','die','cup'),('Flasche','die','bottle'),
 ('Lampe','die','lamp'),('Stuhl','der','chair'),('Schere','die','scissors'),('Papier','das','paper'),('Radio','das','radio'),
 ('Jacke','die','jacket'),('Tasche','die','bag'),('Ball','der','ball'),('Apfel','der','apple'),('Zeitung','die','newspaper'),
 ('Computer','der','laptop'),('Telefon','das','phone'),('Tisch','der','table'),('Licht','das','light')
) AS t(obj, art, icon);
