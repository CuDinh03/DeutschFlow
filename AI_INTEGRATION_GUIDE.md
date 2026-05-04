# DeutschFlow AI Integration Guide

Hướng dẫn tích hợp AI model (Llama 3 8B) vào DeutschFlow backend.

## 📁 Cấu trúc Project

```
DeutschFlow/
├── deutschflow_model/          # AI model đã train (LoRA adapters)
│   ├── adapter_config.json
│   ├── adapter_model.safetensors
│   └── ...
├── ai-server/                  # Python FastAPI server
│   ├── ai_server.py           # Main server code
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Docker image
│   └── README.md              # AI server docs
├── backend/                    # Java Spring Boot backend
│   └── src/main/java/com/deutschflow/ai/
│       ├── AIModelService.java    # AI client service
│       ├── AIResponse.java        # Response DTO
│       └── AIController.java      # REST endpoints
└── scripts/
    └── start-ai-server.sh     # Script để start AI server
```

## 🚀 Quick Start

### Option 1: Local Development (Khuyên dùng)

#### 1. Start AI Server

```bash
# Từ root project
./scripts/start-ai-server.sh
```

Server sẽ chạy tại: `http://localhost:8000`

API docs: `http://localhost:8000/docs`

#### 2. Start Java Backend

```bash
cd backend
./mvnw spring-boot:run
```

Backend sẽ chạy tại: `http://localhost:8080`

### Option 2: Docker Compose

```bash
# Build và start tất cả services
docker-compose -f docker-compose.ai.yml up --build

# Hoặc chạy background
docker-compose -f docker-compose.ai.yml up -d

# Stop services
docker-compose -f docker-compose.ai.yml down
```

## 📡 API Endpoints

### AI Server (Python - Port 8000)

#### Health Check
```bash
GET http://localhost:8000/health
```

#### Generate Response
```bash
POST http://localhost:8000/generate
Content-Type: application/json

{
  "instruction": "Translate to English",
  "input": "Guten Morgen",
  "max_tokens": 256,
  "temperature": 0.7
}
```

#### Translate to English
```bash
POST http://localhost:8000/translate/to-english?text=Guten%20Morgen
```

#### Translate to German
```bash
POST http://localhost:8000/translate/to-german?text=Good%20morning
```

#### Correct Grammar
```bash
POST http://localhost:8000/grammar/correct?text=Ich%20bin%20gehen
```

#### Explain Grammar
```bash
POST http://localhost:8000/grammar/explain?text=Ich%20gehe%20zur%20Schule
```

#### Conversation
```bash
POST http://localhost:8000/conversation/respond?user_message=Hallo!&context=greeting
```

### Java Backend (Port 8080)

#### Health Check
```bash
GET http://localhost:8080/api/ai/health
```

#### Translate to English
```bash
POST http://localhost:8080/api/ai/translate/to-english
Content-Type: application/json

{
  "text": "Guten Morgen"
}
```

#### Translate to German
```bash
POST http://localhost:8080/api/ai/translate/to-german
Content-Type: application/json

{
  "text": "Good morning"
}
```

#### Correct Grammar
```bash
POST http://localhost:8080/api/ai/grammar/correct
Content-Type: application/json

{
  "text": "Ich bin gehen"
}
```

#### Explain Grammar
```bash
POST http://localhost:8080/api/ai/grammar/explain
Content-Type: application/json

{
  "text": "Ich gehe zur Schule"
}
```

#### Conversation
```bash
POST http://localhost:8080/api/ai/conversation/respond
Content-Type: application/json

{
  "message": "Hallo! Wie geht es dir?",
  "context": "greeting"
}
```

#### Custom Generation
```bash
POST http://localhost:8080/api/ai/generate
Content-Type: application/json

{
  "instruction": "Explain this German word",
  "input": "Schadenfreude",
  "maxTokens": 256,
  "temperature": 0.7
}
```

## 💻 Sử dụng trong Code

### Java Service Example

```java
@Service
@RequiredArgsConstructor
public class MyGermanService {
    
    private final AIModelService aiModelService;
    
    public String translateWord(String germanWord) {
        return aiModelService.translateToEnglish(germanWord);
    }
    
    public String correctSentence(String germanSentence) {
        return aiModelService.correctGrammar(germanSentence);
    }
    
    public String chatWithStudent(String studentMessage) {
        return aiModelService.generateConversationResponse(
            studentMessage, 
            "You are helping a beginner learn German"
        );
    }
}
```

### Controller Example

```java
@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
public class LearningController {
    
    private final AIModelService aiModelService;
    
    @PostMapping("/practice/translate")
    public ResponseEntity<String> practiceTranslation(@RequestBody String germanText) {
        String translation = aiModelService.translateToEnglish(germanText);
        return ResponseEntity.ok(translation);
    }
    
    @PostMapping("/practice/grammar")
    public ResponseEntity<Map<String, String>> practiceGrammar(@RequestBody String germanText) {
        String corrected = aiModelService.correctGrammar(germanText);
        String explanation = aiModelService.explainGrammar(germanText);
        
        return ResponseEntity.ok(Map.of(
            "original", germanText,
            "corrected", corrected,
            "explanation", explanation
        ));
    }
}
```

## 🔧 Configuration

### Environment Variables

Thêm vào `.env`:

```bash
# AI Server Configuration
AI_SERVER_URL=http://localhost:8000
AI_SERVER_TIMEOUT_MS=30000
```

### application.yml

```yaml
app:
  ai:
    server-url: ${AI_SERVER_URL:http://localhost:8000}
    timeout-ms: ${AI_SERVER_TIMEOUT_MS:30000}
```

## 🐛 Troubleshooting

### AI Server không start

**Lỗi: Model not found**
```bash
# Kiểm tra model path
ls -la deutschflow_model/

# Đảm bảo có các files:
# - adapter_config.json
# - adapter_model.safetensors
```

**Lỗi: CUDA not available**
```bash
# Kiểm tra GPU
nvidia-smi

# Nếu không có GPU, model sẽ chạy trên CPU (chậm hơn)
```

**Lỗi: Out of Memory**
```bash
# Giảm batch size hoặc max_seq_length trong ai_server.py
# Hoặc restart server để clear memory
```

### Java Backend không connect được AI Server

**Lỗi: Connection refused**
```bash
# Kiểm tra AI server đang chạy
curl http://localhost:8000/health

# Kiểm tra firewall
# Kiểm tra AI_SERVER_URL trong .env
```

**Lỗi: Timeout**
```bash
# Tăng timeout trong application.yml
AI_SERVER_TIMEOUT_MS=60000
```

## 📊 Performance

### Latency

- **Translation**: ~1-2 seconds
- **Grammar correction**: ~1-2 seconds
- **Conversation**: ~2-3 seconds
- **Explanation**: ~3-5 seconds

### Throughput

- **Single GPU (8GB VRAM)**: ~5-10 requests/second
- **CPU only**: ~1-2 requests/second

### Optimization Tips

1. **Batch requests** khi có thể
2. **Cache** kết quả cho queries phổ biến
3. **Async processing** cho non-critical tasks
4. **Load balancing** với multiple AI servers

## 🚢 Production Deployment

### Khuyến nghị

1. **Separate servers**: AI server và Backend trên máy khác nhau
2. **GPU server**: Dùng cloud GPU (AWS, GCP, Azure) cho AI server
3. **Load balancer**: Nginx/HAProxy trước AI servers
4. **Monitoring**: Prometheus + Grafana
5. **Caching**: Redis cho frequent queries
6. **Rate limiting**: Tránh overload AI server

### Cloud Options

- **AWS**: EC2 với GPU (g4dn.xlarge)
- **GCP**: Compute Engine với GPU (n1-standard-4 + T4)
- **Azure**: NC-series VMs
- **RunPod**: Thuê GPU theo giờ (rẻ hơn)

## 📝 Next Steps

1. ✅ AI server đã setup
2. ✅ Java backend đã tích hợp
3. ⏳ Test các endpoints
4. ⏳ Tích hợp vào existing features
5. ⏳ Add caching layer
6. ⏳ Deploy to production

## 🆘 Support

Nếu gặp vấn đề:

1. Check logs: `docker-compose -f docker-compose.ai.yml logs ai-server`
2. Check health: `curl http://localhost:8000/health`
3. Check API docs: `http://localhost:8000/docs`
4. Review code trong `ai-server/ai_server.py`

---

**Model Info:**
- Base: Llama 3 8B (4-bit quantized)
- LoRA Rank: 32
- Training: 1000 steps on German learning data
- Size: ~100MB (adapters only)
