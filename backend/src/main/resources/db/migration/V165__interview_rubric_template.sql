-- Rubric templates: scoring criteria and weights per industry, role group, and phase
CREATE TABLE IF NOT EXISTS interview_rubric_template (
    id          BIGSERIAL    PRIMARY KEY,
    industry    VARCHAR(100) NOT NULL,
    role_group  VARCHAR(100) NOT NULL,          -- e.g. "IT", "Healthcare", "Gastronomy"
    level_range VARCHAR(50)  NOT NULL,          -- e.g. "0-6M", "1-2Y", "3Y+"
    phase       VARCHAR(30)  NOT NULL,          -- INTRO | ICE_BREAKER | HARD_SKILLS | STAR_SOFT | CLOSING | OVERALL
    criteria_json  TEXT      NOT NULL,          -- JSON array of criterion objects
    weight_json    TEXT      NOT NULL,          -- JSON object mapping criterion -> weight (0.0-1.0)
    version     INT          NOT NULL DEFAULT 1,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rubric_industry_phase ON interview_rubric_template (industry, phase, active);

-- ── IT / Software ──────────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('IT / Software', 'IT', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"completeness","label_vi":"Tính đầy đủ"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"structure","label_vi":"Cấu trúc câu trả lời"},
   {"key":"confidence","label_vi":"Sự tự tin"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.15,"clarity":0.10,"completeness":0.10,"german_quality":0.15,"structure":0.10,"confidence":0.10,"profession_fit":0.15,"concrete_experience":0.15}'
),
('IT / Software', 'IT', 'ANY', 'HARD_SKILLS',
 '[
   {"key":"technical_depth","label_vi":"Độ sâu kỹ thuật"},
   {"key":"trade_off_reasoning","label_vi":"Lý luận đánh đổi"},
   {"key":"concrete_example","label_vi":"Ví dụ cụ thể"},
   {"key":"problem_solving","label_vi":"Giải quyết vấn đề"}
 ]',
 '{"technical_depth":0.30,"trade_off_reasoning":0.25,"concrete_example":0.25,"problem_solving":0.20}'
);

-- ── Healthcare ─────────────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Healthcare', 'Healthcare', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"completeness","label_vi":"Tính đầy đủ"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"empathy","label_vi":"Sự đồng cảm với bệnh nhân"},
   {"key":"hygiene_awareness","label_vi":"Ý thức vệ sinh"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.12,"clarity":0.10,"completeness":0.10,"german_quality":0.15,"empathy":0.18,"hygiene_awareness":0.15,"profession_fit":0.10,"concrete_experience":0.10}'
),
('Healthcare', 'Healthcare', 'ANY', 'HARD_SKILLS',
 '[
   {"key":"patient_communication","label_vi":"Giao tiếp bệnh nhân"},
   {"key":"hygiene_protocol","label_vi":"Quy trình vệ sinh"},
   {"key":"documentation","label_vi":"Tài liệu hóa"},
   {"key":"emergency_response","label_vi":"Xử lý tình huống khẩn"}
 ]',
 '{"patient_communication":0.30,"hygiene_protocol":0.25,"documentation":0.25,"emergency_response":0.20}'
);

-- ── Gastronomy ─────────────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Gastronomy', 'Gastronomy', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"haccp_awareness","label_vi":"Nhận thức HACCP"},
   {"key":"teamwork","label_vi":"Làm việc nhóm"},
   {"key":"rush_handling","label_vi":"Xử lý giờ cao điểm"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.12,"clarity":0.10,"german_quality":0.15,"haccp_awareness":0.18,"teamwork":0.12,"rush_handling":0.15,"profession_fit":0.10,"concrete_experience":0.08}'
);

-- ── Retail / Verkauf ───────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Retail / Verkauf', 'Retail', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"customer_orientation","label_vi":"Hướng tới khách hàng"},
   {"key":"complaint_handling","label_vi":"Xử lý khiếu nại"},
   {"key":"teamwork","label_vi":"Làm việc nhóm"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.12,"clarity":0.12,"german_quality":0.15,"customer_orientation":0.20,"complaint_handling":0.15,"teamwork":0.10,"profession_fit":0.10,"concrete_experience":0.06}'
);

-- ── Operations / Maschinenbau ──────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Operations / Maschinenbau', 'Operations', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"safety_awareness","label_vi":"Nhận thức an toàn"},
   {"key":"technical_precision","label_vi":"Độ chính xác kỹ thuật"},
   {"key":"troubleshooting","label_vi":"Xử lý sự cố"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.10,"clarity":0.10,"german_quality":0.15,"safety_awareness":0.20,"technical_precision":0.18,"troubleshooting":0.15,"profession_fit":0.07,"concrete_experience":0.05}'
);

-- ── Service / Hotel ────────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Service / Hotel', 'Service', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"guest_orientation","label_vi":"Hướng tới khách"},
   {"key":"complaint_handling","label_vi":"Xử lý khiếu nại"},
   {"key":"professionalism","label_vi":"Tính chuyên nghiệp"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.12,"clarity":0.10,"german_quality":0.15,"guest_orientation":0.20,"complaint_handling":0.15,"professionalism":0.12,"profession_fit":0.10,"concrete_experience":0.06}'
);

-- ── Media / MC ────────────────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Media / Entertainment', 'Media', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"live_pressure","label_vi":"Xử lý áp lực trực tiếp"},
   {"key":"improvisation","label_vi":"Khả năng ứng biến"},
   {"key":"stage_presence","label_vi":"Phong thái trên sân khấu"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.10,"clarity":0.10,"german_quality":0.15,"live_pressure":0.18,"improvisation":0.17,"stage_presence":0.15,"profession_fit":0.10,"concrete_experience":0.05}'
);

-- ── Education / General ───────────────────────────────────────────────────────
INSERT INTO interview_rubric_template (industry, role_group, level_range, phase, criteria_json, weight_json) VALUES
('Education / Career', 'Education', 'ANY', 'OVERALL',
 '[
   {"key":"relevance","label_vi":"Độ liên quan"},
   {"key":"clarity","label_vi":"Sự rõ ràng"},
   {"key":"completeness","label_vi":"Tính đầy đủ"},
   {"key":"german_quality","label_vi":"Chất lượng tiếng Đức"},
   {"key":"structure","label_vi":"Cấu trúc câu trả lời"},
   {"key":"confidence","label_vi":"Sự tự tin"},
   {"key":"profession_fit","label_vi":"Phù hợp nghề nghiệp"},
   {"key":"concrete_experience","label_vi":"Kinh nghiệm cụ thể"}
 ]',
 '{"relevance":0.14,"clarity":0.12,"completeness":0.12,"german_quality":0.15,"structure":0.12,"confidence":0.12,"profession_fit":0.12,"concrete_experience":0.11}'
);
