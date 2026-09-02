# Kho từ vựng và hub Từ vựng — kiến trúc, dữ liệu thật, và những gì còn nợ

> **Trạng thái: ĐANG CHẠY trên `main`** tại `383db46b` (02/09/2026). Năm đợt của kế hoạch
> "thiết kế lại hub Từ vựng" đã merge; hai đợt còn lại chặn ở owner (§7).
>
> Tài liệu này là **nguồn chân lý duy nhất** cho hợp đồng API từ vựng và cho hiện trạng dữ liệu.
> Mọi con số dưới đây đã đối chiếu với code trên `main` hoặc đo trực tiếp trên DB tại thời điểm viết.
> **Sửa code mà lệch tài liệu thì sửa tài liệu trong cùng PR.**

## 0. Vì sao có tài liệu này

Phần lớn kiến thức về kho từ vựng trước đây nằm rải rác trong mô tả PR và ghi chú phiên làm việc.
Những thứ đắt nhất — *dữ liệu nào không đáng tin*, *bộ đếm phải khớp bộ lọc*, *hai cột song song cho
cùng một mục từ* — không suy ra được từ code, và mất đi là phải khám phá lại từ đầu. Chúng ở đây.

| Nhãn | Nghĩa |
|---|---|
| 🟢 **ĐANG CHẠY** | Có trên `main`, đã đo. Đổi là breaking change. |
| 🔴 **DỮ LIỆU HỎNG** | Đang tồn tại trên prod, chưa sửa được bằng code. |
| ⛔ **CÒN NỢ** | Chưa làm, có người chặn hoặc phụ thuộc. |

---

## 1. Sự thật quan trọng nhất: 72,6% nhãn cấp độ không có nguồn

🔴 **DỮ LIỆU HỎNG.** Kho có **10.957 mục từ**. Phân bố nhãn CEFR trên prod:

| Cấp | Số từ | Có nguồn? |
|---|---|---|
| A1 | 682 | ✅ khớp wordlist Goethe |
| A2 | 636 | ✅ (wordlist có 656 — 20 lemma còn kẹt nhãn cao hơn) |
| B1 | 1.688 | ✅ (wordlist có 1.920 — 232 lemma còn kẹt) |
| **B2** | **2.000** | ❌ **không nguồn nào** |
| **C1** | **5.951** | ❌ **không nguồn nào** |

`CefrLevelResolver` — nguồn cấp độ **duy nhất** trong code — chỉ nạp ba danh sách A1/A2/B1. Ba khoá
cấu hình `app.vocabulary.cefr-sources.b2-list` / `c1-list` / `c2-list` để trống, nên `countsByLevel()`
trả về **0** cho B2, C1 và C2. Mọi nhãn B2/C1 đang hiển thị là tàn dư của thuật toán cũ (gán cấp theo
dải tần suất rồi nhồi cho đủ quota), và `POST /api/admin/vocabulary/cefr/reclassify` **chưa từng chạy
trên prod** để dọn.

### 1.1 Vì sao kho có 10.957 từ mà wordlist chỉ có 3.258

`OfficialCefrVocabularyImportService` bơm kho lên ~10k bằng `backend/src/main/resources/wordlists/de_50k.txt`
— bảng tần suất dựng từ **phụ đề phim** (hermitdave/FrequencyWords). Hệ quả: kho chứa thán từ, tên
riêng và dạng chia, không phải mục từ.

| Mục từ trong kho | Hạng de_50k | Thực chất |
|---|---|---|
| `aah` / `aaah` / `aaaah` | 5.847 / 14.367 / 28.006 | thán từ trong phụ đề |
| `aaarrrgghh` | 42.287 | tiếng gào |
| `aaron` / `aarons` | 3.799 / 40.813 | tên riêng |
| `aang` | 35.008 | tên nhân vật phim *Avatar* |
| `aale` | 33.083 | số nhiều của `Aal` |

🔑 **Cách kiểm lại mà không cần DB prod:** `grep -n "^<từ> " backend/src/main/resources/wordlists/de_50k.txt`
cho ra hạng tần suất. Có mặt ở đó mà không có trong `goethe_official_wordlist.tsv` ⇒ vào kho vì tần
suất, không vì giá trị sư phạm.

### 1.2 `words` có HAI cột song song cho cùng một mục từ

🔴 **DỮ LIỆU HỎNG — bẫy này đã gây một lỗi im lặng, xem §5.**

| Cột | Ai ghi | Ai đọc |
|---|---|---|
| `base_form` | trình import | `WordQueryService` (toàn bộ hệ thống từ vựng) |
| `word` / `translation` | migration seed cũ | entity JPA `Word` |

Trình import chỉ ghi `base_form`, nên **107/261 dòng** (đo trên bản migration sạch) có
`word`/`translation` NULL. Code nào đọc qua entity `Word` sẽ thấy NULL ở gần một nửa kho.

### 1.3 `dtype` trộn hoa/thường và còn nhãn ngoài danh mục

Cột `words.dtype` chứa cả `'Noun'` (trình import) lẫn `'NOUN'` (migration seed), cộng thêm `PRONOUN`,
`NUMBER`, `PHRASE`, `INTERJECTION`. Đo trên bản migration sạch: so khớp thẳng `dtype = 'Noun'` chỉ
bắt được **63/154** danh từ thật, và **22** từ không thuộc nhóm nào.

🟢 Đã xử lý bằng `DTYPE_GROUP_EXPR` trong `WordQueryService`: quy về bốn nhóm không phân biệt hoa
thường, nhãn lạ rơi vào `Word`. **Đừng viết `dtype = ?` thẳng ở truy vấn mới** — dùng biểu thức đó.

---

## 2. Hợp đồng API — `/api/words`

🟢 **ĐANG CHẠY.** Tất cả đều cần đăng nhập; `userId` lấy từ phiên.

| Endpoint | Trả về | Dùng ở đâu |
|---|---|---|
| `GET /api/words` | danh sách phân trang | hub (cuộn vô hạn), mobile, client cũ |
| `GET /api/words/facets` | số từ theo **từng trục lọc** | dải chip của hub |
| `GET /api/words/deck` | bộ thẻ một lượt luyện | swipe · quiz mạo từ · luyện nói |
| `GET /api/words/levels` | số từ theo cấp | **giữ cho client cũ**, hub đã chuyển sang `/facets` |
| `GET /api/words/coverage[...]` | độ phủ danh từ/động từ/bản dịch | màn thống kê, báo cáo admin |

Tham số lọc dùng chung: `q`, `cefr` + `exact`, `topic`, `focus`, `tag`, `dtype`, `gender`, `status`, `locale`.

### 2.1 Ô tìm (`q`)

🟢 Khớp **lemma và nghĩa**, không phân biệt hoa/thường:

- `LOWER(w.base_form) LIKE ?` — Postgres `LIKE` vốn phân biệt hoa/thường; thiếu `LOWER` thì gõ `haus`
  không ra `Haus`.
- `EXISTS` trên `word_translations` theo locale hiện tại, dự phòng `en`.
- `escapeLikeWildcards()` thoát `\`, `%`, `_`. **Không thoát thì một dấu `%` trả về cả kho.**
- Khi có từ khoá, kết quả xếp theo chất lượng khớp: khớp tuyệt đối → đầu từ → **giữa từ** → chỉ khớp
  nghĩa. Bậc "giữa từ" bắt buộc phải giữ: từ ghép tiếng Đức (`Kranken`**`haus`**) sống nhờ nó.

⚠️ `topic` rơi vào **cùng** nhánh lọc này (`query = topic` khi `q` rỗng), nên trang luyện nói lọc theo
chủ đề cũng hưởng đúng ngữ nghĩa đó. Cố ý — không tách ngữ nghĩa tìm kiếm thứ hai.

🔑 **Không có index nào cho `q`, và đó là quyết định có đo.** Trên 11.241 từ (lớn hơn prod), từ khoá
khớp 1.575 dòng: câu đếm **4,8 ms**, câu trang **7,8 ms**. Quét tuần tự ở quy mô này rẻ hơn chi phí một
migration `CREATE EXTENSION pg_trgm` trên RDS. **Đo lại nếu kho vượt ~50k từ.**

### 2.2 Facets — bất biến quan trọng nhất của hub

🟢 `GET /api/words/facets` đếm năm trục trong một lượt gọi: `status`, `dtype`, `gender`, `cefr`, `topics`.

> **Bất biến:** con số trên một chip phải bằng **đúng số từ nhận được khi chọn chip đó**.

Kéo theo hai luật ràng buộc mọi thay đổi sau này:

1. **Đếm trục nào thì bỏ bộ lọc của chính trục đó ra khỏi WHERE** (`buildFilter(f, FacetAxis.X)`).
   Giữ lại thì mọi chip không được chọn về 0 và người học kẹt ở lựa chọn hiện tại.
2. **Biểu thức đếm phải khớp TỪNG CHỮ với vế lọc tương ứng.** Ngày 02/09 chip "Danh từ" ghi 151 mà bấm
   vào chỉ ra 60, vì bộ lọc còn kèm ràng buộc "phải có mạo từ" mà bộ đếm không tính.

`VocabularyFacetsIntegrationTest` có một ca **bấm thử từng chip của cả năm trục rồi so tổng** — đó là ca
canh bất biến này. Đừng xoá nó.

⚠️ Trục cấp độ đếm theo **từng cấp**, nên client chọn từ chip phải gửi `exact=true`. Chế độ mặc định là
**cộng dồn** (A2 = A1+A2) — giữ nguyên cho mobile và client cũ.

### 2.3 Deck — cách bốc từ cho bài luyện

🟢 `GET /api/words/deck?mode=SWIPE|ARTICLE|SPEAK&size=…`

Thứ tự sư phạm:

1. từ **đến hạn ôn**, quá hạn lâu nhất trước;
2. bù bằng từ **chưa học**, theo **dải** `frequency_rank` rộng `FREQUENCY_BAND = 500` — từ hay gặp vào trước;
3. phần còn lại.

Trong cùng một bậc thì trộn theo cặp *(người dùng, ngày)*: hai lượt cùng ngày ra cùng bộ, hôm sau đổi bộ.

- `UNRANKED_SENTINEL = 10000` là **giá trị mặc định** của cột `frequency_rank` (V151), nghĩa là "chưa
  biết hạng" — bị đẩy xuống cuối, không chen vào giữa.
- `mode=ARTICLE` thêm ràng buộc danh từ **có** mạo từ. Ràng buộc này **thuộc về deck, không thuộc bộ lọc
  tra cứu** — để nguyên trong `dtype=Noun` thì chip "Danh từ" ở hub không đếm được danh từ chưa gán giống.
- Cấp độ **cộng dồn** theo mặc định: ba bài luyện nhận một *mức sàn*, không phải đúng một cấp.

Trước 02/09 cả swipe lẫn quiz đều gọi `/words?page=0&size=20` rồi trộn *trong đúng 20 thẻ đó*. Server sắp
theo cấp rồi alphabet nên trang 0 là bất biến ⇒ **bộ thẻ không bao giờ đổi**, và luôn bắt đầu từ chữ A.

---

## 3. Ghi tiến độ học

🟢 `POST /api/vocabulary/{wordId}/learn` — đường ghi tiến độ **duy nhất** của các bài luyện. Idempotent.

Gọi từ: thẻ vuốt (vuốt phải hoặc gõ đúng) và quiz mạo từ (đáp đúng). Trang **luyện nói chưa gọi** — bài
đó chấm bằng AI, "nói đúng một lần" là tín hiệu khác hẳn "biết từ này".

> **Không best-effort.** Đây là hành động tiến độ do người học chủ động bấm, nên lưu hỏng phải nổi lên
> tới người gọi. Trước 02/09 nó đi qua `SrsVocabScheduler.schedule()` — hàm nuốt mọi exception — nên
> endpoint trả **202 kể cả khi không ghi được dòng nào**, và nó hỏng thật (xem §5).

Phía client `frontend/src/app/v2/student/vocabulary/progress.ts`: lưu hỏng **không** ném ra ngoài (người
học đang giữa lượt vuốt) nhưng cũng **không** bị nuốt — trả `false`, cộng dồn, và màn hình kết thúc lượt
nói rõ còn bao nhiêu từ chưa lưu được.

⚠️ **Việc ghi không được phụ thuộc animation.** `SwipeCard` gọi `onDecided` ngay lúc người học quyết
định, tách khỏi `onSwipe` vốn chỉ chạy sau khi animation thoát thẻ hoàn tất. Tab bị ẩn (rAF bị throttle),
chuyển trang giữa chừng, hay máy bật giảm chuyển động — animation không kết thúc thì tiến độ biến mất
không dấu vết.

---

## 4. Hub `/v2/student/vocabulary`

🟢 Bố cục từ trên xuống: **một việc chính** → hàng lối vào phụ → khối tra cứu (tìm → lọc → đếm → lưới).

- Việc chính: còn thẻ đến hạn thì "Ôn N từ đến hạn" dẫn tới màn ôn tập; hết hạn mới mời "Học 20 từ mới".
  Số N lấy từ `GET /api/srs/count` qua `dueCount.ts`.
- Hàng phụ **lọc bỏ** đích mà việc chính đã dẫn tới — không lặp một lối vào hai lần trên cùng màn.
- Ba dải chip: trạng thái học · từ loại + mạo từ (der xanh · die đỏ · das lục) · chủ đề. Cấp độ nằm ở
  một select phụ, vì đó là trục dữ liệu yếu nhất (§1).
- **Chip chỉ hiện khi có từ, hoặc khi đang được chọn.** Chip đếm 0 là chip dẫn tới danh sách rỗng.
- Bỏ chọn "Danh từ" thì bỏ luôn mạo từ đang chọn, nếu không còn lại một bộ lọc mồ côi trả về rỗng.
- Trạng thái ôn tập trên thẻ từ hiện bằng **cả chấm màu lẫn nhãn chữ** — màu không được là tín hiệu duy nhất.

Phần thuần logic tách ra `facets.ts`, `progress.ts`, `dueCount.ts` để test được mà không cần render.

⚠️ `frontend/src/app/v2/student/vocabulary/swipe/SwipeCard.tsx` có loại thẻ trung tính `'unknown'`
(nhãn "Wort", màu xám) cho **danh từ chưa có dữ liệu giống**. Trước 02/09 nhánh dự phòng gán
`'adjective'`, nên thẻ dán nhãn **"Adjektiv" lên danh từ** — trúng ~39% số từ (91/234). Không hiển thị
được mạo từ là một chuyện; khẳng định sai từ loại là chuyện khác.

---

## 5. Ba lỗi im lặng đã sửa — và cách chúng lộ ra

Ghi lại vì cả ba đều **không** lộ ra khi đọc code.

| Lỗi | Lộ ra khi | Dấu hiệu |
|---|---|---|
| Ô tìm coi `%` là ký tự đại diện | viết test cho ô tìm | gõ một dấu `%` trả về **cả kho** |
| Chip "Danh từ" ghi 151, bấm ra 60 | **dựng stack lên nhìn tận mắt** | bộ đếm và bộ lọc lệch nhau một vế |
| `POST …/learn` trả 202 mà không ghi gì | viết test trước khi sửa | **3/4 ca đỏ, kể cả ca hợp lệ nhất** |

Bài học chung: **ba lớp kiểm khác nhau bắt ba loại lỗi khác nhau.** Đọc code bắt được lỗi logic; viết
test bắt được lỗi biên; dựng ứng dụng lên nhìn bắt được lỗi mà cả hai lớp trên đều cho là đúng.

---

## 6. Chạy tại chỗ để nghiệm thu

Khi Docker không dùng được, dựng Postgres riêng:

```bash
# 1) Cụm dùng-một-lần. LC_ALL=C là BẮT BUỘC, thiếu thì pg_ctl chết với
#    "postmaster became multithreaded during startup".
export LC_ALL=C LANG=C
initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
printf "port = 55442\ntimezone = 'UTC'\n" >> "$PGDATA/postgresql.conf"
pg_ctl -D "$PGDATA" -w start
createdb -h 127.0.0.1 -p 55442 -U postgres df_it
psql -h 127.0.0.1 -p 55442 -U postgres -d df_it -c \
  "CREATE EXTENSION vector; CREATE EXTENSION btree_gist;"

# 2) Integration test
TZ=UTC DEUTSCHFLOW_IT_JDBC_URL=jdbc:postgresql://127.0.0.1:55442/df_it \
DEUTSCHFLOW_IT_USERNAME=postgres DEUTSCHFLOW_IT_PASSWORD=postgres \
DEUTSCHFLOW_IT_REQUIRE_DB=true ./mvnw -o test
```

Backend chạy local **bắt buộc `TZ=UTC`** — migration `V199` tự huỷ nếu session timezone khác UTC.

Tài khoản `student@deutschflow.com` cần có dòng trong `user_learning_profiles` + `learning_plans` thì
các trang luyện tập mới không đá về onboarding; `goal_type` chỉ nhận `WORK` hoặc `CERT`.

🔴 **`frontend/.env.local` trỏ `NEXT_PUBLIC_BACKEND_URL` sang PRODUCTION.** Copy sang worktree để chạy
dev thì **phải đổi về `http://localhost:8080` trước khi mở trang**, nếu không trang dev bắn thẳng vào prod.

---

## 7. ⛔ Còn nợ

| # | Việc | Chặn ở |
|---|---|---|
| 1 | **Deploy backend** | Merge vào `main` **không** tự deploy BE. Chưa deploy thì prod vẫn chạy bản cũ: ô tìm còn phân biệt hoa/thường, chưa có `/facets` và `/deck`, endpoint `learn` vẫn trả 202 rỗng. |
| 2 | **Chạy `POST /api/admin/vocabulary/cefr/reclassify`** | Cần token ADMIN. Chưa chạy thì mọi con số trên chip vẫn đếm cả 7.951 từ rác (§1). **Đây là nút thắt gốc.** |
| 3 | **Cổng `publish_status`** | Phụ thuộc việc 2. Thêm cột trạng thái xuất bản vào `words`, backfill theo luật, rồi chặn ở `buildFilter` — một dòng điều kiện là mọi truy vấn phía học viên theo. |
| 4 | Nguồn wordlist cho B2/C1/C2 | Cắm vào `app.vocabulary.cefr-sources.b2-list` / `c1-list` / `c2-list`. Không phải sửa code. |
| 5 | Trang luyện nói ghi tiến độ | Quyết định sản phẩm: "nói đúng một lần" có đáng coi là "đã học" không. |

**Thứ tự bắt buộc:** việc 2 trước việc 3. `reclassifyAllWords()` xoá sạch `cefr_level` rồi gán lại từ
wordlist; chạy sau backfill thì luật cổng đọc phải nhãn giả và cho 7.951 từ rác đi thẳng qua.

---

## 8. Đọc thêm

| Chủ đề | Ở đâu |
|---|---|
| Quy trình merge ngăn xếp PR và cổng CI | [`stacked-pr-and-ci-gates.md`](stacked-pr-and-ci-gates.md) (cùng thư mục) |
| Bất biến facet, có ca test canh | `backend/src/test/java/com/deutschflow/vocabulary/VocabularyFacetsIntegrationTest.java` |
| Thứ tự bốc thẻ | `backend/src/test/java/com/deutschflow/vocabulary/VocabularyDeckIntegrationTest.java` |
| Ô tìm | `backend/src/test/java/com/deutschflow/vocabulary/VocabularySearchIntegrationTest.java` |
| Ghi tiến độ | `backend/src/test/java/com/deutschflow/vocabulary/MarkWordLearnedIntegrationTest.java` |

### Lịch sử — năm đợt đã lên `main` ngày 02/09/2026

| Đợt | Nội dung | Commit |
|---|---|---|
| 2 | Ô tìm: hoa/thường, tìm nghĩa, thoát wildcard | `82eb85fe` |
| 3 | Ba trục lọc + `/words/facets` | `bbb44b44` |
| 4 | `/words/deck` | `0f0a4fe5` |
| 4b | Ghi tiến độ về server | `b7be837d` |
| 5 | Bố cục hub | `383db46b` |
