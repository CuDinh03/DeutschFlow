# Ngăn xếp PR và cổng CI — quy trình đã kiểm chứng

> **Trạng thái: ĐANG CHẠY.** Bản sửa cổng ở `6ad1fa8a` (#459). Quy trình merge ở §2 rút ra từ đợt merge
> năm PR xếp chồng ngày 02/09/2026, mỗi bước đều đã chạy thật.
>
> **Sửa `.github/workflows/*` mà lệch tài liệu thì sửa tài liệu trong cùng PR.**

## 1. Bốn workflow và cách chúng kích hoạt

| Workflow | Kích hoạt trên PR | Lọc theo |
|---|---|---|
| `backend-ci.yml` | **mọi** PR | `pull_request:` trần, lọc `paths` ở nhánh `push` |
| `security-ci.yml` | **mọi** PR | `pull_request:` trần |
| `frontend-ci.yml` | PR đụng `frontend/**` | `paths` — **không** lọc base |
| `mobile-ci.yml` | PR đụng `mobile/**` | `paths` — **không** lọc base |

### 1.1 🪤 Lọc `pull_request.branches` khiến PR xếp chồng KHÔNG qua cổng

Trước `6ad1fa8a`, `frontend-ci` và `mobile-ci` đều lọc `pull_request.branches: [main, …]`. Bộ lọc đó chỉ
khớp nhánh **đích**, nên PR có base là một nhánh feature khác rơi ra ngoài và workflow **không hề chạy**.

Nguy hiểm nằm ở chỗ nó **không đỏ — nó vắng mặt**, và PR vẫn hiện `CLEAN` / `MERGEABLE` vì hai workflow
kia vẫn xanh. Nhìn qua tưởng đã qua cổng đầy đủ. Ngăn xếp năm PR ngày 02/09 merge được mà chưa từng chạy
`tsc`, `lint`, i18n guard hay bản build thật một lần nào trên CI — trong khi bốn PR trong đó sửa frontend.

**Cách kiểm bất kỳ PR nào:**

```bash
gh pr view <N> --json statusCheckRollup --jq '[.statusCheckRollup[].workflowName] | unique'
```

Thiếu `Frontend CI` trên một PR có sửa `frontend/**` là dấu hiệu workflow không kích hoạt, không phải
nó pass.

### 1.2 🪤 Hai kiểu "không chạy" mà GitHub xử lý khác nhau

| | Có check run? | Branch protection |
|---|---|---|
| Workflow bị `paths:` / `branches:` chặn | **không** | pending vĩnh viễn → **BLOCKED** |
| Job bị `if:` skip | **có**, kết luận `skipped` | **chấp nhận** |

`main` yêu cầu `🔨 Compile` + `🧪 Unit Tests` (trong `backend-ci.yml`). Workflow đó để `pull_request:` trần
chính vì lý do này — PR không đụng backend vẫn sinh check run với kết luận `skipped`, nên không bị chặn.
**Đừng thêm `paths` vào `pull_request` của `backend-ci.yml`.**

### 1.3 `types: [… , edited]` — có mặt, nhưng đừng trông đợi nhiều

`frontend-ci` và `mobile-ci` khai báo `types: [opened, synchronize, reopened, edited]`, kèm chốt lọc ở
mỗi job để bỏ qua lần `edited` chỉ sửa tiêu đề/mô tả:

```yaml
if: >-
  github.event_name != 'pull_request'
  || github.event.action != 'edited'
  || github.event.changes.base != null
```

Ý định là: khi PR bị trỏ lại base thì cổng chạy lại. **Trong thực tế của repo này nó gần như không bao giờ
kích hoạt**, vì mọi lần trỏ lại base sau một squash-merge đều làm PR xung đột ngay lập tức, mà xung đột
thì GitHub không dựng được merge ref để chạy workflow. Cổng thật sự chạy ở bước push sau khi xử lý xung
đột — tức sự kiện `synchronize`, vốn đã kích hoạt CI từ trước.

Giữ lại vì vô hại (chốt lọc làm nó skip) và vẫn có ích khi retarget sạch. Đã kiểm: sửa mô tả PR sinh một
lượt chạy mới với kết luận `skipped`.

---

## 2. Merge một ngăn xếp PR (squash)

Repo dùng **squash merge**. Điều đó tạo SHA mới cho nội dung mà nhánh dưới đã có sẵn, nên **xung đột là
chắc chắn** ở mỗi bước, không phải xui.

### 2.1 🪤 Merge KHÔNG tự trỏ lại base

GitHub chỉ trỏ lại base của PR chồng khi **nhánh base bị xoá**. Và xoá nhánh base thủ công
(`git push origin --delete`) thì **đóng luôn PR chồng lên nó**.

⇒ Phải trỏ lại **tường minh**, trước khi xoá bất cứ nhánh nào.

### 2.2 Quy trình cho mỗi bước

```bash
gh pr merge <PR-dưới> --squash          # 1. merge
gh pr edit <PR-kế> --base main          # 2. trỏ lại base TƯỜNG MINH

git fetch origin                        # 3. BẮT BUỘC — quên là merge phải main cũ
git switch <nhánh-PR-kế>
git merge origin/main                   # 4. xung đột ở đây là bình thường
#    → xử lý theo §2.3
./mvnw -o test                          # 5. chạy test THẬT, đừng tin merge tự động
git push
#    6. chờ CI xanh rồi mới merge PR kế
```

Bỏ bước 3 là bẫy dễ dính nhất: `git merge origin/main` với ref cũ sẽ merge **sạch một cách giả tạo** vì
nó chưa hề chứa PR vừa merge. Kiểm bằng `git merge-base --is-ancestor origin/main HEAD`.

### 2.3 🔑 Xung đột: kiểm trước khi chọn phe

Câu hỏi duy nhất cần trả lời: **main có đóng góp gì cho file này không?**

```bash
git diff origin/main <tip-nhánh-trước-khi-merge> -- <file>
```

| Kết quả | Nghĩa | Cách xử lý |
|---|---|---|
| **rỗng** | main giống hệt nhánh ở file này, không đóng góp gì | `git checkout --ours <file>` an toàn |
| **khác rỗng** | main có phần của người khác | **CẤM `--ours`** — nó lấy cả file và xoá mất phần đó. Gỡ dấu xung đột theo **từng vùng**. |

Ca thật ngày 02/09: hai PR đầu rơi vào cột "rỗng"; PR cuối thì ba file `student.*.json` rơi vào cột
"khác rỗng" — main đã có thêm `progressNotSaved` và `scoreBelowThreshold` từ một PR khác. Dùng `--ours`
ở đó là xoá khoá i18n của người khác, im lặng.

Sau khi giải quyết, **kiểm ngược lại**: cả phần của mình lẫn phần của main đều còn, và với JSON thì file
còn parse được.

### 2.4 Sau khi merge xong cả ngăn xếp

```bash
git push origin --delete <nhánh>   # an toàn: mọi PR đã trỏ về main, không PR nào phụ thuộc nữa
git branch -D <nhánh>
```

---

## 3. Frontend CI làm gì

Chạy tay đúng chuỗi này khi cần chắc chắn mà không đợi CI:

```bash
cd frontend
npm ci
npx tsc --noEmit
npm run lint
npm run check:i18n                     # parity 3 locale + usage resolve được
npm test -- --coverage
../scripts/i18n/check_i18n.py          # chuỗi cứng chưa qua t()
npm run build                          # bản build THẬT
```

Bước cuối là bước đắt nhất và **không lớp nào khác thay được**: `tsc` và unit test không chạy static
generation, nên một trang có thể qua hết các cổng trên rồi vẫn ném `MISSING_MESSAGE` hoặc hỏng khi dựng
artifact production.

🪤 `npx tsc` có thể báo lỗi giả từ `.next/types` còn sót sau khi merge kéo về route mới. CI chạy trên
checkout sạch nên không gặp; ở máy thì xoá `.next/types` rồi chạy lại.

---

## 4. Nợ đã biết ở cấu hình workflow

| Việc | Ghi chú |
|---|---|
| Dọn `push.branches` của `frontend-ci` | `feat/onboarding-v3` **đã merge trọn** vào main (gỡ được). `dev` thì **chưa** — còn 19 commit chưa lên main tại 02/09, dù chú thích của `mobile-ci` gọi nó là "nhánh chết". Đo bằng `git merge-base --is-ancestor origin/<b> origin/main` trước khi gỡ bất kỳ nhánh nào. |
| `types: edited` | Xem §1.3 — cân nhắc gỡ nếu thấy rườm rà. |
| Branch protection trên `main` | Chưa bật. |
