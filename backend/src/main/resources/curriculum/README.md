# Curriculum Resources — Hướng dẫn nội bộ

## Vai trò từng file

### `/netzwerk-neu/a1.curriculum.json`
- **Loại:** Tài liệu tham khảo nội bộ (Content team dùng khi viết bài)
- **KHÔNG** được load trong runtime — chỉ dùng làm checklist để đối chiếu nội dung với sách giáo khoa Netzwerk Neu (Klett)
- **Hệ chính:** `skill_tree_nodes` trong database (bắt đầu từ migration V67)

### Mapping: Netzwerk Neu → Skill Tree

| Netzwerk Neu | Skill Tree Day | Chủ đề |
|---|---|---|
| L01 | Day 11–14 | Guten Tag! (Chào hỏi, giới thiệu) |
| L02 | Day 15–17 | Freunde, Kollegen und ich (Sở thích, nghề nghiệp) |
| L03 | Day 29–31 | In Hamburg (Giao thông, chỉ đường) |
| L04 | Day 18–21 | Guten Appetit! (Ẩm thực, mua sắm) |
| L05 | Day 25–28 | Alltag und Familie (Thời gian, gia đình) |
| L08 | Day 32–34 | Fit und gesund (Sức khỏe) |
| L09 | Day 22–24 | Meine Wohnung (Nhà ở) |

### Quy ước

- Khi thêm nội dung mới, **luôn viết trong migration SQL** (INSERT/UPDATE vào `skill_tree_nodes`)
- File JSON chỉ dùng để xem qua cấu trúc bài học mong muốn theo sách
- Không tạo thêm file JSON cho A2, B1... — tất cả nội dung vào database
