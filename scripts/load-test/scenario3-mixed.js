// ============================================================
// scenario3-mixed.js — Full Mixed Workload (5 users, 30 phút)
// Mục đích: Mô phỏng 5 users thực tế với hành vi khác nhau
//   - 2 users: AI Speaking Communication
//   - 1 user:  AI Speaking Interview
//   - 1 user:  Roadmap + Skill Tree browsing
//   - 1 user:  Dashboard + vocabulary browsing
// Chạy: k6 run scripts/load-test/scenario3-mixed.js
// ============================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  USERS, BASE_URL, CHAT_MESSAGES, INTERVIEW_MESSAGES, TOPICS,
  login, authHeaders, randomFrom, thinkTime,
} from './config.js';

// Custom metrics
const chatDuration = new Trend('ai_chat_duration', true);
const browseDuration = new Trend('browse_duration', true);
const groq429Count = new Counter('groq_429_errors');
const errorRate = new Rate('errors');
const messagesTotal = new Counter('messages_sent');

export const options = {
  scenarios: {
    mixed: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
    },
  },
  thresholds: {
    ai_chat_duration: ['p(95)<15000'],
    browse_duration: ['p(95)<2000'],
    errors: ['rate<0.10'],
  },
};

export function setup() {
  const tokens = [];
  for (const user of USERS) {
    const token = login(http, user);
    tokens.push(token);
  }
  console.log(`✅ Setup: ${tokens.filter(Boolean).length}/5 users logged in`);
  return { tokens };
}

// ── VU routing: decide behavior based on VU number ──
// VU 1-2: AI Speaking Communication
// VU 3:   AI Speaking Interview
// VU 4:   Roadmap + Skill Tree browsing
// VU 5:   Dashboard + Vocabulary browsing

export default function (data) {
  const vuIndex = __VU - 1;
  const token = data.tokens[vuIndex % data.tokens.length];
  if (!token) { sleep(5); return; }

  if (vuIndex <= 1) {
    aiChatCommunication(token, vuIndex);
  } else if (vuIndex === 2) {
    aiChatInterview(token);
  } else if (vuIndex === 3) {
    browseRoadmap(token);
  } else {
    browseDashboard(token);
  }
}

// ── AI Speaking Communication (VU 1-2) ──
function aiChatCommunication(token, vuIndex) {
  const opts = authHeaders(token);
  const topic = randomFrom(TOPICS);

  // Create session (once per iteration cycle)
  const createRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions`,
    JSON.stringify({
      topic: topic,
      cefrLevel: 'A1',
      persona: vuIndex === 0 ? 'LUKAS' : 'EMMA',
      responseSchema: 'V1',
      sessionMode: 'COMMUNICATION',
    }),
    opts
  );

  if (createRes.status !== 200) {
    errorRate.add(1);
    sleep(10);
    return;
  }

  const sessionId = JSON.parse(createRes.body).id;
  const message = randomFrom(CHAT_MESSAGES);

  const start = Date.now();
  const chatRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions/${sessionId}/chat`,
    JSON.stringify({ userMessage: message }),
    opts
  );
  chatDuration.add(Date.now() - start);

  if (chatRes.status === 429) {
    groq429Count.add(1);
    sleep(30);
    return;
  }

  const ok = check(chatRes, { 'comm chat 200': (r) => r.status === 200 });
  errorRate.add(ok ? 0 : 1);
  messagesTotal.add(1);

  sleep(thinkTime());
}

// ── AI Speaking Interview (VU 3) ──
function aiChatInterview(token) {
  const opts = authHeaders(token);

  const createRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions`,
    JSON.stringify({
      topic: 'Bewerbungsgespräch',
      cefrLevel: 'A2',
      persona: 'LUKAS',
      responseSchema: 'V1',
      sessionMode: 'INTERVIEW',
      interviewPosition: 'Backend Developer',
      experienceLevel: '1-2Y',
    }),
    opts
  );

  if (createRes.status !== 200) {
    errorRate.add(1);
    sleep(10);
    return;
  }

  const sessionId = JSON.parse(createRes.body).id;
  const message = randomFrom(INTERVIEW_MESSAGES);

  const start = Date.now();
  const chatRes = http.post(
    `${BASE_URL}/api/ai-speaking/sessions/${sessionId}/chat`,
    JSON.stringify({ userMessage: message }),
    opts
  );
  chatDuration.add(Date.now() - start);

  if (chatRes.status === 429) {
    groq429Count.add(1);
    sleep(30);
    return;
  }

  const ok = check(chatRes, { 'interview chat 200': (r) => r.status === 200 });
  errorRate.add(ok ? 0 : 1);
  messagesTotal.add(1);

  sleep(thinkTime());
}

// ── Roadmap + Skill Tree browsing (VU 4) ──
function browseRoadmap(token) {
  const opts = authHeaders(token);
  const endpoints = [
    '/api/skill-tree/me',
    '/api/roadmap/active',
    '/api/today/me',
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}${ep}`, opts);
    browseDuration.add(Date.now() - start);

    const ok = check(res, { [`${ep} OK`]: (r) => r.status === 200 });
    errorRate.add(ok ? 0 : 1);
    sleep(2);
  }

  // Try loading a skill tree node (node ID 1 — A0 module)
  const nodeStart = Date.now();
  const nodeRes = http.get(`${BASE_URL}/api/skill-tree/node/1/session`, opts);
  browseDuration.add(Date.now() - nodeStart);

  check(nodeRes, {
    'node session 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(5); // Browse time between pages
}

// ── Dashboard + Vocabulary browsing (VU 5) ──
function browseDashboard(token) {
  const opts = authHeaders(token);
  const endpoints = [
    '/api/student/dashboard',
    '/api/today/me',
    '/api/xp/leaderboard?limit=20',
    '/api/notifications',
    '/api/words?page=0&size=20',
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}${ep}`, opts);
    browseDuration.add(Date.now() - start);

    const ok = check(res, { [`${ep} OK`]: (r) => r.status === 200 });
    errorRate.add(ok ? 0 : 1);
    sleep(2);
  }

  sleep(5); // User reading time
}

export function teardown(data) {
  console.log('='.repeat(50));
  console.log('  Mixed Workload Load Test — COMPLETE');
  console.log('='.repeat(50));
}
