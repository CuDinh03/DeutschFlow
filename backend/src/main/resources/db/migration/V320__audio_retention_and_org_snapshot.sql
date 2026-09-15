-- Gói 1 (DEC-22, owner chốt 09/09/2026) — DỌN BẢN GHI ÂM CỦA HỌC VIÊN CHƯA THÀNH NIÊN sau 30 ngày,
-- và làm cho VẾT DỌN rơi đúng SỔ của giám đốc trung tâm.
--
-- Owner chốt: bản GHI ÂM giữ 30 ngày; bản CHUYỂN CHỮ và ĐIỂM giữ lâu dài theo hồ sơ học tập.
-- Cấu trúc dữ liệu sẵn sàng cho đúng luật đó mà không phải đụng gì: `speaking_exam_turns` tách
-- `audio_ref` (khoá S3) khỏi `transcript` + `stt_json`, còn điểm nằm ở
-- `speaking_exam_results.score_sheet_json`. Dọn = nhả `audio_ref`, KHÔNG chạm hai thứ kia.
--
-- 🔴 SỐ HIỆU: V317 (Gói 0 PR-0B) và V319 (Gói 1 PR-1A) đã chiếm; V318 dành cho trigger chặn
--    admin-làm-thành-viên của PR-0A, đang chờ kết quả cổng kiểm chỉ-đọc trên production.
--    `spring.flyway.out-of-order = false` nên thứ tự merge phải là 317 → 318 → 319 → 320.
--
-- ⚠️ BẢN NÀY KHÔNG GẮN TRIGGER NÀO. Nói rõ vì V319 vừa trả giá cho một trigger append-only thiếu
--    `WHEN (pg_trigger_depth() = 0)`: ở đây không có chỗ nào cần bất biến. Cột đánh dấu đã dọn TỒN
--    TẠI ĐỂ ĐƯỢC GHI ĐÈ — job nền chính là bên UPDATE nó — nên một trigger chặn mutation sẽ giết
--    đúng tính năng mà migration này sinh ra. Bằng chứng "ai xoá, lúc nào, bao nhiêu bản ghi" nằm ở
--    `audit_logs` (đã bất biến từ V303), không nằm ở đây.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. `speaking_exam_sessions.org_id` — ẢNH CHỤP trung tâm tại thời điểm TẠO PHIÊN
-- ─────────────────────────────────────────────────────────────────────────────
-- Hiện trạng: bảng này KHÔNG có org_id. Kiểm được bằng một lệnh — `grep -c org_id` trên cả năm
-- migration từng đụng bảng (V277, V279, V283, V284, V305) đều trả về 0. Hôm nay câu hỏi "phiên này
-- thuộc trung tâm nào" chỉ trả lời được bằng cách SUY từ `users.org_id` HIỆN TẠI của chủ phiên —
-- xem `AdminExamGoldenController.orgOfSessionOwner`: SELECT user_id rồi `auditOrgResolver.forUser`.
--
-- Vì sao phép suy đó hỏng ĐÚNG LÚC CẦN NHẤT với job dọn: job chạy 30 NGÀY SAU khi ghi âm. Trong 30
-- ngày ấy học viên hoàn toàn có thể đã rời trung tâm ⇒ `users.org_id` về NULL ⇒ vết dọn ghi ra
-- mang `org_id = NULL`, mà đường đọc sổ của giám đốc lọc `AND org_id = ?` nên loại sạch NULL. Kết
-- quả: đúng cái thao tác xoá dữ liệu học viên của mình mà giám đốc KHÔNG BAO GIỜ THẤY — trong khi
-- đây lại là loại vết mà một trung tâm cần chứng minh nhất khi có người hỏi.
--
-- Đây y hệt nghịch lý mà V317 vừa phải đi vá cho vết của admin nền tảng, và chính V315 đã tự viết
-- rằng đoán theo "trạng thái HIỆN TẠI của actor" là "sai ngay khi một người rời trung tâm hoặc đổi
-- vai". Vá sau không được: dữ liệu để suy ngược đã biến mất cùng lúc với lý do phải suy.
--
-- Không có đường thay thế nào rẻ hơn: `org_member_history` (V316) mới được tạo và CHƯA AI GHI, nên
-- không tra ngược được "30 ngày trước em ấy thuộc trung tâm nào".
--
-- Khoá ngoại để NO ACTION (không ON DELETE) — cùng khuôn với `audit_logs.org_id` (V315),
-- `stt_usage_events.org_id` (V269) và `teacher_classes.org_id` (V204). Ảnh chụp mà `SET NULL` thì
-- tự xoá chính mình đúng lúc cần; còn chuyện chặn xoá trung tâm chỉ là lý thuyết: không đường mã
-- nào xoá `organizations` (kiểm: không có `organizationRepository.delete` / `DELETE FROM
-- organizations` trong backend).
ALTER TABLE speaking_exam_sessions
    ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);

-- Backfill dòng cũ — PHÉP ĐOÁN CÓ Ý THỨC, CHỈ ÁP CHO DỮ LIỆU QUÁ KHỨ.
--
-- Nguồn duy nhất còn giữ thông tin thời-điểm-cũ là `users.org_id` (bất biến V204:
-- `users.org_id == org_members.org_id` của dòng ACTIVE). Đúng khi chủ phiên chưa rời trung tâm kể
-- từ lúc thi; sai thì cũng KHÔNG tệ hơn hiện trạng, vì hiện trạng chính là phép suy này chạy lúc
-- đọc. Cùng lối V269 / V315 / V317-nhánh-3.
--
-- ⚠️ Dòng MỚI KHÔNG được dùng phép đoán này: nhóm 2 ghi `org_id` TƯỜNG MINH lúc tạo phiên, đó mới
--    là chỗ biến cột này từ "một phép suy nhanh hơn" thành "một ảnh chụp".
-- Điều kiện `s.org_id IS NULL` khiến chạy lại là no-op (cổng fresh-migration replay được), và cũng
-- khiến backfill KHÔNG bao giờ đè lên ảnh chụp thật do mã ghi.
UPDATE speaking_exam_sessions s
SET    org_id = u.org_id
FROM   users u
WHERE  u.id = s.user_id
  AND  u.org_id IS NOT NULL
  AND  s.org_id IS NULL;

COMMENT ON COLUMN speaking_exam_sessions.org_id IS
    'Trung tâm của chủ phiên tại thời điểm TẠO PHIÊN (ảnh chụp). Có để vết dọn audio 30 ngày sau '
    'vẫn rơi đúng sổ của giám đốc dù học viên đã rời trung tâm. NULL = phiên B2C. Dòng cũ được '
    'backfill xấp xỉ từ users.org_id; dòng mới ghi tường minh lúc tạo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Dấu vết đã dọn — trả lời "phiên này đã xoá audio chưa, lúc nào, vì sao"
-- ─────────────────────────────────────────────────────────────────────────────
-- 🔴 Nói thẳng cái mà hai cột này KHÔNG làm, để không ai xây nhầm lên chúng: tính CHẠY LẠI AN TOÀN
-- của job KHÔNG đến từ đây. Nó đến từ `speaking_exam_turns.audio_ref` — dọn xong thì `audio_ref` về
-- NULL, dòng tự rời khỏi tập ứng viên; dọn hụt thì key thất bại giữ nguyên tham chiếu (F-12,
-- `ExamGoldenService.purgeAudio`) và lần chạy sau tự nhặt lại. Sự thật "còn object trên S3 không"
-- nằm ở `audio_ref`, không nằm ở một cột trạng thái chép lại nó — một cột như thế chỉ thêm một
-- nguồn sự thật thứ hai để lệch nhau.
--
-- Vậy hai cột này để làm gì: trả lời câu mà `audio_ref IS NULL` KHÔNG trả lời được. Một phiên chưa
-- bao giờ ghi âm và một phiên đã bị xoá audio trông y hệt nhau qua `audio_ref` — cùng NULL. Khi
-- người giám hộ hỏi "bản ghi âm của cháu còn không, ai xoá, lúc nào", đó là hai câu trả lời khác
-- nhau, và `retain_audio` cũng không cứu được vì `false` là giá trị MẶC ĐỊNH của mọi phiên chưa
-- từng có audio.
--
-- Vì sao đặt ở SESSION chứ không ở TURN: trạng thái từng lượt đã có `audio_ref` biểu diễn rồi; thêm
-- mốc cho từng lượt là chép lại cùng một sự thật. `purgeAudio` vốn làm việc theo PHIÊN.
--
-- `audio_purge_reason` không phải trang trí: hôm nay có BA đường xoá audio đi qua cùng một hàm
-- `purgeAudio` — job hạn 30 ngày, `removeParticipant` (rút đồng ý hiệu chuẩn), và endpoint admin dọn
-- tay. Vết `audit_logs` mang ĐỊNH DANH + SỐ LƯỢNG (không nội dung), và với job nền là số lượng theo
-- LƯỢT CHẠY, nên không có cột này thì không ai nói được vì sao RIÊNG bản ghi này biến mất. Quan
-- trọng hơn: `retain_audio = true` hiện chỉ bật cho người tham gia hiệu chuẩn — phần lớn là NGƯỜI
-- LỚN đã ký đồng ý (V284) — nên một job lọc tuổi sai sẽ ăn mất golden set dùng để chuẩn hoá chấm
-- điểm, thứ không tái tạo được. Cột lý do là cách duy nhất soi lại được cơ chế nào đã lấy bản ghi nào.
ALTER TABLE speaking_exam_sessions
    ADD COLUMN IF NOT EXISTS audio_purged_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS audio_purge_reason VARCHAR(24);

-- CHECK tách khỏi ADD COLUMN để chạy lại được (ADD CONSTRAINT không có IF NOT EXISTS) — khuôn V316.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_speaking_sessions_purge_reason') THEN
        ALTER TABLE speaking_exam_sessions
            ADD CONSTRAINT chk_speaking_sessions_purge_reason
            CHECK (audio_purge_reason IS NULL OR audio_purge_reason IN (
                'MINOR_RETENTION_30D',  -- job hạn 30 ngày (DEC-22)
                'CONSENT_REVOKED',      -- ExamGoldenService.removeParticipant
                'ADMIN_PURGE'           -- AdminExamGoldenController.purgeAudio (dọn tay / ghi âm hỏng)
            ));
    END IF;
    -- Hai cột đi thành cặp: một mốc không lý do là một bản ghi biến mất không ai giải thích được,
    -- một lý do không mốc là một câu chuyện không có thời điểm. Mọi dòng đang có đều NULL cả hai
    -- nên ràng buộc thoả ngay, không cần backfill.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_speaking_sessions_purge_pair') THEN
        ALTER TABLE speaking_exam_sessions
            ADD CONSTRAINT chk_speaking_sessions_purge_pair
            CHECK ((audio_purged_at IS NULL) = (audio_purge_reason IS NULL));
    END IF;
END $$;

COMMENT ON COLUMN speaking_exam_sessions.audio_purged_at IS
    'Lúc audio của phiên được xoá XONG HẲN (mọi key S3 đã xoá thật). Đặt CÙNG giao dịch với lần '
    'purge thành công. NULL = chưa từng dọn, hoặc dọn còn key thất bại. KHÔNG phải nguồn sự thật '
    'cho "còn object trên S3 không" — cái đó là speaking_exam_turns.audio_ref.';

COMMENT ON COLUMN speaking_exam_sessions.audio_purge_reason IS
    'Cơ chế nào đã xoá: MINOR_RETENTION_30D | CONSENT_REVOKED | ADMIN_PURGE. Luôn đi kèm '
    'audio_purged_at (chk_speaking_sessions_purge_pair).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index cho job: "quá hạn, còn audio thật"
-- ─────────────────────────────────────────────────────────────────────────────
-- Index đặt trên `speaking_exam_turns`, KHÔNG phải trên `speaking_exam_sessions`, vì đó là nơi câu
-- hỏi thật sự nằm. Job lọc ứng viên bằng
--     EXISTS (SELECT 1 FROM speaking_exam_turns t
--             WHERE t.session_id = s.id AND t.audio_ref IS NOT NULL AND t.audio_ref <> '')
-- chứ không bằng cờ `retain_audio` — và đúng như vậy: cờ đó bị hạ khi purge thành công, nên lái theo
-- cờ sẽ mất dấu vĩnh viễn một phiên có key S3 lỗi hoặc có ai đó hạ cờ bằng tay. Một index trên
-- `sessions(created_at) WHERE retain_audio AND audio_purged_at IS NULL` nghe hợp lý nhưng planner
-- KHÔNG dùng được cho câu trên (vị từ `retain_audio` không có trong WHERE) — nó sẽ là index chết.
--
-- Vị từ index phải KHỚP HẲN cả hai điều kiện, kể cả `<> ''`. Đo trên PostgreSQL 17, 60.000 phiên /
-- 360.000 lượt / 3.600 lượt có audio (đúng tỉ lệ ~1% phiên hiệu chuẩn hôm nay):
--     không index                          → Parallel Seq Scan 360k lượt, 5.839 buffer
--     partial CHỈ `audio_ref IS NOT NULL`  → Bitmap Heap Scan, 2.308 heap block (phải recheck <> '')
--     partial khớp cả hai (bản dưới đây)   → Index Only Scan, Heap Fetches: 0, 7 buffer · index 56 kB
-- Bỏ vế `<> ''` làm index vẫn "được dùng" nhưng mất gần hết tác dụng — đúng kiểu tối ưu trông xanh
-- mà không xanh.
--
-- MỘT PHẦN nên co lại theo đúng thứ còn phải dọn: mỗi lần purge nhả `audio_ref` là một mục rời khỏi
-- index; dọn hết thì index rỗng và không tốn gì. Nó cũng phục vụ luôn `ExamGoldenService.purgeAudio`
-- và mọi câu "phiên này còn audio không".
CREATE INDEX IF NOT EXISTS idx_speaking_exam_turns_audio_present
    ON speaking_exam_turns (session_id)
    WHERE audio_ref IS NOT NULL AND audio_ref <> '';

-- 🪤 LUẬT CHO NHÓM 2 — ghi `audio_purged_at` + `audio_purge_reason` CHỈ KHI `purgeAudio` trả về
--    `failed` RỖNG, và ghi trong CÙNG giao dịch với chỗ đang hạ `retain_audio = false`
--    (`ExamGoldenService:551`). Đặt mốc khi còn key thất bại là nói dối về một việc chưa xong —
--    tệp S3 vẫn sống mà sổ ghi là đã xoá. Ràng buộc `chk_speaking_sessions_purge_pair` bắt buộc ghi
--    cả hai cột cùng lúc, nên không có đường ghi nửa vời.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. `student_assignments` — ĐÃ XEM, CỐ Ý KHÔNG THÊM CỘT NÀO
-- ─────────────────────────────────────────────────────────────────────────────
-- Bài nộp có thể là tệp âm thanh thật (`StudentAssignmentController.ALLOWED_UPLOAD_TYPES` nhận
-- audio/mpeg, audio/mp4, audio/m4a, audio/aac… — định dạng expo-audio ghi trên máy), key
-- `assignments/{assignmentId}/{userId}_{ts}{ext}`. Nên câu hỏi là đúng chỗ. Ba lý do để KHÔNG gắn
-- cùng bộ cột như §1–§2, theo thứ tự sức nặng:
--
-- (a) VẤN ĐỀ ORG KHÔNG TỒN TẠI Ở BẢNG NÀY. Lý do §1 phải có `org_id` là vì phiên thi nói chỉ neo
--     vào MỘT CON NGƯỜI (`user_id`), mà con người thì rời trung tâm. Bài nộp thì neo vào LỚP:
--     `student_assignments.assignment_id` → `class_assignments.class_id` → `teacher_classes.org_id`
--     (V133 + V204). Lớp không rời trung tâm, nên đường tra org ở đây vốn đã là ảnh chụp theo huyết
--     thống dữ liệu — thêm cột là chép lại một sự thật đã đúng sẵn, và chép lại thì có ngày lệch.
--
-- (b) CỘT ĐÁNH DẤU ĐÃ DỌN CŨNG THỪA, VÌ CHÍNH CỘT DỮ LIỆU ĐÃ TỰ GIỚI HẠN. Dọn xong là
--     `submission_file_url` về NULL, dòng rời khỏi tập ứng viên — y hệt vai trò `audio_ref` đang làm
--     cho phiên thi nói. Cột `audio_purged_at` của §2 sinh ra để phân biệt "đã xoá" với "chưa từng
--     có", và ở đây sự phân biệt đó KHÔNG có giá trị tương đương: một bài nộp không có tệp là
--     chuyện thường ngày (nộp bằng chữ), không phải một câu hỏi ai cần trả lời.
--
-- (c) XOÁ Ở ĐÂY LÀ XOÁ CHÍNH BÀI LÀM, KHÔNG PHẢI XOÁ BẢN SAO — và đó là câu hỏi cho OWNER, không
--     phải cho schema. Luật "ghi âm 30 ngày, chuyển chữ + điểm lâu dài" giữ được ở phiên thi nói là
--     NHỜ bản chuyển chữ sống sót (`transcript` + `stt_json` + `score_sheet_json`). Bài nộp thì
--     KHÔNG có bản chuyển chữ nào: `GradingService` chấm `submission_content` (chữ),
--     `HandwritingOcrService` đọc ẢNH, và không có đường STT nào cho audio bài nộp — giáo viên nghe
--     rồi chấm. Xoá tệp là xoá luôn căn cứ của điểm đã chốt.
--
-- ⚠️ NỢ ĐỂ LẠI — cần owner quyết, không đoán thay được:
--     · 6 điểm gọi `MinorGate.assertAudioAllowed` hiện có KHÔNG bao gồm endpoint cấp URL nộp bài
--       (`StudentAssignmentController.getPresignedUrl`). Học viên chưa thành niên vẫn nộp được tệp
--       ghi âm dù cổng PR-1B đã đóng sáu đường kia. Chặn ở đó rẻ hơn và không mất dữ liệu nào.
--     · Không có cột nào lưu loại phương tiện: một cột `submission_file_url` VARCHAR(1024) (V136)
--       dùng chung cho ảnh, PDF, docx, video, text và audio, còn đuôi tệp lấy từ `filename` do client
--       gửi và CÓ THỂ RỖNG (mã gán `extension = ""` khi tên không có dấu chấm). Vì vậy job dọn buộc
--       phải nhận diện audio bằng danh sách đuôi tệp và BỎ QUA phần còn lại (đúng lựa chọn an toàn:
--       thà sót còn hơn xoá nhầm bài PDF). Thêm cột kiểu phương tiện lúc cấp URL sẽ gỡ được phép đoán
--       — nhưng CHỈ cho tệp nộp từ đó về sau; mọi dòng đang có vẫn phải đoán. Nên đó là một hạng mục
--       riêng có đánh đổi riêng, không phải thứ nhét kèm vào migration này.
