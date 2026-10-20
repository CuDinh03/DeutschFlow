# Edge TTS sidecar — chạy cạnh backend trong mạng Docker deutschflow-net.
# Backend gọi http://deutschflow-edge-tts:5050 (EDGE_TTS_URL); cổng không publish ra host.
FROM python:3.12-slim

WORKDIR /app
COPY --chmod=644 requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chmod=644 server.py .

RUN useradd --system --no-create-home app
USER app

EXPOSE 5050
CMD ["python", "server.py"]
