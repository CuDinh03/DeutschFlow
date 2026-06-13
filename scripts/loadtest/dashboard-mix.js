// dashboard-mix.js — the read path with the most DB queries right after login.
// When a student lands on Home, app/(student)/index.tsx fires three calls in
// parallel; the heaviest is /api/student/dashboard (an aggregate). This is what
// "100 CCU just using the app" actually looks like — and the dashboard
// aggregate is the student call most likely to saturate the DB pool first.
//
//   BASE=https://staging.mydeutschflow.com TOKEN=<jwt> \
//     k6 run scripts/loadtest/dashboard-mix.js
//
// Watch: hikaricp_connections_active / hikaricp_connections_pending (pending > 0
// = pool saturated), RDS CurrentConnections / CPU, and p95 per endpoint tag.
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const TOKEN = __ENV.TOKEN;
if (!TOKEN) {
  throw new Error('TOKEN is required: log in once and pass --env TOKEN=<jwt>');
}
const params = (name) => ({ headers: { Authorization: `Bearer ${TOKEN}` }, tags: { name } });
const errors = new Rate('logical_errors');

export const options = {
  scenarios: {
    dashboard_mix: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 30 },   // warm
        { duration: '2m', target: 80 },   // pool pressure builds
        { duration: '2m', target: 120 },  // ~100+ CCU on the heaviest read path
        { duration: '1m', target: 0 },    // recover
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:dashboard}': ['p(95)<1500'],
    logical_errors: ['rate<0.05'],
  },
};

export default function () {
  // Mirror app/(student)/index.tsx: dashboard + srs count + unread badge fire together.
  const responses = http.batch([
    ['GET', `${BASE}/api/student/dashboard`, null, params('dashboard')],
    ['GET', `${BASE}/api/srs/count`, null, params('srs_count')],
    ['GET', `${BASE}/api/notifications/unread-count`, null, params('unread')],
  ]);
  for (const r of responses) {
    const ok = r.status >= 200 && r.status < 300;
    errors.add(!ok);
    check(r, { 'authed 2xx': () => ok });
  }
}
