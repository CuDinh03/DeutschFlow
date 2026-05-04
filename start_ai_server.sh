#!/bin/bash

# ==============================================================================
# Script khởi động DeutschFlow Local AI Server
# ==============================================================================

# Lấy đường dẫn gốc của dự án
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_SERVER_DIR="${PROJECT_ROOT}/ai-server"
MODEL_DIR="${PROJECT_ROOT}/deutschflow_model"

# Màu sắc để in log cho đẹp
GREEN='\03---[0;32m'
YELLOW='\03---[1;33m'
RED='\03---[0;31m'
NC='\03---[0m' # No Color

echo -e "${GREEN}=== Khởi động DeutschFlow AI Server ===${NC}"

# 1. Kiểm tra thư mục model
if [ ! -d "$MODEL_DIR" ]; then
    echo -e "${RED}Lỗi: Không tìm thấy thư mục model tại: $MODEL_DIR${NC}"
    echo -e "Vui lòng đảm bảo model (đã fine-tune) được đặt đúng vị trí."
    exit 1
fi
echo -e "✅ Tìm thấy thư mục model: $MODEL_DIR"

# 2. Kiểm tra thư mục ai-server
if [ ! -d "$AI_SERVER_DIR" ]; then
    echo -e "${RED}Lỗi: Không tìm thấy thư mục ai-server tại: $AI_SERVER_DIR${NC}"
    exit 1
fi
cd "$AI_SERVER_DIR"

# 3. Kích hoạt môi trường ảo Python (Virtual Environment)
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Cảnh báo: Chưa có môi trường ảo .venv. Đang tự động tạo và cài đặt...${NC}"
    python3 -m venv .venv
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo -e "✅ Kích hoạt môi trường ảo Python (.venv)..."
    source .venv/bin/activate
    pip install -r requirements.txt
fi

# 4. Chạy server FastAPI qua uvicorn
echo -e "${GREEN}🚀 Đang khởi động AI Server trên cổng 8000...${NC}"
echo -e "${YELLOW}(Lần đầu khởi động có thể mất vài phút để load model vào RAM/VRAM)${NC}"

# Set biến môi trường để trỏ đúng đường dẫn model tuyệt đối
export DEUTSCHFLOW_MODEL_PATH="$MODEL_DIR"

# Chạy server
python ai_server.py
