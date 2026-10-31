-- ============================================================
-- V350: Nháp lớp nghề Điều dưỡng + Xây dựng (31/10/2026, đợt 2f định hướng A + B + E)
--
-- Soạn sẵn thay vì bấm "Sinh" trên prod, theo đúng luật của OccupationContentGenerator:
-- 6 câu (2 dễ, 2 vừa, 2 khó) + 6 từ, xưng Sie, không hỏi có/không, không đụng chủ đề AGG.
-- status mặc định AI_GENERATED: nháp vào hàng duyệt /v2/admin/occupation-review, trang nghề giữ
-- "chưa duyệt" (không index) cho tới khi người duyệt bấm APPROVED đủ 3 câu.
-- Bản đọc để duyệt nằm ở plans/2026-10-31-2f-nhap-dieu-duong-xay-dung-de-duyet.md (local).
--
-- Nghề đã có câu (bộ sinh chạy trước migration này) thì không chèn câu, không trộn hai bộ.
-- Phụ thuộc: số này đứng sau V349 của PR #734, PR đó phải lên prod trước.
-- ============================================================

-- Điều dưỡng (Pflegefachmann/-frau)
INSERT INTO occupation_question (id, occupation_code, topic_key, question_de, question_vi, question_en, difficulty, source_model)
SELECT v.id, 'pflegefachkraft', v.topic_key, v.question_de, v.question_vi, v.question_en, v.difficulty, 'claude-nhap-2f'
FROM (VALUES
    ('occ_pflegefachkraft_2f1', 'grundpflege', 'Wie unterstützen Sie eine pflegebedürftige Person bei der Körperpflege, ohne ihre Selbstständigkeit zu übergehen?',
     'Bạn hỗ trợ người cần chăm sóc vệ sinh cá nhân như thế nào mà vẫn tôn trọng khả năng tự lập của họ?',
     'How do you help a person in care with personal hygiene without overriding their independence?', 'BEGINNER'),
    ('occ_pflegefachkraft_2f2', 'vitalzeichen', 'Welche Vitalzeichen erheben Sie im Frühdienst, und wie dokumentieren Sie die Werte?',
     'Trong ca sáng bạn đo những dấu hiệu sinh tồn nào và ghi lại các chỉ số ra sao?',
     'Which vital signs do you take on the early shift, and how do you record the values?', 'BEGINNER'),
    ('occ_pflegefachkraft_2f3', 'medikamentengabe', 'Wie stellen Sie sicher, dass bei der Medikamentengabe keine Verwechslung passiert?',
     'Bạn làm thế nào để bảo đảm không xảy ra nhầm lẫn khi cho người bệnh dùng thuốc?',
     'How do you make sure no mix-up happens when you give out medication?', 'INTERMEDIATE'),
    ('occ_pflegefachkraft_2f4', 'dekubitusprophylaxe', 'Welche Maßnahmen ergreifen Sie, um bei bettlägerigen Patientinnen und Patienten einen Dekubitus zu verhindern?',
     'Bạn áp dụng những biện pháp nào để phòng loét tì đè cho người bệnh nằm liệt giường?',
     'What measures do you take to prevent pressure ulcers in bedridden patients?', 'INTERMEDIATE'),
    ('occ_pflegefachkraft_2f5', 'akute_verschlechterung', 'Beschreiben Sie, wie Sie handeln, wenn sich der Zustand eines Patienten während Ihres Dienstes plötzlich verschlechtert.',
     'Hãy mô tả bạn xử lý thế nào khi tình trạng của người bệnh đột ngột xấu đi trong ca trực.',
     'Describe how you act when a patient''s condition suddenly gets worse during your shift.', 'ADVANCED'),
    ('occ_pflegefachkraft_2f6', 'aerztliche_anordnung', 'Wie gehen Sie vor, wenn Sie eine ärztliche Anordnung für unklar oder fehlerhaft halten?',
     'Bạn làm gì khi thấy một y lệnh không rõ ràng hoặc có thể sai?',
     'What do you do when you think a doctor''s order is unclear or wrong?', 'ADVANCED')
) AS v(id, topic_key, question_de, question_vi, question_en, difficulty)
WHERE NOT EXISTS (SELECT 1 FROM occupation_question q WHERE q.occupation_code = 'pflegefachkraft');

INSERT INTO occupation_term (occupation_code, term_de, meaning_en, meaning_vi, example_de, source_model)
VALUES
    ('pflegefachkraft', 'die Grundpflege', 'basic nursing care', 'chăm sóc cơ bản',
     'In der Grundpflege achte ich auf die Selbstständigkeit der Patienten.', 'claude-nhap-2f'),
    ('pflegefachkraft', 'die Vitalzeichen', 'vital signs', 'dấu hiệu sinh tồn',
     'Die Vitalzeichen kontrolliere ich zu Beginn jedes Dienstes.', 'claude-nhap-2f'),
    ('pflegefachkraft', 'die Dienstübergabe', 'shift handover', 'bàn giao ca',
     'Bei der Dienstübergabe nenne ich alle wichtigen Veränderungen.', 'claude-nhap-2f'),
    ('pflegefachkraft', 'die Pflegedokumentation', 'nursing documentation', 'hồ sơ điều dưỡng',
     'Jede Maßnahme trage ich sofort in die Pflegedokumentation ein.', 'claude-nhap-2f'),
    ('pflegefachkraft', 'die Dekubitusprophylaxe', 'pressure ulcer prevention', 'phòng loét tì đè',
     'Zur Dekubitusprophylaxe gehört regelmäßiges Umlagern.', 'claude-nhap-2f'),
    ('pflegefachkraft', 'die Wundversorgung', 'wound care', 'chăm sóc vết thương',
     'Die Wundversorgung führe ich nach ärztlicher Anordnung durch.', 'claude-nhap-2f')
ON CONFLICT (occupation_code, term_de) DO NOTHING;

-- Điều dưỡng chăm sóc người cao tuổi (Altenpfleger/in)
INSERT INTO occupation_question (id, occupation_code, topic_key, question_de, question_vi, question_en, difficulty, source_model)
SELECT v.id, 'altenpfleger', v.topic_key, v.question_de, v.question_vi, v.question_en, v.difficulty, 'claude-nhap-2f'
FROM (VALUES
    ('occ_altenpfleger_2f1', 'biografiearbeit', 'Wie lernen Sie die Gewohnheiten einer neuen Bewohnerin oder eines neuen Bewohners kennen?',
     'Bạn tìm hiểu thói quen của một người mới vào viện dưỡng lão như thế nào?',
     'How do you get to know the habits of a new resident?', 'BEGINNER'),
    ('occ_altenpfleger_2f2', 'essen_anreichen', 'Worauf achten Sie, wenn Sie einer Bewohnerin beim Essen helfen?',
     'Bạn chú ý điều gì khi giúp một người cao tuổi ăn uống?',
     'What do you pay attention to when you help a resident eat?', 'BEGINNER'),
    ('occ_altenpfleger_2f3', 'demenz', 'Wie reagieren Sie, wenn ein Bewohner mit Demenz abends unruhig wird und nach Hause möchte?',
     'Bạn phản ứng thế nào khi một người bị sa sút trí tuệ trở nên bồn chồn vào buổi tối và đòi về nhà?',
     'How do you respond when a resident with dementia gets restless in the evening and wants to go home?', 'INTERMEDIATE'),
    ('occ_altenpfleger_2f4', 'sturzprophylaxe', 'Welche Maßnahmen nutzen Sie, um Stürze bei älteren Menschen zu vermeiden?',
     'Bạn dùng những biện pháp nào để phòng té ngã cho người cao tuổi?',
     'What measures do you use to prevent falls in older people?', 'INTERMEDIATE'),
    ('occ_altenpfleger_2f5', 'angehoerigengespraech', 'Wie führen Sie ein Gespräch mit Angehörigen, die mit der Pflege unzufrieden sind?',
     'Bạn trao đổi thế nào với người nhà đang không hài lòng về việc chăm sóc?',
     'How do you handle a conversation with relatives who are unhappy with the care?', 'ADVANCED'),
    ('occ_altenpfleger_2f6', 'sterbebegleitung', 'Wie begleiten Sie einen sterbenden Bewohner und seine Angehörigen in den letzten Tagen?',
     'Bạn đồng hành thế nào với một người sắp qua đời và gia đình họ trong những ngày cuối?',
     'How do you support a dying resident and their relatives during the final days?', 'ADVANCED')
) AS v(id, topic_key, question_de, question_vi, question_en, difficulty)
WHERE NOT EXISTS (SELECT 1 FROM occupation_question q WHERE q.occupation_code = 'altenpfleger');

INSERT INTO occupation_term (occupation_code, term_de, meaning_en, meaning_vi, example_de, source_model)
VALUES
    ('altenpfleger', 'die Biografiearbeit', 'biographical work', 'tìm hiểu tiểu sử người được chăm sóc',
     'Durch Biografiearbeit erfahre ich, was einem Bewohner wichtig ist.', 'claude-nhap-2f'),
    ('altenpfleger', 'die Validation', 'validation therapy', 'liệu pháp thấu cảm với người sa sút trí tuệ',
     'Mit Validation nehme ich die Gefühle der Bewohner ernst.', 'claude-nhap-2f'),
    ('altenpfleger', 'die Sturzprophylaxe', 'fall prevention', 'phòng té ngã',
     'Zur Sturzprophylaxe entferne ich Stolperfallen im Zimmer.', 'claude-nhap-2f'),
    ('altenpfleger', 'die aktivierende Pflege', 'activating care', 'chăm sóc khuyến khích tự vận động',
     'Bei der aktivierenden Pflege lasse ich die Bewohner möglichst viel selbst tun.', 'claude-nhap-2f'),
    ('altenpfleger', 'der Pflegegrad', 'care level', 'mức độ cần chăm sóc',
     'Der Pflegegrad zeigt, wie viel Unterstützung jemand braucht.', 'claude-nhap-2f'),
    ('altenpfleger', 'die Palliativpflege', 'palliative care', 'chăm sóc giảm nhẹ',
     'In der Palliativpflege steht die Lebensqualität im Mittelpunkt.', 'claude-nhap-2f')
ON CONFLICT (occupation_code, term_de) DO NOTHING;

-- Thợ xây (Maurer/in)
INSERT INTO occupation_question (id, occupation_code, topic_key, question_de, question_vi, question_en, difficulty, source_model)
SELECT v.id, 'maurer', v.topic_key, v.question_de, v.question_vi, v.question_en, v.difficulty, 'claude-nhap-2f'
FROM (VALUES
    ('occ_maurer_2f1', 'werkzeug_material', 'Mit welchen Werkzeugen und Materialien arbeiten Sie beim Mauern am häufigsten?',
     'Khi xây tường, bạn thường dùng những dụng cụ và vật liệu nào nhất?',
     'Which tools and materials do you use most often when bricklaying?', 'BEGINNER'),
    ('occ_maurer_2f2', 'arbeitsschutz', 'Welche Schutzausrüstung tragen Sie auf der Baustelle, und wann ist sie besonders wichtig?',
     'Bạn mang đồ bảo hộ nào trên công trường và lúc nào chúng đặc biệt quan trọng?',
     'What protective equipment do you wear on site, and when is it especially important?', 'BEGINNER'),
    ('occ_maurer_2f3', 'lot_und_flucht', 'Wie prüfen Sie, ob eine Wand lot- und fluchtgerecht gemauert ist?',
     'Bạn kiểm tra thế nào để biết bức tường đã xây thẳng đứng và đúng hàng?',
     'How do you check that a wall has been built plumb and in line?', 'INTERMEDIATE'),
    ('occ_maurer_2f4', 'bauplan', 'Welche Angaben entnehmen Sie dem Bauplan, bevor Sie mit einer neuen Wand beginnen?',
     'Trước khi bắt đầu xây một bức tường mới, bạn lấy những thông tin nào từ bản vẽ?',
     'What information do you take from the construction plan before you start a new wall?', 'INTERMEDIATE'),
    ('occ_maurer_2f5', 'witterungsschutz', 'Wie schützen Sie frisches Mauerwerk bei Frost oder starkem Regen?',
     'Bạn bảo vệ khối xây mới như thế nào khi có sương giá hoặc mưa to?',
     'How do you protect fresh masonry during frost or heavy rain?', 'ADVANCED'),
    ('occ_maurer_2f6', 'massabweichung', 'Was tun Sie, wenn Sie merken, dass eine bereits gemauerte Wand nicht den Maßen im Plan entspricht?',
     'Bạn làm gì khi phát hiện bức tường đã xây không đúng kích thước trên bản vẽ?',
     'What do you do when you notice that a finished wall does not match the dimensions in the plan?', 'ADVANCED')
) AS v(id, topic_key, question_de, question_vi, question_en, difficulty)
WHERE NOT EXISTS (SELECT 1 FROM occupation_question q WHERE q.occupation_code = 'maurer');

INSERT INTO occupation_term (occupation_code, term_de, meaning_en, meaning_vi, example_de, source_model)
VALUES
    ('maurer', 'das Mauerwerk', 'masonry', 'khối xây',
     'Das Mauerwerk muss vor Frost geschützt werden.', 'claude-nhap-2f'),
    ('maurer', 'der Mörtel', 'mortar', 'vữa',
     'Den Mörtel mische ich nach Vorgabe des Herstellers.', 'claude-nhap-2f'),
    ('maurer', 'die Maurerkelle', 'bricklayer''s trowel', 'bay thợ xây',
     'Mit der Maurerkelle trage ich den Mörtel gleichmäßig auf.', 'claude-nhap-2f'),
    ('maurer', 'die Wasserwaage', 'spirit level', 'thước thủy',
     'Mit der Wasserwaage prüfe ich jede Steinreihe.', 'claude-nhap-2f'),
    ('maurer', 'der Bauplan', 'construction plan', 'bản vẽ thi công',
     'Im Bauplan sehe ich die genauen Maße der Wand.', 'claude-nhap-2f'),
    ('maurer', 'das Gerüst', 'scaffolding', 'giàn giáo',
     'Vor der Arbeit prüfe ich, ob das Gerüst sicher steht.', 'claude-nhap-2f')
ON CONFLICT (occupation_code, term_de) DO NOTHING;

-- Phụ hồ (Bauhelfer/in)
INSERT INTO occupation_question (id, occupation_code, topic_key, question_de, question_vi, question_en, difficulty, source_model)
SELECT v.id, 'bauhelfer', v.topic_key, v.question_de, v.question_vi, v.question_en, v.difficulty, 'claude-nhap-2f'
FROM (VALUES
    ('occ_bauhelfer_2f1', 'baustellenaufgaben', 'Welche Aufgaben haben Sie auf einer Baustelle bisher übernommen?',
     'Cho đến nay bạn đã đảm nhận những việc gì trên công trường?',
     'What tasks have you taken on at a construction site so far?', 'BEGINNER'),
    ('occ_bauhelfer_2f2', 'schutzausruestung', 'Welche persönliche Schutzausrüstung brauchen Sie bei Ihrer Arbeit auf der Baustelle?',
     'Bạn cần những đồ bảo hộ cá nhân nào khi làm việc trên công trường?',
     'What personal protective equipment do you need for your work on site?', 'BEGINNER'),
    ('occ_bauhelfer_2f3', 'baustoffe_transport', 'Wie lagern und transportieren Sie schwere Baustoffe, ohne sich oder andere zu gefährden?',
     'Bạn xếp và vận chuyển vật liệu nặng thế nào để không gây nguy hiểm cho mình và người khác?',
     'How do you store and move heavy building materials without putting yourself or others at risk?', 'INTERMEDIATE'),
    ('occ_bauhelfer_2f4', 'arbeitsanweisung', 'Was tun Sie, wenn Sie eine Arbeitsanweisung Ihres Poliers nicht genau verstanden haben?',
     'Bạn làm gì khi chưa hiểu rõ chỉ dẫn công việc của đốc công?',
     'What do you do when you have not fully understood your foreman''s instruction?', 'INTERMEDIATE'),
    ('occ_bauhelfer_2f5', 'gefahrensituation', 'Wie reagieren Sie, wenn Sie auf der Baustelle eine gefährliche Situation bemerken?',
     'Bạn phản ứng thế nào khi phát hiện một tình huống nguy hiểm trên công trường?',
     'How do you respond when you notice a dangerous situation on site?', 'ADVANCED'),
    ('occ_bauhelfer_2f6', 'betonieren', 'Worauf achten Sie, wenn Sie beim Mischen und Einbringen von Beton helfen?',
     'Bạn chú ý điều gì khi phụ trộn và đổ bê tông?',
     'What do you pay attention to when you help mix and pour concrete?', 'ADVANCED')
) AS v(id, topic_key, question_de, question_vi, question_en, difficulty)
WHERE NOT EXISTS (SELECT 1 FROM occupation_question q WHERE q.occupation_code = 'bauhelfer');

INSERT INTO occupation_term (occupation_code, term_de, meaning_en, meaning_vi, example_de, source_model)
VALUES
    ('bauhelfer', 'der Polier', 'site foreman', 'đốc công',
     'Bei Fragen wende ich mich direkt an den Polier.', 'claude-nhap-2f'),
    ('bauhelfer', 'die Schubkarre', 'wheelbarrow', 'xe cút kít',
     'Mit der Schubkarre bringe ich den Sand zum Mischer.', 'claude-nhap-2f'),
    ('bauhelfer', 'der Beton', 'concrete', 'bê tông',
     'Der Beton muss schnell verarbeitet werden.', 'claude-nhap-2f'),
    ('bauhelfer', 'die persönliche Schutzausrüstung', 'personal protective equipment', 'đồ bảo hộ cá nhân',
     'Ohne persönliche Schutzausrüstung betrete ich die Baustelle nicht.', 'claude-nhap-2f'),
    ('bauhelfer', 'die Baugrube', 'excavation pit', 'hố móng',
     'Die Baugrube sichere ich mit einer Absperrung.', 'claude-nhap-2f'),
    ('bauhelfer', 'der Baustoff', 'building material', 'vật liệu xây dựng',
     'Jeden Baustoff lagere ich trocken und sicher.', 'claude-nhap-2f')
ON CONFLICT (occupation_code, term_de) DO NOTHING;
