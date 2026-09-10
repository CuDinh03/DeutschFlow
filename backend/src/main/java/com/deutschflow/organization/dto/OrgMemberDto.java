package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Một thành viên trong tổ chức (OWNER|MANAGER|TEACHER|STUDENT).
 *
 * @param birthDateRecorded {@code users.birth_date} đã có giá trị chưa — D4. {@code null} =
 *        KHÔNG TÍNH ở đường này (mọi vai khác STUDENT, và các đường trả thành viên lẻ như
 *        mời/đổi vai/console admin), khác hẳn {@code false} = đã tính và ĐANG THIẾU. Trung tâm
 *        đếm số phải đi đòi giấy tờ bằng {@code false}, nên hai giá trị này không được lẫn: ngày sinh của nhân sự trung
 *        tâm không phải việc của màn này, và trả {@code false} cho họ sẽ đẩy nhân sự vào đúng cái
 *        chỉ báo "chưa khai ngày sinh" mà trung tâm dùng để đi đòi giấy tờ học viên.
 *        ⛔ Trường này CỐ Ý là boolean chứ không phải ngày sinh: màn danh sách chỉ cần biết CÒN
 *        THIẾU hay không, và ngày sinh là dữ liệu của trẻ — đừng phát nó ra chỗ không dùng tới.
 */
public record OrgMemberDto(
        Long userId,
        String email,
        String displayName,
        String role,
        String status,
        Instant joinedAt,
        Boolean birthDateRecorded
) {}
