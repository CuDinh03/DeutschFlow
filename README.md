# DeutschFlow

Nền tảng học tiếng Đức kết hợp mã hóa màu sắc theo giống từ, logic ngữ pháp kiểu Lego và AI.

## Tech Stack

- **Backend:** Java 17 (toolchain trong `backend/pom.xml`), Spring Boot 3.2
- **Frontend (production):** Next.js 14 + TypeScript + Tailwind CSS — [`frontend/`](frontend/)
- **Database:** PostgreSQL (Flyway migrations trong `backend/src/main/resources/db/migration/`)
- **Realtime:** STOMP over WebSocket
- **AI:** Provider cấu hình được (ví dụ Groq/OpenAI); STT Whisper API phía server; quota token theo gói

