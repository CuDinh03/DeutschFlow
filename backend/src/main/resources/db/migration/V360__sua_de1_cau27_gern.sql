-- Đề 1, Sprachbausteine Teil 1, câu 27 (07/11/2026, owner quyết "sửa đề").
--
-- „Ich bringe sie ___ zum Termin mit" có lựa chọn a „gern" · b „gerne" · c „lieber", đáp án a.
-- „gerne" là biến thể của „gern", cùng nghĩa và cùng vị trí nên người chọn b không sai về tiếng Đức.
-- Sửa: thay b bằng „am liebsten", thành bộ gern / lieber / am liebsten như các đề telc thường dùng.
-- Đáp án vẫn là a, id câu không đổi, nên đáp án đã lưu và lượt đã chấm vẫn đúng chữ cái.
--
-- Chỉ đổi đúng hai chuỗi trong sections_json (bộ lựa chọn và explanation_vi của SB1-27), và chỉ
-- trên hàng Đề số 1 còn đúng nội dung V328. Phần giải thích ở V358 đổi bằng jsonb_set đúng khoá.
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

UPDATE mock_exams
SET sections_json = replace(
      replace(sections_json::text,
              '{"a": "gern", "b": "gerne", "c": "lieber"}',
              '{"a": "gern", "b": "am liebsten", "c": "lieber"}'),
      '"„Ich bringe sie gern mit“; „lieber“ nghĩa là thích hơn — không có so sánh ở đây."',
      '"„Ich bringe sie gern zum Termin mit“ — „gern“ = sẵn lòng. „lieber“ (thích hơn) và „am liebsten“ (thích nhất) là dạng so sánh, trong câu không có gì để so sánh."'
    )::jsonb
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 1'
  AND sections_json::text LIKE '%"id": "SB1-27"%'
  AND sections_json::text LIKE '%{"a": "gern", "b": "gerne", "c": "lieber"}%';

UPDATE mock_exam_explanations e
SET body = jsonb_set(e.body, '{items,SB1-27}', $j$
{ "need_vi": "trạng từ „sẵn lòng“, không so sánh với gì",
  "rule_vi": "gern = sẵn lòng · lieber = thích … hơn · am liebsten = thích … nhất",
  "wrong": {
    "b": { "why_vi": "„am liebsten“ là dạng so sánh nhất của „gern“ (thích … nhất). Câu chỉ nói bạn sẵn lòng mang giấy tờ tới buổi hẹn, không chọn giữa nhiều cách." },
    "c": { "why_vi": "„lieber“ là „thích … hơn“ (so sánh hơn). Trong câu không có gì để so sánh." } } }
$j$::jsonb)
FROM mock_exams m
WHERE e.exam_id = m.id
  AND m.exam_format = 'TELC'
  AND m.title = 'telc Deutsch B1 — Đề số 1'
  AND e.teil_key = 'SPRACHBAUSTEINE-1'
  AND e.body->'items'->'SB1-27' IS NOT NULL;
