# DeutschFlow — Quy Trình Bảo Trì & Deployment

> **Cập nhật lần cuối:** 2026-05-07  
> **Stack:** Spring Boot (EC2) · Next.js (Amplify) · PostgreSQL (RDS) · Cloudflare DNS

---

## 📋 Thông Tin Hạ Tầng

| Thành phần | Chi tiết |
|---|---|
| **Backend EC2** | `3.82.43.113` (us-east-1) — `i-0794da961a4e0f4b7` |
| **RDS Endpoint** | `deutschflow.cs7y6k2kosr4.us-east-1.rds.amazonaws.com:5432` |
| **DB Name** | `deutschflow` / user: `postgres` |
| **API Domain** | `https://api.mydeutschflow.com` (Cloudflare → EC2:8080) |
| **Frontend** | AWS Amplify (branch `main`) |
| **SSH Key** | `deutschflow-key.pem` (KHÔNG commit git) |
| **Env File** | `/home/ubuntu/DeutschFlow/.env.production` (trên EC2) |

---

## 🚀 Quy Trình 1: Update / Fix Lỗi → Deploy

### Bước 1 — Sửa code trên máy local

```bash
# Luôn làm việc trên nhánh AI_model
git checkout AI_model

# Sửa code, sau đó commit
git add .
git commit -m "fix(module): mô tả ngắn gọn"

# Push lên GitHub (cả AI_model lẫn main)
git push
git push origin AI_model:main --force
```

> ⚠️ **Lưu ý**: Hai nhánh `AI_model` và `main` có lịch sử tách biệt (diverged history).
> Phải dùng `--force` khi push `AI_model` → `main`. Đây là hành vi bình thường của dự án.

---

### Bước 2 — Deploy Backend lên EC2

```bash
# SSH vào EC2
ssh -i /path/to/deutschflow-key.pem ubuntu@3.82.43.113

# Vào thư mục dự án
cd /home/ubuntu/DeutschFlow

# Pull code mới nhất
git pull origin main

# Stop container cũ
sudo docker rm -f deutschflow-backend

# Rebuild image với code mới (bỏ qua tests vì đã test local)
sudo docker build -t deutschflow-backend:latest ./backend

# Chạy container mới với env production (Giới hạn RAM 1200MB để tránh sập EC2)
sudo docker run -d \
  --name deutschflow-backend \
  --memory="1200m" \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -p 8080:8080 \
  --restart unless-stopped \
  deutschflow-backend:latest

# Kiểm tra đang chạy
sudo docker ps

# Đợi ~30s rồi check health
sleep 30 && curl -s http://localhost:8080/actuator/health
```

**✅ Kết quả mong đợi:** `{"status":"UP"}`

---

### Bước 3 — Deploy Frontend (tự động)

Frontend được deploy tự động qua **AWS Amplify** khi có commit lên `main`.

Kiểm tra build status tại: https://console.aws.amazon.com/amplify

Nếu cần trigger thủ công:
```
AWS Amplify Console → App → branch main → "Redeploy this version"
```

---

## 🛠️ Quy Trình 2: Script Deploy Nhanh (1 lệnh từ Local)

Tạo file `deploy-backend.sh` để không phải nhớ lệnh:

```bash
#!/bin/bash
# deploy-backend.sh — Chạy từ máy local
# Usage: ./deploy-backend.sh

PEM="/Users/dinhcu/Desktop/DeutschFlow/deutschflow-key.pem"
EC2="ubuntu@3.82.43.113"

echo "🚀 Deploying DeutschFlow Backend..."

ssh -i "$PEM" -o StrictHostKeyChecking=no "$EC2" << 'ENDSSH'
  set -e
  cd /home/ubuntu/DeutschFlow
  
  echo "📥 Pulling latest code..."
  git pull origin main
  
  echo "🔨 Building Docker image..."
  sudo docker build -t deutschflow-backend:latest ./backend
  
  echo "♻️ Restarting container..."
  sudo docker rm -f deutschflow-backend 2>/dev/null || true
  sudo docker run -d \
    --name deutschflow-backend \
    --memory="1200m" \
    --env-file /home/ubuntu/DeutschFlow/.env.production \
    -p 8080:8080 \
    --restart unless-stopped \
    deutschflow-backend:latest
  
  echo "⏳ Waiting for Spring Boot to start..."
  sleep 40
  
  echo "🔍 Health check..."
  curl -s http://localhost:8080/actuator/health
  echo ""
  echo "✅ Deploy complete!"
ENDSSH
```

```bash
chmod +x deploy-backend.sh
./deploy-backend.sh
```

---

## 📊 Monitoring & Log

### Xem log real-time

```bash
ssh -i deutschflow-key.pem ubuntu@3.82.43.113

# Log trực tiếp
sudo docker logs -f deutschflow-backend

# Chỉ 50 dòng cuối
sudo docker logs deutschflow-backend --tail 50

# Lọc lỗi
sudo docker logs deutschflow-backend 2>&1 | grep -E "ERROR|WARN|Exception" | tail -20
```

### Kiểm tra container health

```bash
# Status container
sudo docker ps

# Stats CPU/RAM
sudo docker stats deutschflow-backend --no-stream

# Health check từ ngoài
curl https://api.mydeutschflow.com/actuator/health
```

### Kiểm tra database

```bash
# Kết nối RDS từ EC2
PGPASSWORD=<password> psql \
  -h deutschflow.cs7y6k2kosr4.us-east-1.rds.amazonaws.com \
  -U postgres -d deutschflow

# Xem số lượng users
SELECT role, COUNT(*) FROM users GROUP BY role;

# Xem 5 session AI gần nhất
SELECT id, created_at FROM ai_speaking_sessions ORDER BY created_at DESC LIMIT 5;
```

---

## 🔥 Lỗi Thường Gặp & Cách Sửa

### ❌ Lỗi 1: `No property 'isActive' found for type 'User'`

**Nguyên nhân:** Field `isActive` trong `User.java` đã đổi thành `active`. Repository method chưa cập nhật.

**Fix:**
```java
// UserRepository.java — ĐỔI TỪ:
List<User> findByRoleAndIsActiveTrue(User.Role role);

// THÀNH:
List<User> findByRoleAndActiveTrue(User.Role role);
```

**Tìm tất cả chỗ dùng:**
```bash
grep -rn "IsActiveTrue\|isActiveTrue\|findByRoleAndIsActive" backend/src/main/java/
```

---

### ❌ Lỗi 2: `JWT secret is missing. Set JWT_SECRET in environment`

**Nguyên nhân:** Container chạy không có env file, hoặc env file không ở đúng chỗ.

**Fix:** Chạy container với `--env-file` chỉ định đường dẫn tuyệt đối:
```bash
# SAI (docker-compose đọc từ shell, không đọc được file)
docker compose -f docker-compose.prod.yml up -d

# ĐÚNG (chỉ định env file rõ ràng)
sudo docker run -d \
  --name deutschflow-backend \
  --env-file /home/ubuntu/DeutschFlow/.env.production \
  -p 8080:8080 \
  deutschflow-backend:latest
```

---

### ❌ Lỗi 3: `Connection timed out` khi EC2 kết nối RDS

**Nguyên nhân:** Security Group của RDS không cho phép EC2 truy cập.

**Fix:** Vào AWS Console:
1. **RDS → `deutschflow` → Connectivity & security → VPC security groups**
2. Click vào `rds-deutschflow-sg`
3. **Edit inbound rules → Add rule:**
   - Type: PostgreSQL | Port: 5432 | Source: `172.31.39.22/32` (private IP của EC2)
4. Save rules

---

### ❌ Lỗi 4: `cd: frontend: No such file or directory` (Amplify Build)

**Nguyên nhân:** `amplify.yml` dùng `cd frontend` nhưng `appRoot: frontend` đã set working directory là `frontend/` rồi.

**Fix trong `amplify.yml`:** Xóa tất cả `cd frontend` trong phases:
```yaml
phases:
  preBuild:
    commands:
      - npm ci          # KHÔNG có "cd frontend" ở đây
  build:
    commands:
      - npm run build   # KHÔNG có "cd frontend" ở đây
```

---

### ❌ Lỗi 5: CI build fail — `class AISpeakingController is public, should be declared in file named AISpeakingController.java`

**Nguyên nhân:** macOS filesystem case-insensitive — `git mv` thất bại khi chỉ đổi chữ hoa/thường.

**Fix:**
```bash
git rm --cached backend/src/main/java/com/deutschflow/speaking/controller/AiSpeakingController.java
git add backend/src/main/java/com/deutschflow/speaking/controller/AISpeakingController.java
git commit -m "fix(ci): rename file to match public class name"
git push
```

---

### ❌ Lỗi 6: Amplify build dùng commit cũ (`0515c82`)

**Nguyên nhân:** Amplify cache commit cũ từ trước khi `main` bị force-push.

**Fix:** Vào **Amplify Console → App → branch main → "Redeploy this version"**  
Hoặc push 1 commit mới để trigger build mới.

---

### ❌ Lỗi 7: Test `AuthServiceUnitTest.me_student_readsTargetLevelFromJdbc` fail

**Nguyên nhân:** `me()` dùng `queryForList()` (varargs) nhưng mock dùng `eq(7L)` — Mockito không match varargs đúng.

**Fix:**
```java
// SAI
when(jdbcTemplate.query(anyString(), any(RowMapper.class), eq(7L)))

// ĐÚNG
when(jdbcTemplate.queryForList(anyString(), any(Object[].class)))
    .thenReturn(List.of(Map.of("target_level", "B1", "industry", "IT")));
```

---

## 🗂️ Cấu Trúc File Quan Trọng

```
DeutschFlow/
├── amplify.yml              # Build config cho AWS Amplify (frontend)
├── docker-compose.prod.yml  # Docker config cho EC2 (backend)
├── .env.production          # ⚠️ SECRET - không commit - copy thủ công lên EC2
├── .env.production.example  # Template public (commit được)
├── deutschflow-key.pem      # ⚠️ SSH key - không commit
├── deutschflow_backup.dump  # DB dump - không commit
├── backend/
│   ├── Dockerfile           # Multi-stage build (JDK build → JRE runtime)
│   └── src/
└── frontend/
    └── src/
```

---

## 🔑 Checklist Trước Khi Deploy

- [ ] Chạy `./mvnw clean compile` local → BUILD SUCCESS
- [ ] Chạy unit tests: `./mvnw test -Dtest='!*IntegrationTest'` → tất cả pass
- [ ] Commit tất cả thay đổi và push lên `AI_model` + `main`
- [ ] Xác nhận `.env.production` trên EC2 có đủ các key
- [ ] Backup DB trước nếu có migration mới: `pg_dump -h localhost -U postgres -d deutschflow -F c -f backup_$(date +%Y%m%d).dump`

---

## 📝 Lịch Sử Deploy

| Ngày | Version | Nội dung | Người thực hiện |
|---|---|---|---|
| 2026-05-07 | v1.0 | First production deploy — EC2 + RDS + Amplify | CuDinh03 |
| 2026-05-07 | v1.0.1 | Fix `isActiveTrue→activeTrue` repository method | CuDinh03 |
| 2026-05-07 | v1.0.2 | Fix Mockito varargs test mock | CuDinh03 |
| 2026-05-07 | v1.0.3 | Fix amplify.yml build path | CuDinh03 |
