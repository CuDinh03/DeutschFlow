// ============================================================
// scenario2-ai-chat.js — 5 users AI Speaking chat + TTS (30 phút)
// Mục đích: Stress test AI endpoints — Groq LLM + ElevenLabs TTS
// Chạy: k6 run scripts/load-test/scenario2-ai-chat.js
// ============================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  USERS, BASE_URL, CHAT_MESSAGES, TOPICS,
  login, authHeaders, randomFrom, thinkTime,
} from './config.js';

// Custom metrics
const chatDuration = new Trend('ai_chat_duration', true);
const groq429Count = new Counter('groq_429_errors');
const errorRate = new Rate('errors');
const messagesTotal = new Counter('messages_sent');

export const options = {
  scenarios: {
    ai_chat: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
    },
  },
  thresholds: {
    ai_chat_duration: ['p(95)<15000'],  // AI response p95 < 15s
    errors: ['rate<0.10'],              // Error rate < 10%
  },
};

export function setup() {
  // Login tất cả 5 users, lưu tokens
  const tokens = [];
  for (const user of USERS) {
    const token = login(http, user);
    if (!token) {
      console.error(`❌ Setup: Login failed for ${user.email}`);
    }
    tokens.push(token);
  }
  console.log(`✅ Setup: ${tokens.filter(Boolean).length}/5 users logged in`);
  return { tokens };
}

export default function (data) {
  const userIndex = __VU - 1;
  const token = data.tokens[userIndex % data.tokens.length];
  if (!token) {
    sleep(5);
    return;
  }

  const opts = authHeaders(token);
  const topic = randomFrom(TOPICS);

  // ── Step 1: Create AI Speaking session ──
  const createRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions`,
    JSON.stringify({
      topic: topic,
      cefrLevel: 'A1',
      persona: 'DEFAULT',
      responseSchema: 'V1',
      sessionMode: 'COMMUNICATION',
    }),
    opts
  );

  const sessionCreated = check(createRes, {
    'session created (200)': (r) => r.status === 200,
  });
  if (!sessionCreated) {
    errorRate.add(1);
    console.error(`VU${__VU}: Create session failed: ${createRes.status}`);
    sleep(10);
    return;
  }
  errorRate.add(0);

  const session = JSON.parse(createRes.body);
  const sessionId = session.id;
  console.log(`VU${__VU}: Session ${sessionId} created — topic: "${topic}"`);

  // ── Step 2: Chat loop (30 phút) ──
  // Mỗi iteration gửi 1 message, sleep 15-20s, rồi lặp lại
  // k6 sẽ tự lặp default function cho đến hết duration (30m)

  const message = randomFrom(CHAT_MESSAGES);

  // Send chat message (non-streaming endpoint — dễ đo hơn SSE)
  const chatStart = Date.now();
  const chatRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions/${sessionId}/chat`,
    JSON.stringify({ userMessage: message }),
    opts
  );
  const chatElapsed = Date.now() - chatStart;
  chatDuration.add(chatElapsed);

  if (chatRes.status === 429) {
    groq429Count.add(1);
    console.warn(`⚠️ VU${__VU}: Groq 429 rate limit! Backing off 30s...`);
    sleep(30);
    return;
  }

  const chatOk = check(chatRes, {
    'chat response 200': (r) => r.status === 200,
    'chat has body': (r) => r.body && r.body.length > 10,
    'chat < 15s': () => chatElapsed < 15000,
  });
  errorRate.add(chatOk ? 0 : 1);
  messagesTotal.add(1);

  if (chatOk) {
    console.log(`VU${__VU}: ✅ Chat OK (${chatElapsed}ms) — "${message.substring(0, 30)}..."`);
  } else {
    console.warn(`VU${__VU}: ❌ Chat FAIL (${chatRes.status}, ${chatElapsed}ms)`);
  }

  // ── Think time — 15-20s giữa mỗi message ──
  sleep(thinkTime());
}

export function teardown(data) {
  console.log('='.repeat(50));
  console.log('  AI Chat Load Test — COMPLETE');
  console.log('='.repeat(50));
}
