# DeutschFlow

Nền tảng học tiếng Đức kết hợp mã hóa màu sắc theo giống từ, logic ngữ pháp kiểu Lego và AI.

## Tech Stack

- **Backend:** Java 17 (toolchain trong `backend/pom.xml`), Spring Boot 3.2
- **Frontend (production):** Next.js 14 + TypeScript + Tailwind CSS — [`frontend/`](frontend/)
- **Database:** PostgreSQL (Flyway migrations trong `backend/src/main/resources/db/migration/`)
- **Realtime:** STOMP over WebSocket
- **AI:** Provider cấu hình được (ví dụ Groq/OpenAI); STT Whisper API phía server; quota token theo gói

## Yêu cầu

- Java 17+, Maven 3.8+
- Node.js 18+
- PostgreSQL 14+ (local hoặc qua Docker Compose — xem dưới)

## Cấu hình môi trường

```bash
cp .env.example .env
```

Cập nhật tối thiểu trong `.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (ít nhất 32 ký tự)

## Chạy local (backend + frontend)

### 1. PostgreSQL bằng Docker (khuyến nghị)

```bash
cp .env.example .env
# Điền DB_PASSWORD (và các biến DB_* nếu khác mặc định)

docker compose up -d
```

### 2. Backend

```bash
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### 3. Frontend

```bash
cd frontend && npm install && npm run dev
```

Truy cập: `http://localhost:3000`

Tài liệu trong **`docs/`:**  
[chạy Backend + AI + Frontend](docs/CHAY_BACKEND_AI_FRONTEND.md) · [hướng dẫn đầy đủ (Postgres, `.env`, gỡ lỗi)](docs/HUONG_DAN_CHAY.md)

> Demo users chỉ được seed khi chạy profile `local` (migration-local).  
> Môi trường shared/prod sẽ tự dọn các tài khoản demo bằng migration `V11`.

## Kiểm thử backend (Maven)

Integration test dựa trên **Testcontainers** (PostgreSQL trong container). Máy dev cần **Docker Engine đang chạy** (Docker Desktop, Colima, OrbStack, v.v.).

```bash
cd backend && ./mvnw test
```

Dự án kèm `backend/src/test/resources/.testcontainers.properties` — ép **Unix socket strategy** để tránh lỗi phổ biến trên **macOS + Docker Desktop** (API trả HTTP 400 / engine rỗng dù `docker ps` vẫn chạy).

Nếu vẫn báo `Could not find a valid Docker environment`:

1. Khởi động lại Docker Desktop (hoặc `colima restart`).
2. Thử trỏ Docker host (chọn một đường ứng với cài đặt của bạn):

```bash
# Docker Desktop — socket trong thư mục user (thường ổn hơn sock mặc định)
export DOCKER_HOST="unix://${HOME}/.docker/run/docker.sock"

# Colima mặc định
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
```

Sau đó chạy lại `./mvnw test` trong **cùng shell** (Maven fork kế thừa biến môi trường).

Tuỳ chọn nếu Ryuk gây lỗi kéo ảnh: `export TESTCONTAINERS_RYUK_DISABLED=true` rồi chạy test lại (chỉ dev, không khuyến nghị CI).

### Khi JVM không dùng được Docker (Cursor sandbox, v.v.)

Bạn vẫn chạy Postgres thật (Docker Compose ở máy bạn) rồi trỏ integration test bằng biến:

```bash
createdb deutschflow_test   # một lần, cùng credentials với .env
export DEUTSCHFLOW_IT_JDBC_URL='jdbc:postgresql://127.0.0.1:5432/deutschflow_test'
export DEUTSCHFLOW_IT_DB_USERNAME='postgres'
export DEUTSCHFLOW_IT_DB_PASSWORD='...'   # giống DB_PASSWORD trong .env
cd backend && ./mvnw test
```

Flyway sẽ chạy trên database đó — **chỉ dùng DB throwaway**, không trỏ vào DB production.

CI trên GitHub Actions vẫn dùng Testcontainers (Docker trên Linux).

## Dữ liệu: MySQL → PostgreSQL

Hướng dẫn / ghi chú migration dữ liệu: [`scripts/DATA_MIGRATION_MYSQL_TO_POSTGRES.txt`](scripts/DATA_MIGRATION_MYSQL_TO_POSTGRES.txt).
