// baseline.js — sanity + light concurrency. Confirms the system is healthy
// BEFORE you push real load. Run this first; if it's not green, stop.
//
//   BASE=https://staging.mydeutschflow.com k6 run scripts/loadtest/baseline.js
//
// Mix: cheap unauth paths + (optional) an authed read if you provide a token.
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const TOKEN = __ENV.TOKEN || ''; // optional Bearer token for an authed read

export const options = {
  scenarios: { baseline: { executor: 'constant-vus', vus: 10, duration: '30s' } },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% errors
    http_req_duration: ['p(95)<800'],        // p95 under 800ms
    'http_req_duration{name:health}': ['p(95)<500'],
  },
};

export default function () {
  group('infra', () => {
    const h = http.get(`${BASE}/actuator/health`, { tags: { name: 'health' } });
    // health is 200 only when DB+Redis are UP; 503 here = incident, not load.
    check(h, { 'health reachable': (r) => r.status === 200 || r.status === 503 });
  });

  group('unauth-read', () => {
    const w = http.get(`${BASE}/api/words`, { tags: { name: 'words' } });
    check(w, { 'words responds': (r) => r.status === 401 || r.status === 200 });
  });

  if (TOKEN) {
    group('authed-read', () => {
      const r = http.get(`${BASE}/api/words?cefr=A1`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
        tags: { name: 'words_a1' },
      });
      check(r, { 'authed 2xx': (res) => res.status >= 200 && res.status < 300 });
    });
  }

  sleep(1);
}
