# Báo cáo: Từ vựng chưa được phân cấp chuẩn theo CEFR — 14/08/2026

**Bề mặt gặp lỗi:** `/v2/student/vocabulary` (web), `/student/vocab-practice` (v1), tab Từ vựng (mobile) — tất cả đọc `words.cefr_level` qua `GET /api/words`.

**Kết luận ngắn:** cấp độ trong bảng `words` **không phải CEFR**. Nó là kết quả của ba trình import chồng lên nhau, trong đó nguồn Goethe thật là nguồn YẾU nhất, còn cấp độ chủ yếu được suy ra từ **thứ hạng tần suất** và từ **vị trí trong danh sách**, cộng thêm phần "nhồi cho đủ chỉ tiêu".

---

## 1. Bằng chứng: chạy lại chính thuật toán đang chạy trong prod

Dựng lại `OfficialCefrVocabularyImportService.importCuratedCefrVocabulary()` trên đúng 3 file wordlist đang đóng gói trong JAR (`cefr_a1_patsy.txt`, `goethe_sorted.txt`, `de_50k.txt`) — script: `scratchpad/replicate-cefr-import.mjs`.

| Số đo | Kết quả |
|---|---|
| Từ còn giữ nhãn **A1 thật** sau khi merge | **12** / 10.000 |
| Phân bố cuối cùng | A1 2.000 · A2 2.000 · B1 2.000 · B2 2.000 · C1 2.000 (đúng bằng quota — không phải phân bố ngôn ngữ) |
| Từ bị **gán cấp bừa để lấp quota** | **2.919 / 10.000 (29%)** |
| 643 lemma Goethe **A1** kết thúc ở đâu | A1 63 · A2 41 · **B1 407** · B2 52 · C1 5 · rơi khỏi kho 75 |
| Cắt theo bảng chữ cái | C1 chỉ còn `-d` → `anzustellen` (toàn từ bắt đầu bằng "a"); B2 chỉ tới `kommissar` |

Ví dụ cụ thể: `aber` → B1, `abbildung` → C1, `acht` → A2; còn `gut`, `danke` được xếp **A1 chỉ vì lấp chỗ trống**, không phải vì được phân loại A1.

## 2. Sáu nguyên nhân gốc trong code

**L-1 — Không có nguồn CEFR cho A2/B2/C1.** `application.yml:476-478` để `classpath-a2/b2/c1` **rỗng**, nên `OfficialCefrVocabularyImportService.java:143-173` rơi vào nhánh dự phòng: A2 = 3.000 từ đầu bảng tần suất `de_50k`, B2 = hạng 3.000–7.000, C1 = hạng 7.000+. Đây là **tần suất, không phải CEFR**.

**L-2 — Heuristic đè lên nguồn thật.** `mergeLevel` (`OfficialCefrVocabularyImportService.java:343-358`) giữ cấp **cao nhất** và chạy theo thứ tự A1 → A2 → B1 → B2 → C1, nên dải tần suất luôn ghi đè danh sách Goethe A1. Đó là lý do 407/643 từ A1 thật bị đẩy lên B1.

**L-3 — Nhồi cho đủ quota.** Mỗi cấp cứng 2.000 từ; thiếu thì lấy tiếp từ bảng tần suất và **gán vào bất kỳ cấp nào đang thiếu** (`firstDeficitLevel`, dòng 230-247). 29% kho có cấp độ hoàn toàn ngẫu nhiên.

**L-4 — Cắt theo bảng chữ cái.** Danh sách mỗi cấp `sort(naturalOrder())` rồi cắt ở 2.000 (dòng 195-225) → nội dung mỗi cấp dồn hết về đầu bảng chữ cái.

**L-5 — Ba trình import đá nhau, nguồn thật yếu nhất.**

| Thứ tự | Trình import | Cách gán cấp | Quyền ghi |
|---|---|---|---|
| `@Order(10)` | `GoetheVocabularyAutoImportService` | **Vị trí trong danh sách**: index <500 = A1, <1000 = A2, <2000 = B1, <4000 = B2, còn lại C1 (`levelForIndex`, dòng 539) | ~8.000 từ |
| `@Order(20)` | `GoetheOfficialWordlistImportService` | **Nguồn THẬT** — `goethe_official_wordlist.tsv` (A1 235 · A2 616 · B1 159) | `shouldUpgradeCefr` (dòng 452) **chỉ nâng, không hạ** ⇒ không bao giờ kéo được từ đã bị đẩy lên B2/C1 về đúng chỗ |
| `@Order(30)` | `OfficialCefrVocabularyImportService` | Dải tần suất + nhồi quota | **Ghi đè vô điều kiện** 10.000 dòng (`upsertLemma`, dòng 422) |

Cả ba đều `auto-import-on-startup: true` ⇒ **mỗi lần restart backend là nhãn bị dập lại**.

**L-6 — A1 là thùng rác mặc định.** `V1__create_vocabulary_tables.sql:9`: `cefr_level VARCHAR(64) NOT NULL DEFAULT 'A1'`; `GlosbeVocabularyImportService.normalizeCefr(null) → "A1"`; `ImportGoetheA1FromTsv` hard-code `'A1'`. Mọi từ không rõ cấp đều rơi vào A1.

**Khớp với ảnh chụp màn hình:** các từ đầu danh sách (`abbildung`, `aber`, `acht`, `ähnlich`…) đều gắn A1 **và viết thường** (danh từ tiếng Đức phải viết hoa) — dấu hiệu chúng đến từ bảng tần suất viết thường và đang mang **nhãn mặc định A1**. Tức prod nhiều khả năng đang ở trạng thái "gần như toàn bộ = A1" (curated import chưa chạy hoặc đã tắt), chứ chưa phải trạng thái phân bố 2.000/cấp ở mục 1 — cả hai trạng thái đều sai, chỉ khác kiểu sai.

**Cách xác nhận (cần tài khoản ADMIN, 1 lệnh):** `GET /api/admin/vocabulary/review/stats` → trả `byLevel` (số từ theo từng `cefr_level`).

## 3. Lỗi hiển thị đi kèm

- **Chip lọc là CỘNG DỒN nhưng nhãn ghi như lọc rời.** `WordQueryService.cumulativeCefrLevelsIncluding` (dòng 800) khiến `cefr=B1` trả **A1+A2+B1**, trong khi chip chỉ ghi "B1" → người dùng thấy lẫn cấp và tưởng dữ liệu sai.
- **Chip C2 vô nghĩa.** `LEVEL_ORDER` của importer dừng ở C1 ⇒ không có từ C2 nào; do lọc cộng dồn nên bấm C2 = xem toàn kho.

## 4. Ảnh hưởng ngoài trang Từ vựng

- `SessionExerciseService.java:210` sinh bài tập buổi học bằng `WHERE w.cefr_level = 'A1'` ⇒ bài tập lấy từ đúng cái thùng rác A1.
- v1 `vocab-practice` và tab từ vựng mobile cũng lọc theo `cefr` ⇒ cùng lỗi.

## 5. Đã sửa trong PR này (code — chưa đụng dữ liệu prod)

Owner chốt 14/08: **mở rộng wordlist chính thức trước rồi mới backfill**, và làm PR sửa code trọn gói.

**Đ1 — Một nguồn sự thật duy nhất.** `CefrLevelResolver` (mới) là chỗ duy nhất quyết định `cefr_level`:

| Ưu tiên | Nguồn | Cấp |
|---|---|---|
| 1 | `goethe_official_wordlist.tsv` (trích PDF Goethe, có cấp từng dòng) | A1/A2/B1 chính xác |
| 2 | `cefr_a1_patsy.txt` — Wortliste A1 (668 lemma) | A1 |
| 3 | `cefr-sources.a2/b2/c1/c2-list` (chưa cấu hình — chỗ để cắm wordlist mới) | theo cấu hình |
| 4 | `goethe_sorted.txt` — Wortliste **B1** của Goethe, cộng dồn A1–B1 | B1 cho phần còn lại |
| — | Bảng tần suất `de_50k` | **không quyết định cấp** — chỉ chọn từ nào vào kho |

Danh sách Goethe là cộng dồn nên lemma xuất hiện ở nhiều danh sách lấy **cấp THẤP NHẤT** (cấp gặp từ lần đầu) — ngược hẳn quy tắc "giữ cấp cao nhất" đã đẩy 407 từ A1 lên B1. Kết quả hiện tại: **3.068 lemma có cấp thật — A1 674 · A2 371 · B1 2.023**; B2/C1/C2 = 0 vì **chưa có nguồn** (thà trống còn hơn bịa).

**Đ2 — Bỏ toàn bộ phần đoán.** Xoá dải tần suất → cấp, xoá nhồi quota, xoá cắt theo bảng chữ cái, xoá `levelForIndex` (gán cấp theo vị trí). `GoetheOfficialWordlistImportService` nay được quyền **hạ cấp** (`shouldApplyCefr`), nên wordlist thật kéo được từ bị đẩy nhầm lên B2/C1 về đúng chỗ. `normalizeCefr(null)` trả `null` thay vì `"A1"` — A1 hết là thùng rác.

**Đ3 — `cefr_level` được phép NULL** (migration `V272`): "chưa phân cấp" nay là trạng thái hợp lệ, thay cho `NOT NULL DEFAULT 'A1'`.

**Đ4 — Import không còn tự chạy lúc khởi động.** `GOETHE_AUTO_IMPORT_ON_STARTUP`, `GOETHE_OFFICIAL_WORDLIST_AUTO_IMPORT`, `CEFR_CURATED_AUTO_IMPORT_STARTUP` mặc định **false**. Ghi lại cấp cả kho phải là thao tác có chủ đích, không phải tác dụng phụ của mỗi lần deploy.

**Đ5 — Lọc đúng cấp + nhóm "chưa phân cấp".** `GET /api/words?cefr=A2&exact=true` trả đúng A2 (mặc định vẫn cộng dồn để mobile/web v1 không đổi hành vi); `cefr=UNGRADED` lọc nhóm chưa phân cấp. Thêm `GET /api/words/levels` trả số từ theo từng cấp — chip cấp độ ở `/v2/student/vocabulary` nay dựng từ số liệu thật (kèm số đếm), nên không còn chip rỗng như chip C2, và nhãn chip khớp badge trên từng thẻ từ.

**Đ6 — Backfill có công tắc riêng:** `POST /api/admin/vocabulary/cefr/reclassify` → xoá cấp cũ rồi gán lại theo wordlist, có ghi audit log. **Chưa chạy trên prod** (chờ owner duyệt sau khi wordlist được mở rộng).

## 6. Việc còn lại

1. **Mở rộng wordlist chính thức** (việc chính, quyết định độ phủ):
   - `goethe_official_wordlist.tsv` mới có 1.010 dòng (A1 235 · A2 616 · B1 159) trong khi Goethe A1 ~650 / A2 ~1.300 / B1 ~2.400. Script trích `scripts/extract_goethe_pdfs.py` cần thư mục `wordsDeutsch/` (3 PDF Goethe) — thư mục này nằm trong `.gitignore` và **không còn trên máy**; đưa lại PDF vào là chạy lại được, phần B1 của script cũng cần sửa (159/2.400 dòng ⇒ parser hụt).
   - Chưa có nguồn cho **B2/C1/C2** — cần owner chốt nguồn; cắm vào `app.vocabulary.cefr-sources.b2-list/c1-list/c2-list` là xong, không phải sửa code.
   - Ví dụ độ phủ còn thiếu: `aber` (A1 thật) hiện ra B1 vì không có trong TSV lẫn bản Anki A1, chỉ có trong danh sách B1 cộng dồn.
2. **Chạy backfill trên prod** sau khi wordlist đủ: gọi endpoint ở Đ6 rồi đối chiếu `GET /api/admin/vocabulary/review/stats`.
3. **Xác nhận trạng thái prod hiện tại** bằng `GET /api/admin/vocabulary/review/stats` (cần tài khoản ADMIN) — dự đoán: gần như toàn bộ đang là `A1` mặc định.
4. Kiểm tra lại `SessionExerciseService` (sinh bài tập từ `cefr_level = 'A1'`) sau backfill: A1 sẽ còn ~674 từ thật thay vì cả kho.

**Đánh đổi đã chấp nhận:** sau backfill, bộ lọc cấp độ chỉ trả ~3.000 từ có nhãn thật (phần còn lại vào nhóm "Chưa phân cấp") thay vì 10.957 từ mang nhãn bịa. Độ phủ tăng lại theo mức mở rộng wordlist ở mục 6.1.
