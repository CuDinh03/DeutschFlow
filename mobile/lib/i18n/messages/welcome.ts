import { defineMessages } from '@/lib/i18n'

/** M0 — màn Chào mừng (`app/(auth)/welcome.tsx`). vi là nguồn; en/de phải khớp từng khoá (tsc). */
export const welcomeMessages = defineMessages(
  {
    tagline: 'Tiếng Đức cho người Việt đi làm, học nghề, du học',
    headline: 'Học tiếng Đức theo đúng mục tiêu của bạn',
    points: {
      path: 'Lộ trình riêng theo mục tiêu và nhịp học của bạn',
      speaking: 'Luyện nói với mentor AI từ buổi đầu tiên',
      firstSentence: 'Câu tiếng Đức đầu tiên trong 2 phút — chưa cần tài khoản',
    },
    start: 'Bắt đầu — miễn phí',
    haveAccount: 'Tôi đã có tài khoản',
  },
  {
    en: {
      tagline: 'German for Vietnamese people who work, train or study abroad',
      headline: 'Learn German for your own goal',
      points: {
        path: 'A personal roadmap built on your goal and pace',
        speaking: 'Practise speaking with an AI mentor from day one',
        firstSentence: 'Your first German sentence in 2 minutes — no account needed',
      },
      start: 'Start — free',
      haveAccount: 'I already have an account',
    },
    de: {
      tagline: 'Deutsch für Vietnamesen, die arbeiten, eine Ausbildung machen oder studieren',
      headline: 'Deutsch lernen – genau für dein Ziel',
      points: {
        path: 'Ein eigener Lernweg nach deinem Ziel und Tempo',
        speaking: 'Sprechen üben mit einem KI-Mentor ab dem ersten Tag',
        firstSentence: 'Dein erster deutscher Satz in 2 Minuten – ohne Konto',
      },
      start: 'Loslegen – kostenlos',
      haveAccount: 'Ich habe schon ein Konto',
    },
  },
)
