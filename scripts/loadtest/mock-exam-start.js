// mock-exam-start.js — the most expensive B2B burst: a whole class (50–100
// students) clicks "Bắt đầu thi thử" within seconds. Each POST /{id}/start does
// a find-active-attempt read, an INSERT ... RETURNING, an exam-details read and
// answer-key stripping — several DB ops per click, all arriving at once.
//
//   BASE=https://staging.mydeutschflow.com TOKEN=<jwt> [EXAM_ID=7] [CEFR=B1] \
//     k6 run scripts/loadtest/mock-exam-start.js
//
// NOTE: with a single TOKEN the /start is idempotent (returns the same
// IN_PROGRESS attempt), so this measures the endpoint's read + answer-strip cost
// under burst. For true per-student attempt creation, drive it with many
// accounts (see scripts/load-test/ for the multi-account login harness).
//
// Watch: hikaricp pending (the INSERT + 2 reads per click amplify pool demand),
// RDS write IOPS / CPU, exam_start_latency p95.
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://api.mydeutschflow.com';
const TOKEN = __ENV.TOKEN;
if (!TOKEN) {
  throw new Error('TOKEN is required: log in once and pass --env TOKEN=<jwt>');
}
const CEFR = __ENV.CEFR || 'B1';
const envExamId = __ENV.EXAM_ID ? Number(__ENV.EXAM_ID) : null;
const auth = (name) => ({ headers: { Authorization: `Bearer ${TOKEN}` }, tags: { name } });

const startLatency = new Trend('exam_start_latency', true);
const errors = new Rate('logical_errors');

export const options = {
  scenarios: {
    // The bell rings — everyone clicks "start" together: a sharp arrival burst.
    exam_start_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 60,
      maxVUs: 200,
      stages: [
        { duration: '15s', target: 2 },    // calm
        { duration: '10s', target: 40 },   // burst
        { duration: '30s', target: 40 },   // hold (~a class of 50–100 starting)
        { duration: '10s', target: 0 },    // drain
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    exam_start_latency: ['p(95)<2500'],
    logical_errors: ['rate<0.10'],
  },
};

// Resolve the exam id ONCE (setup runs a single time) so the burst isolates
// /start rather than also hammering the list endpoint.
export function setup() {
  if (envExamId) return { examId: envExamId };
  const list = http.get(`${BASE}/api/mock-exams?cefrLevel=${CEFR}`, auth('exam_list'));
  let examId = null;
  try {
    const arr = list.json();
    if (Array.isArray(arr) && arr.length > 0) examId = arr[0].id;
  } catch (_) {
    // fall through — examId stays null, default() will record a logical error
  }
  return { examId };
}

export default function (data) {
  if (!data || !data.examId) {
    errors.add(true);
    return;
  }
  const res = http.post(`${BASE}/api/mock-exams/${data.examId}/start`, null, auth('exam_start'));
  startLatency.add(res.timings.duration);
  const ok = res.status >= 200 && res.status < 300;
  errors.add(!ok);
  check(res, {
    'start 2xx': () => ok,
    'no server error': (r) => r.status < 500,
  });
}
