#!/usr/bin/env python3
"""Contract test cho 8 tier LLM — chạy MỖI LẦN đổi model hoặc đổi nhà cung cấp.

Vì sao có script này (F2.4, checklist `plans/2026-08-07-checklist-khung-ai-tier.md`):
khung tier cho phép "xoay model = sửa 1 dòng env", nhưng một model mới có thể phá HỢP ĐỒNG mà
compile/unit test không thấy được, và phá theo kiểu ÂM THẦM:

  * không hỗ trợ `response_format={"type":"json_object"}` ⇒ parser đọc prose, điểm/nhận xét rơi;
  * là reasoning model nhưng KHÔNG nhận `reasoning_effort` (hoặc ngược lại) ⇒ 400, hoặc tệ hơn:
    nhận rồi vẫn "nghĩ" hết ngân sách và trả JSON CỤT — sự cố FW.7 ngày 09/08/2026, chấm Schreiben
    hỏng ~10% mà log chỉ thấy bài AI_GRADED mất sạch nhận xét (regex fallback vẫn móc được điểm);
  * ngân sách token của tier quá chật cho model mới (nó dài dòng hơn model cũ).

Bởi vậy phép đo bắt buộc là: bắn ĐÚNG ngân sách token chật nhất của tier, LẶP nhiều lượt (hỏng
kiểu này chập chờn — 1 lượt xanh không chứng minh gì, FW.7 đo 19/20 rồi mới lòi), và đọc
`completion_tokens` để biết còn bao nhiêu biên an toàn.

Phạm vi: kiểm HỢP ĐỒNG kỹ thuật của model/endpoint. KHÔNG kiểm chất lượng sư phạm — prompt ở đây
là prompt MẪU (cùng hình dạng, không phải bản production). Chất lượng chấm do harness F1
(`/api/admin/grading-eval`, chạy đúng lõi GradingService) đo.

Cách chạy
---------
    # đọc cấu hình từ file env kiểu .env.production (KHÔNG in secret ra màn hình)
    python3 scripts/ai-tier-contract-test.py --env-file /path/to/.env.production

    # chỉ vài tier, lặp 10 lượt (mức đủ để thấy hỏng ~10%)
    python3 scripts/ai-tier-contract-test.py --env-file .env --tiers grading-exam,batch --runs 10

    # thử một model ứng viên TRƯỚC khi flip env thật
    python3 scripts/ai-tier-contract-test.py --env-file .env --tiers grading-exam \
        --model accounts/fireworks/models/deepseek-v4-flash --effort ''

    # đo TTFT chế độ stream (điều kiện tiên quyết G1.4 của CHAT_PAID: <1,5s)
    python3 scripts/ai-tier-contract-test.py --env-file .env --tiers chat-paid --stream

    # kiểm STT: transcript + bẫy Fireworks nuốt prompt trùng audio
    python3 scripts/ai-tier-contract-test.py --env-file .env --audio /path/mau.wav \
        --expected-text "Ich bin gestern mit dem Fahrrad zur Schule gefahren."

Exit code 0 = mọi tier đạt hợp đồng; 1 = có tier 🔴 (đừng flip); 2 = lỗi cấu hình.
Không có phụ thuộc ngoài stdlib. Script KHÔNG in API key (chỉ in độ dài) và có che key nếu nó
lọt vào thông báo lỗi của upstream.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

TIMEOUT_SEC = 120

# Host audio của Fireworks (audio-*.direct.fireworks.ai) nằm sau Cloudflare và CHẶN User-Agent mặc
# định của urllib bằng 403 "error code: 1010" (browser integrity check). Triệu chứng đọc y như lỗi
# key/host sai — cùng họ với cái bẫy "mỗi model một host" đã tốn thời gian ở #310. Khai UA tường minh.
USER_AGENT = "DeutschFlow-ai-tier-contract-test/1.0"


def build_tls_context() -> ssl.SSLContext:
    """Context TLS có xác thực chứng thư, tự tìm CA bundle.

    Python bản python.org trên macOS không dùng keychain hệ thống và nếu chưa chạy
    "Install Certificates.command" thì MỌI request https chết bằng CERTIFICATE_VERIFY_FAILED —
    triệu chứng trông y như "endpoint chết", rất dễ chẩn đoán sai thành lỗi nhà cung cấp.
    Thứ tự tìm: SSL_CERT_FILE → certifi (nếu có) → /etc/ssl/cert.pem (macOS) → store mặc định.
    KHÔNG bao giờ tắt xác thực: request này mang API key.
    """
    for cafile in (os.environ.get("SSL_CERT_FILE"), _certifi_path(), "/etc/ssl/cert.pem"):
        if cafile and Path(cafile).is_file():
            try:
                return ssl.create_default_context(cafile=cafile)
            except Exception:  # bundle hỏng → thử ứng viên tiếp theo
                continue
    return ssl.create_default_context()


def _certifi_path() -> str | None:
    try:
        import certifi  # type: ignore
        return certifi.where()
    except Exception:
        return None


TLS = build_tls_context()

# ── Mẫu thử theo tier ────────────────────────────────────────────────────────────────────────
# `budget` = ngân sách max_tokens CHẬT NHẤT trong các call site thật của tier (đọc từ code
# 09/08/2026) — chật nhất mới là chỗ JSON bị cắt trước:
#   chat-free/paid  800  ← row DB `system_config.ai.maxTokens` (che hằng SPEAKING_MAX_COMPLETION_TOKENS=2000)
#   error-verify    300  ← thiết kế C1.1 (chưa có caller)
#   grading-exam    800  ← AiExamEvaluatorService:59,183 (GradingService 1500, mock exam 1200, Teil2 1000)
#   grading-daily  1000  ← ConversationEvaluationService (InterviewEvaluationService 2200)
#   explain         256  ← AIGrammarService.generate (correctGrammar 512, explainGrammar 700)
#   content        1024  ← SkillTreeService:1107,1248 (PracticeNode 4096)
#   batch           600  ← VocabularyAutoTaggingService:194
# Đổi ngân sách trong code thì sửa cả ở đây, nếu không script đo một hợp đồng đã hết đúng.

CHAT_SYSTEM = (
    "Du bist LENA, freundliche deutsche Sprachtutorin für einen vietnamesischen A1-Lerner. "
    'Antworte NUR mit einem JSON-Objekt: {"ai_speech_de": string (max 2 kurze Sätze, endet mit '
    'einer Frage), "correction": string|null, "explanation_vi": string|null, '
    '"grammar_point": string|null, "status": "OFF_TOPIC"|"ON_TOPIC_NEEDS_IMPROVEMENT"|"EXCELLENT", '
    '"action": "CONTINUE"}. Korrigiere nur echte Fehler, erfinde nichts.'
)
CHAT_USER = "Am Samstag ich habe in den Park gegangen mit meine Freundin."

GRADING_SYSTEM = (
    "Bạn là một giáo viên tiếng Đức chấm bài viết. Hãy đánh giá bài viết theo thang điểm 100. "
    "Trả về DUY NHẤT một JSON object hợp lệ (không markdown) đúng định dạng: "
    '{"score": <0-100>, "confidence": <0-100>, "criteria": {"grammar": <0-100>, '
    '"vocabulary": <0-100>, "content": <0-100>, "structure": <0-100>}, '
    '"feedback": "<nhận xét tiếng Việt về ngữ pháp, từ vựng, cấu trúc câu>"}'
)
GRADING_USER = (
    "<submission>Liebe Anna, ich schreibe dir aus Hamburg. Gestern ich habe ein Museum besucht "
    "und es war sehr interessant. Am Abend wir sind in ein Restaurant gegangen. Das Essen war "
    "lecker aber teuer. Wie geht es dir? Viele Grüße, Minh</submission>"
)

DAILY_SYSTEM = (
    "Bạn là giám khảo đánh giá một phiên hội thoại tiếng Đức. Trả về DUY NHẤT JSON: "
    '{"overall_score": <0-100>, "fluency": <0-100>, "accuracy": <0-100>, '
    '"errors": [{"original": string, "corrected": string, "type": string}], '
    '"feedback_vi": string}'
)
DAILY_USER = (
    "<transcript>Học viên: Ich habe gestern nach Berlin gefahren. Ich bin sehr müde gewesen "
    "aber die Stadt war schön. Ich möchte nächstes Jahr wieder fahren.</transcript>"
)

VERIFY_SYSTEM = (
    "Bạn là trọng tài ngữ pháp tiếng Đức. Với mỗi lỗi được đề xuất, xác nhận đúng hay bác bỏ. "
    'Trả về DUY NHẤT JSON: {"confirmed": [string], "rejected": [{"error": string, "reason": string}]}'
)
VERIFY_USER = (
    'Câu học viên: "Ich habe nach Berlin gefahren." · Lỗi AI đề xuất: '
    '["habe → bin (Verb der Bewegung braucht sein)", "nach → zu"]'
)

EXPLAIN_SYSTEM = (
    "Bạn là giáo viên tiếng Đức, giải thích cho người Việt học tiếng Đức. Trả về DUY NHẤT JSON: "
    '{"corrected": string, "explanation_vi": string (tối đa 3 câu)}'
)
EXPLAIN_USER = "Ich habe nach Berlin gefahren letztes Wochenende."

CONTENT_SYSTEM = (
    "Bạn soạn nội dung bài học tiếng Đức trình độ A1 cho người Việt. Trả về DUY NHẤT JSON: "
    '{"title": string, "explanation_vi": string, "examples": [{"de": string, "vi": string}], '
    '"exercises": [{"question": string, "answer": string}]}'
)
CONTENT_USER = "Chủ đề: Perfekt với 'sein' (Verben der Bewegung). Cần 3 ví dụ và 2 bài tập."

BATCH_SYSTEM = (
    "Bạn gán thẻ cho từ vựng tiếng Đức. Trả về DUY NHẤT JSON: "
    '{"level": "A1"|"A2"|"B1"|"B2", "topic": string, "pos": string, "article": string|null}'
)
BATCH_USER = "Từ: der Fahrradweg"


@dataclass(frozen=True)
class TierProbe:
    """Một tier + mẫu thử của nó. `model_env`/`fallback_env` gương ĐÚNG chain trong application.yml."""

    key: str                      # khoá tier trong yml, vd "grading-exam"
    model_env: str                # AI_LLM_TIER_<T>_MODEL
    fallback_env: str             # GROQ_MODEL hoặc GROQ_GRADING_MODEL
    default_model: str
    effort_env: str
    effort_fallback_env: str | None  # None = tier không gương GROQ_REASONING_EFFORT
    default_effort: str
    budget: int                   # max_tokens chật nhất trong các call site thật
    temperature: float
    system: str
    user: str
    required_keys: tuple[str, ...]
    has_caller: bool = True       # False = tier chưa được service nào gọi (chỉ kiểm sẵn)


PROBES: tuple[TierProbe, ...] = (
    TierProbe("chat-free", "AI_LLM_TIER_CHAT_FREE_MODEL", "GROQ_MODEL", "openai/gpt-oss-20b",
              "AI_LLM_TIER_CHAT_FREE_EFFORT", "GROQ_REASONING_EFFORT", "low",
              800, 0.7, CHAT_SYSTEM, CHAT_USER, ("ai_speech_de", "status", "action")),
    TierProbe("chat-paid", "AI_LLM_TIER_CHAT_PAID_MODEL", "GROQ_MODEL", "openai/gpt-oss-20b",
              "AI_LLM_TIER_CHAT_PAID_EFFORT", "GROQ_REASONING_EFFORT", "low",
              800, 0.7, CHAT_SYSTEM, CHAT_USER, ("ai_speech_de", "status", "action")),
    TierProbe("error-verify", "AI_LLM_TIER_ERROR_VERIFY_MODEL", "GROQ_MODEL", "openai/gpt-oss-20b",
              "AI_LLM_TIER_ERROR_VERIFY_EFFORT", "GROQ_REASONING_EFFORT", "low",
              300, 0.0, VERIFY_SYSTEM, VERIFY_USER, ("confirmed", "rejected"), has_caller=False),
    TierProbe("grading-exam", "AI_LLM_TIER_GRADING_EXAM_MODEL", "GROQ_GRADING_MODEL",
              "openai/gpt-oss-120b", "AI_LLM_TIER_GRADING_EXAM_EFFORT", None, "low",
              800, 0.3, GRADING_SYSTEM, GRADING_USER, ("score", "feedback")),
    TierProbe("grading-daily", "AI_LLM_TIER_GRADING_DAILY_MODEL", "GROQ_GRADING_MODEL",
              "openai/gpt-oss-120b", "AI_LLM_TIER_GRADING_DAILY_EFFORT", None, "low",
              1000, 0.3, DAILY_SYSTEM, DAILY_USER, ("overall_score", "feedback_vi")),
    TierProbe("explain", "AI_LLM_TIER_EXPLAIN_MODEL", "GROQ_MODEL", "openai/gpt-oss-20b",
              "AI_LLM_TIER_EXPLAIN_EFFORT", "GROQ_REASONING_EFFORT", "low",
              256, 0.2, EXPLAIN_SYSTEM, EXPLAIN_USER, ("corrected", "explanation_vi")),
    TierProbe("content", "AI_LLM_TIER_CONTENT_MODEL", "GROQ_MODEL", "openai/gpt-oss-20b",
              "AI_LLM_TIER_CONTENT_EFFORT", "GROQ_REASONING_EFFORT", "low",
              1024, 0.3, CONTENT_SYSTEM, CONTENT_USER, ("title", "examples")),
    TierProbe("batch", "AI_LLM_TIER_BATCH_MODEL", "GROQ_GRADING_MODEL", "openai/gpt-oss-120b",
              "AI_LLM_TIER_BATCH_EFFORT", "GROQ_REASONING_EFFORT", "low",
              600, 0.0, BATCH_SYSTEM, BATCH_USER, ("level", "topic")),
)


# ── Cấu hình ─────────────────────────────────────────────────────────────────────────────────

def load_env(env_file: str | None) -> dict[str, str]:
    """Env của process, phủ thêm các dòng KEY=VALUE của file env (nếu có). Không log giá trị."""
    env: dict[str, str] = dict(os.environ)
    if not env_file:
        return env
    path = Path(env_file).expanduser()
    if not path.is_file():
        die(f"Không đọc được file env: {path}")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env


def die(msg: str) -> None:
    print(f"❌ {msg}", file=sys.stderr)
    sys.exit(2)


def mask(text: str, secret: str) -> str:
    """Che key nếu upstream vọng nó lại trong thông báo lỗi."""
    if secret and len(secret) > 8:
        text = text.replace(secret, f"{secret[:3]}…[đã che]")
    return text


def resolve(env: dict[str, str], probe: TierProbe,
            model_override: str | None, effort_override: str | None) -> tuple[str, str]:
    """Model + effort thực tế của tier, theo đúng chain fallback của application.yml."""
    if model_override:
        model = model_override
    else:
        model = env.get(probe.model_env) or env.get(probe.fallback_env) or probe.default_model
    if effort_override is not None:
        effort = effort_override
    else:
        effort = env.get(probe.effort_env)
        if effort is None and probe.effort_fallback_env:
            effort = env.get(probe.effort_fallback_env)
        if effort is None:
            effort = probe.default_effort
    return model.strip(), effort.strip()


# ── Gọi API ──────────────────────────────────────────────────────────────────────────────────

@dataclass
class RunResult:
    ok: bool
    label: str                 # OK | CỤT | RỖNG | THIẾU_FIELD | ERR_API:<code> | ERR_HTTP
    latency_s: float = 0.0
    prompt_tokens: int = 0
    cached_tokens: int = 0
    completion_tokens: int = 0
    detail: str = ""


def post_json(url: str, key: str, body: dict[str, Any]) -> tuple[int, str]:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": USER_AGENT},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC, context=TLS) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # timeout, DNS, TLS…
        return 0, f"{type(e).__name__}: {e}"


def one_run(url: str, key: str, model: str, effort: str, probe: TierProbe) -> RunResult:
    body: dict[str, Any] = {
        "model": model,
        "temperature": probe.temperature,
        "max_tokens": probe.budget,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": probe.system},
            {"role": "user", "content": probe.user},
        ],
    }
    if effort:
        body["reasoning_effort"] = effort

    t0 = time.time()
    status, raw = post_json(url, key, body)
    dt = time.time() - t0

    if status == 0:
        return RunResult(False, "ERR_HTTP", dt, detail=mask(raw[:200], key))
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return RunResult(False, "ERR_HTTP", dt, detail=f"HTTP {status}, body không phải JSON")
    if "error" in payload:
        err = json.dumps(payload["error"])[:220]
        return RunResult(False, f"ERR_API:{status}", dt, detail=mask(err, key))

    usage = payload.get("usage") or {}
    details = usage.get("prompt_tokens_details") or {}
    res = RunResult(
        False, "?", dt,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        cached_tokens=int(details.get("cached_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
    )
    content = ((payload.get("choices") or [{}])[0].get("message") or {}).get("content")
    if not content:
        # Ngân sách bị phần "nghĩ" ăn hết trước khi kịp phát token nào (model reasoning + effort rỗng).
        res.label = "RỖNG"
        return res
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        res.label = "CỤT"
        res.detail = f"JSON không đóng được (out {res.completion_tokens}/{probe.budget} tok)"
        return res
    missing = [k for k in probe.required_keys if k not in parsed]
    if missing:
        res.label = "THIẾU_FIELD"
        res.detail = f"thiếu {missing}"
        return res
    res.ok = True
    res.label = "OK"
    return res


def measure_ttft_stream(url: str, key: str, model: str, effort: str, probe: TierProbe) -> tuple[float, str]:
    """TTFT = giây tới token nội dung ĐẦU TIÊN ở chế độ stream (điều kiện G1.4 của CHAT_PAID)."""
    body: dict[str, Any] = {
        "model": model,
        "temperature": probe.temperature,
        "max_tokens": probe.budget,
        "stream": True,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": probe.system},
            {"role": "user", "content": probe.user},
        ],
    }
    if effort:
        body["reasoning_effort"] = effort
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "User-Agent": USER_AGENT},
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC, context=TLS) as resp:
            for raw_line in resp:
                line = raw_line.decode("utf-8", "replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = ((chunk.get("choices") or [{}])[0].get("delta") or {})
                if delta.get("content"):
                    return time.time() - t0, ""
    except urllib.error.HTTPError as e:
        return -1.0, mask(e.read().decode("utf-8", "replace")[:200], key)
    except Exception as e:
        return -1.0, f"{type(e).__name__}: {e}"
    return -1.0, "stream kết thúc mà không có token nội dung nào"


# ── Kiểm STT ─────────────────────────────────────────────────────────────────────────────────

def multipart(fields: dict[str, str], file_field: str, filename: str, blob: bytes) -> tuple[bytes, str]:
    boundary = "----DeutschFlowContract" + str(int(time.time() * 1000))
    out = bytearray()
    for k, v in fields.items():
        out += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    out += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
            f"filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode()
    out += blob + f"\r\n--{boundary}--\r\n".encode()
    return bytes(out), f"multipart/form-data; boundary={boundary}"


def transcribe(url: str, key: str, model: str, audio: Path, prompt: str | None) -> tuple[dict[str, Any], float, str]:
    fields = {"model": model, "language": "de", "temperature": "0.0",
              "response_format": "verbose_json", "timestamp_granularities[]": "word"}
    if prompt:
        fields["prompt"] = prompt
    payload, content_type = multipart(fields, "file", audio.name, audio.read_bytes())
    req = urllib.request.Request(
        url, data=payload,
        headers={"Authorization": f"Bearer {key}", "Content-Type": content_type,
                 "User-Agent": USER_AGENT},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC, context=TLS) as resp:
            return json.loads(resp.read().decode("utf-8", "replace")), time.time() - t0, ""
    except urllib.error.HTTPError as e:
        return {}, time.time() - t0, mask(e.read().decode("utf-8", "replace")[:200], key)
    except Exception as e:
        return {}, time.time() - t0, f"{type(e).__name__}: {e}"


def normalize(text: str) -> list[str]:
    return [w for w in re.sub(r"[,!?.;:]", " ", text or "").lower().split() if w]


def check_stt(env: dict[str, str], key: str, audio: Path, expected: str) -> bool:
    url = env.get("GROQ_WHISPER_BASE_URL") or ""
    model = env.get("GROQ_WHISPER_MODEL") or "whisper-large-v3"
    prompt_enabled = (env.get("GROQ_WHISPER_PROMPT_ENABLED") or "true").lower() == "true"
    if not url:
        die("Thiếu GROQ_WHISPER_BASE_URL — không kiểm được STT.")

    print(f"\n── STT ── model={model} @ {url.split('/')[2]} · GROQ_WHISPER_PROMPT_ENABLED={prompt_enabled}")
    ok = True

    root, dt, err = transcribe(url, key, model, audio, None)
    if err:
        print(f"  🔴 transcribe (không prompt): {err}")
        return False
    text = (root.get("text") or "").strip()
    print(f"  ✅ transcribe {dt:.2f}s · \"{text}\"")
    if expected:
        want, got = normalize(expected), normalize(text)
        missing = [w for w in want if w not in got]
        if missing:
            print(f"  ⚠️  transcript thiếu từ so với câu mẫu: {missing}")
    if not (root.get("words") or root.get("segments")):
        print("  🔴 verbose_json không trả `words` lẫn `segments` ⇒ chấm phát âm mất căn cứ "
              "(PronunciationScorerService cần word timestamps + avg_logprob).")
        ok = False
    elif not root.get("segments"):
        has_prob = any("probability" in w for w in (root.get("words") or []))
        print(f"  ✅ words[] có · segments[] KHÔNG có ⇒ avg_logprob phải suy từ words[].probability "
              f"({'có' if has_prob else 'KHÔNG CÓ — 🔴'})")
        ok = ok and has_prob

    # Bẫy nuốt prompt: Fireworks coi prompt là "văn bản đứng TRƯỚC audio" nên đoạn audio khớp
    # prompt bị bỏ khỏi transcript ⇒ học viên đọc ĐÚNG bị chấm 0. Đo thật 09/08: chỉ nuốt khi audio
    # còn nội dung SAU đoạn khớp prompt (audio nhiều câu + prompt câu đầu = mất câu đầu, tất định).
    if expected:
        root_p, _, err_p = transcribe(url, key, model, audio, expected)
        if err_p:
            print(f"  ⚠️  không thử được nhánh có prompt: {err_p}")
        else:
            text_p = (root_p.get("text") or "").strip()
            swallowed = len(normalize(text_p)) < len(normalize(text)) * 0.6
            if swallowed and prompt_enabled:
                print(f"  🔴 NHÀ CUNG CẤP NUỐT PROMPT và cờ đang BẬT — đặt "
                      f"GROQ_WHISPER_PROMPT_ENABLED=false. Có prompt: \"{text_p}\"")
                ok = False
            elif swallowed:
                print(f"  ✅ nhà cung cấp nuốt prompt NHƯNG cờ đã tắt ⇒ prod an toàn "
                      f"(nếu bật sẽ ra: \"{text_p}\")")
            else:
                print("  ✅ không thấy nuốt prompt trên mẫu này")
    return ok


# ── Chạy một tier ────────────────────────────────────────────────────────────────────────────

@dataclass
class TierReport:
    key: str
    model: str
    effort: str
    ok: bool
    runs: list[RunResult] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def check_tier(url: str, key: str, probe: TierProbe, env: dict[str, str],
               runs: int, workers: int, model_override: str | None,
               effort_override: str | None, budget_override: int | None = None) -> TierReport:
    model, effort = resolve(env, probe, model_override, effort_override)
    if budget_override and budget_override > 0:
        probe = replace(probe, budget=budget_override)
    rep = TierReport(probe.key, model, effort, True)

    with ThreadPoolExecutor(max_workers=max(1, min(workers, runs))) as ex:
        rep.runs = list(ex.map(lambda _: one_run(url, key, model, effort, probe), range(runs)))

    good = [r for r in rep.runs if r.ok]
    bad = [r for r in rep.runs if not r.ok]
    rep.ok = not bad

    if bad:
        kinds = sorted({r.label for r in bad})
        rep.notes.append(f"{len(bad)}/{runs} lượt hỏng: {kinds}")
        # In detail của MỌI kiểu hỏng, không riêng ERR_API: lỗi tầng vận chuyển (TLS, DNS, timeout)
        # mà im lặng thì người đọc báo cáo tưởng nhà cung cấp chết, trong khi thủ phạm có thể chỉ
        # là CA store của Python trên máy đang chạy script.
        for kind in kinds:
            sample = next((r for r in bad if r.label == kind and r.detail), None)
            if sample is not None:
                rep.notes.append(f"{kind} → {sample.detail}")
            if kind.startswith("ERR_API") and sample is not None:
                low = sample.detail.lower()
                if effort and "reasoning" in low:
                    rep.notes.append(
                        f"⇒ model KHÔNG nhận reasoning_effort: đặt {probe.effort_env}= (rỗng).")
                elif "not found" in low or "does not exist" in low:
                    rep.notes.append("⇒ slug model sai (Fireworks cần dạng "
                                     "accounts/fireworks/models/<tên>; tra bằng GET /v1/models).")
            if kind == "ERR_HTTP" and sample is not None and "CERTIFICATE_VERIFY" in sample.detail:
                rep.notes.append("⇒ CA store của Python, KHÔNG phải lỗi nhà cung cấp: chạy "
                                 "'Install Certificates.command' hoặc đặt SSL_CERT_FILE.")
        if "CỤT" in kinds or "RỖNG" in kinds:
            rep.notes.append(
                f"⇒ ngân sách {probe.budget} tok KHÔNG đủ cho model này. Cách sửa: đặt "
                f"{probe.effort_env}=low nếu là model reasoning; nếu đã low mà vẫn cụt thì phải "
                f"nới max_tokens tại call site (đây là kiểu hỏng ÂM THẦM — regex fallback vẫn móc "
                f"được điểm nên bài lưu AI_GRADED mất sạch nhận xét, xem FW.7).")

    if good:
        worst = max(r.completion_tokens for r in good)
        headroom = 100.0 * (probe.budget - worst) / probe.budget
        rep.notes.append(f"out max {worst}/{probe.budget} tok · biên an toàn {headroom:.0f}%")
        if headroom < 20:
            rep.ok = False
            rep.notes.append("🔴 biên an toàn <20% — một lượt dài hơn bình thường là cụt JSON.")
        cached = max(r.cached_tokens for r in good)
        if cached:
            pt = max(r.prompt_tokens for r in good)
            rep.notes.append(f"prompt cache: {cached}/{pt} token hit (ledger nên tính giá cached-in)")
    return rep


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Contract test 8 tier LLM (F2.4 — checklist khung AI tier).",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env-file", help="file kiểu .env.production (phủ lên env của process)")
    ap.add_argument("--tiers", help="danh sách tier, phẩy phân cách (mặc định: tất cả tier có caller)")
    ap.add_argument("--all-tiers", action="store_true", help="gồm cả tier chưa có caller (error-verify)")
    ap.add_argument("--runs", type=int, default=3,
                    help="số lượt mỗi tier (mặc định 3; hỏng kiểu FW.7 chập chờn nên đổi model hãy dùng 10)")
    ap.add_argument("--workers", type=int, default=3, help="số lượt chạy song song (mặc định 3)")
    ap.add_argument("--model", help="ép model cho MỌI tier được chọn — thử ứng viên trước khi flip env")
    ap.add_argument("--effort", help="ép reasoning_effort ('' = không gửi tham số)")
    ap.add_argument("--budget", type=int,
                    help="ép max_tokens (mặc định: ngân sách CHẬT NHẤT trong call site thật của "
                         "tier). Dùng để biết một model dài dòng cần nới call site tới đâu.")
    ap.add_argument("--stream", action="store_true", help="đo thêm TTFT chế độ stream (G1.4)")
    ap.add_argument("--ttft-runs", type=int, default=10,
                    help="số lượt đo TTFT (mặc định 10; tiêu chí đạt tính theo TRUNG VỊ)")
    ap.add_argument("--ttft-budget", type=float, default=1.5, help="ngưỡng TTFT đạt/không đạt (giây)")
    ap.add_argument("--audio", help="file audio để kiểm STT (transcript + bẫy nuốt prompt)")
    ap.add_argument("--expected-text", default="", help="câu mẫu tương ứng --audio")
    args = ap.parse_args()

    env = load_env(args.env_file)
    key = env.get("GROQ_API_KEY") or env.get("AI_LLM_API_KEY") or ""
    url = env.get("AI_LLM_BASE_URL") or env.get("GROQ_BASE_URL") or ""
    if not key:
        die("Thiếu GROQ_API_KEY (hoặc AI_LLM_API_KEY).")
    if not url:
        die("Thiếu GROQ_BASE_URL (hoặc AI_LLM_BASE_URL).")

    selected = [p for p in PROBES if p.has_caller or args.all_tiers]
    if args.tiers:
        want = {t.strip() for t in args.tiers.split(",") if t.strip()}
        unknown = want - {p.key for p in PROBES}
        if unknown:
            die(f"Tier không tồn tại: {sorted(unknown)}. Có: {[p.key for p in PROBES]}")
        selected = [p for p in PROBES if p.key in want]

    print("=" * 96)
    print("CONTRACT TEST TIER LLM — kiểm hợp đồng kỹ thuật (JSON mode · knob · ngân sách token)")
    print("=" * 96)
    print(f"endpoint : {url}")
    print(f"key      : {key[:3]}…({len(key)} ký tự)")
    print(f"lượt/tier: {args.runs} (song song {args.workers})"
          + (f" · model ép: {args.model}" if args.model else "")
          + (f" · effort ép: '{args.effort}'" if args.effort is not None else ""))

    failures: list[str] = []
    for probe in selected:
        rep = check_tier(url, key, probe, env, args.runs, args.workers,
                         args.model, args.effort, args.budget)
        mark = "✅" if rep.ok else "🔴"
        ok_n = sum(1 for r in rep.runs if r.ok)
        lat = [r.latency_s for r in rep.runs if r.ok]
        lat_txt = f"{min(lat):.2f}–{max(lat):.2f}s" if lat else "—"
        effort_txt = rep.effort if rep.effort else "(không gửi)"
        budget_txt = args.budget or probe.budget
        print(f"\n{mark} {probe.key:14s} {ok_n}/{args.runs} OK · {lat_txt} · "
              f"effort={effort_txt} · budget={budget_txt} tok")
        print(f"   model: {rep.model}")
        for note in rep.notes:
            print(f"   {note}")
        if not rep.ok:
            failures.append(probe.key)

        if args.stream and probe.key.startswith("chat"):
            model, effort = resolve(env, probe, args.model, args.effort)
            # Lặp: một mẫu TTFT không nói được gì (đúng cái bẫy mà script này tồn tại để tránh) —
            # routing lạnh của nhà cung cấp làm lượt lẻ chậm gấp 3 lần trung vị.
            samples: list[float] = []
            for _ in range(args.ttft_runs):
                ttft, err = measure_ttft_stream(url, key, model, effort, probe)
                if ttft < 0:
                    print(f"   🔴 TTFT stream: {err}")
                    failures.append(f"{probe.key}/stream")
                    break
                samples.append(ttft)
            if samples:
                samples.sort()
                median = samples[len(samples) // 2]
                over = [s for s in samples if s > args.ttft_budget]
                # Tiêu chí đạt: TRUNG VỊ dưới ngưỡng — người dùng cảm nhận trường hợp thường,
                # nhưng vẫn phải in số lượt vượt ngưỡng để không che đuôi phân phối.
                good = median <= args.ttft_budget
                print(f"   {'✅' if good else '🔴'} TTFT stream: trung vị {median:.2f}s · "
                      f"min {samples[0]:.2f}s · max {samples[-1]:.2f}s · "
                      f"{len(over)}/{len(samples)} lượt vượt {args.ttft_budget:.1f}s "
                      f"(điều kiện G1.4 của CHAT_PAID)")
                print(f"      mẫu: {[round(s, 2) for s in samples]}")
                if not good:
                    failures.append(f"{probe.key}/ttft")

    if args.audio:
        audio = Path(args.audio).expanduser()
        if not audio.is_file():
            die(f"Không đọc được file audio: {audio}")
        if not check_stt(env, key, audio, args.expected_text):
            failures.append("stt")

    print("\n" + "=" * 96)
    if failures:
        print(f"🔴 KHÔNG ĐẠT HỢP ĐỒNG: {failures} — ĐỪNG flip model/nhà cung cấp khi còn dòng này.")
        return 1
    print("✅ Mọi tier được kiểm đều đạt hợp đồng.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
