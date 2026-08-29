# Đồng hồ trong ví token & ngày lịch VN — vì sao test phải ghim `Clock`

> Trạng thái: **CI XANH** ngày **2026-08-30** trên PR #416 (nhánh `fix/quota-clock-flaky-it`, base
> `origin/main` `473bfcdf`) — job `🐘 Integration Tests` chạy TOÀN BỘ IT của repo:
> `Tests run: 177, Failures: 0, Errors: 0, Skipped: 10`. Chờ owner merge. Phần còn chưa kiểm: §10.
> Phạm vi: `AiUsageLedgerService` + unit test của nó + hai lớp integration test hạn mức token.
>
> Đặt ở `backend/` chứ không phải `docs/` vì `.gitignore:203` ignore `docs/*` (chỉ chừa vài thư mục
> Wave gate), nên doc để trong `docs/` sẽ không theo repo khi clone. Cùng chỗ với
> `backend/INTERVIEW_OPTIMIZATION_REVIEW.md`.
>
> Tài liệu này ghi lại *vì sao* thiết kế hiện tại như vậy, để lần sau ai đụng vào không phải dò lại
> từ đầu và không vô tình gỡ mất phần đang giữ cho test khỏi đỏ oan.

---

## 1. Tóm tắt

`QuotaBillingIntegrationTest.ledgerDebit_freshTrialNeverAccrued_accruesBeforeDebit_keepsPro` đỏ ngẫu
nhiên trên CI khi build rơi vào khoảng **00:00–00:10 giờ `Asia/Ho_Chi_Minh`** (17:00–17:10 UTC), với

```
expected: 399523L
 but was: 799523L
```

Nguyên nhân **không phải** lỗi sản phẩm, cũng **không phải** assert quá chặt. Nguyên nhân là test và
service đọc "bây giờ" **hai lần riêng biệt**; nửa đêm giờ VN rơi vào giữa hai lần đọc thì service
thấy đã sang ngày lịch mới và cộng dồn ví thêm một ngày grant.

Cách vá: đưa `Clock` thành bean, `AiUsageLedgerService` đọc `clock.instant()`, test ghim `Clock` về
một mốc cố định để **cả hai phía nhìn cùng một mốc**.

---

## 2. Bằng chứng, không phải suy luận

Lỗi đã được **tái hiện xác định** (không phải ngồi chờ tới nửa đêm). Cách tái hiện: thêm tạm một test
đặt `starts_at` vào 5 phút **trước** nửa đêm VN của ngày hiện tại — tương đương đúng thứ xảy ra khi CI
chạy lúc 00:0x giờ VN với offset dựng dữ liệu 10 phút:

```java
Instant startedYesterdayVn =
        QuotaVnCalendar.truncatedToStartOfLocalDayUtc(Instant.now()).minusSeconds(300);
```

Kết quả nhận được, trùng từng chữ số với log CI:

```
[ERROR] QuotaBillingIntegrationTest.TEMP_repro_subscriptionStartedYesterdayVn_accruesTwice
[ví phải được cộng dồn ngày đầu rồi mới trừ]
expected: 399523L
 but was: 799523L
```

6 test còn lại trong cùng lớp xanh ở chính lần chạy đó → khoanh vùng đúng một cơ chế, không phải hỏng
môi trường. Test tạm này đã được **gỡ bỏ** sau khi chứng minh xong; nó chỉ tồn tại trong lúc chẩn đoán.

---

## 3. Cơ chế: ví token cộng dồn theo NGÀY LỊCH giờ VN

### 3.1 Múi giờ ghim cứng trong code, không theo máy chạy

`backend/src/main/java/com/deutschflow/common/quota/QuotaVnCalendar.java:11`

```java
public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
```

Nên đặt `TZ` của runner thành gì cũng **không** dời được ranh giới ngày của ví. Đây là lý do
"chạy CI với TZ khác" không phải một cách vá.

### 3.2 Công thức cộng dồn

`QuotaService.computeAccruedWalletBalance` (`QuotaService.java:299`), logic lặp lại y hệt trong
`accrueWalletThroughToday` (`QuotaService.java:636`):

```
baseline    = subscriptionStart − 1 ngày
from        = (lastAccruedTo == null) ? baseline : max(lastAccruedTo, baseline)
spanDays    = max(0, DAYS.between(from, today))          // today = ngày lịch VN của `now`
nếu cap<=0 hoặc daily<=0 hoặc spanDays<=0 → min(balance, cap)
pullsNeeded = ceil((cap − balance) / daily)
pulls       = min(spanDays, pullsNeeded)
kết quả     = min(cap, balance + pulls × daily)
```

Điểm mấu chốt: `baseline = subscriptionStart − 1 ngày`. Nghĩa là **ngay trong ngày gói bắt đầu**,
`spanDays` đã bằng 1 và ví được cộng một ngày grant. Sang ngày lịch VN kế tiếp, `spanDays` = 2.

### 3.3 Ráp số cụ thể cho ca bị đỏ

| Đại lượng | Giá trị | Nguồn |
|---|---|---|
| `daily_token_grant` của PRO | 400 000 | `V42__ai_quota_daily_vn_and_wallets.sql:18`, giữ nguyên ở `V73__subscription_plans_v2.sql:57` |
| `wallet_cap_days` của PRO | 30 | cùng hai migration trên |
| `cap` | 30 × 400 000 = 12 000 000 | tích của hai dòng trên |
| Số token bị trừ | 477 | `QuotaBillingIntegrationTest` — "STT 23,87s ≈ 477 token-tương-đương", số của vụ thật |

Test **không** hard-code 400 000; nó đọc từ DB (`QuotaBillingIntegrationTest.java:223`), nên bảng trên
là để hiểu, không phải hằng số phải đồng bộ tay.

- **Cùng ngày lịch VN** (mong đợi): `spanDays = 1` → `pulls = 1` → ví 400 000 → trừ 477 → **399 523** ✅
- **Vượt nửa đêm VN**: `spanDays = 2` → `pulls = 2` → ví 800 000 → trừ 477 → **799 523** ❌

`799523 = 2×400000 − 477` khớp chính xác con số CI báo. Đây là cách xác nhận cơ chế, không phải đoán.

---

## 4. Vì sao vỡ: hai lần đọc đồng hồ

Trước khi vá, đường đi là:

1. Test gọi `Instant.now()` → dùng dựng `user_subscriptions.starts_at = now − 600s`.
2. Test gọi `aiUsageLedgerService.record(...)`.
3. Bên trong, `AiUsageLedgerService.chargeOrgPoolAndWallet` gọi **`Instant.now()` lần thứ hai** rồi
   chuyển xuống `QuotaService.applyUsageDebit(userId, tokens, now)`.
4. `applyUsageDebit` (`QuotaService.java:144`) cộng dồn ví **trước** khi trừ
   (`ensureWalletRow` dòng 159, `accrueWalletThroughToday` dòng 169) — đây là vá B5 có chủ đích,
   xác nhận trên prod 26/07, **không được gỡ**.

Cửa sổ hỏng = khoảng thời gian mà (1) rơi vào ngày lịch VN trước còn (3) đã sang ngày sau.
Vì (1) lùi thêm 600 giây, cửa sổ đó rộng **10 phút mỗi ngày**, tức 00:00–00:10 giờ VN.
Khoảng 0,7% số lần chạy — đủ hiếm để bị đọc nhầm thành "trục trặc vặt", đủ thường để chặn PR.

Các test trong `TwoChannelTokenPoolIntegrationTest` dính **cùng loại lỗ hổng** nhưng cửa sổ chỉ rộng
vài mili-giây (ví dựng bằng `Instant.now()` ngay sát lời gọi service, không có offset 600s), nên thực
tế gần như không bao giờ nổ — vẫn đã ghim luôn cho dứt điểm.

---

## 5. Vì sao KHÔNG chọn các cách khác

| Phương án | Vì sao loại |
|---|---|
| Nới assert (chấp nhận cả `grant−477` lẫn `2×grant−477`) | Bỏ mất chính thứ test đang canh. Test này là chốt chặn của bug B5 "trial PRO chết ngay lần dùng AI đầu tiên" — nếu ví không được cộng dồn trước khi trừ thì số dư ra 0 và gói bị hạ cấp. Assert lỏng sẽ nuốt luôn ca đó. |
| Bỏ `minusSeconds(600)`, đặt `starts_at = now` | Chỉ **thu hẹp** cửa sổ từ 10 phút xuống vài mili-giây, không **đóng** nó. Test vẫn phụ thuộc thời điểm chạy, chỉ là khó bắt hơn — kiểu nợ tệ nhất. |
| Chèn sẵn dòng ví với `last_accrual_local_date` cố định | Phá tiền đề của test: ca đang tái hiện là **chưa có dòng ví nào** (`// cố ý KHÔNG insert user_ai_token_wallets`). Chèn ví vào là test một ca khác. |
| Đổi `TZ` của runner | Vô tác dụng — múi giờ ghim cứng trong `QuotaVnCalendar.ZONE` (§3.1). |
| Sửa logic cộng dồn trong sản phẩm | Không có gì để sửa. Người mua gói lúc 23:55 rồi dùng lúc 00:05 **thật sự** được hai ngày grant — đó là ngữ nghĩa ngày lịch của sản phẩm, không phải lỗi. |

---

## 6. Thiết kế đã chọn

### 6.1 Phía sản phẩm

`backend/src/main/java/com/deutschflow/common/config/ClockConfig.java` (mới)

```java
@Bean
public Clock systemClock() {
    return Clock.systemUTC();
}
```

`AiUsageLedgerService.java:27` thêm `private final Clock clock;` (constructor injection qua
`@RequiredArgsConstructor` sẵn có), và `AiUsageLedgerService.java:172` đổi `Instant.now()` →
`clock.instant()` — đó là **chỗ duy nhất** trong file đọc đồng hồ.

**Hành vi production không đổi — đã kiểm ở mức mã nguồn JDK 21.0.11**, không phải tin lời:

```
java.base/java/time/Instant.java:277   →  public static Instant now() { return Clock.currentInstant(); }
java.base/java/time/Clock.java:612-615 →  SystemClock.instant() { return currentInstant(); }
```

Cùng một hàm. `Clock.systemUTC().instant()` và `Instant.now()` đi **cùng một đường mã**.

### 6.2 Phía test

`backend/src/test/java/com/deutschflow/testsupport/FixedClockTestConfig.java` (mới) — một
`@TestConfiguration` khai `@Bean @Primary Clock` ghim cứng. Hai lớp IT thêm
`@Import(FixedClockTestConfig.class)` và thay mọi `Instant.now()` bằng `FixedClockTestConfig.FIXED_NOW`.

`@TestConfiguration` được Spring Boot loại khỏi component scan mặc định (cơ chế `TypeExcludeFilter`
đi kèm `@SpringBootApplication` — `DeutschFlowApplication.java:10`), nên nó **chỉ** tác động lên lớp
nào `@Import` tường minh; các test khác vẫn chạy `Clock.systemUTC()`. Điều này khớp với quan sát:
`OrgContextLoadIntegrationTest` (không import) khởi động và xanh bình thường.

Hai lớp IT import **cùng một** config nên dùng chung một Spring context. Quan sát thực tế qua nhiều
lần chạy: lớp chạy trước tốn 5–15s để dựng context, còn `QuotaBillingIntegrationTest` chạy ngay sau đó
luôn chỉ mất khoảng **0,1s** (đo được 0,099–0,125s qua 4 lần chạy) — tức nó dùng lại context đã cache chứ không dựng mới. Chi phí là **một**
context phụ cho cả hai lớp, không phải hai.

---

## 7. Điểm quan trọng nhất: ghim đồng hồ THÔI CHƯA ĐỦ

Ý tưởng ban đầu là ghim `FIXED_NOW` vào **giữa** cửa sổ hỏng (00:05 giờ VN) để test luôn chạy ở điều
kiện xấu nhất. **Đã thử, và vẫn đỏ y hệt `799523`.**

Vì sao: test dựng gói bằng `FIXED_NOW.minusSeconds(600)`. Đặt `FIXED_NOW` = 00:05 giờ VN thì mốc dựng
= 23:55 **ngày hôm trước** → `spanDays = 2` → cộng dồn hai ngày. Ghim đồng hồ đã loại bỏ *tính ngẫu
nhiên* (kết quả giờ ổn định), nhưng **tiền đề của assert** — "gói bắt đầu cùng ngày lịch với lúc trừ" —
vẫn bị phá. Và như §5 đã nói, cộng hai ngày ở tình huống đó là **đúng**.

Kết luận rút ra, và đây là thứ dễ vấp lại nhất:

> Ghim đồng hồ chỉ khiến test **xác định**. Muốn test **đúng**, mốc ghim còn phải nằm đủ xa nửa đêm
> giờ VN để mọi dữ liệu dựng lệch quanh nó vẫn rơi trong cùng một ngày lịch.

Nên `FIXED_NOW` được đặt ở **12:00 giờ VN** ngày 2026-05-15 (`Instant.parse("2026-05-15T05:00:00Z")`),
và có **rào static** chặn người sau vô tình dời nó về sát ranh giới:

```java
private static final Duration MIN_MARGIN_FROM_VN_MIDNIGHT = Duration.ofHours(1);
```

Rào đã được thử bằng cách cố tình đặt `FIXED_NOW` = 00:05 giờ VN, và nó bắn đúng:

```
java.lang.IllegalStateException: FIXED_NOW (00:05 giờ VN) quá sát nửa đêm Asia/Ho_Chi_Minh.
Test hạn mức dựng gói/ví lệch vài chục phút quanh mốc này; sát ranh giới thì phần dựng lệch sang
ngày lịch khác và ví được cộng dồn thêm một ngày — assert vỡ mà không phải do lỗi sản phẩm.
Chọn mốc cách nửa đêm VN ít nhất 1 giờ.
```

Lần sau nếu ai dời mốc sai, họ nhận được câu giải thích ngay tại chỗ thay vì một con số `799523` khó hiểu.

---

## 8. Đã chạy những gì

Chạy hai lần: **29/08** trên base cũ, rồi **30/08** sau khi áp lại lên `origin/main` (`473bfcdf`).
Số dưới đây là của lần 30/08 — tức đúng bản đem đi PR. Cục bộ, `TZ=UTC`, Postgres ngoài (xem §11).

| Lệnh | Kết quả |
|---|---|
| `./mvnw -o test` (toàn bộ unit) | `Tests run: 2121, Failures: 0, Errors: 0, Skipped: 3` |
| IT `QuotaBillingIntegrationTest` | 6/6 xanh (0,100s) |
| IT `TwoChannelTokenPoolIntegrationTest` | 9/9 xanh (6,2s) |
| IT `OrgContextLoadIntegrationTest` | 1/1 xanh (24,9s) |
| **CI** job `🐘 Integration Tests` (toàn bộ IT repo) | `Tests run: 177, Failures: 0, Errors: 0, Skipped: 10` |

`OrgContextLoadIntegrationTest` được chạy có chủ đích vì nó **không** `@Import` config ghim — nó cho
thấy bean `Clock` mới không phá vỡ context của các test khác. Chênh lệch thời gian cũng xác nhận lại
§6.2: nó dựng context riêng (24,9s) còn `QuotaBillingIntegrationTest` dùng lại context đã cache của
`TwoChannelTokenPoolIntegrationTest` (0,100s). CI cho lại đúng dạng số đó trên máy khác, JDK khác
(17 thay vì 21): `TwoChannelTokenPool` 9,973s rồi `QuotaBilling` **0,139s** — nên "dùng chung context"
là tính chất của thiết kế, không phải may mắn của một máy.

### 8.1 Chứng cứ ngược — gỡ vá ra thì test có đỏ thật không

Một assert siết chặt chỉ đáng tin nếu nó bắt được lỗi thật, nên đã kiểm bằng cách **cố tình hoàn
nguyên** `clock.instant()` về `Instant.now()` trong `AiUsageLedgerService` rồi chạy lại:

```
[ERROR] Tests run: 17, Failures: 5, Errors: 0 -- in AiUsageLedgerServiceUnitTest
```

Đỏ đúng 5 chỗ đã siết, không hơn không kém; khôi phục lại thì 17/17 xanh. Nghĩa là ai gỡ `Clock` ra
sau này sẽ đỏ **ngay ở unit test**, không phải chờ CI rơi trúng nửa đêm giờ VN mới lộ.

### 8.2 Siết `AiUsageLedgerServiceUnitTest`

**5** chỗ `any(Instant.class)` đổi thành `eq(FixedClockTestConfig.FIXED_NOW)` — giờ nó khẳng định
service chuyển **đúng mốc của `Clock`** xuống `applyUsageDebit`, chứ không còn chấp nhận "một
`Instant` nào đó". (Bản 29/08 chỉ có 4 chỗ; `main` sau đó thêm test V270 cho overload `TokenUsage`,
mang theo chỗ thứ 5 — nên khi áp lại phải đếm lại chứ đừng tin con số cũ.)

Lớp unit test này phải bỏ `@InjectMocks` và dựng tường minh trong `@BeforeEach`: `Clock` không phải
mock nên `@InjectMocks` sẽ để `null` và `clock.instant()` ném NPE.

---

## 9. Nâng cấp / sửa về sau

### 9.1 Nếu cần ghim đồng hồ cho một test khác

1. Thêm `@Import(FixedClockTestConfig.class)` vào lớp test.
2. Thay mọi `Instant.now()` trong lớp đó bằng `FixedClockTestConfig.FIXED_NOW`. **Trộn lẫn hai nguồn
   thời gian trong cùng một test là quay lại đúng lỗi cũ.**
3. Nếu service mà test gọi vẫn tự đọc `Instant.now()` thì ghim vô tác dụng — phải chuyển service đó
   sang nhận `Clock` trước (mẫu ở §6.1).

### 9.2 Nếu cần chuyển thêm service sang `Clock`

Backend hiện còn **344** chỗ gọi `Instant.now()` / `LocalDate.now()` / `LocalDateTime.now()` trong
`src/main/java` (đếm lại trên `origin/main` 30/08; con số này trôi theo từng đợt, đừng coi là hằng số). Chúng **cố ý không được đụng tới** trong đợt này — đây là vá một lỗi test cụ thể,
không phải chiến dịch chuyển toàn bộ codebase sang `Clock`.

Riêng trong package `common/quota` còn hai chỗ:

- `SubscriptionReconcileJob.java:35`
- `FreeTierGuard.java:132`

Đã kiểm: `FreeTierGuard` chỉ được gọi từ controller (`GradingController`, `TeacherMaterialController`),
**không** nằm trên đường `QuotaService.assertAllowed`/`applyUsageDebit`, nên không liên quan tới lỗi này.
Chỉ chuyển chúng sang `Clock` khi có test thật sự cần, đừng chuyển "cho đồng bộ".

### 9.3 Ranh giới KHÔNG được vượt

- **Đừng gỡ bước cộng dồn trước khi trừ** ở `applyUsageDebit` (`QuotaService.java:159-169`). Đó là vá
  B5, xác nhận trên prod 26/07: bỏ đi thì trial PRO chết ngay lần dùng AI đầu tiên.
- **Đừng ghim `Clock` ở tầng ứng dụng production.** `ClockConfig` phải giữ nguyên `Clock.systemUTC()`;
  chỉ test mới `@Primary` đè lên.
- **Đừng để `FIXED_NOW` lệch múi.** Mốc hiện tại (12:00 giờ VN) khiến ngày VN trùng ngày UTC. Nếu ai
  đổi sang mốc mà hai ngày lệch nhau, các phép chuyển `java.sql.Date` ↔ `LocalDate` theo múi giờ mặc
  định của JVM **có thể** lộ ra khác biệt — **điều này chưa được kiểm chứng**, xem §10.

### 9.4 Đường đi theo đồng hồ DB thì sao?

Kênh pool trung tâm (`org_monthly_token_counters`) tính mốc tháng bằng
`date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')` phía Postgres — thấy ở
`OrgQuotaService.java:50,162,193` và nhánh staff của `AiUsageLedgerService`. Đường này **không đọc**
`Clock` của Java nên ghim đồng hồ không ảnh hưởng tới nó, và cũng **không** được ghim bởi thiết kế này.
Nếu sau này cần test theo mốc tháng, phải xử lý riêng ở tầng SQL — `FixedClockTestConfig` không giúp gì.

---

## 10. Những gì CHƯA được kiểm chứng

Ghi ra để không ai đọc tài liệu này rồi tưởng đã chắc hơn thực tế:

- ~~Chưa chạy trên CI~~ và ~~chưa chạy toàn bộ IT của repo~~ — **cả hai đã đóng 30/08**: job
  `🐘 Integration Tests` (= `./mvnw -B verify -DskipUnitTests=true`) xanh với 177 IT. Đó cũng là lời
  đáp cho rủi ro "một lớp IT khác tự khai bean `Clock` rồi xung đột với `ClockConfig`": trước đó chỉ
  có một lần grep làm chứng, giờ có một lần chạy đầy đủ.
- **Chưa thử `FIXED_NOW` ở mốc mà ngày VN lệch ngày UTC** (ngoài lần thử 00:05 đã bị rào chặn lại).
  Nhận định ở §9.3 về `java.sql.Date` là *cảnh báo cần kiểm*, không phải kết luận đã đo.
- **Chưa đo lại xác suất đỏ trên CI sau khi vá** — không có cách đo trực tiếp; lập luận là cửa sổ phụ
  thuộc thời gian đã bị loại bỏ khỏi đường mã, chứ không phải quan sát thống kê.

---

## 11. Bẫy môi trường khi chạy lại IT cục bộ

Hai thứ chặn ngay từ bước đầu, đều đã gặp thật trong đợt này:

1. **Testcontainers 1.20.5 không nói chuyện được với Docker 29.3.1.** Nó kết nối được lần đầu rồi
   thất bại với `BadRequestException (Status 400: {"ID":"","Containers":0,...})` — một payload rỗng.
   → Phải tự dựng Postgres và trỏ vào bằng biến môi trường.
2. **Ảnh `postgres` tiêu chuẩn không chạy nổi migration.** `V132__add_knowledge_base_pgvector.sql`
   dừng ở `ERROR: extension "vector" is not available`. Phải dùng ảnh `pgvector/pgvector:pg16` —
   đúng ảnh mà `PostgresTestContainerHolder.java:17-18` đang khai.

Công thức đã dùng và chạy được:

```bash
docker run -d --name df-it-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=deutschflow_test -p 55433:5432 pgvector/pgvector:pg16
```

```bash
TZ=UTC DEUTSCHFLOW_IT_JDBC_URL=jdbc:postgresql://localhost:55433/deutschflow_test DEUTSCHFLOW_IT_DB_USERNAME=postgres DEUTSCHFLOW_IT_DB_PASSWORD=postgres ./mvnw -o verify -Dtest=NoSuchUnitTestSkipSurefire -Dsurefire.failIfNoSpecifiedTests=false -Dit.test=QuotaBillingIntegrationTest,TwoChannelTokenPoolIntegrationTest -DfailIfNoTests=false
```

Ghi chú về cờ:

- IT chạy bằng **failsafe** (`-Dit.test`), unit test bằng **surefire** (`-Dtest`) — pom khai tách ở
  `pom.xml:322` và `pom.xml:339`. Truyền `-Dtest=<TênIT>` sẽ **ghi đè `<excludes>` của surefire** và
  khiến surefire chạy luôn lớp IT đó; dùng tên giả + `-Dsurefire.failIfNoSpecifiedTests=false` để tắt
  hẳn surefire.
- **Đừng dùng `-DskipTests`** — nó tắt cả failsafe, cho ra `BUILD SUCCESS` rỗng.
- Phải dùng `./mvnw`, không dùng `mvn` cài bằng brew.

---

## 12. Bảng tra file

| File | Vai trò |
|---|---|
| `backend/src/main/java/com/deutschflow/common/config/ClockConfig.java` | Bean `Clock.systemUTC()` cho production |
| `backend/src/main/java/com/deutschflow/common/quota/AiUsageLedgerService.java:27,172` | Nhận `Clock`, dùng `clock.instant()` |
| `backend/src/main/java/com/deutschflow/common/quota/QuotaVnCalendar.java:11` | Múi giờ ghim cứng của ranh giới ngày |
| `backend/src/main/java/com/deutschflow/common/quota/QuotaService.java:144,299,636` | `applyUsageDebit`, công thức cộng dồn |
| `backend/src/test/java/com/deutschflow/testsupport/FixedClockTestConfig.java` | Mốc ghim + rào chặn mốc sát nửa đêm |
| `backend/src/test/java/com/deutschflow/common/quota/QuotaBillingIntegrationTest.java` | Test hạn mức, đã ghim mốc |
| `backend/src/test/java/com/deutschflow/common/quota/TwoChannelTokenPoolIntegrationTest.java` | Test 2 kênh token, đã ghim mốc |
| `backend/src/test/java/com/deutschflow/common/quota/AiUsageLedgerServiceUnitTest.java` | Unit test, dựng service tường minh với `Clock` |
