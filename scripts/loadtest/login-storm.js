// login-storm.js — models a whole class hitting POST /api/auth/login at the
// start of a lesson. This is the single most CPU-expensive auth path: a bcrypt
// verify (~100–200ms per attempt on a 2-vCPU box) plus the Redis-backed rate
// limiter that 500'd in prod on 2026-06-13 when deutschflow-redis was
// unreachable (ERR-74C: Lettuce hung ~5s → HTTP 500 on every login).
//
//   BASE=https://staging.mydeutschflow.com LOADTEST_PASSWORD=... \
//     k6 run scripts/loadtest/login-storm.js
//
// Watch (Grafana / actuator/prometheus): process/system CPU (bcrypt is serial
// CPU-bound), the rate-limiter WARN logs, hikaricp (login does a user lookup),
// and CRUCIALLY http 5xx — a 500 here is the ERR-74C regression, not load.
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const PASSWORD = __ENV.LOADTEST_PASSWORD;
if (!PASSWORD) {
  throw new Error('LOADTEST_PASSWORD is required: k6 run --env LOADTEST_PASSWORD=<pw> ...');
}
// Pre-created test accounts (same set as scripts/load-test/config.js).
// Override with EMAILS="a@x.com,b@x.com" to use your own.
const EMAILS = (__ENV.EMAILS
  || 'loadtest01@test.com,loadtest02@test.com,loadtest03@test.com,loadtest04@test.com,loadtest05@test.com'
).split(',');

const loginLatency = new Trend('login_latency', true);
const serverErrors = new Rate('login_5xx');   // the ERR-74C signal — must stay ~0
const rateLimited = new Rate('login_429');     // expected degradation, NOT a failure

export const options = {
  scenarios: {
    // Ramp arrival rate to find the bcrypt/CPU wall. bcrypt is serial-CPU-bound,
    // so roughly (vCPU / 0.15s) logins/s saturates — on 2 vCPU that's ~13/s.
    login_storm: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '10s', target: 5 },    // calm
        { duration: '10s', target: 20 },   // class starts logging in
        { duration: '30s', target: 20 },   // hold the storm (~600 logins / 30s)
        { duration: '10s', target: 0 },    // drain
      ],
    },
  },
  thresholds: {
    login_5xx: ['rate<0.01'],          // a 500 on login = ERR-74C regression → block
    login_latency: ['p(95)<2000'],     // bcrypt + lookup; climbs under CPU pressure
  },
};

export default function () {
  const email = EMAILS[(__VU + __ITER) % EMAILS.length];
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );
  loginLatency.add(res.timings.duration);
  serverErrors.add(res.status >= 500);
  rateLimited.add(res.status === 429);
  check(res, {
    // 200 = success, 401 = wrong pw (bcrypt still ran), 429 = limiter did its job.
    'no server error (no ERR-74C)': (r) => r.status < 500,
    'auth resolved (200/401/429)': (r) => r.status === 200 || r.status === 401 || r.status === 429,
  });
}
