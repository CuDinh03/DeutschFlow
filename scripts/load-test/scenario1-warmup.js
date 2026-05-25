// ============================================================
// scenario1-warmup.js — Auth + Dashboard (5 users, 2 minutes)
// Mục đích: Warm-up server, kiểm tra auth + basic read endpoints
// Chạy: k6 run scripts/load-test/scenario1-warmup.js
// ============================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { USERS, BASE_URL, login, authHeaders } from './config.js';

// Custom metrics
const loginDuration = new Trend('login_duration', true);
const dashboardDuration = new Trend('dashboard_duration', true);
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    warmup: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 1,        // Mỗi user chạy 1 lần flow
      maxDuration: '2m',
    },
  },
  thresholds: {
    login_duration: ['p(95)<500'],      // Login p95 < 500ms
    dashboard_duration: ['p(95)<1000'], // Dashboard p95 < 1s
    errors: ['rate<0.01'],              // Error rate < 1%
  },
};

export default function () {
  const userIndex = __VU - 1; // VU 1-5 → index 0-4
  const user = USERS[userIndex % USERS.length];

  // ── Step 1: Login ──
  const loginStart = Date.now();
  const token = login(http, user);
  loginDuration.add(Date.now() - loginStart);

  const loginOk = check(token, {
    'login successful': (t) => t !== null && t.length > 0,
  });
  if (!loginOk) {
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  const opts = authHeaders(token);
  sleep(1);

  // ── Step 2: Dashboard endpoints ──
  const endpoints = [
    '/api/student/dashboard',
    '/api/today/me',
    '/api/skill-tree/me',
    '/api/xp/leaderboard?limit=20',
    '/api/notifications',
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const res = http.get(`${BASE_URL}${ep}`, opts);
    dashboardDuration.add(Date.now() - start);

    const ok = check(res, {
      [`${ep} status 200`]: (r) => r.status === 200,
      [`${ep} has body`]: (r) => r.body && r.body.length > 0,
    });
    errorRate.add(ok ? 0 : 1);

    sleep(0.5); // 500ms between requests
  }

  console.log(`✅ VU${__VU} (${user.email}): warm-up complete`);
}
