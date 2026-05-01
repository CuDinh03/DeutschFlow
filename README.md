# DeutschFlow

Nền tảng học tiếng Đức kết hợp mã hóa màu sắc theo giống từ, logic ngữ pháp kiểu Lego và AI.

## Tech Stack

- **Backend:** Java 17 + Spring Boot 3.2
- **Frontend (production):** Next.js 14 + TypeScript + Tailwind CSS — thư mục [`frontend/`](frontend/)
- **UI export (prototype):** Vite bundle trong [`deutschflowUI/ui/`](deutschflowUI/ui/) — bám design Figma, **không** thay thế app Next.js trong `frontend/`.
- **Database:** MySQL 8.0
- **Realtime:** STOMP over WebSocket
- **AI:** Provider cấu hình được (ví dụ Groq/OpenAI); STT Whisper API phía server; quota token theo gói (xem SRS §5.7)

## Yêu cầu

- Java 17+, Maven 3.8+
- Node.js 18+
- MySQL 8.0 (local hoặc remote)

## Cấu hình môi trường

```bash
cp .env.example .env
```

Cập nhật tối thiểu các biến sau trong `.env`:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`
- `JWT_SECRET` (ít nhất 32 ký tự)

## Chạy local không Docker

```bash
# 1. Chạy Backend
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# 2. Chạy Frontend
cd frontend && npm install && npm run dev
```

Truy cập: `http://localhost:3000`

> Demo users chỉ được seed khi chạy profile `local` (migration-local).  
> Môi trường shared/prod sẽ tự dọn các tài khoản demo bằng migration `V11`.

## Tùy chọn: chạy MySQL bằng Docker

Nếu bạn không có MySQL local, có thể dùng Docker chỉ cho DB:

```bash
# chuẩn bị env
cp .env.example .env
# điền DB_ROOT_PASSWORD, DB_USERNAME, DB_PASSWORD trước khi chạy

docker compose up -d
```
