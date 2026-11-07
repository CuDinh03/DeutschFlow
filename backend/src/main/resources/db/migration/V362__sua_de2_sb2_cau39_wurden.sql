-- Đề 2, Sprachbausteine Teil 2, câu 39 (07/11/2026). Luật owner: đáp án đúng phải khớp NGỮ CẢNH,
-- và chỉ sửa đề khi hai phương án khớp ngữ cảnh như nhau.
--
-- „Wir ___ uns aber erst anmelden, wenn wir wissen, ob es noch zwei freie Plätze gibt." Đáp án
-- KÖNNEN (f). Hộp từ còn WÜRDEN (o), không dùng ở chỗ nào khác của đề, và „Wir würden uns aber
-- erst anmelden, wenn …" cũng đúng ngữ pháp và khớp ngữ cảnh ⇒ hai đáp án.
-- Sửa: thay WÜRDEN bằng WURDEN (Präteritum của werden). WURDEN không vừa chỗ nào: chỗ 37 chủ ngữ
-- „ich", chỗ 39 việc đăng ký là việc sắp tới. Đáp án mọi câu không đổi, id câu không đổi.
--
-- Chỉ đổi đúng hai chuỗi trong sections_json (ô o của hộp từ và explanation_vi của SB2-37) trên
-- hàng Đề số 2; phần giải thích V358 đổi bằng jsonb_set đúng khoá.
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

UPDATE mock_exams
SET sections_json = replace(
      replace(sections_json::text,
              '"o": "WÜRDEN"',
              '"o": "WURDEN"'),
      'WÜRDEN (o) là ngôi „wir/sie“, sai chủ ngữ.',
      'WURDEN (o) là quá khứ, ngôi „wir/sie“ — sai cả thì lẫn chủ ngữ.'
    )::jsonb
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 2'
  AND sections_json::text LIKE '%"id": "SB2-39"%'
  AND sections_json::text LIKE '%"o": "WÜRDEN"%';

UPDATE mock_exam_explanations e
SET body = jsonb_set(
      jsonb_set(
        jsonb_set(e.body, '{options,o}', $j$
{ "meaning_vi": "trợ động từ „werden“ ở quá khứ (Präteritum), ngôi wir/sie/Sie",
  "distractor_vi": "Nhiễu cho chỗ 37 và 39: chỗ 37 chủ ngữ là „ich“, chỗ 39 nói việc sắp tới nên không dùng quá khứ." }
$j$::jsonb),
        '{items,SB2-37,wrong,o}', $j$
{ "why_vi": "„wurden“ là quá khứ và chia cho wir/sie/Sie; chủ ngữ là „Ich“, lại đang nói hiện tại.", "trap": "Sai ngôi" }
$j$::jsonb),
      '{items,SB2-39,wrong,o}', $j$
{ "why_vi": "„wurden“ là quá khứ của „werden“. Việc đăng ký còn ở phía trước („erst … wenn wir wissen“), nên „wir wurden uns anmelden“ không khớp; cần hiện tại „können“.", "trap": "Sai thì" }
$j$::jsonb)
FROM mock_exams m
WHERE e.exam_id = m.id
  AND m.exam_format = 'TELC'
  AND m.title = 'telc Deutsch B1 — Đề số 2'
  AND e.teil_key IN ('SPRACHBAUSTEINE-2')
  AND e.body->'items'->'SB2-39' IS NOT NULL;
