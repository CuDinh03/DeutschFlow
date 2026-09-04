-- LLM tier CONTENT thỉnh thoảng bọc bài tập trong vỏ JSON-schema
-- {"type":"object","content":[...]} (prod 17–18/08: session 33 HOEREN, 35 SPRECHEN)
-- => overview đếm 0, runner hiện "0 Aufgaben". Backend giờ đã bóc vỏ lúc ghi
-- (PracticeNodeService#normalizeExercisePayload); migration này bóc vỏ cho các
-- session đã lưu. Payload hợp lệ chỉ có 2 dạng: mảng trần hoặc object mang
-- exercises/reading_passage — object có "content" mà thiếu cả hai key đó là vỏ.
UPDATE practice_node_sessions
SET exercises_json = exercises_json -> 'content'
WHERE jsonb_typeof(exercises_json) = 'object'
  AND jsonb_typeof(exercises_json -> 'content') IN ('array', 'object')
  AND jsonb_typeof(exercises_json -> 'exercises') IS NULL
  AND jsonb_typeof(exercises_json -> 'reading_passage') IS NULL;
