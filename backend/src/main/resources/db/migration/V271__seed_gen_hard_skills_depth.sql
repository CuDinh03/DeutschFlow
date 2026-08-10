-- Đợt E1 kế hoạch 10/08 (chấm điểm phỏng vấn thật): bank DEFAULT chỉ có 3 câu HARD_SKILLS nên
-- phiên dài cạn bank từ lượt 7 và rơi vào fallback lặp nguyên văn (harness S3 lượt 7–9).
-- Seed 3 câu mới — parity với InterviewQuestionBank.generalQuestions (InterviewQuestionBankSeedParityTest).

INSERT INTO interview_question (id, persona_code, phase, topic_key, question_de, difficulty) VALUES
('gen_process',    'DEFAULT', 'HARD_SKILLS', 'prozess',    'Beschreiben Sie einen Arbeitsablauf, den Sie verbessert haben — vorher/nachher, gern mit Zahlen.', 'INTERMEDIATE'),
('gen_tools',      'DEFAULT', 'HARD_SKILLS', 'werkzeuge',  'Welches Werkzeug oder System beherrschen Sie für diese Position am besten, und wie haben Sie es zuletzt konkret eingesetzt?', 'INTERMEDIATE'),
('gen_prioritize', 'DEFAULT', 'HARD_SKILLS', 'prioritaet', 'Wie priorisieren Sie, wenn zwei dringende Aufgaben gleichzeitig kommen? Ein reales Beispiel, kein Theorieblock.', 'INTERMEDIATE')
ON CONFLICT (id) DO NOTHING;
