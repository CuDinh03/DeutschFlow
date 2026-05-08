"""
Edge TTS Sidecar — Free Microsoft Neural TTS for DeutschFlow.

Provides a REST endpoint that converts text to speech using Microsoft's
Edge Neural Voices. Maps 18 DeutschFlow AI personas to unique voice
configurations with distinct pitch/rate adjustments.

Usage:
    pip install -r requirements.txt
    python server.py          # starts on port 5050
    EDGE_TTS_PORT=5051 python server.py  # custom port

API:
    POST /tts
    Body: {"text": "Hallo, wie geht es dir?", "persona": "LUKAS"}
    Response: audio/mpeg binary
"""

import asyncio
import io
import logging
import os

import edge_tts
from flask import Flask, request, send_file, jsonify

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [EdgeTTS] %(message)s")
log = logging.getLogger(__name__)

# ─── Persona → Voice Mapping ──────────────────────────────────────────────────
# Each persona gets a unique combination of voice + pitch + rate adjustments
# to create 18 distinct-sounding characters from 6 base German Neural voices.
#
# Available German Neural voices:
#   de-DE-ConradNeural         (Male, mature, calm)
#   de-DE-KillianNeural        (Male, strong, deep)
#   de-DE-FlorianMultilingualNeural (Male, friendly, warm)
#   de-DE-KatjaNeural          (Female, young, energetic)
#   de-DE-AmalaNeural          (Female, warm, gentle)
#   de-DE-SeraphinaMultilingualNeural (Female, professional)

PERSONA_VOICES = {
    # ── Core 5 personas ──
    "DEFAULT":   {"voice": "de-DE-ConradNeural",                "pitch": "+0Hz",  "rate": "+0%"},
    "LUKAS":     {"voice": "de-DE-ConradNeural",                "pitch": "-15Hz", "rate": "-5%"},
    "EMMA":      {"voice": "de-DE-KatjaNeural",                 "pitch": "+15Hz", "rate": "+5%"},
    "ANNA":      {"voice": "de-DE-AmalaNeural",                 "pitch": "+0Hz",  "rate": "-3%"},
    "HANNA":     {"voice": "de-DE-AmalaNeural",                 "pitch": "+10Hz", "rate": "+0%"},
    "KLAUS":     {"voice": "de-DE-KillianNeural",               "pitch": "-25Hz", "rate": "-5%"},

    # ── Verkauf (Bán hàng) ──
    "LENA":      {"voice": "de-DE-KatjaNeural",                 "pitch": "+25Hz", "rate": "+3%"},
    "THOMAS":    {"voice": "de-DE-FlorianMultilingualNeural",    "pitch": "+0Hz",  "rate": "+0%"},
    "PETRA":     {"voice": "de-DE-AmalaNeural",                  "pitch": "-15Hz", "rate": "-5%"},

    # ── Medizin (Y khoa) ──
    "SARAH":     {"voice": "de-DE-SeraphinaMultilingualNeural",  "pitch": "+0Hz",  "rate": "+0%"},
    "SCHNEIDER": {"voice": "de-DE-ConradNeural",                 "pitch": "-40Hz", "rate": "-10%"},
    "WEBER":     {"voice": "de-DE-SeraphinaMultilingualNeural",  "pitch": "+15Hz", "rate": "-3%"},

    # ── Maschinenbau (Cơ khí) ──
    "MAX":       {"voice": "de-DE-KillianNeural",               "pitch": "+15Hz", "rate": "+0%"},
    "OLIVER":    {"voice": "de-DE-KillianNeural",               "pitch": "-15Hz", "rate": "+3%"},

    # ── Service (Phục vụ) ──
    "NIKLAS":    {"voice": "de-DE-FlorianMultilingualNeural",    "pitch": "+15Hz", "rate": "-3%"},
    "NINA":      {"voice": "de-DE-KatjaNeural",                 "pitch": "-15Hz", "rate": "-5%"},

    # ── Special Vietnamese tutors ──
    "TUAN":      {"voice": "de-DE-ConradNeural",                "pitch": "+25Hz", "rate": "+3%"},
    "LAN":       {"voice": "de-DE-AmalaNeural",                  "pitch": "+15Hz", "rate": "-5%"},
    "MINH":      {"voice": "de-DE-FlorianMultilingualNeural",    "pitch": "+25Hz", "rate": "+5%"},
}

# Fallback for unknown personas
DEFAULT_VOICE = PERSONA_VOICES["DEFAULT"]


def _get_voice_config(persona: str) -> dict:
    """Get voice configuration for a persona, falling back to DEFAULT."""
    return PERSONA_VOICES.get(persona.upper(), DEFAULT_VOICE)


async def _synthesize(text: str, voice: str, pitch: str, rate: str) -> bytes:
    """Async synthesis using edge-tts. Returns MP3 bytes."""
    communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate)
    buf = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf += chunk["data"]
    return buf


@app.route("/tts", methods=["POST"])
def tts():
    """
    POST /tts
    Body: {"text": "...", "persona": "LUKAS"}
    Returns: audio/mpeg
    """
    data = request.get_json(silent=True)
    if not data or not data.get("text"):
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"][:2000]  # Match ElevenLabs truncation limit
    persona = data.get("persona", "DEFAULT").upper()
    cfg = _get_voice_config(persona)

    log.info("TTS request: persona=%s, voice=%s, len=%d", persona, cfg["voice"], len(text))

    try:
        audio_bytes = asyncio.run(_synthesize(text, cfg["voice"], cfg["pitch"], cfg["rate"]))
        if not audio_bytes:
            return jsonify({"error": "Empty audio generated"}), 500

        return send_file(
            io.BytesIO(audio_bytes),
            mimetype="audio/mpeg",
            download_name="speech.mp3",
        )
    except Exception as e:
        log.error("TTS synthesis failed: %s", e)
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "edge-tts-sidecar",
        "personas": len(PERSONA_VOICES),
    })


@app.route("/voices", methods=["GET"])
def list_voices():
    """Debug endpoint: list all persona-to-voice mappings."""
    return jsonify(PERSONA_VOICES)


if __name__ == "__main__":
    port = int(os.environ.get("EDGE_TTS_PORT", 5050))
    log.info("Starting Edge TTS sidecar on port %d with %d personas", port, len(PERSONA_VOICES))
    app.run(host="0.0.0.0", port=port, debug=False)
