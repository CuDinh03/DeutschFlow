# deploy/self-host — DeutschFlow trên VM tự host (không AWS)

Chạy **trên VM** (`/srv/deutschflow/repo`), user `deploy`. Env + secret nằm ngoài repo:
`/srv/deutschflow/env/{backend.env,frontend-build.env,backup.env,backup-age.pub}`, `/home/deploy/secrets/`.
Không bao giờ chép `.env` từ máy dev lên server.

| Script | Việc |
|---|---|
| `install-nginx.sh` | Cài site nginx (`deutschflow.nginx.conf`: chỉ `127.0.0.1:80`, sau Cloudflare Tunnel) + file upstream blue-green |
| `deploy-backend-vm.sh [--rollback]` | Build backend, chạy màu kia (8080 ↔ 8081), health, đổi upstream `df_backend`, xả màu cũ. 0 downtime |
| `deploy-frontend-vm.sh [--rollback]` | Build Next.js (build args từ `frontend-build.env` + JWT public key), màu 3000 ↔ 3001, kiểm cổng vai trò, đổi `df_frontend` |
| `cleanup-vm.sh` | Dọn image/container an toàn — giữ `:latest`, `:prev`, 3 tag commit gần nhất; không đụng volume |
| `backup-db.sh` | `pg_dump` → mã hoá `age` (khoá công khai) → `/backup/db` (14 bản) → R2 `deutschflow-backup` (30 ngày). Timer `systemd/deutschflow-backup.timer` 03:00 giờ VN |
| `restore-db.sh <file> <age-key> [--into-scratch\|--into-prod]` | Diễn tập restore vào container tạm (mặc định) hoặc restore đè prod |

Biến: `DEPLOY_BRANCH` (mặc định nhánh hiện tại của repo VM), `SKIP_FETCH=1` (build cây đang có).

Thay cho `deploy-backend.sh` / `cleanup-deploy.sh` ở gốc repo (EC2, đã ngừng dùng).
