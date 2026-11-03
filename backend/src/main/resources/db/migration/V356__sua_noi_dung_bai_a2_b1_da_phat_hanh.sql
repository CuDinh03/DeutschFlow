-- V356: Sửa lỗi nội dung 9 bài đã phát hành: ngày 31, 35, 39, 40 (V180) và 51–55 (V181).
--
-- Lỗi nặng nhất ở ngày 52: đáp án tg52_03 và p52_03 đặt hatte trước Partizip trong câu phụ nachdem,
-- nên học viên điền đúng ngữ pháp bị chấm sai, mà dependency đòi 100% thì không qua được bài.
-- Bản đọc từng thay đổi nằm trong mô tả PR.
--
-- Chỉ thay đúng phần bị lỗi, không ghi đè cả bài. Mỗi lệnh ghi rõ giá trị cũ; giá trị hiện tại khác
-- giá trị cũ thì bỏ qua và báo WARNING để không đè lên chỉnh sửa khác và không chặn deploy.
-- Hai hàm dùng pg_temp nên không để lại gì trong schema.

CREATE FUNCTION pg_temp.thay_chuoi(p_ngay INT, p_duong_dan TEXT[], p_cu TEXT, p_moi TEXT) RETURNS VOID AS $$
DECLARE
    hien_tai TEXT;
BEGIN
    SELECT content_json #>> p_duong_dan INTO hien_tai
    FROM skill_tree_nodes
    WHERE node_type = 'CORE_TRUNK' AND day_number = p_ngay;

    IF hien_tai IS NULL OR position(p_cu IN hien_tai) = 0 THEN
        RAISE WARNING 'V356 bỏ qua ngày %, % không chứa: %', p_ngay, p_duong_dan, p_cu;
        RETURN;
    END IF;

    UPDATE skill_tree_nodes
    SET content_json = jsonb_set(content_json, p_duong_dan, to_jsonb(replace(hien_tai, p_cu, p_moi)))
    WHERE node_type = 'CORE_TRUNK' AND day_number = p_ngay;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.sua_muc(p_ngay INT, p_mang TEXT[], p_id TEXT, p_cu JSONB, p_moi JSONB) RETURNS VOID AS $$
DECLARE
    vi_tri INT;
    muc JSONB;
BEGIN
    SELECT (e.thu_tu - 1)::int, e.gia_tri INTO vi_tri, muc
    FROM skill_tree_nodes n,
         jsonb_array_elements(n.content_json #> p_mang) WITH ORDINALITY AS e(gia_tri, thu_tu)
    WHERE n.node_type = 'CORE_TRUNK' AND n.day_number = p_ngay AND e.gia_tri ->> 'id' = p_id;

    IF muc IS NULL OR NOT muc @> p_cu THEN
        RAISE WARNING 'V356 bỏ qua ngày %, mục % không khớp giá trị cũ', p_ngay, p_id;
        RETURN;
    END IF;

    UPDATE skill_tree_nodes
    SET content_json = jsonb_set(content_json, p_mang || vi_tri::text, muc || p_moi)
    WHERE node_type = 'CORE_TRUNK' AND day_number = p_ngay;
END;
$$ LANGUAGE plpgsql;

-- ─── Ngày 31: Dativ ──────────────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(31, '{theory_cards,1,content,vi}',
    'Ich gehe nach der Arbeit.', 'Ich gehe nach der Arbeit nach Hause.');
SELECT pg_temp.thay_chuoi(31, '{vocabulary,2,ai_speech_hints,ipa_target}', 'ɡəˈfɛlən', 'ɡəˈfalən');
SELECT pg_temp.thay_chuoi(31, '{audio_content,listen_dialogue}',
    'Gehen Sie geradeaus, dann links. — Danke, das ist sehr nett von Ihnen!',
    'Geh geradeaus, dann links. — Danke, das ist sehr nett von dir!');

-- ─── Ngày 35: Nebensätze ─────────────────────────────────────────────────────
SELECT pg_temp.sua_muc(35, '{exercises,practice}', 'p35_02',
    '{"words":["dass","ist.","Er","weiß,","du","krank"],"correct_order":["Er","weiß,","dass","du","krank","ist."]}',
    '{"words":["dass","bist.","Er","weiß,","du","krank"],"correct_order":["Er","weiß,","dass","du","krank","bist."]}');
SELECT pg_temp.thay_chuoi(35, '{reading_passage,text_de}',
    'weil mir die Zeit läuft.', 'weil mir die Zeit davonläuft.');
SELECT pg_temp.sua_muc(35, '{reading_passage,questions}', 'rq35_01',
    '{"accept_also":["eine Stelle bewerben"]}',
    '{"accept_also":["sich um eine Stelle bewerben"]}');

-- ─── Ngày 39: Konjunktiv II ──────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(39, '{examples,0,german}',
    'Würden Sie auch eine Vorspeise möchten?', 'Hätten Sie auch gern eine Vorspeise?');
SELECT pg_temp.thay_chuoi(39, '{audio_content,listen_dialogue}', 'Das wäre einfach!', 'Das ist ganz einfach!');

-- ─── Ngày 40: Passiv Präsens ─────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(40, '{theory_cards,0,content,vi}', 'ik werde', 'ich werde');
SELECT pg_temp.thay_chuoi(40, '{theory_cards,0,content,vi}', 'PartizipII', 'Partizip II');

-- ─── Ngày 51: Indirekte Rede ─────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(51, '{theory_cards,1,content,vi}', 'ik sei', 'ich sei');
SELECT pg_temp.thay_chuoi(51, '{phrases,0,speak_de}', 'Er sagt, dass er morgen kommt.', 'Er sagt, er komme morgen.');
-- Thẻ lý thuyết của bài dạy cả dass + Konjunktiv I nên phương án 0 không sai. Đổi đề thành tìm câu sai.
SELECT pg_temp.sua_muc(51, '{exercises,theory_gate}', 'tg51_04',
    '{"question_vi":"Câu nào đúng?","options":["Er sagt, dass er komme.","Er sagt, dass er kommt.","Er sagt, er kommt.","Er sagt, kommt er."],"correct":1}',
    '{"question_vi":"Câu nào SAI ngữ pháp?","options":["Er sagt, dass er komme.","Er sagt, dass er kommt.","Er sagt, er komme.","Er sagt, dass kommt er."],"correct":3}');
SELECT pg_temp.sua_muc(51, '{exercises,practice}', 'p51_02',
    '{"words":["komme.","er","sagt,","morgen","Er"]}',
    '{"words":["komme","er","sagt,","morgen.","Er"]}');

-- ─── Ngày 52: Plusquamperfekt ────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(52, '{vocabulary,0,ai_speech_hints,focus_phonemes,0}', 'ˈnaːxdeːm', 'naːxˈdeːm');
SELECT pg_temp.thay_chuoi(52, '{vocabulary,0,ai_speech_hints,ipa_target}', 'ˈnaːxdeːm', 'naːxˈdeːm');
SELECT pg_temp.thay_chuoi(52, '{examples,0,german}', 'Vorhin war die Situation', 'Vorher war die Situation');
SELECT pg_temp.thay_chuoi(52, '{examples,0,german}', 'war er bereits besser.', 'ging es ihm bereits besser.');
SELECT pg_temp.sua_muc(52, '{exercises,theory_gate}', 'tg52_03',
    '{"sentence_de":"Nachdem sie ___ ___, feierte sie. (bestehen - Perf. mit haben)","hint_vi":"hatte bestanden","answer":"hatte, bestanden","accept_also":["hatte / bestanden"]}',
    '{"sentence_de":"Nachdem sie die Prüfung ___ ___, feierte sie. (bestehen - Plusquamperfekt)","hint_vi":"nachdem đẩy động từ chia về cuối câu: bestanden hatte","answer":"bestanden, hatte","accept_also":["bestanden / hatte"]}');
SELECT pg_temp.sua_muc(52, '{exercises,theory_gate}', 'tg52_04',
    '{"sentence_de":"Als ich aufwachte, ___ sie schon ___ ___. (abfahren - sein)"}',
    '{"sentence_de":"Als ich aufwachte, ___ sie schon ___. (abfahren - sein)"}');
SELECT pg_temp.sua_muc(52, '{exercises,practice}', 'p52_02',
    '{"words":["hatte","schon","Wir","Als","er","ankam,","gegessen."]}',
    '{"words":["hatten","schon","wir","Als","er","ankam,","gegessen."]}');
SELECT pg_temp.sua_muc(52, '{exercises,practice}', 'p52_03',
    '{"sentence_de":"Nachdem ich den Brief ___ ___, schickte ich ihn ab. (schreiben - Perf.)","hint_vi":"hatte geschrieben","answer":"hatte, geschrieben","accept_also":["hatte / geschrieben"]}',
    '{"sentence_de":"Nachdem ich den Brief ___ ___, schickte ich ihn ab. (schreiben - Plusquamperfekt)","hint_vi":"nachdem đẩy động từ chia về cuối câu: geschrieben hatte","answer":"geschrieben, hatte","accept_also":["geschrieben / hatte"]}');

-- ─── Ngày 53: Modalverben ────────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(53, '{theory_cards,2,content,vi}', 'thích (something always true)', 'thích (nói chung, lâu dài)');
SELECT pg_temp.thay_chuoi(53, '{examples,0,german}',
    'Aber Sie dürfen nicht die Deadline verpassen!', 'Aber Sie dürfen die Deadline nicht verpassen!');
-- Câu đề đã có sẵn nicht, phương án "darfst nicht" ghép vào thành hai lần nicht.
SELECT pg_temp.sua_muc(53, '{exercises,theory_gate}', 'tg53_01',
    '{"options":["musst nicht","darfst nicht","sollst nicht","willst nicht"],"correct":1}',
    '{"options":["musst","darfst","sollst","willst"]}');

-- ─── Ngày 54: Thư trang trọng ────────────────────────────────────────────────
-- Tiếng Đức không đặt dấu phẩy sau lời kết thư, đây lại là bài dạy đúng phần đó.
SELECT pg_temp.thay_chuoi(54, '{theory_cards,0,content,vi}', 'Mit freundlichen Grüßen,', 'Mit freundlichen Grüßen');
SELECT pg_temp.thay_chuoi(54, '{theory_cards,1,content,vi}', 'Bitte nehmen Sie mich in Betracht.', 'Bitte ziehen Sie mich in Betracht.');
SELECT pg_temp.thay_chuoi(54, '{theory_cards,2,content,vi}', 'ichm schreibe', 'ich schreibe');
SELECT pg_temp.thay_chuoi(54, '{theory_cards,2,content,vi}', 'Mit freundlichen Grüßen,', 'Mit freundlichen Grüßen');
SELECT pg_temp.thay_chuoi(54, '{examples,0,german}', 'Mit freundlichen Grüßen,', 'Mit freundlichen Grüßen');
SELECT pg_temp.thay_chuoi(54, '{reading_passage,text_de}', 'Ich schreibe Ihnen bezüglich', 'ich schreibe Ihnen bezüglich');
SELECT pg_temp.thay_chuoi(54, '{reading_passage,text_de}', 'Mit freundlichen Grüßen,', 'Mit freundlichen Grüßen');
SELECT pg_temp.thay_chuoi(54, '{writing_prompt,example_answer}', 'Mit freundlichen Grüßen,', 'Mit freundlichen Grüßen');
SELECT pg_temp.sua_muc(54, '{reading_passage,questions}', 'rq54_01',
    '{"accept_also":["Geld zurück","Ersatzkurs"]}',
    '{"accept_also":["Rückerstattung","Geld zurück","Ersatzkurs"]}');

-- ─── Ngày 55: Diskutieren ────────────────────────────────────────────────────
SELECT pg_temp.thay_chuoi(55, '{vocabulary,1,ai_speech_hints,common_errors_vi,0}',
    'zu-STIM-men: trennbar', 'ZU-stim-men: trennbar, nhấn ZU');

DROP FUNCTION pg_temp.thay_chuoi(INT, TEXT[], TEXT, TEXT);
DROP FUNCTION pg_temp.sua_muc(INT, TEXT[], TEXT, JSONB, JSONB);
