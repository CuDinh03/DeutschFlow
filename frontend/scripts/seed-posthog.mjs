/**
 * PostHog Seed Script — DeutschFlow
 * Bắn dữ liệu mock lên PostHog để populate Dashboard/Funnel
 * Chạy: node scripts/seed-posthog.mjs
 */

const POSTHOG_KEY = 'phc_vFERGwkAxSWCTagc39wk3uevgueqhZsXvjcc5dDSKoHB'
const POSTHOG_HOST = 'https://us.i.posthog.com'

const FEATURES = ['dash', 'road', 'speak', 'plan', 'vocabulary', 'review']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const LEVELS = ['A1', 'A2', 'B1', 'B2']
const GOALS = ['TRAVEL', 'WORK', 'STUDY', 'PERSONAL']
const INDUSTRIES = ['IT', 'MEDICINE', 'EDUCATION', 'BUSINESS']

// ─── Tạo user giả ────────────────────────────────────────────────────────────
function makeUsers(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-user-${i + 1}`,
    email: `user${i + 1}@test.com`,
    name: `User ${i + 1}`,
    role: 'STUDENT',
    locale: ['vi', 'en'][i % 2],
    level: LEVELS[i % 4],
  }))
}

// ─── Helper: random trong khoảng ─────────────────────────────────────────────
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = arr => arr[rnd(0, arr.length - 1)]
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString()

// ─── Gửi 1 batch events lên PostHog ─────────────────────────────────────────
async function sendBatch(events) {
  const res = await fetch(`${POSTHOG_HOST}/batch/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: POSTHOG_KEY, batch: events }),
  })
  if (!res.ok) {
    console.error('❌ Batch failed:', res.status, await res.text())
  }
}

// ─── Build events cho 1 user trong 1 ngày ───────────────────────────────────
function buildDayEvents(user, daysAgoN) {
  const events = []
  const ts = (offsetMs = 0) =>
    new Date(Date.now() - daysAgoN * 86400000 + offsetMs).toISOString()
  const hour = rnd(7, 22)

  const base = {
    distinct_id: user.id,
    properties: {
      $set: { email: user.email, name: user.name, role: user.role, locale: user.locale },
    },
  }

  // 1. Mở app
  events.push({
    ...base,
    event: 'app_opened',
    timestamp: ts(0),
    properties: {
      ...base.properties,
      referrer: pick(['direct', 'google', 'facebook', 'direct']),
      hour_of_day: hour,
      day_of_week: pick(DAYS),
    },
  })

  // 2. Pageview trang chủ
  events.push({
    ...base,
    event: '$pageview',
    timestamp: ts(1000),
    properties: { ...base.properties, $current_url: 'http://localhost:3000/' },
  })

  // 3. Pageview dashboard
  events.push({
    ...base,
    event: '$pageview',
    timestamp: ts(5000),
    properties: { ...base.properties, $current_url: 'http://localhost:3000/dashboard' },
  })

  // 4. Dùng feature chính (nav click + feature_session)
  const numFeatures = rnd(1, 3)
  let offset = 10000
  for (let f = 0; f < numFeatures; f++) {
    const feature = pick(FEATURES)
    const activeSeconds = rnd(30, 600)

    events.push({
      ...base,
      event: 'nav_clicked',
      timestamp: ts(offset),
      properties: { ...base.properties, feature, from: '/dashboard' },
    })
    offset += 2000

    events.push({
      ...base,
      event: '$pageview',
      timestamp: ts(offset),
      properties: {
        ...base.properties,
        $current_url: `http://localhost:3000/student/${feature}`,
      },
    })
    offset += activeSeconds * 1000

    events.push({
      ...base,
      event: 'feature_session',
      timestamp: ts(offset),
      properties: {
        ...base.properties,
        feature,
        active_seconds: activeSeconds,
        total_seconds: activeSeconds + rnd(0, 30),
        hour_of_day: hour,
        day_of_week: pick(DAYS),
      },
    })
    offset += 3000
  }

  return events
}

// ─── Build Onboarding funnel events ─────────────────────────────────────────
function buildOnboardingFunnel(user, daysAgoN, completedSteps = 3) {
  const events = []
  const ts = (s = 0) =>
    new Date(Date.now() - daysAgoN * 86400000 + s * 1000).toISOString()

  const base = { distinct_id: user.id, properties: {} }

  events.push({ ...base, event: 'register_started', timestamp: ts(0), properties: { locale: user.locale } })
  events.push({ ...base, event: 'register_success', timestamp: ts(5), properties: { role: 'STUDENT', locale: user.locale } })

  if (completedSteps >= 1) {
    events.push({
      ...base, event: 'onboarding_step_completed', timestamp: ts(20),
      properties: { step: 1, step_name: 'Select Level', currentLevel: user.level },
    })
  }
  if (completedSteps >= 2) {
    events.push({
      ...base, event: 'onboarding_step_completed', timestamp: ts(60),
      properties: { step: 2, step_name: 'Select Goal', goalType: pick(GOALS), industry: pick(INDUSTRIES), targetLevel: LEVELS[LEVELS.indexOf(user.level) + 1] || 'B2' },
    })
  }
  if (completedSteps >= 3) {
    events.push({
      ...base, event: 'onboarding_step_completed', timestamp: ts(120),
      properties: { step: 3, step_name: 'Select Schedule', weeklyTarget: pick([3, 4, 5, 7]) },
    })
  }
  return events
}

// ─── Build Login events ──────────────────────────────────────────────────────
function buildLoginEvents(user, daysAgoN) {
  const ts = (s = 0) => new Date(Date.now() - daysAgoN * 86400000 + s * 1000).toISOString()
  const base = { distinct_id: user.id, properties: {} }
  const failed = Math.random() < 0.15 // 15% tỷ lệ login thất bại

  if (failed) {
    return [
      { ...base, event: 'login_started', timestamp: ts(0), properties: { method: 'email' } },
      { ...base, event: 'login_failed', timestamp: ts(3), properties: { reason: 'Invalid password' } },
    ]
  }
  return [
    { ...base, event: 'login_started', timestamp: ts(0), properties: { method: 'email' } },
    { ...base, event: 'login_success', timestamp: ts(2), properties: { role: user.role } },
  ]
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const users = makeUsers(25)
  let totalEvents = 0
  let batchAll = []

  console.log('🚀 Bắt đầu seed dữ liệu PostHog...')
  console.log(`👥 ${users.length} mock users × 7 ngày\n`)

  // Onboarding funnel (30 ngày trước)
  // Giả lập tỷ lệ drop-off: 100% register, 85% step1, 70% step2, 60% step3
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const completedSteps = i < 15 ? 3 : i < 18 ? 2 : i < 22 ? 1 : 0
    const events = buildOnboardingFunnel(user, rnd(14, 30), completedSteps)
    batchAll.push(...events)
  }

  // 7 ngày hoạt động gần đây
  for (let day = 0; day < 7; day++) {
    // Mỗi ngày có 60–80% user active
    const activeUsers = users.filter(() => Math.random() < 0.7)

    for (const user of activeUsers) {
      // Login mỗi ngày
      batchAll.push(...buildLoginEvents(user, day))
      // Hoạt động trong app
      batchAll.push(...buildDayEvents(user, day))
    }
  }

  totalEvents = batchAll.length

  // Gửi theo từng batch 50 events
  const CHUNK = 50
  for (let i = 0; i < batchAll.length; i += CHUNK) {
    const chunk = batchAll.slice(i, i + CHUNK)
    await sendBatch(chunk)
    process.stdout.write(`\r📤 Đã gửi ${Math.min(i + CHUNK, totalEvents)}/${totalEvents} events...`)
    await new Promise(r => setTimeout(r, 200)) // tránh rate limit
  }

  console.log(`\n\n✅ Hoàn thành! Đã gửi ${totalEvents} events lên PostHog.`)
  console.log('🔗 Xem tại: https://us.posthog.com/project/default/activity')
}

main().catch(console.error)
