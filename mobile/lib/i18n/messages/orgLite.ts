import { defineMessages } from '@/lib/i18n'

/**
 * PROFILE_LITE — wizard rút gọn cho học viên trung tâm (`components/onboarding/OrgLiteWizard.tsx`).
 * vi là nguồn; en/de phải khớp từng khoá (tsc). `{className}`, `{orgName}`, `{level}` là dữ liệu.
 * `trial.date` là mẫu ngày số theo từng ngôn ngữ (không kéo thư viện ngày).
 */
export const orgLiteMessages = defineMessages(
  {
    cap: 'Học viên trung tâm',
    title: {
      withClass: 'Bạn thuộc lớp {className}',
      withOrg: 'Bạn là học viên của {orgName}',
      plain: 'Bạn là học viên trung tâm',
    },
    sub: 'Mục tiêu, giáo trình và mentor do trung tâm sắp xếp — bạn chỉ cần chọn nhịp học rồi vào bài đầu tiên.',
    trial: {
      proUntil: 'PRO miễn phí tới {date}.',
      date: '{day} tháng {month}, {year}',
    },
    level: {
      cap: 'Trình độ hiện tại',
      hint: 'Trung tâm chưa đặt trình độ — chọn mức gần đúng nhất, giáo viên chỉnh lại được sau.',
      preset: 'Trình độ hiện tại do trung tâm đặt: {level}.',
    },
    pace: {
      cap: 'Nhịp học · mỗi ngày bao nhiêu phút?',
      streakHint: 'Chuỗi ngày học (streak) tính theo mức này — chọn mức bạn giữ được lâu dài.',
    },
    start: 'Bắt đầu học',
  },
  {
    en: {
      cap: 'Centre learner',
      title: {
        withClass: 'You are in class {className}',
        withOrg: 'You are a learner at {orgName}',
        plain: 'You are a centre learner',
      },
      sub: 'Your goal, curriculum and mentor are set by your centre — just pick your pace and go to your first lesson.',
      trial: {
        proUntil: 'PRO free until {date}.',
        date: '{month}/{day}/{year}',
      },
      level: {
        cap: 'Current level',
        hint: 'Your centre has not set a level yet — pick the closest one; your teacher can adjust it later.',
        preset: 'Current level set by your centre: {level}.',
      },
      pace: {
        cap: 'Pace · how many minutes a day?',
        streakHint: 'Your daily streak is counted against this — pick a level you can keep up for the long run.',
      },
      start: 'Start learning',
    },
    de: {
      cap: 'Kursteilnehmer',
      title: {
        withClass: 'Du bist in der Klasse {className}',
        withOrg: 'Du lernst bei {orgName}',
        plain: 'Du bist Kursteilnehmer an einem Sprachzentrum',
      },
      sub: 'Ziel, Lehrplan und Mentor legt dein Sprachzentrum fest – du wählst nur dein Lerntempo und gehst zur ersten Lektion.',
      trial: {
        proUntil: 'PRO kostenlos bis {date}.',
        date: '{day}.{month}.{year}',
      },
      level: {
        cap: 'Aktuelles Niveau',
        hint: 'Dein Sprachzentrum hat noch kein Niveau festgelegt – wähle das passendste, deine Lehrkraft kann es später anpassen.',
        preset: 'Aktuelles Niveau, vom Sprachzentrum festgelegt: {level}.',
      },
      pace: {
        cap: 'Lerntempo · wie viele Minuten pro Tag?',
        streakHint: 'Deine Lernserie richtet sich nach diesem Wert – wähle ein Tempo, das du langfristig halten kannst.',
      },
      start: 'Lernen starten',
    },
  },
)
