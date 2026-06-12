// spike.js — SPIKE test. Slams a sudden burst on top of a calm baseline to see
// whether the system rejects fast (accept-count/queue) or cascades (5s timeouts,
// then recovery). Models a marketing push or a class of students logging in at once.
//
//   BASE=https://staging.mydeutschflow.com TOKEN=<jwt> k6 run scripts/loadtest/spike.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const TOKEN = __ENV.TOKEN || '';
const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate', // arrival-rate = models real RPS, not VUs
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: '30s', target: 10 },   // calm
        { duration: '10s', target: 250 },  // SPIKE
        { duration: '40s', target: 250 },  // hold
        { duration: '10s', target: 10 },   // drop
        { duration: '30s', target: 10 },   // recovery window — does p95 settle back?
      ],
    },
  },
  thresholds: { http_req_failed: ['rate<0.60'] },
};

export default function () {
  const res = http.get(`${BASE}/api/words?cefr=A1`, {
    headers: authHeaders,
    tags: { name: 'spike_read' },
  });
  check(res, { 'not 5xx': (r) => r.status < 500 });
}
