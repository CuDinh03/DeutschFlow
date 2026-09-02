# `plans/reference/` — tài liệu tham chiếu sống

Khác phần còn lại của `plans/` vốn là **kế hoạch theo ngày** (làm xong thì đóng lại), thư mục này chứa
tài liệu **mô tả hệ thống như nó đang là**. Nó phải đúng với `main` tại mọi thời điểm.

> Đặt ở `plans/` chứ không phải `docs/` vì `.gitignore` loại `docs/` khỏi git ("DOCS nội bộ, không push").
> Tài liệu ở đây cần sống sót qua một lần `git clone`, nên phải nằm trong cây được theo dõi.

| Tài liệu | Nội dung |
|---|---|
| [`vocabulary-hub.md`](vocabulary-hub.md) | Hợp đồng API `/api/words`, hiện trạng dữ liệu kho từ vựng, các bất biến, và việc còn nợ |
| [`stacked-pr-and-ci-gates.md`](stacked-pr-and-ci-gates.md) | Bốn workflow CI kích hoạt thế nào, và quy trình merge một ngăn xếp PR squash |

**Quy ước:** sửa code mà lệch tài liệu ở đây thì sửa tài liệu **trong cùng PR**. Mọi con số phải đo được
hoặc đối chiếu được với code; đừng ghi con số không kiểm lại được.
