-- Gói C — phần Viết của đề telc B1 Set 1 đúng dạng đề thật hiện hành (17/09/2026).
--
-- Đối chiếu V325 với Übungstest telc 2020 và 35 đề thật tái dựng:
--   • V325 là THƯ KHIẾU NẠI trang trọng gửi Kundenservice, không có văn bản kích thích, Anweisung
--     đòi „circa 100 Wörter", bốn Leitpunkte in theo thứ tự hợp lý.
--   • Đề thật (2020 →): luôn là E-MAIL XƯNG DU trả lời E-Mail của một người bạn, in nguyên văn
--     E-Mail đó phía trên; bốn Leitpunkte theo khuôn ổn định (phản hồi đề nghị · kể về mình ·
--     lời khuyên/đề xuất · tin mới) in XÁO thứ tự và Anweisung đòi „eine passende Reihenfolge"
--     (chấm ở Kriterium II); KHÔNG quy định số từ; không đòi Datum.
--
-- Khoá mới ở cấp Teil: `stimulus {type: EMAIL|AD|LETTER, from, subject, body}` (trình chạy in như
-- khung mail/mẩu tin), `shuffle_points: true` (trình chạy xáo `writing_points` bằng hạt giống cố
-- định theo nội dung — cùng một đề luôn ra cùng một thứ tự, như tờ đề in). Seed lưu Leitpunkte
-- theo THỨ TỰ HỢP LÝ để AI chấm Kriterium II biết thứ tự nào là hợp lý. `prompt` giữ một dòng ngắn
-- để trình chạy cũ (chưa biết `stimulus`) vẫn hiện ô nhập. Đề Goethe không khai ⇒ như cũ.
--
-- Gợi ý độ dài 120–180 từ chỉ nằm trong `instruction_vi` — Anweisung tiếng Đức không ghi số từ,
-- đúng như đề thật. Nội dung SOẠN GỐC (repo PUBLIC). 🪤 Dấu cách sau $j$ là BẮT BUỘC.

UPDATE mock_exams
SET sections_json = jsonb_set(sections_json, '{sections,3}', $j$
{
  "name": "SCHREIBEN",
  "label_vi": "Viết",
  "time_minutes": 30,
  "max_points": 45,
  "teile": [
    {
      "teil": 1,
      "instruction_de": "Ihre Freundin Lena hat Ihnen eine E-Mail geschrieben. Antworten Sie ihr. Schreiben Sie zu allen vier Punkten und überlegen Sie sich eine passende Reihenfolge der Punkte. Vergessen Sie nicht Anrede und Gruß.",
      "instruction_vi": "Viết một E-Mail xưng „du“ trả lời bạn: đủ bốn ý dưới đây, tự sắp thứ tự cho hợp lý, có lời chào đầu và cuối. Bốn ý in không theo thứ tự — như tờ đề thật. Gợi ý độ dài: 120–180 từ (bài mẫu 300–400 từ trên mạng là quá dài cho 30 phút).",
      "prompt": "Ihre Freundin Lena hat Ihnen geschrieben. Antworten Sie ihr.",
      "stimulus": {
        "type": "EMAIL",
        "from": "Lena",
        "subject": "Besuch im Juli?",
        "body": "Hallo!\n\nWie geht's dir? Ich habe endlich Urlaub bekommen – zwei Wochen im Juli! Ich würde dich so gern besuchen und deine neue Stadt endlich richtig kennenlernen. Passt dir das im Juli, oder hast du da schon etwas vor?\n\nViel Geld habe ich leider nicht gespart, deshalb suche ich etwas Günstiges zum Übernachten. Hast du eine Idee? Und was sollte ich unbedingt sehen oder machen, wenn ich bei dir bin?\n\nErzähl doch mal, wie es dir seit dem Umzug geht – wir haben in letzter Zeit kaum geschrieben.\n\nLiebe Grüße\nLena"
      },
      "shuffle_points": true,
      "writing_points": [
        "Reaktion auf Lenas Vorschlag: Passt der Besuch im Juli?",
        "Etwas über Ihre neue Stadt und wie es Ihnen dort gefällt",
        "Ein Tipp, wo Lena günstig übernachten kann",
        "Was es bei Ihnen Neues gibt"
      ]
    }
  ]
}
$j$::jsonb)
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 1'
  AND jsonb_array_length(sections_json->'sections') = 4
  AND sections_json->'sections'->3->>'name' = 'SCHREIBEN';
