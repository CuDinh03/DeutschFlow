# DeutschFlow

Nền tảng học tiếng Đức kết hợp mã hóa màu sắc theo giống từ, logic ngữ pháp kiểu Lego và AI.

## Tech Stack

- **Backend:** Java 17 + Spring Boot 3.2
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** MySQL 8.0
- **Realtime:** STOMP over WebSocket
- **AI:** OpenAI GPT-4o + Whisper

## Yêu cầu

- Java 17+, Maven 3.8+
- Node.js 18+
- Docker Desktop

## Chạy nhanh

```bash
# 1. Cấu hình môi trường
cp .env.example .env
# Điền DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET vào .env

# 2. Khởi động MySQL
docker-compose up -d

# 3. Chạy Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# 4. Chạy Frontend
cd frontend && npm install && npm run dev
```

Truy cập: `http://localhost:3000`
