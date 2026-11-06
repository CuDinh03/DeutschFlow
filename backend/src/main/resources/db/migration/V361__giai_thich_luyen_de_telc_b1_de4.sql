-- Giải thích cho chế độ luyện đề telc B1 — Đề số 4 (07/11/2026), phần Đọc và Sprachbausteine.
--
-- Cùng định dạng V358 (xem chú thích đầu V358): options.<chữ>.meaning_vi / distractor_vi,
-- items.<id>.gist_vi / evidence / need_vi / rule_vi / wrong.<chữ>.{why_vi, trap}. Trước migration
-- này Đề 4 chạy bằng câu ráp (PracticeAnalysis). "Vì sao đúng" vẫn là explanation_vi trong đề (V345).
-- `evidence` chép NGUYÊN VĂN từng dòng của đề để tô được (PracticeExplanationsDe4Test kiểm).
--
-- Nội dung soạn gốc, BẢN NHÁP chờ owner duyệt (cùng cách duyệt như V358: làm thử trên production).
-- Sửa nội dung: viết migration mới ghi đè đúng hàng (ON CONFLICT … DO UPDATE).
-- 🪤 Dấu cách sau $j$ là BẮT BUỘC (xem V325).

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-1', $j$
{
  "options": {
    "a": { "meaning_vi": "tuyến tàu mới, đi Offenburg NHANH hơn", "distractor_vi": "Gần text 5: cùng tuyến Freiburg–Offenburg, nhưng đi xe buýt thay tàu CHẬM hơn khoảng năm mươi phút." },
    "b": { "meaning_vi": "người dân nhận chăm cây mới trồng trong thành phố" },
    "c": { "meaning_vi": "siêu thị BÁN thực phẩm hôm trước với nửa giá", "distractor_vi": "Gần text 1: siêu thị không bán rẻ mà CHO Tafel thực phẩm còn dư." },
    "d": { "meaning_vi": "mùa hè rạp chiếu phim ra ngoài trời" },
    "e": { "meaning_vi": "trường điều dưỡng RÚT NGẮN khoá học còn hai năm", "distractor_vi": "Gần text 2 nhưng ngược nghĩa: khoá bán thời gian DÀI hơn, bốn năm thay vì ba." },
    "f": { "meaning_vi": "ba tuần chạy xe buýt thay tàu" },
    "g": { "meaning_vi": "thành phố phải CHẶT cây cổ thụ vì nắng nóng", "distractor_vi": "Gần text 3: cùng chuyện cây và nắng nóng, nhưng thành phố TRỒNG thêm một nghìn cây." },
    "h": { "meaning_vi": "thực phẩm còn dư nay được đưa cho người khó khăn" },
    "i": { "meaning_vi": "rạp Harmonie đóng cửa để sửa", "distractor_vi": "Gần text 4: cùng rạp „Harmonie“, nhưng rạp không đóng cửa mà chiếu phim ngoài trời." },
    "j": { "meaning_vi": "học nghề điều dưỡng nay cả người đang nuôi con cũng học được" }
  },
  "items": {
    "LV1-1": { "gist_vi": "ba siêu thị mỗi tối đưa thực phẩm không bán được cho Tafel; Tafel phát cho khoảng 1500 người ít tiền mỗi tuần",
      "evidence": ["bekommt jetzt die Freiburger Tafel", "rund 1500 Menschen mit wenig Geld"],
      "wrong": { "c": { "why_vi": "Bài không nói bán nửa giá. Siêu thị „geben … ab“ — ĐƯA thực phẩm còn dư cho Tafel, không lấy tiền.", "trap": "Bẫy trùng từ" } } },
    "LV1-2": { "gist_vi": "trường điều dưỡng mở khoá học bán thời gian cho người có con nhỏ, giờ học khớp giờ nhà trẻ",
      "evidence": ["Wer kleine Kinder hat, kann oft keine Ausbildung in Vollzeit machen.", "Statt drei dauert sie vier Jahre"],
      "wrong": { "e": { "why_vi": "Ngược với bài: khoá bán thời gian kéo DÀI từ ba lên bốn năm, không rút ngắn còn hai năm.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-3": { "gist_vi": "thành phố trồng một nghìn cây mới; người dân nhận đỡ đầu, tưới cây trước cửa nhà",
      "evidence": ["Wer eine Baumpatenschaft übernimmt, gießt in trockenen Wochen einen bestimmten Baum vor der eigenen Haustür."],
      "wrong": { "g": { "why_vi": "Bài có nắng nóng, nhưng thành phố TRỒNG thêm cây, không chặt cây nào.", "trap": "Bẫy ngược nghĩa" } } },
    "LV1-4": { "gist_vi": "tháng Bảy đến cuối tháng Tám, rạp Harmonie chiếu phim ngoài trời mỗi tối trong sân nhà máy bia cũ",
      "evidence": ["jeden Abend einen Film unter freiem Himmel"],
      "wrong": { "i": { "why_vi": "Cùng tên rạp „Harmonie“, nhưng bài không nói rạp đóng cửa hay sửa chữa; rạp chiếu thêm ngoài trời suốt mùa hè.", "trap": "Bẫy trùng từ" } } },
    "LV1-5": { "gist_vi": "từ 3 đến 24/8 tuyến tàu Freiburg–Offenburg đóng để sửa đường ray, chạy xe buýt thay",
      "evidence": ["Statt der Züge fahren Busse", "etwa fünfzig Minuten länger"],
      "wrong": { "a": { "why_vi": "Không có tuyến tàu mới nào. Xe buýt thay tàu đi CHẬM hơn khoảng năm mươi phút.", "trap": "Bẫy ngược nghĩa" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 4'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-2', $j$
{
  "items": {
    "LV2-6": { "evidence": ["meistens weil die Studierenden", "weniger helfen, als vereinbart war."],
      "wrong": {
        "b": { "why_vi": "Bài không nói người cao tuổi đòi hỏi quá nhiều; lý do thường gặp là sinh viên giúp ÍT hơn đã thoả thuận.", "trap": "Bài không nói" },
        "c": { "why_vi": "Diện tích phòng chỉ dùng để tính số giờ giúp việc (một giờ cho mỗi mét vuông), không phải lý do ngừng ở chung.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" } } },
    "LV2-7": { "evidence": ["bezahlt dafür keine Miete", "Nur die Nebenkosten* müssen die jungen Mieter selbst bezahlen."],
      "wrong": {
        "a": { "why_vi": "„über fünfhundert Euro“ là giá những phòng rẻ nhất Jonas tìm được lúc đầu và KHÔNG thuê nổi. Phòng hiện tại anh không trả tiền thuê.", "trap": "Bẫy trùng con số" },
        "c": { "why_vi": "Bài không nói trả nửa tiền thuê: Jonas không trả tiền thuê, chỉ trả „Nebenkosten“ và giúp việc nhà." } } },
    "LV2-8": { "evidence": ["Pflege ist dagegen ausdrücklich"],
      "wrong": {
        "a": { "why_vi": "Ngược với câu hỏi: đi chợ là việc sinh viên ĐƯỢC làm („Die Studierenden kaufen ein“).", "trap": "Bẫy ngược nghĩa" },
        "b": { "why_vi": "Làm vườn cũng được phép: sinh viên „mähen den Rasen“ — cắt cỏ.", "trap": "Bẫy ngược nghĩa" } } },
    "LV2-9": { "evidence": ["Vor jeder Vermittlung besucht eine Mitarbeiterin beide Seiten", "„Die Menschen müssen zueinander"],
      "wrong": {
        "a": { "why_vi": "Bài không có tuần ở thử. Có một buổi nói chuyện lần hai SAU ba tháng ở chung.", "trap": "Bài không nói" },
        "c": { "why_vi": "Bài không nhắc tới khoản phí nào trả cho Studierendenwerk.", "trap": "Bài không nói" } } },
    "LV2-10": { "evidence": ["Abends ist jemand im Haus", "hatte ich nachts oft Angst"],
      "wrong": {
        "a": { "why_vi": "Jonas có nấu ăn, nhưng bà nói ngay sau đó: „Am wichtigsten sei für sie aber etwas anderes“ — điều quan trọng nhất là buổi tối có người trong nhà.", "trap": "Chi tiết có trong bài nhưng không trả lời câu hỏi" },
        "b": { "why_vi": "Con gái chỉ là người thuyết phục bà tham gia dự án; bài không nói con gái đến thăm nhiều hơn.", "trap": "Bài không nói" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 4'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'LESEN-3', $j$
{
  "options": {
    "a": { "meaning_vi": "sinh viên sư phạm dạy kèm tiếng Pháp, tiếng Anh mọi lớp, cả online" },
    "b": { "meaning_vi": "cho không giường trẻ em kèm nệm, tự đến lấy" },
    "c": { "meaning_vi": "nhóm đi bộ đường dài Schwarzwald, miễn phí", "distractor_vi": "Gần câu 17 vì cùng hoạt động ngoài trời, nhưng đây là đi bộ đường dài, không có khoá dạy leo núi." },
    "d": { "meaning_vi": "cho thuê xe đạp điện, xe đạp du lịch ở ga chính" },
    "e": { "meaning_vi": "người chăm sóc có kinh nghiệm trò chuyện, đi dạo với người già buổi chiều" },
    "f": { "meaning_vi": "người cần MUA máy may cũ, tới 80 €" },
    "g": { "meaning_vi": "câu lạc bộ cờ vua cho trẻ từ 8 tuổi, bốn tuần đầu miễn phí" },
    "h": { "meaning_vi": "hội tư vấn khai thuế cho người làm công và người hưu trí" },
    "i": { "meaning_vi": "cho thuê ga-ra gần đại học" },
    "j": { "meaning_vi": "đầu bếp dạy nấu một bữa đãi khách ngay tại bếp nhà bạn", "distractor_vi": "Không tình huống nào cần học nấu ăn." },
    "k": { "meaning_vi": "gia đình ở Freiburg tìm Au-pair một năm", "distractor_vi": "Gần câu 20 vì cùng là Au-pair, nhưng gia đình ở Freiburg — bạn muốn sang Tây Ban Nha." },
    "l": { "meaning_vi": "bán rẻ thùng các-tông chuyển nhà", "distractor_vi": "Là đáp án của ví dụ 01." }
  },
  "items": {
    "LV3-11": { "gist_vi": "muốn đạp xe cuối tuần cùng khách nhưng mình chỉ có một chiếc", "evidence": ["Fahrradverleih am Hauptbahnhof"] },
    "LV3-12": { "gist_vi": "bà sống một mình, muốn có người bầu bạn buổi chiều", "evidence": ["Betreuung für Senioren am Nachmittag"] },
    "LV3-13": { "gist_vi": "có máy may cũ không dùng nữa, muốn BÁN đi", "evidence": ["Suche gebrauchte Nähmaschine"] },
    "LV3-14": { "gist_vi": "con gái chín tuổi thích trò chơi bàn cờ, muốn chơi đều đặn với trẻ khác", "evidence": ["Training für Kinder ab 8 Jahren"] },
    "LV3-15": { "gist_vi": "không hiểu các mẫu đơn khai thuế", "evidence": ["Steuererklärung zu kompliziert?"] },
    "LV3-16": { "gist_vi": "sắp có em bé, cần giường cho bé mà ít tiền", "evidence": ["Verschenke Kinderbett mit Matratze"] },
    "LV3-17": { "gist_vi": "muốn học leo núi, tìm một khoá học",
      "wrong": { "c": { "why_vi": "Mẩu c là nhóm ĐI BỘ đường dài mỗi hai Chủ nhật, không dạy leo núi. Không mẩu nào có khoá leo núi.", "trap": "Bẫy cùng chủ đề" } } },
    "LV3-18": { "gist_vi": "con trai bị điểm kém môn tiếng Pháp", "evidence": ["Nachhilfe in Französisch und Englisch für alle Klassen"] },
    "LV3-19": { "gist_vi": "tìm chỗ để xe máy gần trường đại học", "evidence": ["Garage zu vermieten, Nähe Universität"] },
    "LV3-20": { "gist_vi": "muốn làm Au-pair một năm ở Tây Ban Nha",
      "wrong": { "k": { "why_vi": "Mẩu k là một gia đình ở FREIBURG tìm Au-pair. Bạn muốn sang Tây Ban Nha — không mẩu nào như vậy.", "trap": "Bẫy trùng từ" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 4'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-1', $j$
{
  "items": {
    "SB1-21": { "need_vi": "giới từ đi với „Vertrag“ khi nói hợp đồng ký TẠI một cơ sở", "rule_vi": "einen Vertrag bei einer Firma haben / kündigen",
      "wrong": {
        "b": { "why_vi": "Hợp đồng với một công ty nói „Vertrag bei …“ (hoặc „mit …“). „Vertrag von …“ không phải cách nói hợp đồng mình ký với phòng tập." },
        "c": { "why_vi": "„zu“ chỉ hướng tới, không đi với „Vertrag“ theo nghĩa này. Chữ „zum“ ở cuối câu thuộc cụm khác: „zum nächstmöglichen Termin“.", "trap": "Bẫy lặp từ quanh chỗ trống" } } },
    "SB1-22": { "need_vi": "giới từ cho buổi trong ngày", "rule_vi": "am Vormittag · am Abend · im Mai · um 10 Uhr",
      "wrong": {
        "a": { "why_vi": "„im“ dùng cho tháng, mùa, năm (im Mai, im Sommer). Buổi trong ngày dùng „am“: „am Vormittag“.", "trap": "Bẫy cặp AM/IM" },
        "c": { "why_vi": "„um“ dùng cho giờ chính xác (um 10 Uhr), không dùng cho buổi." } } },
    "SB1-23": { "need_vi": "trợ động từ bị động ở hiện tại, đi với „repariert“", "rule_vi": "werden + Partizip II (Passiv Präsens)",
      "wrong": {
        "a": { "why_vi": "„wurden“ là quá khứ. Câu nói máy hỏng „schon seit Wochen“ và tới giờ vẫn chưa được sửa: với „seit“, tiếng Đức dùng thì hiện tại ⇒ „werden … nicht repariert“.", "trap": "Sai thì" },
        "c": { "why_vi": "„worden“ là Partizip II của „werden“, chỉ đứng sau „sind/waren“ (sind repariert worden), không đứng một mình." } } },
    "SB1-24": { "need_vi": "liên từ nối hai ý ĐỐI LẬP, giữ trật tự câu chính („hat“ đứng thứ hai)", "rule_vi": "…, aber + chủ ngữ + động từ",
      "wrong": {
        "a": { "why_vi": "„denn“ cũng giữ trật tự câu chính, nhưng nghĩa thành „tôi phàn nàn VÌ không ai phản hồi“. Ý của thư là đã phàn nàn hai lần MÀ không ai phản hồi ⇒ đối lập „aber“.", "trap": "Đúng ngữ pháp, sai nghĩa" },
        "c": { "why_vi": "„weil“ đẩy động từ xuống cuối (weil niemand reagiert hat). Ở đây „hat“ đứng ngay sau chủ ngữ.", "trap": "Bẫy cặp WEIL/DENN" } } },
    "SB1-25": { "need_vi": "liên từ lý do mở câu phụ đứng đầu câu, „umziehe“ ở cuối", "rule_vi": "Da …, werde ich … (câu phụ đứng trước, động từ chính theo ngay sau)",
      "wrong": {
        "a": { "why_vi": "„damit“ là „để“ (mục đích): „để tôi chuyển nhà vào tháng Năm“ không hợp nghĩa." },
        "b": { "why_vi": "„Deshalb“ đứng đầu thì động từ chia phải theo ngay sau (Deshalb ziehe ich …). Ở đây „umziehe“ đứng cuối ⇒ cần liên từ câu phụ „Da“.", "trap": "Bẫy trật tự từ" } } },
    "SB1-26": { "need_vi": "giới từ hỏi ngày hợp đồng kết thúc", "rule_vi": "zu welchem Datum · zum 31. Mai",
      "wrong": {
        "a": { "why_vi": "Trong thư huỷ hợp đồng, ngày kết thúc nói bằng „zu“: „zum 31. Mai“, „zu welchem Datum“. „mit welchem Datum“ không phải cách nói quen dùng." },
        "c": { "why_vi": "„um“ dùng cho giờ, không đi với „Datum“." } } },
    "SB1-27": { "need_vi": "động từ „bitten“ chia theo „ich“ ở hiện tại", "rule_vi": "Ich bitte Sie, … zu + Infinitiv",
      "wrong": {
        "a": { "why_vi": "„bitten“ là nguyên mẫu, hoặc dạng của ngôi wir/sie/Sie. Chủ ngữ „ich“ ⇒ „bitte“." },
        "c": { "why_vi": "„gebeten“ là Partizip II, cần „habe“ đi kèm (ich habe Sie gebeten). Câu không có „habe“." } } },
    "SB1-28": { "need_vi": "liên từ thời gian „ngay khi“, „ist“ ở cuối", "rule_vi": "sobald = ngay khi",
      "wrong": {
        "a": { "why_vi": "„seit“ là „từ khi“: một việc đã bắt đầu và kéo dài tới nay. Thời hạn báo huỷ chưa hết, nên không dùng được." },
        "b": { "why_vi": "„bevor“ là „trước khi“: „đừng trừ tiền nữa TRƯỚC KHI hết thời hạn“ ngược ý người viết. Người viết muốn không bị trừ tiền từ lúc thời hạn kết thúc.", "trap": "Bẫy ngược nghĩa" } } },
    "SB1-29": { "need_vi": "liên từ điều kiện ở hiện tại/tương lai", "rule_vi": "wenn = nếu, khi (hiện tại, lặp lại) · als = khi (một lần trong quá khứ)",
      "wrong": {
        "b": { "why_vi": "„als“ chỉ dùng cho một lần trong quá khứ. Ở đây là điều kiện: tôi trả thẻ NẾU anh chị cho biết gửi đi đâu.", "trap": "Bẫy cặp WENN/ALS" },
        "c": { "why_vi": "„ob“ là „có … không“, mở câu hỏi gián tiếp; ở đây không có câu hỏi." } } },
    "SB1-30": { "need_vi": "giới từ đi với „Dank“", "rule_vi": "Danke / Vielen Dank für + Akkusativ",
      "wrong": {
        "a": { "why_vi": "„über“ đi với „sich freuen über“, không đi với „Dank“." },
        "b": { "why_vi": "„auf“ đi với „sich freuen auf“, „warten auf“; cảm ơn vì điều gì là „für“." } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 4'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;

INSERT INTO mock_exam_explanations (exam_id, teil_key, body)
SELECT id, 'SPRACHBAUSTEINE-2', $j$
{
  "options": {
    "a": { "meaning_vi": "giới từ „từ … trở đi“ (ab vier Jahren, ab elf Uhr)" },
    "b": { "meaning_vi": "giới từ „an + dem“ (buổi trong ngày, ngày)" },
    "c": { "meaning_vi": "giới từ „ở cạnh, vào“", "distractor_vi": "Nhiễu cho chỗ 31: đọc tin TRÊN báo là „in der Zeitung“, không phải „an der Zeitung“." },
    "d": { "meaning_vi": "giới từ „lên, tới“ — „sich freuen auf“" },
    "e": { "meaning_vi": "liên từ „vì“, giữ trật tự câu chính", "distractor_vi": "Nhiễu cặp với WEIL ở chỗ 39: „hat“ đứng cuối nên phải là „weil“." },
    "f": { "meaning_vi": "liên từ „nếu, trong trường hợp“, mở câu phụ", "distractor_vi": "Nhiễu cho chỗ 37: đúng loại liên từ nhưng sai nghĩa." },
    "g": { "meaning_vi": "giới từ „cho, vì“ + Akkusativ" },
    "h": { "meaning_vi": "giới từ „in + dem“ (tháng, mùa)", "distractor_vi": "Nhiễu cặp với AM ở chỗ 38: nói „am Abend“." },
    "i": { "meaning_vi": "giới từ „trong“" },
    "j": { "meaning_vi": "„phải“, ngôi wir/sie/Sie" },
    "k": { "meaning_vi": "liên từ „mặc dù“, mở câu phụ" },
    "l": { "meaning_vi": "giới từ „về, qua“", "distractor_vi": "Nhiễu cặp với AUF ở chỗ 40: „sich freuen über“ dùng cho điều đã có; câu trả lời thì chưa tới." },
    "m": { "meaning_vi": "từ để hỏi „cái gì“" },
    "n": { "meaning_vi": "liên từ „vì“, đẩy động từ xuống cuối" },
    "o": { "meaning_vi": "„sẽ“ Konjunktiv II, ngôi ich/er/sie/es" }
  },
  "items": {
    "SB2-31": { "need_vi": "giới từ: đọc mẩu tin TRÊN báo", "rule_vi": "in der Zeitung lesen",
      "wrong": { "c": { "why_vi": "„an der Zeitung“ không dùng để nói tin đăng trên báo; đọc trên báo là „in der Zeitung“.", "trap": "Bẫy cặp IN/AN" } } },
    "SB2-32": { "need_vi": "giới từ cố định của „sich interessieren“", "rule_vi": "sich interessieren für + Akkusativ" },
    "SB2-33": { "need_vi": "từ để hỏi mở câu hỏi gián tiếp về CÁI GÌ (nhạc cụ nào), „möchte“ ở cuối", "rule_vi": "wissen, was … (động từ cuối)" },
    "SB2-34": { "need_vi": "động từ khuyết thiếu chia theo „wir“, đứng đầu câu hỏi có/không", "rule_vi": "Müssen wir …? (động từ đứng đầu câu hỏi)" },
    "SB2-35": { "need_vi": "giới từ chỉ tuổi tối thiểu, như mẩu tin viết „ab 4 Jahren“", "rule_vi": "ab + Dativ: ab vier Jahren",
      "wrong": { "i": { "why_vi": "„in vier Jahren“ nghĩa là „bốn năm nữa“, sai nghĩa; và IN đã dùng cho chỗ 31.", "trap": "Đúng ngữ pháp, sai nghĩa" } } },
    "SB2-36": { "need_vi": "trợ động từ Konjunktiv II chia theo „ich“, cuối câu có „anfangen“", "rule_vi": "ich würde gern + Infinitiv" },
    "SB2-37": { "need_vi": "liên từ nhượng bộ mở câu phụ, „habe“ ở cuối", "rule_vi": "obwohl … (động từ cuối) = mặc dù",
      "wrong": {
        "f": { "why_vi": "„falls“ (nếu) cũng đẩy động từ xuống cuối, nhưng „tôi muốn học lại NẾU tôi không có nhiều thời gian“ không hợp nghĩa.", "trap": "Đúng loại từ, sai nghĩa" },
        "n": { "why_vi": "„weil“ thành „muốn học lại VÌ không có nhiều thời gian“, ngược ý. Hai ý trái nhau nên dùng „obwohl“; WEIL cần cho chỗ 39.", "trap": "Bẫy ngược nghĩa" } } },
    "SB2-38": { "need_vi": "giới từ cho buổi trong ngày", "rule_vi": "am Abend · am Vormittag",
      "wrong": { "h": { "why_vi": "„im“ dùng cho tháng, mùa; buổi trong ngày nói „am Abend“.", "trap": "Bẫy cặp AM/IM" } } },
    "SB2-39": { "need_vi": "liên từ lý do, „hat“ ở cuối", "rule_vi": "weil … (động từ cuối)",
      "wrong": { "e": { "why_vi": "„denn“ cũng là „vì“ nhưng giữ động từ ở vị trí thứ hai (denn meine Tochter hat …). Ở đây „hat“ đứng cuối ⇒ „weil“.", "trap": "Bẫy cặp WEIL/DENN" } } },
    "SB2-40": { "need_vi": "giới từ của „sich freuen“ cho điều sắp tới", "rule_vi": "sich freuen auf (sắp tới) · sich freuen über (đã có)",
      "wrong": { "l": { "why_vi": "„sich freuen über“ dùng cho điều đã nhận được. Câu trả lời chưa tới ⇒ „auf“.", "trap": "Bẫy cặp AUF/ÜBER" } } }
  }
}
$j$::jsonb FROM mock_exams WHERE exam_format = 'TELC' AND title = 'telc Deutsch B1 — Đề số 4'
ON CONFLICT (exam_id, teil_key) DO UPDATE SET body = EXCLUDED.body;
