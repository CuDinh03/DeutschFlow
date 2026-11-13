package com.deutschflow.interview.dto;

/**
 * Một trang nghề được lập chỉ mục ({@code GET /api/public/occupations/indexable}) — nguồn duy nhất cho
 * sitemap, cùng điều kiện {@code reviewed} mà trang {@code /phong-van/[nghe]} dùng cho meta robots.
 *
 * @param code         mã nghề trên URL
 * @param lastModified ngày nội dung trang đổi lần cuối (ISO {@code yyyy-MM-dd}): mới nhất giữa dòng
 *                     danh mục và câu lớp nghề đã duyệt; {@code null} khi không biết
 */
public record IndexableOccupationDto(String code, String lastModified) {}
