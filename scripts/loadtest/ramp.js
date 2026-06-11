// ramp.js — STRESS test. Ramps load up in stages to find the breaking point.
// Expectation for DeutschFlow: the first wall is the DB pool (max 20). When
// hikaricp_connections_pending stays > 0 and p95 jumps toward ~5s (the Hikari
// connection-timeout), you've hit the ceiling.
//
//   BASE=https://staging.mydeutschflow.com TOKEN=<jwt> k6 run scripts/loadtest/ramp.js
//
// Watch in parallel (Grafana / actuator/prometheus):
//   hikaricp_connections_active, hikaricp_connections_pending,
//   http_server_requests_seconds (p95), RDS CurrentConnections / CPU, JVM heap.
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const TOKEN = __ENV.TOKEN || '';
const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

const readLatency = new Trend('read_latency', true);
const errors = new Rate('logical_errors');

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 20 },   // warm
        { duration: '2m', target: 50 },   // ~thread:pool pressure starts
        { duration: '2m', target: 100 },  // expect pool saturation here
        { duration: '2m', target: 150 },  // past the wall
        { duration: '1m', target: 0 },    // recover
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // Don't fail the run on breach — we WANT to observe the break. Just record.
    http_req_failed: ['rate<0.50'],
    read_latency: ['p(95)<3000'],
  },
};

// Use a representative authed READ path. Replace with a real endpoint that hits
// the DB (dashboard / SRS-due / words?cefr=A1) so you actually exercise the pool.
export default function () {
  const res = http.get(`${BASE}/api/words?cefr=A1`, {
    headers: authHeaders,
    tags: { name: 'authed_read' },
  });
  readLatency.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 400;
  errors.add(!ok);
  check(res, { 'status < 400': () => ok });
}
