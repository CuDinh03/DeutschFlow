-- V379: ngày phát hành của bộ đề — để màn học viên gắn nhãn "Mới" cho đề vừa có.
--
-- created_at không dùng được: đề ghép ở Xưởng đề (và đề viết tay nhập bằng migration) được tạo với
-- reviewed = FALSE ("Sắp có"), nhiều ngày sau mới phát hành. Nhãn "Mới" phải tính từ lúc học viên
-- thật sự làm được đề.
--
-- Mọi đường phát hành đều đi qua việc bật reviewed (nút Phát hành của Xưởng đề, hoặc UPDATE trong
-- migration), nên ngày phát hành do trigger đóng dấu — không đường nào quên được.

ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Đề đã có: coi ngày tạo là ngày phát hành. Đề còn "Sắp có" để trống tới khi phát hành.
UPDATE mock_exams SET published_at = created_at WHERE reviewed = TRUE AND published_at IS NULL;

CREATE OR REPLACE FUNCTION mock_exams_stamp_published_at() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.reviewed AND NEW.published_at IS NULL THEN
            NEW.published_at := now();
        END IF;
    ELSIF NEW.reviewed AND NOT OLD.reviewed THEN
        NEW.published_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mock_exams_published_at ON mock_exams;
CREATE TRIGGER trg_mock_exams_published_at
    BEFORE INSERT OR UPDATE OF reviewed ON mock_exams
    FOR EACH ROW EXECUTE FUNCTION mock_exams_stamp_published_at();
