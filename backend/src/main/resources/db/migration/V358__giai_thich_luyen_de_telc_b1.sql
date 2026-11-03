-- Giải thích cho chế độ luyện đề telc B1 (03/11/2026) — Đề số 1–3, phần Đọc và Sprachbausteine.
--
-- Mỗi hàng là một Teil (khoá `TÊN_PHẦN-số` như MockExamPracticeService). Thân JSON:
--   options.<chữ cái>.meaning_vi     nghĩa của lựa chọn trong kho dùng chung (tiêu đề, rao vặt, hộp từ)
--   options.<chữ cái>.distractor_vi  vì sao lựa chọn thừa không hợp câu nào
--   items.<id>.gist_vi               ý chính của bài / tình huống
--   items.<id>.evidence              cụm trong bài chứng minh đáp án (chép NGUYÊN VĂN để tô được)
--   items.<id>.need_vi, rule_vi      chỗ trống cần loại từ gì, quy tắc nào
--   items.<id>.wrong.<chữ cái>       vì sao phương án đó sai + nhãn loại bẫy
-- "Vì sao đúng" vẫn là `explanation_vi` trong đề; phương án sai chưa có ý riêng thì backend ráp câu
-- từ meaning_vi + gist_vi/need_vi (PracticeAnalysis).
--
-- Nội dung soạn gốc cho đề soạn gốc; owner duyệt bằng cách làm thử trên production (quyết định
-- 03/11/2026). Sửa nội dung: viết migration mới ghi đè đúng hàng (ON CONFLICT … DO UPDATE).
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

-- ═══════════════════════════ Đề số 2 ═══════════════════════════

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-1', $j$
{
  "options": {
    "a": { "meaning_vi": "thư viện mở khoá tiếng Đức có thi cuối khoá", "distractor_vi": "Gần text 2 vì cùng ở thư viện, nhưng quán cà phê ngôn ngữ ở đó „ohne Unterricht und ohne Noten“ — không lớp học, không thi." },
    "b": { "meaning_vi": "sửa đồ thay vì vứt, tình nguyện viên giúp khách tự sửa" },
    "c": { "meaning_vi": "xe buýt đêm cuối tuần chạy tới sáng" },
    "d": { "meaning_vi": "tiểu thương phải rời khu chợ cũ", "distractor_vi": "Gần text 1 vì cùng nói về khu chợ, nhưng chợ MỞ LẠI và tiểu thương mong đông khách, không ai phải rời đi." },
    "e": { "meaning_vi": "hội học sinh đề xuất ngày không điện thoại và có kết quả tốt" },
    "f": { "meaning_vi": "đi xe buýt ban đêm đắt hơn", "distractor_vi": "Gần text 3 vì cùng nói về xe buýt đêm, nhưng bài ghi „Die Fahrpreise bleiben gleich“ — giá vé giữ nguyên." },
    "g": { "meaning_vi": "thực phẩm địa phương trong khu chợ vừa sửa xong" },
    "h": { "meaning_vi": "trường cấm điện thoại hoàn toàn", "distractor_vi": "Gần text 4, nhưng điện thoại chỉ bị cất hai ngày mỗi tuần, không phải cấm hoàn toàn." },
    "i": { "meaning_vi": "người mới đến luyện nói không áp lực ở quán cà phê ngôn ngữ" },
    "j": { "meaning_vi": "cửa hàng mới bán đồ điện cũ giá rẻ", "distractor_vi": "Gần text 5 vì cùng nói về đồ điện cũ, nhưng ở Repair Café không ai bán gì — khách tự sửa đồ của mình." }
  },
  "items": {
    "LV1-1": { "gist_vi": "khu chợ có mái che mở lại sau hai năm sửa, bán chủ yếu thực phẩm từ nông trại trong vùng",
      "evidence": ["Nach zwei Jahren Umbau öffnet die alte Markthalle", "Lebensmittel von Bauernhöfen aus der Region"],
      "wrong": { "d": { "why_vi": "„verlassen“ nghĩa là tiểu thương phải rời chợ. Bài nói ngược lại: chợ mở cửa lại và các tiểu thương mong nơi này lại thành chỗ hẹn của cả trung tâm.", "trap": "Bẫy cùng chủ đề" } } },
    "LV1-2": { "gist_vi": "người mới đến Đức gặp tình nguyện viên ở thư viện để luyện nói, không học, không chấm điểm",
      "evidence": ["Menschen, die neu in Deutschland sind", "ganz ohne Unterricht und ohne Noten das Sprechen"],
      "wrong": { "a": { "why_vi": "Tiêu đề a nói về KHOÁ HỌC có THI cuối khoá. Bài nói rõ „ohne Unterricht und ohne Noten“ — không lớp học, không điểm, càng không có kỳ thi. Chữ „Bibliothek“ xuất hiện ở cả hai nên dễ chọn vội.", "trap": "Bẫy cùng chủ đề" } } },
    "LV1-3": { "gist_vi": "từ tháng Ba xe buýt đêm thứ Sáu, thứ Bảy chạy suốt đêm, giá vé không đổi",
      "evidence": ["freitags und samstags", "die ganze Nacht im Stundentakt"],
      "wrong": { "f": { "why_vi": "„teurer“ là đắt hơn. Bài nói „Die Fahrpreise bleiben gleich“ — giá vé giữ nguyên. Cùng chủ đề xe buýt đêm nhưng sai đúng ở chi tiết giá.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-4": { "gist_vi": "hội học sinh tự đề xuất hai ngày không điện thoại mỗi tuần, sau ba tháng kết quả tốt",
      "evidence": ["Die Idee kam von der Schülervertretung selbst", "Nach drei Monaten ist das Ergebnis positiv"],
      "wrong": { "h": { "why_vi": "„komplett verbieten“ là cấm hoàn toàn. Bài chỉ cất điện thoại „an zwei Tagen pro Woche“, và ý tưởng đến từ học sinh chứ không phải nhà trường áp đặt.", "trap": "Bẫy phóng đại" } } },
    "LV1-5": { "gist_vi": "Repair Café: tình nguyện viên giúp khách tự sửa đồ hỏng thay vì vứt đi, không mất tiền",
      "evidence": ["repariert statt weggeworfen", "ihre Sachen selbst wieder in Ordnung zu bringen"],
      "wrong": { "j": { "why_vi": "Tiêu đề j nói về cửa hàng BÁN đồ điện cũ. Ở Repair Café không ai bán gì: khách mang đồ hỏng đến để tự sửa và không phải trả tiền.", "trap": "Bẫy cùng chủ đề" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 2'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-2', $j$
{
  "items": {
    "LV2-6": { "evidence": ["Besonders Männer fehlen", "Nur jeder fünfte Leih-Großelternteil ist ein Opa"],
      "wrong": {
        "a": { "why_vi": "Gia đình trẻ thì thừa: hơn một trăm gia đình đang chờ. Hội thiếu người lớn tuổi, không thiếu gia đình.", "trap": "Bẫy ngược nghĩa" },
        "c": { "why_vi": "Bà Brandes là cựu giáo viên, nhưng bài không nói hội đi tìm riêng giáo viên nghỉ hưu. Hội đang tìm ĐÀN ÔNG ở câu lạc bộ thể thao và buổi gặp người cao tuổi.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" } } },
    "LV2-7": { "evidence": ["niemanden mehr", "einspringen konnte"],
      "wrong": {
        "b": { "why_vi": "Bài nói nhà mới „schnell eingerichtet“ — chuyện nhà cửa không phải vấn đề, càng không nói cần nhà rộng hơn.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" },
        "c": { "why_vi": "Bài không nói thiếu chỗ ở nhà trẻ; bé Paul vẫn đi nhà trẻ bình thường. Điều gia đình thiếu là người giúp đỡ khi con ốm." } } },
    "LV2-8": { "evidence": ["Solche Anfragen lehnt der Verein ab", "Leih-Großeltern sind keine Babysitter"],
      "wrong": {
        "a": { "why_vi": "Ngược lại: hội TỪ CHỐI những gia đình chỉ tìm người trông trẻ giá rẻ, nên không có chuyện được xếp chỗ nhanh hơn.", "trap": "Bẫy ngược nghĩa" },
        "c": { "why_vi": "Bài không nhắc tới phí nào. Yêu cầu kiểu này bị từ chối luôn, không phải trả thêm tiền để được nhận." } } },
    "LV2-9": { "evidence": ["Geld bekommt sie für ihre Besuche", "die Familie bezahlt nur die Fahrkarte und das Material"],
      "wrong": {
        "a": { "why_vi": "Bài nói „Geld bekommt sie … nicht“ — bà không nhận lương, kể cả từ hội." },
        "b": { "why_vi": "Gia đình không trả tiền công hằng tháng; họ chỉ trả vé tàu xe và vật liệu khi cùng làm đồ thủ công." } } },
    "LV2-10": { "evidence": ["ohne Begründung aufhören", "Neun von zehn Paaren bleiben"],
      "wrong": {
        "b": { "why_vi": "Bài không nói gặp mỗi ngày; bà Brandes đến thăm mỗi thứ Tư." },
        "c": { "why_vi": "Ngược với bài: „Neun von zehn Paaren bleiben zusammen“ — đa số ở lại với nhau.", "trap": "Bẫy ngược nghĩa" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 2'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-3', $j$
{
  "options": {
    "a": { "meaning_vi": "sinh viên nhận trông trẻ buổi tối và cuối tuần" },
    "b": { "meaning_vi": "bán máy giặt cũ 150 €" },
    "c": { "meaning_vi": "người đăng TÌM người làm vườn", "distractor_vi": "Người đăng tìm người giúp làm vườn — không tình huống nào cần việc này." },
    "d": { "meaning_vi": "khoá học bơi cho người lớn" },
    "e": { "meaning_vi": "hướng dẫn dùng điện thoại, máy tính cho người cao tuổi tại nhà" },
    "f": { "meaning_vi": "lớp nhảy Salsa", "distractor_vi": "Gần câu 20 vì cùng là một khoá học, nhưng là khiêu vũ chứ không phải học đàn." },
    "g": { "meaning_vi": "đưa đón sân bay, cả ban đêm và sáng sớm" },
    "h": { "meaning_vi": "tìm người thuê tiếp căn hộ 2 phòng, được nuôi thú" },
    "i": { "meaning_vi": "bán sách giáo khoa cũ lớp 7–10", "distractor_vi": "Không tình huống nào cần sách giáo khoa." },
    "j": { "meaning_vi": "thợ sửa xe đạp đến tận nhà" },
    "k": { "meaning_vi": "lớp hội thoại tiếng Anh cho người đi làm, tập gọi điện và viết e-mail" },
    "l": { "meaning_vi": "dịch vụ tiệc buffet giao tận nơi", "distractor_vi": "Là đáp án của ví dụ 01." }
  },
  "items": {
    "LV3-11": { "gist_vi": "bố 78 tuổi muốn học gửi ảnh cho cháu qua e-mail", "evidence": ["Computerhilfe für Senioren", "bei Ihnen zu Hause"],
      "wrong": { "k": { "why_vi": "Mẩu k là lớp tiếng Anh cho người đi làm. Bố bạn cần người chỉ cách dùng e-mail, không cần học tiếng Anh.", "trap": "Bẫy trùng từ" } } },
    "LV3-12": { "gist_vi": "người lớn chưa biết bơi muốn học bơi", "evidence": ["Schwimmkurs für Erwachsene"] },
    "LV3-13": { "gist_vi": "cần ra sân bay lúc 6 giờ sáng khi chưa có xe buýt", "evidence": ["Fahrdienst zum Flughafen", "auch nachts und am frühen Morgen"] },
    "LV3-14": { "gist_vi": "cần người trông con gái nhỏ tối thứ Bảy", "evidence": ["abends und am Wochenende Zeit", "Erfahrung mit Kleinkindern"] },
    "LV3-15": { "gist_vi": "xe đạp hỏng nhưng không có thời gian mang tới tiệm", "evidence": ["direkt vor Ihrer Haustür"] },
    "LV3-16": { "gist_vi": "tìm nhà được nuôi mèo", "evidence": ["Haustiere erlaubt"] },
    "LV3-17": { "gist_vi": "cần gọi điện bằng tiếng Anh tốt hơn cho công việc mới", "evidence": ["Schwerpunkt Telefonieren"],
      "wrong": { "e": { "why_vi": "Mẩu e dạy người cao tuổi dùng điện thoại, máy tính — không phải nói tiếng Anh qua điện thoại.", "trap": "Bẫy trùng từ" } } },
    "LV3-18": { "gist_vi": "máy giặt hỏng, muốn mua cái khác không tốn nhiều tiền", "evidence": ["Verkaufe Waschmaschine", "150 €"] },
    "LV3-19": { "gist_vi": "bạn muốn BÁN tủ lạnh cũ — tức là cần người MUA tủ lạnh",
      "wrong": { "b": { "why_vi": "Mẩu b là người khác đang BÁN máy giặt. Bạn cần bán tủ lạnh, tức là cần người muốn MUA — không mẩu nào như vậy.", "trap": "Bẫy ngược chiều mua/bán" } } },
    "LV3-20": { "gist_vi": "muốn tìm khoá học đàn guitar",
      "wrong": {
        "f": { "why_vi": "Mẩu f là khoá nhảy Salsa: cùng là khoá học nhưng không dạy đàn guitar.", "trap": "Bẫy cùng loại" },
        "k": { "why_vi": "Mẩu k là lớp tiếng Anh, không liên quan tới guitar.", "trap": "Bẫy cùng loại" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 2'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-1', $j$
{
  "items": {
    "SB1-21": { "need_vi": "giới từ đi trong cụm „sich an jemanden … wenden“ để nói lý do liên hệ", "rule_vi": "sich an jdn. wenden mit + Dativ",
      "wrong": {
        "b": { "why_vi": "„von“ không đi với cụm „sich an jemanden wenden“. Muốn nói mình liên hệ VÌ việc gì thì dùng „mit + Dativ“." },
        "c": { "why_vi": "„über“ đi với „sich beschweren über“ (phàn nàn về). Cụm ở đây là „sich an jemanden wenden mit“, không dùng „über“." } } },
    "SB1-22": { "need_vi": "liên từ nối hai ý NGƯỢC nhau, động từ đứng cuối câu phụ", "rule_vi": "obwohl = mặc dù",
      "wrong": {
        "a": { "why_vi": "„weil“ nêu lý do: „lò sưởi lạnh VÌ tôi vặn hết cỡ“ — vô lý. Hai vế ngược nhau nên cần liên từ nhượng bộ." },
        "c": { "why_vi": "„damit“ nêu mục đích („để …“): vặn lò sưởi để nó lạnh? Không hợp nghĩa." } } },
    "SB1-23": { "need_vi": "mạo từ Akkusativ giống đực cho „Hausmeister“", "rule_vi": "anrufen + Akkusativ",
      "wrong": {
        "a": { "why_vi": "„dem“ là Dativ. „anrufen“ cần tân ngữ Akkusativ: „jemanden anrufen“." },
        "c": { "why_vi": "„der“ là Nominativ giống đực (chủ ngữ) hoặc Dativ giống cái. Ở đây „Hausmeister“ là tân ngữ giống đực ⇒ „den“." } } },
    "SB1-24": { "need_vi": "mạo từ cho „Problem“ (giống trung) ở Akkusativ", "rule_vi": "das Problem · Akkusativ vẫn là das",
      "wrong": {
        "a": { "why_vi": "„die“ dùng cho giống cái hoặc số nhiều; „Problem“ là giống trung." },
        "b": { "why_vi": "„den“ là Akkusativ giống ĐỰC. Danh từ giống trung giữ nguyên „das“ ở Akkusativ." } } },
    "SB1-25": { "need_vi": "liên từ mở mệnh đề nội dung sau „glauben“", "rule_vi": "glauben, dass …",
      "wrong": {
        "a": { "why_vi": "„ob“ mở câu hỏi gián tiếp có/không (sau fragen, nicht wissen). Sau „glauben“ là điều mình tin ⇒ „dass“." },
        "c": { "why_vi": "„wenn“ là điều kiện hoặc thời gian, không dùng làm nội dung của „glauben“." } } },
    "SB1-26": { "need_vi": "trạng từ bổ nghĩa cho động từ „klingeln“ (không đi kèm danh từ)", "rule_vi": "trạng từ không chia đuôi",
      "wrong": {
        "b": { "why_vi": "Dạng có đuôi -e là tính từ đứng trước danh từ („eine einfache Lösung“). Ở đây không có danh từ theo sau." },
        "c": { "why_vi": "Đuôi -en cũng là tính từ đứng trước danh từ. Từ này bổ nghĩa cho động từ „klingeln“ nên giữ nguyên „einfach“." } } },
    "SB1-27": { "need_vi": "đại từ quan hệ thay cho „meine Nachbarin“, làm chủ ngữ trong câu phụ", "rule_vi": "die Nachbarin → die (Nominativ)",
      "wrong": {
        "a": { "why_vi": "„der“ dùng cho danh từ giống đực; người được nhắc là „meine Nachbarin“ (giống cái)." },
        "c": { "why_vi": "„das“ dùng cho danh từ giống trung; „Nachbarin“ là giống cái." } } },
    "SB1-28": { "need_vi": "liên từ mở câu hỏi gián tiếp có/không sau „fragen“", "rule_vi": "fragen, ob …",
      "wrong": {
        "b": { "why_vi": "Không nói „fragen, dass“. Câu hỏi gián tiếp dạng có/không luôn là „fragen, ob“." },
        "c": { "why_vi": "„wann“ hỏi THỜI ĐIỂM. Câu này hỏi có phải trả ít tiền thuê hơn không (có/không)." } } },
    "SB1-29": { "need_vi": "trợ động từ Konjunktiv II cho lời đề nghị lịch sự, khớp với „könnten“ phía sau", "rule_vi": "Ich würde mich freuen, wenn …",
      "wrong": {
        "a": { "why_vi": "„werde“ là thì tương lai. Vế sau đã dùng „könnten“ (Konjunktiv II), nên vế chính cũng phải là Konjunktiv II „würde“ — cặp lịch sự cố định." },
        "c": { "why_vi": "„wurde“ là quá khứ (Präteritum) của werden — sai thì." } } },
    "SB1-30": { "need_vi": "giới từ trong cụm cố định cuối thư", "rule_vi": "sich im Voraus bedanken",
      "wrong": {
        "b": { "why_vi": "Không có cụm „am Voraus“. Cụm cố định là „im Voraus“." },
        "c": { "why_vi": "„zum Voraus“ chỉ gặp ở tiếng Đức Thuỵ Sĩ; đề theo chuẩn „im Voraus“." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 2'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-2', $j$
{
  "options": {
    "a": { "meaning_vi": "giới từ „an + dem“ (vào ngày…, ở mép…)", "distractor_vi": "Nhiễu cặp với IM ở chỗ 31: „am Internet“ sai, phải là „im Internet“." },
    "b": { "meaning_vi": "giới từ „đến“ (mốc kết thúc)" },
    "c": { "meaning_vi": "liên từ „nếu“, mở câu phụ" },
    "d": { "meaning_vi": "giới từ „cho, vì“ + Akkusativ" },
    "e": { "meaning_vi": "giới từ „in + dem“ („trong“)" },
    "f": { "meaning_vi": "động từ khuyết thiếu „có thể“, ngôi wir/sie/Sie, hiện tại" },
    "g": { "meaning_vi": "„có thể“ ở quá khứ (Präteritum), ngôi wir/sie", "distractor_vi": "Nhiễu cặp với KÖNNEN ở chỗ 39: câu đang ở hiện tại." },
    "h": { "meaning_vi": "giới từ „với“ + Dativ" },
    "i": { "meaning_vi": "„muốn“ (lịch sự), ngôi ich/er/sie" },
    "j": { "meaning_vi": "liên từ „mặc dù“, mở câu phụ", "distractor_vi": "Nhiễu cho chỗ 36: đúng loại liên từ nhưng nghĩa „mặc dù“ không hợp." },
    "k": { "meaning_vi": "liên từ „hay, hoặc“, không đổi trật tự từ" },
    "l": { "meaning_vi": "giới từ „không kèm“ + Akkusativ" },
    "m": { "meaning_vi": "giới từ „từ … (tới nay)“ + Dativ", "distractor_vi": "Nhiễu cặp với BIS ở chỗ 35: „seit“ là mốc bắt đầu, không phải mốc kết thúc." },
    "n": { "meaning_vi": "từ để hỏi „như thế nào“, mở câu hỏi gián tiếp" },
    "o": { "meaning_vi": "„sẽ, muốn“ Konjunktiv II, ngôi wir/sie/Sie", "distractor_vi": "Nhiễu cho chỗ 37: chủ ngữ „ich“ không đi với „würden“." }
  },
  "items": {
    "SB2-31": { "need_vi": "giới từ gộp với mạo từ đứng trước „Internet“", "rule_vi": "im Internet",
      "wrong": { "a": { "why_vi": "„am“ = an + dem, dùng cho ngày („am Montag“) hoặc mép, bề mặt. Với Internet tiếng Đức luôn nói „im Internet“.", "trap": "Bẫy cặp dễ lẫn" } } },
    "SB2-32": { "need_vi": "từ để hỏi mở câu hỏi gián tiếp sau „ich weiß nicht“, động từ „kann“ ở cuối", "rule_vi": "ich weiß nicht, wie …",
      "wrong": {
        "c": { "why_vi": "„falls“ là điều kiện („nếu“). „Tôi không biết nếu tôi nấu được“ không có nghĩa; sau „weiß nicht“ cần một từ để hỏi." },
        "j": { "why_vi": "„obwohl“ (mặc dù) không đi sau „ich weiß nicht“; cần từ để hỏi „wie“ — hỏi về CÁCH nấu." } } },
    "SB2-33": { "need_vi": "liên từ nối hai khả năng trong cùng một câu hỏi, giữ nguyên trật tự „gibt es …“", "rule_vi": "câu hỏi A oder câu hỏi B",
      "wrong": { "c": { "why_vi": "„falls“ đẩy động từ xuống cuối câu, nhưng sau chỗ trống là „gibt es“ — động từ đứng ngay đầu. Chỉ liên từ không đổi trật tự như „oder“ mới vừa." } } },
    "SB2-34": { "need_vi": "giới từ đi với Akkusativ „die Lebensmittel“", "rule_vi": "ohne + Akkusativ",
      "wrong": {
        "h": { "why_vi": "„mit“ đòi Dativ: phải là „mit den Lebensmitteln“. Trong câu là „die Lebensmittel“ (Akkusativ), nên chỉ „ohne“ hợp.", "trap": "Bẫy sai cách" },
        "d": { "why_vi": "„für die Lebensmittel“ đúng ngữ pháp nhưng nghĩa thành „khoá học giá bao nhiêu CHO thực phẩm“. Người viết muốn hỏi giá khoá học KHÔNG tính thực phẩm." } } },
    "SB2-35": { "need_vi": "giới từ chỉ mốc KẾT THÚC giờ làm", "rule_vi": "bis 19 Uhr = đến 19 giờ",
      "wrong": { "m": { "why_vi": "„seit“ là mốc BẮT ĐẦU kéo dài tới nay („seit 19 Uhr“ = từ 19 giờ tới giờ). Ý câu là làm việc ĐẾN 19 giờ nên tới lớp muộn.", "trap": "Bẫy cặp dễ lẫn" } } },
    "SB2-36": { "need_vi": "liên từ điều kiện mở câu phụ, động từ „komme“ ở cuối", "rule_vi": "Falls …, (động từ) …",
      "wrong": { "j": { "why_vi": "„obwohl“ đúng loại liên từ, nhưng „MẶC DÙ tôi đến muộn thì tôi có tham gia được không?“ không hợp ý. Người viết hỏi về TRƯỜNG HỢP đến muộn ⇒ điều kiện „falls“.", "trap": "Đúng loại từ, sai nghĩa" } } },
    "SB2-37": { "need_vi": "động từ chia theo „ich“, vì cuối câu có động từ nguyên mẫu „stören“", "rule_vi": "ich möchte + Infinitiv",
      "wrong": {
        "o": { "why_vi": "„würden“ chia cho wir/sie/Sie; chủ ngữ là „Ich“ nên sai ngôi.", "trap": "Sai ngôi" },
        "f": { "why_vi": "„können“ cũng sai ngôi (với ich phải là „kann“), và nghĩa „tôi có thể không làm phiền ai“ không phải điều người viết muốn nói." } } },
    "SB2-38": { "need_vi": "giới từ đi với Dativ „meiner Freundin“", "rule_vi": "mit + Dativ · zusammen mit",
      "wrong": { "l": { "why_vi": "„ohne“ đòi Akkusativ („ohne meine Freundin“) và còn ngược nghĩa với „zusammen“ ngay sau." } } },
    "SB2-39": { "need_vi": "động từ khuyết thiếu chia theo „wir“, ở hiện tại", "rule_vi": "wir können + Infinitiv",
      "wrong": { "g": { "why_vi": "„konnten“ là quá khứ. Việc đăng ký xảy ra sau này („erst … wenn wir wissen“), nên dùng hiện tại „können“.", "trap": "Bẫy cặp dễ lẫn" } } },
    "SB2-40": { "need_vi": "giới từ cố định của „sich bedanken“", "rule_vi": "sich bedanken für + Akkusativ",
      "wrong": { "h": { "why_vi": "„sich bedanken mit“ không phải cụm cố định. Cảm ơn VÌ điều gì thì dùng „für“." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 2'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

-- ═══════════════════════════ Đề số 3 ═══════════════════════════

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-1', $j$
{
  "options": {
    "a": { "meaning_vi": "tiệm bánh lâu đời đóng cửa vĩnh viễn sau 110 năm", "distractor_vi": "Gần text 5, nhưng tiệm KHÔNG đóng: người từng học nghề ở tiệm đã tiếp quản." },
    "b": { "meaning_vi": "chợ phiên phải dời chỗ vì có công trình" },
    "c": { "meaning_vi": "thành phố bán xe đạp chở hàng cũ giá rẻ", "distractor_vi": "Gần text 2, nhưng thành phố cho MƯỢN xe miễn phí, không bán." },
    "d": { "meaning_vi": "làng thu hút một bác sĩ trẻ bằng phòng khám không tiền thuê" },
    "e": { "meaning_vi": "Bürgeramt chỉ nhận đặt hẹn online, chờ ít hơn" },
    "f": { "meaning_vi": "tiểu thương đòi ngày họp chợ mới", "distractor_vi": "Gần text 3, nhưng ngày họp chợ giữ nguyên; tiểu thương chỉ lo mất khách quen." },
    "g": { "meaning_vi": "người từng học nghề tiếp quản tiệm bánh" },
    "h": { "meaning_vi": "bệnh viện ở Köln cần gấp bác sĩ từ nông thôn", "distractor_vi": "Gần text 4, nhưng bác sĩ RỜI bệnh viện Köln về làng — không bệnh viện nào đi tìm bác sĩ." },
    "i": { "meaning_vi": "gia đình được mượn xe đạp chở hàng miễn phí" },
    "j": { "meaning_vi": "Bürgeramt bỏ hẳn đặt hẹn qua điện thoại", "distractor_vi": "Gần text 1, nhưng số điện thoại để đặt hẹn VẪN còn." }
  },
  "items": {
    "LV1-1": { "gist_vi": "Bürgeramt Köln chỉ nhận đặt hẹn qua mạng, thời gian chờ giảm từ 90 xuống 15 phút",
      "evidence": ["nur noch online buchen", "von 90 auf 15 Minuten gesunken"],
      "wrong": { "j": { "why_vi": "„abschaffen“ là bỏ hẳn. Bài nói „Für Menschen ohne Internet gibt es weiterhin eine Telefonnummer“ — số điện thoại VẪN còn, chỉ là đường dây hay bận.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-2": { "gist_vi": "gia đình được mượn miễn phí xe đạp chở hàng, giữ tối đa ba ngày",
      "evidence": ["kostenlos ein Lastenrad ausleihen", "bis zu drei Tage behalten"],
      "wrong": { "c": { "why_vi": "„verkaufen“ là bán. Thành phố cho MƯỢN miễn phí („kostenlos … ausleihen“), không bán chiếc nào.", "trap": "Bẫy cùng chủ đề" } } },
    "LV1-3": { "gist_vi": "chợ phiên phải dời sang bãi đỗ xe ít nhất một năm vì xây hầm đỗ xe; ngày họp chợ không đổi",
      "evidence": ["muss für mindestens ein Jahr umziehen", "eine neue Tiefgarage gebaut wird"],
      "wrong": { "f": { "why_vi": "Tiểu thương không đòi ngày họp chợ mới: „Die Markttage dienstags und freitags bleiben gleich“. Họ chỉ lo mất khách quen vì chỗ mới khó đi tàu điện.", "trap": "Bẫy cùng chủ đề" } } },
    "LV1-4": { "gist_vi": "làng không còn bác sĩ; xã sửa phòng khám, cho bác sĩ trẻ dùng phòng khám và nhà ở miễn phí ba năm",
      "evidence": ["keinen Hausarzt mehr", "drei Jahre lang mietfrei"],
      "wrong": { "h": { "why_vi": "Ngược chiều: bác sĩ Hartmann RỜI một bệnh viện ở Köln để về làng. Không có bệnh viện nào đi tìm bác sĩ nông thôn.", "trap": "Bẫy ngược chiều" } } },
    "LV1-5": { "gist_vi": "ông chủ định đóng tiệm bánh 110 năm, nhưng một người từng học nghề ở tiệm đã tiếp quản",
      "evidence": ["meldete sich eine frühere Auszubildende", "führt die Bäckerei seit dem ersten Mai weiter"],
      "wrong": { "a": { "why_vi": "Ông chủ CÓ định đóng cửa, nhưng câu sau mở bằng „Doch dann …“: người học nghề cũ tiếp quản và tiệm vẫn mở. Tiêu đề a chỉ đúng nửa đầu câu chuyện.", "trap": "Bẫy nửa câu chuyện" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 3'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-2', $j$
{
  "items": {
    "LV2-6": { "evidence": ["vor allem kleine Renten erhöht"],
      "wrong": {
        "a": { "why_vi": "Bài không nhắc tới thuế. Người phản đối muốn nhà nước TĂNG lương hưu thấp, không muốn người già phải đóng thêm gì." },
        "c": { "why_vi": "Bài có nói thiếu lao động lành nghề, nhưng người phản đối không đòi đào tạo thêm người trẻ; họ đòi tăng lương hưu thấp.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" } } },
    "LV2-7": { "evidence": ["drei Vormittage pro Woche"],
      "wrong": {
        "b": { "why_vi": "Ông làm ba buổi sáng mỗi tuần, không phải cả ngày mỗi ngày; bài còn nói phần lớn người lớn tuổi không muốn làm toàn thời gian." },
        "c": { "why_vi": "Ngược với bài: ông dạy sửa động cơ cũ „für die es keine Computer gibt“ — loại không dùng máy tính.", "trap": "Bẫy ngược nghĩa" } } },
    "LV2-8": { "evidence": ["dass ihnen die Arbeit Spaß macht", "Geld nicht der wichtigste Grund ist"],
      "wrong": {
        "a": { "why_vi": "Lương hưu thấp là lý do của NHIỀU người, nhưng bài nói rõ tiền „nicht der wichtigste Grund“. Câu hỏi hỏi về ĐA SỐ.", "trap": "Đúng với một số người, sai với đa số" },
        "b": { "why_vi": "Bài không nói sếp nhờ họ đi làm tiếp." } } },
    "LV2-9": { "evidence": ["Werner kennt Autos, die meine jungen Leute nur aus Büchern kennen"],
      "wrong": {
        "b": { "why_vi": "Bài không nói ông làm giá rẻ; ông chủ khen kinh nghiệm của ông và việc khách hàng tin ông." },
        "c": { "why_vi": "Không ai nói ông muốn tiếp quản xưởng; ông chỉ định làm thêm ít nhất hai năm." } } },
    "LV2-10": { "evidence": ["Schwere körperliche Arbeit ist für viele Ältere"],
      "wrong": {
        "a": { "why_vi": "Ngược với bài: người lớn tuổi mang theo nhiều kinh nghiệm, và khách hàng tin ông Kowalski.", "trap": "Bẫy ngược nghĩa" },
        "c": { "why_vi": "Bài nói họ không muốn làm toàn thời gian, nhưng không nói họ chỉ muốn làm cuối tuần." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 3'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-3', $j$
{
  "options": {
    "a": { "meaning_vi": "kèm bài tập về nhà miễn phí cho học sinh tiểu học, chiều thứ Hai–Năm" },
    "b": { "meaning_vi": "bán sofa cũ 3 chỗ, 120 €", "distractor_vi": "Gần câu 20 vì cũng là đồ nội thất cũ, nhưng đây là SOFA, không phải giường." },
    "c": { "meaning_vi": "tập yoga bên bờ sông sáng Chủ nhật", "distractor_vi": "Không tình huống nào cần tập yoga." },
    "d": { "meaning_vi": "dịch thuật có công chứng tiếng Ba Lan, Nga" },
    "e": { "meaning_vi": "tìm nữ ở ghép một phòng 16 m²", "distractor_vi": "Gần câu 19, nhưng chỉ là MỘT phòng trong nhà ở ghép và chỉ nhận phụ nữ — không hợp gia đình bốn người." },
    "f": { "meaning_vi": "chợ đồ cũ trẻ em sáng thứ Bảy" },
    "g": { "meaning_vi": "chó nhỏ tìm nhà mới có vườn" },
    "h": { "meaning_vi": "giúp điền giấy tờ (Jobcenter, Kindergeld, Wohngeld)" },
    "i": { "meaning_vi": "dàn hợp xướng tìm giọng nam" },
    "j": { "meaning_vi": "lái xe tập cùng người có kinh nghiệm cho người có bằng lâu không lái" },
    "k": { "meaning_vi": "thợ sơn nhà" },
    "l": { "meaning_vi": "nấu tiệc cho công ty, đám cưới, từ 30 người", "distractor_vi": "Là đáp án của ví dụ 01." }
  },
  "items": {
    "LV3-11": { "gist_vi": "có bằng lái mười năm nhưng chưa từng lái, giờ sợ lái", "evidence": ["Übungsfahrten mit erfahrenem Fahrer", "lange nicht gefahren"] },
    "LV3-12": { "gist_vi": "phải sơn lại nhà trước khi dọn đi", "evidence": ["Ich streiche Ihre Wohnung"] },
    "LV3-13": { "gist_vi": "cần bản dịch chính thức giấy khai sinh tiếng Ba Lan", "evidence": ["Übersetzerin für Polnisch", "beglaubigt"] },
    "LV3-14": { "gist_vi": "không hiểu mẫu đơn Kindergeld, cần người giúp", "evidence": ["Hilfe beim Ausfüllen von Formularen", "Kindergeld"] },
    "LV3-15": { "gist_vi": "con lớp hai cần kèm bài về nhà buổi chiều", "evidence": ["Hausaufgabenhilfe für Grundschüler"] },
    "LV3-16": { "gist_vi": "chồng thích hát, tìm một nhóm tập đều đặn", "evidence": ["sucht Männerstimmen", "Proben mittwochs"] },
    "LV3-17": { "gist_vi": "muốn mua quần áo cũ giá rẻ cho em bé vào cuối tuần", "evidence": ["Kinderflohmarkt", "Samstag 10–14 Uhr"] },
    "LV3-18": { "gist_vi": "con muốn nuôi thú, nhà có vườn", "evidence": ["sucht neues Zuhause mit Garten"] },
    "LV3-19": { "gist_vi": "cần một căn hộ cho gia đình bốn người",
      "wrong": { "e": { "why_vi": "Mẩu e chỉ cho thuê MỘT phòng 16 m² trong nhà ở ghép và chỉ nhận phụ nữ không hút thuốc — không phải căn hộ cho cả gia đình.", "trap": "Bẫy cùng chủ đề" } } },
    "LV3-20": { "gist_vi": "muốn mua một chiếc giường cũ",
      "wrong": { "b": { "why_vi": "Mẩu b bán SOFA cũ, không phải giường. Cùng là đồ nội thất cũ nhưng không đúng thứ cần mua.", "trap": "Bẫy cùng loại" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 3'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-1', $j$
{
  "items": {
    "SB1-21": { "need_vi": "giới từ cho buổi trong ngày „Vormittag“", "rule_vi": "am Vormittag · um + giờ",
      "wrong": {
        "a": { "why_vi": "„im“ dùng cho tháng, mùa („im Mai, im Winter“), không dùng cho buổi trong ngày." },
        "b": { "why_vi": "„um“ đi với giờ chính xác („um acht Uhr“), không đi với „Vormittag“." } } },
    "SB1-22": { "need_vi": "trạng từ bổ nghĩa cho động từ „geändert“", "rule_vi": "trạng từ không chia đuôi",
      "wrong": {
        "a": { "why_vi": "Đuôi -e là tính từ đứng trước danh từ („eine plötzliche Änderung“). Ở đây không có danh từ theo sau." },
        "c": { "why_vi": "Đuôi -er cũng là tính từ đứng trước danh từ (hoặc dạng so sánh hơn) — không hợp chỗ này." } } },
    "SB1-23": { "need_vi": "giới từ đi cặp với „von“ để chỉ một khoảng thời gian", "rule_vi": "von … bis …",
      "wrong": {
        "a": { "why_vi": "Khoảng giờ không nói „von … zu …“; luôn là „von … bis …“." },
        "b": { "why_vi": "„nach“ là sau (mốc thời gian) hoặc tới (nơi chốn), không ghép với „von“ thành khoảng giờ." } } },
    "SB1-24": { "need_vi": "liên từ mở câu hỏi gián tiếp có/không sau „fragen“", "rule_vi": "fragen, ob …",
      "wrong": {
        "a": { "why_vi": "Không nói „fragen, dass“; hỏi gián tiếp dạng có/không là „fragen, ob“." },
        "c": { "why_vi": "„wenn“ là điều kiện hoặc thời gian, không mở câu hỏi gián tiếp." } } },
    "SB1-25": { "need_vi": "liên từ mở mệnh đề nội dung sau „ich habe gesehen“ — điều người viết đã biết chắc", "rule_vi": "sehen, dass …",
      "wrong": {
        "a": { "why_vi": "„was“ là „cái gì“: „tôi đã thấy cái gì có một khoá B1“ không có nghĩa." },
        "b": { "why_vi": "„ob“ dùng khi chưa chắc có hay không. Người viết ĐÃ thấy trên web là có khoá học, nên dùng „dass“." } } },
    "SB1-26": { "need_vi": "động từ Konjunktiv II cho một giả định lịch sự (chưa được chuyển lớp)", "rule_vi": "wäre = sẽ là (giả định)",
      "wrong": {
        "b": { "why_vi": "„war“ là quá khứ: „khoá này đã lý tưởng“ — sai thời gian, người viết đang nói về việc NẾU được chuyển." },
        "c": { "why_vi": "„ist gewesen“ là Perfekt (đã từng là) — cũng sai thời gian." } } },
    "SB1-27": { "need_vi": "đại từ quan hệ cho „die Lektionen“ (số nhiều), làm tân ngữ Akkusativ của „verpassen“", "rule_vi": "số nhiều Akkusativ → die",
      "wrong": {
        "a": { "why_vi": "„denen“ là Dativ số nhiều. „verpassen“ cần Akkusativ ⇒ „die“." },
        "c": { "why_vi": "„der“ là giống đực (Nominativ) hoặc giống cái (Dativ) — không phải số nhiều Akkusativ." } } },
    "SB1-28": { "need_vi": "giới từ cố định của „etwas … etwas verwenden“", "rule_vi": "verwenden für + Akkusativ",
      "wrong": {
        "b": { "why_vi": "„an“ không đi với „verwenden“ trong nghĩa dùng tiền cho việc gì." },
        "c": { "why_vi": "„auf“ cũng không đi với „verwenden“; dùng khoản tiền CHO khoá mới ⇒ „für“." } } },
    "SB1-29": { "need_vi": "động từ nguyên mẫu sau động từ khuyết thiếu „könnten“", "rule_vi": "könnten + Infinitiv ở cuối",
      "wrong": {
        "b": { "why_vi": "„antwortet“ là dạng đã chia (er/ihr). Sau „könnten“ động từ chính luôn ở dạng nguyên mẫu." },
        "c": { "why_vi": "„geantwortet“ là Partizip II, đi với haben ở thì Perfekt, không đi sau „könnten“." } } },
    "SB1-30": { "need_vi": "giới từ trong cụm cố định „jemanden … Telefon erreichen“", "rule_vi": "am Telefon",
      "wrong": {
        "a": { "why_vi": "„im Telefon“ là „bên trong cái điện thoại“ — sai nghĩa. Liên lạc được qua điện thoại là „am Telefon“." },
        "c": { "why_vi": "Nói „beim Telefonieren“ thì được, nhưng với danh từ „Telefon“ cụm cố định là „am Telefon“." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 3'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-2', $j$
{
  "options": {
    "a": { "meaning_vi": "giới từ „an + dem“ (ngày, buổi, cuối tuần)" },
    "b": { "meaning_vi": "liên từ „vì“, động từ đứng THỨ HAI" },
    "c": { "meaning_vi": "liên từ „nếu“, mở câu phụ" },
    "d": { "meaning_vi": "giới từ „in + dem“" },
    "e": { "meaning_vi": "giới từ „với“ + Dativ", "distractor_vi": "Nhiễu cho chỗ 31: nhận mẩu tin TỪ ai là „von“, không phải „mit“." },
    "f": { "meaning_vi": "„muốn“ (lịch sự), ngôi ich/er/sie" },
    "g": { "meaning_vi": "liên từ „có … không“, mở câu hỏi gián tiếp" },
    "h": { "meaning_vi": "liên từ „mặc dù“, mở câu phụ", "distractor_vi": "Nhiễu cho chỗ 39: đúng loại liên từ nhưng nghĩa „mặc dù“ không hợp." },
    "i": { "meaning_vi": "liên từ „hay, hoặc“, không đổi trật tự từ" },
    "j": { "meaning_vi": "giới từ „từ … (tới nay)“", "distractor_vi": "Không chỗ nào cần một mốc thời gian bắt đầu." },
    "k": { "meaning_vi": "giới từ „từ (ai)“ + Dativ" },
    "l": { "meaning_vi": "từ để hỏi „khi nào“", "distractor_vi": "Nhiễu cặp với OB ở chỗ 35: câu hỏi có/không, không hỏi thời điểm." },
    "m": { "meaning_vi": "liên từ „vì“, động từ đứng CUỐI" },
    "n": { "meaning_vi": "„muốn“, ngôi ihr", "distractor_vi": "Nhiễu cho chỗ 36: „wollt“ chia cho „ihr“, còn chủ ngữ là „ich“." },
    "o": { "meaning_vi": "„sẽ, muốn“ Konjunktiv II, ngôi wir/sie/Sie" }
  },
  "items": {
    "SB2-31": { "need_vi": "giới từ chỉ người GỬI sau „bekommen“", "rule_vi": "etwas von jemandem bekommen",
      "wrong": { "e": { "why_vi": "„mit einer Freundin bekommen“ là nhận CÙNG với bạn. Ý câu là người bạn GỬI cho mình mẩu tin ⇒ „von“.", "trap": "Bẫy cặp dễ lẫn" } } },
    "SB2-32": { "need_vi": "liên từ chỉ lý do mở câu phụ — động từ „erwarten“ đứng CUỐI", "rule_vi": "weil … (động từ cuối)",
      "wrong": { "b": { "why_vi": "„denn“ cũng là „vì“, nhưng sau „denn“ động từ đứng THỨ HAI („denn wir erwarten …“). Ở đây „erwarten“ đứng cuối ⇒ chỉ „weil“ hợp.", "trap": "Bẫy cặp WEIL/DENN" } } },
    "SB2-33": { "need_vi": "liên từ chỉ lý do KHÔNG đổi trật tự — „arbeitet“ đứng thứ hai", "rule_vi": "denn + trật tự câu chính",
      "wrong": { "m": { "why_vi": "„weil“ đẩy động từ xuống cuối („weil mein Mann … arbeitet“). Ở đây „arbeitet“ đứng ngay sau chủ ngữ ⇒ phải là „denn“.", "trap": "Bẫy cặp WEIL/DENN" } } },
    "SB2-34": { "need_vi": "liên từ nối hai khả năng trong cùng một câu hỏi", "rule_vi": "câu hỏi A oder câu hỏi B",
      "wrong": { "c": { "why_vi": "„falls“ đẩy động từ xuống cuối, nhưng sau chỗ trống „müssen“ đứng đầu (vẫn là câu hỏi). Cần liên từ giữ trật tự như „oder“." } } },
    "SB2-35": { "need_vi": "liên từ mở câu hỏi gián tiếp có/không sau „wissen Sie“", "rule_vi": "wissen, ob …",
      "wrong": { "l": { "why_vi": "„wann“ hỏi KHI NÀO. Người viết hỏi phí phụ mùa đông CÓ cao hơn không — câu có/không ⇒ „ob“.", "trap": "Bẫy cặp OB/WANN" } } },
    "SB2-36": { "need_vi": "động từ chia theo „ich“ (chủ ngữ đứng sau vì câu mở bằng „Außerdem“)", "rule_vi": "Außerdem möchte ich …",
      "wrong": {
        "n": { "why_vi": "„wollt“ chia cho „ihr“; chủ ngữ ở đây là „ich“.", "trap": "Sai ngôi" },
        "o": { "why_vi": "„würden“ chia cho wir/sie/Sie; với „ich“ phải là „würde“ hoặc „möchte“.", "trap": "Sai ngôi" } } },
    "SB2-37": { "need_vi": "động từ chia theo „wir“ cho lời đề nghị lịch sự, cuối câu có „besichtigen“", "rule_vi": "wir würden gern + Infinitiv",
      "wrong": { "f": { "why_vi": "„möchte“ là ngôi ich/er/sie; chủ ngữ „Wir“ cần „möchten“ — hộp không có, nên chỉ „würden“ hợp.", "trap": "Sai ngôi" } } },
    "SB2-38": { "need_vi": "giới từ cho „Wochenende“", "rule_vi": "am Wochenende",
      "wrong": { "d": { "why_vi": "Với „Wochenende“ tiếng Đức chuẩn nói „am Wochenende“; „im“ dùng cho tháng, mùa.", "trap": "Bẫy cặp AM/IM" } } },
    "SB2-39": { "need_vi": "liên từ điều kiện mở câu phụ, động từ „haben“ ở cuối", "rule_vi": "Falls …, (động từ) …",
      "wrong": { "h": { "why_vi": "„obwohl“ đúng loại liên từ nhưng sai nghĩa: „MẶC DÙ ông bà có câu hỏi thì có thể gọi tôi“ không hợp lý; ý là „NẾU có câu hỏi“.", "trap": "Đúng loại từ, sai nghĩa" } } },
    "SB2-40": { "need_vi": "giới từ trong cụm cố định cuối thư", "rule_vi": "im Voraus",
      "wrong": { "a": { "why_vi": "Không có „am Voraus“; cụm cố định là „im Voraus“.", "trap": "Bẫy cặp AM/IM" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 3'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

-- ═══════════════════════════ Đề số 1 (nội dung sau V328) ═══════════════════════════

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-1', $j$
{
  "options": {
    "a": { "meaning_vi": "bốn tuyến đường xe đạp mới, thành phố muốn bớt ô tô ở trung tâm" },
    "b": { "meaning_vi": "thư viện thành phố mở cửa cả Chủ nhật" },
    "c": { "meaning_vi": "giới kinh doanh đòi thêm chỗ đỗ xe ở trung tâm", "distractor_vi": "Gần text 1: giới kinh doanh chỉ lo mất khách, bài không nói họ đòi thêm chỗ đỗ." },
    "d": { "meaning_vi": "ngày càng nhiều người trẻ chọn nghề thủ công", "distractor_vi": "Gần text 2 nhưng ngược nghĩa: vùng đang thiếu khoảng 900 người học nghề." },
    "e": { "meaning_vi": "bể bơi trong nhà MỚI khai trương vào mùa hè", "distractor_vi": "Gần text 3: bể cũ đóng cửa để sửa, không có bể mới nào." },
    "f": { "meaning_vi": "thư viện phải đóng cửa vì cắt giảm chi tiêu", "distractor_vi": "Gần text 5: thư viện chỉ nghỉ thứ Hai để mở thêm Chủ nhật, không đóng hẳn." },
    "g": { "meaning_vi": "hàng xóm biến một bãi đất trống thành vườn" },
    "h": { "meaning_vi": "xưởng thủ công treo thưởng vẫn không tìm được người học nghề" },
    "i": { "meaning_vi": "bể bơi đóng cửa suốt mùa hè" },
    "j": { "meaning_vi": "cư dân phố Linden phản đối một dự án xây dựng", "distractor_vi": "Gần text 4 vì cùng phố Lindenstraße, nhưng không có dự án xây dựng hay ai phản đối." }
  },
  "items": {
    "LV1-1": { "gist_vi": "thành phố làm bốn tuyến đường chỉ dành cho xe đạp để bớt ô tô vào trung tâm; một số chỗ đỗ bị bỏ",
      "evidence": ["vier neue Strecken, die nur für Fahrräder reserviert sind", "deutlich weniger Autos in die Innenstadt"],
      "wrong": { "c": { "why_vi": "Giới kinh doanh có phê phán kế hoạch, nhưng chỉ vì sợ mất khách. Bài không nói họ ĐÒI thêm chỗ đỗ; ý chính là các tuyến đường xe đạp mới.", "trap": "Chi tiết phụ thay cho ý chính" } } },
    "LV1-2": { "gist_vi": "vùng thiếu khoảng 900 người học nghề thủ công; xưởng treo thưởng mà vẫn không có người",
      "evidence": ["fehlen in diesem Jahr rund 900 junge Leute", "Trotzdem finden sie kaum Bewerber"],
      "wrong": { "d": { "why_vi": "Ngược với bài: không phải „immer mehr“ người trẻ chọn nghề, mà đang THIẾU 900 người; phần lớn học sinh tốt nghiệp chọn đại học.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-3": { "gist_vi": "bể bơi đóng cửa từ tháng Sáu đến hết tháng Chín để thay hệ thống thông gió",
      "evidence": ["bleibt von Anfang Juni bis Ende September zu", "muss komplett erneuert werden"],
      "wrong": { "e": { "why_vi": "Không có bể bơi MỚI nào khai trương: bể cũ ĐÓNG cả mùa hè để sửa, tháng Mười mở lại như cũ.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-4": { "gist_vi": "khoảng ba mươi người trong phố cùng trồng rau, hoa trên mảnh đất trống thành phố cho mượn",
      "evidence": ["Auf einem leeren Grundstück", "pflanzen seit April etwa dreißig Anwohner gemeinsam"],
      "wrong": { "j": { "why_vi": "Cùng là phố Lindenstraße, nhưng bài không có dự án xây dựng hay ai phản đối. Cư dân cùng nhau trồng vườn và mở tiệc vườn.", "trap": "Bẫy trùng từ" } } },
    "LV1-5": { "gist_vi": "thư viện mở thêm Chủ nhật 11–16 giờ, đổi lại nghỉ thứ Hai",
      "evidence": ["Sonntags kann man dort nun von 11 bis 16 Uhr", "bleibt die Bücherei montags geschlossen"],
      "wrong": { "f": { "why_vi": "Thư viện không đóng hẳn: chỉ nghỉ thứ Hai để mở thêm Chủ nhật. Bài cũng không nói chuyện cắt giảm chi tiêu.", "trap": "Bẫy phóng đại" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 1'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-2', $j$
{
  "items": {
    "LV2-6": { "evidence": ["weil sie sich allein gelassen fühlen"],
      "wrong": {
        "a": { "why_vi": "Bà Özdemir nói ngược lại: „Die meisten hören nicht auf, weil die Arbeit zu schwer ist“.", "trap": "Bẫy ngược nghĩa" },
        "c": { "why_vi": "Nửa năm là mốc bà khuyên nên HỎI THĂM người mới; ai được hỏi thăm thường ở lại sang năm thứ hai. Bài không nói họ bỏ để tìm việc khác.", "trap": "Bẫy trùng con số" } } },
    "LV2-7": { "evidence": ["fragt zuerst nach dem Zeitaufwand"],
      "wrong": {
        "b": { "why_vi": "Bài không nói ai hỏi về tiền; câu hỏi đầu tiên là việc này tốn bao nhiêu thời gian." },
        "c": { "why_vi": "Bài không nói người mới hỏi còn ai cùng tham gia." } } },
    "LV2-8": { "evidence": ["aber niemanden für den Vorstand"],
      "wrong": {
        "a": { "why_vi": "Ngược với bài: tìm mười người cho lễ hội thành phố thì „schnell“ — rất nhanh.", "trap": "Bẫy ngược nghĩa" },
        "c": { "why_vi": "Đặt sân tập là MỘT việc của ban điều hành, nhưng ông nói không tìm được người cho cả ban điều hành, không riêng việc đặt sân.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" } } },
    "LV2-9": { "evidence": ["auf mehrere Schultern zu verteilen"],
      "wrong": {
        "b": { "why_vi": "Bài không nói hội nào bắt thành viên phải nhận chức vụ." },
        "c": { "why_vi": "Không hội nào bỏ thủ quỹ; họ chia việc thủ quỹ cho ba người, hoặc thuê nhân viên văn phòng vài giờ mỗi tuần." } } },
    "LV2-10": { "evidence": ["vor allem für wie lange"],
      "wrong": {
        "a": { "why_vi": "Bài không nói số người tham gia GIẢM; chỉ nói cách họ tham gia đã khác.", "trap": "Bài không nói" },
        "c": { "why_vi": "Ngược với bài: trước kia người ta ở lại hội cả đời, nay muốn những việc có thời hạn ngắn.", "trap": "Bẫy ngược nghĩa" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 1'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-3', $j$
{
  "options": {
    "a": { "meaning_vi": "dạy kèm Toán lớp 5–10 tại nhà người dạy" },
    "b": { "meaning_vi": "bán xe đạp trẻ em cũ", "distractor_vi": "Gần câu 17 vì cùng chuyện bán xe, nhưng đây là người khác BÁN xe đạp — bạn cần người MUA ô tô." },
    "c": { "meaning_vi": "tìm người đi chung xe Leipzig–Dresden mỗi thứ Sáu, chia tiền xăng" },
    "d": { "meaning_vi": "dắt chó đi dạo trong giờ làm việc" },
    "e": { "meaning_vi": "phòng trong nhà ở ghép gần đại học, 340 €" },
    "f": { "meaning_vi": "dạy guitar cho người mới, mọi lứa tuổi" },
    "g": { "meaning_vi": "tìm người giúp chuyển nhà sáng thứ Bảy" },
    "h": { "meaning_vi": "lớp học may cho người lớn", "distractor_vi": "Không tình huống nào cần học may." },
    "i": { "meaning_vi": "cho không tủ lạnh nhỏ" },
    "j": { "meaning_vi": "công ty tìm người dọn văn phòng buổi tối" },
    "k": { "meaning_vi": "lớp tiếng Đức A2 nhóm nhỏ", "distractor_vi": "Không tình huống nào cần học tiếng Đức." },
    "l": { "meaning_vi": "thợ chụp ảnh tiệc gia đình, đám cưới", "distractor_vi": "Là đáp án của ví dụ 01." }
  },
  "items": {
    "LV3-11": { "gist_vi": "con gái học Toán kém, cần người kèm đều đặn", "evidence": ["Nachhilfe Mathe, Klasse 5–10"] },
    "LV3-12": { "gist_vi": "chuyển nhà thứ Bảy, cần người khiêng đồ", "evidence": ["Umzugshelfer gesucht: Samstag ab 10 Uhr"] },
    "LV3-13": { "gist_vi": "ban ngày đi làm, không ai dắt chó đi dạo", "evidence": ["Ich gehe mit Ihrem Hund, während Sie arbeiten"] },
    "LV3-14": { "gist_vi": "tìm phòng rẻ gần trường đại học", "evidence": ["5 Minuten zur Universität", "340 € warm"] },
    "LV3-15": { "gist_vi": "muốn học một nhạc cụ từ đầu", "evidence": ["Gitarrenunterricht für Anfänger"] },
    "LV3-16": { "gist_vi": "cần tủ lạnh cũ mà gần như không có tiền", "evidence": ["Kleiner Kühlschrank zu verschenken"] },
    "LV3-17": { "gist_vi": "muốn BÁN ô tô, cần một người mua",
      "wrong": { "b": { "why_vi": "Mẩu b là người khác đang BÁN xe đạp trẻ em. Bạn cần người MUA ô tô — không mẩu nào như vậy.", "trap": "Bẫy ngược chiều mua/bán" } } },
    "LV3-18": { "gist_vi": "thứ Sáu hay đi Dresden, muốn chia chi phí đi đường", "evidence": ["jeden Freitag gegen 15 Uhr", "Teile gern die Benzinkosten"] },
    "LV3-19": { "gist_vi": "tìm chỗ gửi trẻ cho con trai hai tuổi",
      "wrong": {
        "d": { "why_vi": "Mẩu d trông CHÓ trong giờ làm, không phải trông trẻ.", "trap": "Bẫy cùng ý trông nom" },
        "a": { "why_vi": "Mẩu a dạy kèm Toán cho học sinh lớp 5–10, không nhận trẻ hai tuổi." } } },
    "LV3-20": { "gist_vi": "công ty cần người dọn văn phòng buổi tối", "evidence": ["Reinigungskraft für unser Büro gesucht"] }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 1'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-1', $j$
{
  "items": {
    "SB1-21": { "need_vi": "liên từ chỉ lý do mở câu phụ — „kann“ đứng CUỐI", "rule_vi": "weil … (động từ cuối)",
      "wrong": {
        "b": { "why_vi": "„denn“ cũng là „vì“ nhưng giữ trật tự câu chính (động từ đứng thứ hai). Ở đây „kann“ đứng cuối ⇒ phải là „weil“.", "trap": "Bẫy cặp WEIL/DENN" },
        "c": { "why_vi": "„obwohl“ là „mặc dù“. Người viết viết thư VÌ không đến được hẹn, không phải mặc dù." } } },
    "SB1-22": { "need_vi": "giới từ trong cụm cố định chỉ việc Ở nhà (không di chuyển)", "rule_vi": "zu Hause (ở nhà) · nach Hause (về nhà)",
      "wrong": {
        "a": { "why_vi": "„nach Hause“ chỉ dùng khi đi VỀ nhà. „bleiben“ là ở yên một chỗ ⇒ „zu Hause“.", "trap": "Bẫy cặp ZU/NACH Hause" },
        "c": { "why_vi": "„bei Hause“ không có trong tiếng Đức; ở nhà mình là „zu Hause“." } } },
    "SB1-23": { "need_vi": "mạo từ Akkusativ giống đực cho „Termin“ (thứ được đưa)", "rule_vi": "der Termin · Akkusativ → einen",
      "wrong": {
        "b": { "why_vi": "„einem“ là Dativ. „Termin“ là thứ được đưa (tân ngữ trực tiếp) ⇒ Akkusativ „einen“." },
        "c": { "why_vi": "„ein“ là Nominativ giống đực hoặc dạng giống trung; „Termin“ giống đực ở Akkusativ phải là „einen“." } } },
    "SB1-24": { "need_vi": "liên từ nêu LÝ DO vì sao tuần sau hợp, „arbeite“ ở cuối", "rule_vi": "weil … (động từ cuối)",
      "wrong": {
        "a": { "why_vi": "„damit“ là mục đích („để …“): tuần sau hợp ĐỂ tôi đi làm lại? Sai nghĩa." },
        "b": { "why_vi": "„trotzdem“ là trạng từ „tuy vậy“: nó đứng trong câu chính và không đẩy động từ xuống cuối. Ở đây „arbeite“ đứng cuối nên cần liên từ câu phụ." } } },
    "SB1-25": { "need_vi": "động từ khuyết thiếu cho một điều kiện có thật ở hiện tại", "rule_vi": "Wenn …, kann ich …",
      "wrong": {
        "b": { "why_vi": "„könnte“ là giả định (Konjunktiv II). Câu này nói điều sẽ thật sự làm nếu được đưa lựa chọn ⇒ hiện tại „kann“." },
        "c": { "why_vi": "„konnte“ là quá khứ — sai thời gian." } } },
    "SB1-26": { "need_vi": "đại từ quan hệ cho „die Unterlagen“ (số nhiều, Akkusativ của „geschickt“)", "rule_vi": "số nhiều Akkusativ → die",
      "wrong": {
        "a": { "why_vi": "„was“ chỉ đi sau „alles, etwas, das …“, không đi sau một danh từ cụ thể như „die Unterlagen“." },
        "c": { "why_vi": "„der“ là giống đực (Nominativ) hoặc giống cái (Dativ), không phải số nhiều Akkusativ." } } },
    "SB1-27": { "need_vi": "trạng từ „sẵn lòng“", "rule_vi": "gern = sẵn lòng · lieber = thích … hơn",
      "wrong": {
        "b": { "why_vi": "„gerne“ là biến thể của „gern“, cùng nghĩa và cùng chỗ đứng. Đề chấm „gern“ là đáp án; nếu bạn chọn „gerne“ thì về tiếng Đức bạn không sai — câu này đang được xem lại." },
        "c": { "why_vi": "„lieber“ là „thích … hơn“ (so sánh). Trong câu không có gì để so sánh." } } },
    "SB1-28": { "need_vi": "trạng từ trong cụm xin lỗi lịch sự quen dùng", "rule_vi": "sich vielmals entschuldigen",
      "wrong": {
        "a": { "why_vi": "„herzlich“ hay đi với lời cảm ơn, lời chào („herzlich danken“, „herzliche Grüße“). Trong thư trang trọng, cụm xin lỗi quen dùng là „sich vielmals entschuldigen“." },
        "c": { "why_vi": "„sehr gern“ là „rất sẵn lòng“ — xin lỗi „rất sẵn lòng“ không hợp nghĩa." } } },
    "SB1-29": { "need_vi": "động từ nguyên mẫu sau „muss“", "rule_vi": "müssen + Infinitiv ở cuối",
      "wrong": {
        "b": { "why_vi": "„abgesagt“ là Partizip II (đi với haben ở thì Perfekt); sau „muss“ phải là nguyên mẫu." },
        "c": { "why_vi": "„absage“ là dạng đã chia cho „ich“; sau động từ khuyết thiếu, động từ chính ở nguyên mẫu." } } },
    "SB1-30": { "need_vi": "giới từ của „sich freuen“ cho điều SẮP tới", "rule_vi": "sich freuen auf (sắp tới) · über (đã có)",
      "wrong": {
        "a": { "why_vi": "„sich freuen über“ dùng cho điều đã nhận được. Thư trả lời chưa tới ⇒ „auf“.", "trap": "Bẫy cặp AUF/ÜBER" },
        "c": { "why_vi": "„sich freuen an“ là thích thú hưởng một thứ đang có — không dùng cho thư trả lời sắp tới." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 1'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-2', $j$
{
  "options": {
    "a": { "meaning_vi": "giới từ „an + dem“ (ngày, cuối tuần)" },
    "b": { "meaning_vi": "trạng từ lịch sự „xin, vui lòng“" },
    "c": { "meaning_vi": "trạng từ „vì vậy“ — đứng đầu vế câu thì động từ theo ngay sau" },
    "d": { "meaning_vi": "liên từ „nếu“, mở câu phụ" },
    "e": { "meaning_vi": "giới từ „cho, về“ + Akkusativ" },
    "f": { "meaning_vi": "giới từ „in + dem“", "distractor_vi": "Nhiễu cặp với AM ở chỗ 31: nói „am Wochenende“." },
    "g": { "meaning_vi": "giới từ „với“ + Dativ", "distractor_vi": "Nhiễu cho chỗ 38 và 39: „weit von … entfernt“, „ohne Auto“." },
    "h": { "meaning_vi": "„muốn“ (lịch sự), ngôi wir/sie/Sie" },
    "i": { "meaning_vi": "liên từ „có … không“, mở câu hỏi gián tiếp" },
    "j": { "meaning_vi": "liên từ „mặc dù“, mở câu phụ", "distractor_vi": "Nhiễu cho chỗ 34: đúng loại liên từ nhưng sai nghĩa." },
    "k": { "meaning_vi": "giới từ „không có“ + Akkusativ" },
    "l": { "meaning_vi": "giới từ „từ“ + Dativ" },
    "m": { "meaning_vi": "từ để hỏi „khi nào“", "distractor_vi": "Nhiễu cặp với OB ở chỗ 36: câu hỏi có/không." },
    "n": { "meaning_vi": "„muốn“ ở quá khứ, ngôi wir/sie", "distractor_vi": "Nhiễu cho chỗ 33 và 40: quá khứ không hợp lời đề nghị ở hiện tại." },
    "o": { "meaning_vi": "„sẽ“ Konjunktiv II, ngôi wir/sie/Sie" }
  },
  "items": {
    "SB2-31": { "need_vi": "giới từ cho „Wochenende“", "rule_vi": "am Wochenende",
      "wrong": { "f": { "why_vi": "„im“ dùng cho tháng, mùa; với „Wochenende“ nói „am Wochenende“.", "trap": "Bẫy cặp AM/IM" } } },
    "SB2-32": { "need_vi": "giới từ cố định của „sich interessieren“", "rule_vi": "sich interessieren für + Akkusativ",
      "wrong": { "g": { "why_vi": "Không có „sich interessieren mit“; quan tâm TỚI điều gì là „für“." } } },
    "SB2-33": { "need_vi": "động từ khuyết thiếu chia theo „wir“, nói mong muốn lịch sự ở hiện tại", "rule_vi": "wir möchten + Infinitiv",
      "wrong": {
        "n": { "why_vi": "„wollten“ là quá khứ; gia đình đang nói kế hoạch tháng Bảy sắp tới ⇒ „möchten“.", "trap": "Sai thì" },
        "o": { "why_vi": "Hộp chỉ có MỘT „würden“, và nó cần cho chỗ 40 („Wir würden uns sehr freuen“). Ở chỗ 33 dùng „möchten“." } } },
    "SB2-34": { "need_vi": "liên từ điều kiện mở câu phụ, „ist“ ở cuối", "rule_vi": "falls … (động từ cuối)",
      "wrong": { "j": { "why_vi": "„obwohl“ (mặc dù) đúng loại liên từ nhưng sai nghĩa: gia đình muốn ở hai tuần NẾU nhà còn trống.", "trap": "Đúng loại từ, sai nghĩa" } } },
    "SB2-35": { "need_vi": "trạng từ lịch sự trong câu nhờ", "rule_vi": "Könnten Sie uns bitte …",
      "wrong": { "c": { "why_vi": "„deshalb“ (vì vậy) nối một hệ quả, không có nghĩa trong câu nhờ vả." } } },
    "SB2-36": { "need_vi": "liên từ mở câu hỏi gián tiếp có/không", "rule_vi": "mitteilen, ob …",
      "wrong": { "m": { "why_vi": "„wann“ hỏi KHI NÀO. Câu hỏi là có khăn và ga trải giường hay không ⇒ „ob“.", "trap": "Bẫy cặp OB/WANN" } } },
    "SB2-37": { "need_vi": "trạng từ nêu hệ quả, đứng đầu vế câu nên „wäre“ theo ngay sau", "rule_vi": "deshalb + động từ + chủ ngữ",
      "wrong": { "d": { "why_vi": "„falls“ đẩy động từ xuống cuối, nhưng ở đây „wäre“ đứng ngay sau chỗ trống ⇒ cần trạng từ như „deshalb“." } } },
    "SB2-38": { "need_vi": "giới từ trong cụm „weit … entfernt“", "rule_vi": "weit von + Dativ entfernt",
      "wrong": { "g": { "why_vi": "„weit mit der Wohnung entfernt“ không có nghĩa; khoảng cách TỪ đâu là „von“." } } },
    "SB2-39": { "need_vi": "giới từ „không có“ — đi mua sắm mà không cần ô tô", "rule_vi": "ohne + Akkusativ",
      "wrong": { "g": { "why_vi": "„mit Auto einkaufen“ đúng ngữ pháp nhưng ngược nghĩa: gia đình muốn biết có đi mua sắm được KHÔNG CẦN ô tô hay không.", "trap": "Đúng ngữ pháp, ngược nghĩa" } } },
    "SB2-40": { "need_vi": "trợ động từ Konjunktiv II chia theo „wir“, cuối câu có „freuen“", "rule_vi": "Wir würden uns freuen …",
      "wrong": {
        "n": { "why_vi": "„wollten uns freuen“ là quá khứ và nghĩa „đã muốn vui“ — không phải lời kết thư lịch sự." },
        "h": { "why_vi": "„möchten“ cần cho chỗ 33, và „wir möchten uns freuen“ không phải cách nói tự nhiên." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 1'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;
