-- =============================================================
-- SEED: Dữ liệu test cho vuhuyen@deutschflow.com (TEACHER role)
-- Tạo 2 lớp, 5 học viên mẫu, bài tập, nộp bài, giáo án
-- Chạy: docker exec deutschflow-postgres psql -U postgres -d deutschflow -f /tmp/seed_teacher_testdata.sql
-- =============================================================
DO $$
DECLARE
  v_teacher_id  BIGINT;
  v_class1_id   BIGINT;
  v_class2_id   BIGINT;
  v_students    BIGINT[];
  v_sid         BIGINT;
  v_asgn1       BIGINT;
  v_asgn2       BIGINT;
  v_asgn3       BIGINT;
  v_asgn4       BIGINT;
BEGIN

  ----------------------------------------------------------------
  -- 1. Teacher ID
  ----------------------------------------------------------------
  SELECT id INTO v_teacher_id FROM users WHERE email = 'vuhuyen@deutschflow.com';
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy vuhuyen@deutschflow.com trong bảng users';
  END IF;
  RAISE NOTICE '[1] teacher_id = %', v_teacher_id;

  ----------------------------------------------------------------
  -- 2. Lấy 5 học viên đầu tiên có role STUDENT
  ----------------------------------------------------------------
  SELECT ARRAY_AGG(id ORDER BY id)
    INTO v_students
    FROM (SELECT id FROM users WHERE role = 'STUDENT' LIMIT 5) t;

  IF v_students IS NULL OR array_length(v_students, 1) = 0 THEN
    RAISE EXCEPTION 'Không có user nào có role STUDENT trong DB';
  END IF;
  RAISE NOTICE '[2] Tìm được % học viên: %', array_length(v_students, 1), v_students;

  ----------------------------------------------------------------
  -- 3. Tạo lớp 1: A1 Nhập môn
  ----------------------------------------------------------------
  SELECT id INTO v_class1_id
    FROM teacher_classes
   WHERE teacher_id = v_teacher_id AND name = '[TEST] A1 Nhập môn tiếng Đức';

  IF v_class1_id IS NULL THEN
    INSERT INTO teacher_classes (teacher_id, name, invite_code, created_at, updated_at)
    VALUES (v_teacher_id, '[TEST] A1 Nhập môn tiếng Đức', 'HUYEN-A1-TEST', NOW() - interval '45 days', NOW())
    RETURNING id INTO v_class1_id;

    INSERT INTO class_teachers (class_id, teacher_id, role, joined_at)
    VALUES (v_class1_id, v_teacher_id, 'PRIMARY', NOW() - interval '45 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '[3] Tạo lớp A1 id=%', v_class1_id;
  ELSE
    RAISE NOTICE '[3] Lớp A1 đã tồn tại id=%', v_class1_id;
  END IF;

  ----------------------------------------------------------------
  -- 4. Tạo lớp 2: B1 Luyện thi Goethe
  ----------------------------------------------------------------
  SELECT id INTO v_class2_id
    FROM teacher_classes
   WHERE teacher_id = v_teacher_id AND name = '[TEST] B1 Luyện thi Goethe';

  IF v_class2_id IS NULL THEN
    INSERT INTO teacher_classes (teacher_id, name, invite_code, created_at, updated_at)
    VALUES (v_teacher_id, '[TEST] B1 Luyện thi Goethe', 'HUYEN-B1-TEST', NOW() - interval '20 days', NOW())
    RETURNING id INTO v_class2_id;

    INSERT INTO class_teachers (class_id, teacher_id, role, joined_at)
    VALUES (v_class2_id, v_teacher_id, 'PRIMARY', NOW() - interval '20 days')
    ON CONFLICT DO NOTHING;
    RAISE NOTICE '[4] Tạo lớp B1 id=%', v_class2_id;
  ELSE
    RAISE NOTICE '[4] Lớp B1 đã tồn tại id=%', v_class2_id;
  END IF;

  ----------------------------------------------------------------
  -- 5. Enroll học viên
  --    Lớp A1: 3 học viên đầu
  --    Lớp B1: tất cả 5
  ----------------------------------------------------------------
  FOR i IN 1..LEAST(3, array_length(v_students, 1)) LOOP
    INSERT INTO class_students (class_id, student_id, joined_at)
    VALUES (v_class1_id, v_students[i], NOW() - interval '40 days')
    ON CONFLICT DO NOTHING;
  END LOOP;

  FOR i IN 1..array_length(v_students, 1) LOOP
    INSERT INTO class_students (class_id, student_id, joined_at)
    VALUES (v_class2_id, v_students[i], NOW() - interval '15 days')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '[5] Enrolled học viên xong';

  ----------------------------------------------------------------
  -- 6. Bài tập cho lớp A1
  ----------------------------------------------------------------
  -- Kiểm tra idempotent trước khi insert
  SELECT id INTO v_asgn1
    FROM class_assignments WHERE class_id = v_class1_id AND topic = 'Giới thiệu bản thân (Schreiben)';
  IF v_asgn1 IS NULL THEN
    INSERT INTO class_assignments (class_id, topic, description, due_date, created_at, assignment_type, skill)
    VALUES (v_class1_id, 'Giới thiệu bản thân (Schreiben)',
            'Viết đoạn văn 80-120 từ giới thiệu bản thân bằng tiếng Đức.',
            NOW() - interval '7 days', NOW() - interval '20 days', 'GENERAL', 'SCHREIBEN')
    RETURNING id INTO v_asgn1;
  END IF;

  SELECT id INTO v_asgn2
    FROM class_assignments WHERE class_id = v_class1_id AND topic = 'Nghe hội thoại A1 (Hören)';
  IF v_asgn2 IS NULL THEN
    INSERT INTO class_assignments (class_id, topic, description, due_date, created_at, assignment_type, skill)
    VALUES (v_class1_id, 'Nghe hội thoại A1 (Hören)',
            'Nghe file âm thanh và trả lời 5 câu hỏi trắc nghiệm.',
            NOW() + interval '7 days', NOW() - interval '5 days', 'GENERAL', 'HOREN')
    RETURNING id INTO v_asgn2;
  END IF;
  RAISE NOTICE '[6] Bài tập lớp A1: asgn1=%, asgn2=%', v_asgn1, v_asgn2;

  ----------------------------------------------------------------
  -- 7. Bài tập cho lớp B1
  ----------------------------------------------------------------
  SELECT id INTO v_asgn3
    FROM class_assignments WHERE class_id = v_class2_id AND topic = 'Viết thư phàn nàn B1';
  IF v_asgn3 IS NULL THEN
    INSERT INTO class_assignments (class_id, topic, description, due_date, created_at, assignment_type, skill)
    VALUES (v_class2_id, 'Viết thư phàn nàn B1',
            'Viết thư chính thức phàn nàn về dịch vụ (150-200 từ). Sử dụng Konjunktiv II.',
            NOW() + interval '5 days', NOW() - interval '8 days', 'GENERAL', 'SCHREIBEN')
    RETURNING id INTO v_asgn3;
  END IF;

  SELECT id INTO v_asgn4
    FROM class_assignments WHERE class_id = v_class2_id AND topic = 'Thuyết trình chủ đề tự do (Sprechen)';
  IF v_asgn4 IS NULL THEN
    INSERT INTO class_assignments (class_id, topic, description, due_date, created_at, assignment_type, skill)
    VALUES (v_class2_id, 'Thuyết trình chủ đề tự do (Sprechen)',
            'Nói 2-3 phút về chủ đề tự chọn. Quay video và nộp link.',
            NOW() + interval '14 days', NOW() - interval '3 days', 'GENERAL', 'SPRECHEN')
    RETURNING id INTO v_asgn4;
  END IF;
  RAISE NOTICE '[7] Bài tập lớp B1: asgn3=%, asgn4=%', v_asgn3, v_asgn4;

  ----------------------------------------------------------------
  -- 8. Nộp bài: student_assignments (trạng thái hỗn hợp)
  ----------------------------------------------------------------
  -- Lớp A1, bài 1 (Giới thiệu bản thân): 1 graded, 1 submitted, 1 pending
  IF array_length(v_students, 1) >= 1 THEN
    INSERT INTO student_assignments
      (assignment_id, student_id, status, submission_content, submitted_at, score, feedback, graded_at, created_at)
    VALUES (v_asgn1, v_students[1], 'GRADED',
      'Hallo, ich heiße Nguyen Van An. Ich bin 22 Jahre alt und komme aus Hanoi, Vietnam. Ich studiere Informatik an der Technischen Universität Hanoi. In meiner Freizeit lese ich gern Bücher und spiele Gitarre.',
      NOW() - interval '10 days', 8, 'Bài viết tốt, cấu trúc rõ ràng. Cần chú ý dấu câu cuối đoạn.',
      NOW() - interval '3 days', NOW() - interval '12 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF array_length(v_students, 1) >= 2 THEN
    INSERT INTO student_assignments
      (assignment_id, student_id, status, submission_content, submitted_at, created_at)
    VALUES (v_asgn1, v_students[2], 'SUBMITTED',
      'Guten Tag! Mein Name ist Tran Thi Bich. Ich lerne seit 3 Monaten Deutsch. Ich komme aus Ho Chi Minh Stadt. Mein Hobby ist Kochen und Reisen.',
      NOW() - interval '6 days', NOW() - interval '12 days')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Lớp B1, bài 3 (Viết thư): 2 submitted, còn lại pending
  IF array_length(v_students, 1) >= 1 THEN
    INSERT INTO student_assignments
      (assignment_id, student_id, status, submission_content, submitted_at, created_at)
    VALUES (v_asgn3, v_students[1], 'SUBMITTED',
      'Sehr geehrte Damen und Herren, ich schreibe Ihnen bezüglich meines letzten Besuchs in Ihrem Restaurant am 15. Juni. Leider war ich mit dem Service sehr unzufrieden...',
      NOW() - interval '2 days', NOW() - interval '8 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF array_length(v_students, 1) >= 3 THEN
    INSERT INTO student_assignments
      (assignment_id, student_id, status, submission_content, submitted_at, score, feedback, graded_at, created_at)
    VALUES (v_asgn3, v_students[3], 'GRADED',
      'Sehr geehrte Damen und Herren, hiermit möchte ich mich über die verspätete Lieferung meiner Bestellung beschweren. Die Bestellung mit der Nummer 12345 sollte am 10. Juni ankommen, traf aber erst am 18. Juni ein.',
      NOW() - interval '5 days', 9, 'Xuất sắc! Konjunktiv II dùng rất đúng chỗ. Cấu trúc thư chuẩn mực.',
      NOW() - interval '1 day', NOW() - interval '8 days')
    ON CONFLICT DO NOTHING;
  END IF;
  RAISE NOTICE '[8] student_assignments xong';

  ----------------------------------------------------------------
  -- 9. Giáo án (class_lessons) lớp A1
  ----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM class_lessons WHERE class_id = v_class1_id LIMIT 1) THEN
    INSERT INTO class_lessons (class_id, order_index, title, description, is_completed, completed_at, completed_by_teacher_id, created_at, updated_at) VALUES
      (v_class1_id, 1, 'Buổi 1: Chào hỏi & Giới thiệu', 'Hallo, Guten Morgen, Wie heißen Sie? – mẫu câu cơ bản nhất', TRUE, NOW()-interval'42 days', v_teacher_id, NOW(), NOW()),
      (v_class1_id, 2, 'Buổi 2: Số đếm 1–100 + Màu sắc', 'eins, zwei, drei… rot, blau, grün…', TRUE, NOW()-interval'35 days', v_teacher_id, NOW(), NOW()),
      (v_class1_id, 3, 'Buổi 3: Gia đình (Familie)', 'Vater, Mutter, Bruder, Schwester, Großeltern', TRUE, NOW()-interval'28 days', v_teacher_id, NOW(), NOW()),
      (v_class1_id, 4, 'Buổi 4: Nghề nghiệp (Berufe)', 'Ich bin Lehrer. Er arbeitet als Ingenieur.', TRUE, NOW()-interval'21 days', v_teacher_id, NOW(), NOW()),
      (v_class1_id, 5, 'Buổi 5: Thức ăn & Nhà hàng', 'Ich möchte bitte ein Bier. Das Schnitzel, bitte.', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class1_id, 6, 'Buổi 6: Chỉ đường', 'Links, rechts, geradeaus. Wo ist der Bahnhof?', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class1_id, 7, 'Buổi 7: Mua sắm (Einkaufen)', 'Wie viel kostet das? Ich nehme das.', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class1_id, 8, 'Buổi 8: Ôn tập + Kiểm tra A1', 'Tổng hợp toàn bộ chủ điểm ngữ pháp A1', FALSE, NULL, NULL, NOW(), NOW());
    RAISE NOTICE '[9] Tạo 8 buổi học lớp A1';
  ELSE
    RAISE NOTICE '[9] Lớp A1 đã có lessons, bỏ qua';
  END IF;

  ----------------------------------------------------------------
  -- 10. Giáo án lớp B1
  ----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM class_lessons WHERE class_id = v_class2_id LIMIT 1) THEN
    INSERT INTO class_lessons (class_id, order_index, title, description, is_completed, completed_at, completed_by_teacher_id, created_at, updated_at) VALUES
      (v_class2_id, 1, 'Buổi 1: Cấu trúc đề thi Goethe B1', '4 kỹ năng – thang điểm – chiến lược làm bài', TRUE, NOW()-interval'18 days', v_teacher_id, NOW(), NOW()),
      (v_class2_id, 2, 'Buổi 2: Kỹ năng Đọc (Lesen)', 'Skimming, scanning – 3 dạng đề thường gặp', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class2_id, 3, 'Buổi 3: Kỹ năng Nghe (Hören)', 'Nghe hội thoại – điền thông tin – chọn đáp án', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class2_id, 4, 'Buổi 4: Kỹ năng Viết (Schreiben)', 'Thư phàn nàn, yêu cầu – mẫu câu Konjunktiv II', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class2_id, 5, 'Buổi 5: Kỹ năng Nói (Sprechen)', 'Bày tỏ ý kiến, đề xuất, phản đối lịch sự', FALSE, NULL, NULL, NOW(), NOW()),
      (v_class2_id, 6, 'Buổi 6: Đề thi thử trọn bộ', 'Mock test 4 kỹ năng + chữa đề chi tiết', FALSE, NULL, NULL, NOW(), NOW());
    RAISE NOTICE '[10] Tạo 6 buổi học lớp B1';
  ELSE
    RAISE NOTICE '[10] Lớp B1 đã có lessons, bỏ qua';
  END IF;

  ----------------------------------------------------------------
  -- 11. Đánh giá kỹ năng cho 1 học viên ở lớp A1 (để test giao diện)
  ----------------------------------------------------------------
  IF array_length(v_students, 1) >= 1 THEN
    UPDATE class_students
       SET skill_horen     = 6.5,
           skill_lesen     = 7.0,
           skill_schreiben = 6.0,
           skill_sprechen  = 5.5,
           teacher_comment = 'Tiến bộ tốt sau 4 buổi học. Cần tập trung vào kỹ năng Nói.',
           evaluated_at    = NOW() - interval '7 days'
     WHERE class_id = v_class1_id AND student_id = v_students[1];
  END IF;
  RAISE NOTICE '[11] Cập nhật skill score cho 1 học viên';

  RAISE NOTICE '=== SEED HOÀN TẤT === lớp A1=% | lớp B1=%', v_class1_id, v_class2_id;
END $$;
