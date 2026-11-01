-- Đợt 4A: mỗi học viên có tối đa một chứng nhận CÒN HIỆU LỰC trong một lớp. OrgCertificateService kiểm
-- trước khi cấp, nhưng hai request đồng thời cùng lọt qua được nên chốt ở DB. Thu hồi xong thì cấp lại được.
-- Bảng đang trống trên production (31/10/2026) nên tạo chỉ mục không khoá gì đáng kể.
CREATE UNIQUE INDEX uq_org_cert_active_student_class
    ON org_certificates (class_id, student_user_id)
    WHERE active;
