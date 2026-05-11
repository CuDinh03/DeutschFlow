// ============================================================
// config.js — Shared configuration for DeutschFlow load tests
// ============================================================

export const BASE_URL = 'https://api.mydeutschflow.com';

// 5 test accounts — phải tạo trước trên production
export const USERS = [
  { email: 'loadtest01@test.com', password: 'LoadTest2026!' },
  { email: 'loadtest02@test.com', password: 'LoadTest2026!' },
  { email: 'loadtest03@test.com', password: 'LoadTest2026!' },
  { email: 'loadtest04@test.com', password: 'LoadTest2026!' },
  { email: 'loadtest05@test.com', password: 'LoadTest2026!' },
];

// German conversation messages — realistic A1/A2 level
export const CHAT_MESSAGES = [
  'Hallo, ich heiße Max und ich komme aus Vietnam.',
  'Ich lerne Deutsch seit drei Monaten.',
  'Ich arbeite als Programmierer in Ho-Chi-Minh-Stadt.',
  'Meine Hobbys sind Kochen und Lesen.',
  'Ich möchte in Deutschland studieren.',
  'Was kann ich in Berlin besuchen?',
  'Ich trinke gerne Kaffee am Morgen.',
  'Das Wetter heute ist sehr schön.',
  'Ich habe zwei Geschwister.',
  'Am Wochenende gehe ich gerne spazieren.',
  'Ich esse gerne Pho zum Frühstück.',
  'Können Sie das bitte wiederholen?',
  'Ich verstehe das nicht. Bitte erklären Sie.',
  'Mein Lieblingsessen ist Schnitzel.',
  'Ich fahre jeden Tag mit dem Bus zur Arbeit.',
];

// Interview messages — for Interview mode scenarios
export const INTERVIEW_MESSAGES = [
  'Guten Tag, mein Name ist Max. Ich bin Softwareentwickler.',
  'Ich habe zwei Jahre Erfahrung mit Java und Spring Boot.',
  'In meinem letzten Projekt habe ich eine REST API entwickelt.',
  'Ich arbeite gerne im Team und kommuniziere klar.',
  'Meine Stärke ist Problemlösung und analytisches Denken.',
  'Ich möchte meine Karriere in Deutschland weiterentwickeln.',
  'Ja, ich habe Erfahrung mit agilen Methoden wie Scrum.',
  'Ich habe ein Projekt geleitet mit fünf Entwicklern.',
];

// AI Speaking topics
export const TOPICS = [
  'Alltag in Deutschland',
  'Hobbys und Freizeit',
  'Essen und Trinken',
  'Arbeit und Beruf',
  'Reisen und Urlaub',
];

// Think time: 15–20 seconds between messages (stay under Groq 30 RPM)
export const THINK_TIME_MIN = 15;
export const THINK_TIME_MAX = 20;

// Helper: random element from array
export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: random think time (seconds)
export function thinkTime() {
  return THINK_TIME_MIN + Math.random() * (THINK_TIME_MAX - THINK_TIME_MIN);
}

// Helper: build auth headers
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

// Helper: login and return access token
export function login(http, user) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    console.error(`Login failed for ${user.email}: ${res.status} ${res.body}`);
    return null;
  }
  const body = JSON.parse(res.body);
  return body.accessToken || body.access_token || body.token;
}
