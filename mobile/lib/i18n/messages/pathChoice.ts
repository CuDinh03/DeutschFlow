import { defineMessages } from '@/lib/i18n'

/**
 * M5b — Chọn đường (`app/(auth)/path-choice.tsx` + `components/onboarding/PathChoiceCard.tsx`).
 * vi là nguồn; en/de phải khớp từng khoá (tsc). `{level}` = trình độ tự khai (CEFR, dữ liệu).
 */
export const pathChoiceMessages = defineMessages(
  {
    screen: {
      cap: 'Trước khi vào lộ trình',
    },
    card: {
      title: 'Vào đúng trình độ của bạn?',
      sub: 'Bạn tự đánh giá {level}. Kiểm tra nhanh để lộ trình khớp chính xác — hoặc bắt đầu học ngay rồi tinh chỉnh sau.',
      back: 'Quay lại',
      continue: 'Tiếp tục',
      footnote: 'Bỏ qua bây giờ vẫn làm bài kiểm tra được sau, trong danh sách tuần đầu.',
    },
    options: {
      placement: {
        label: 'Kiểm tra nhanh 10 câu',
        desc: 'Khoảng 4 phút · 4 kỹ năng · lộ trình khớp đúng chỗ bạn đang đứng',
      },
      skip: {
        label: 'Bỏ qua, vào lộ trình',
        desc: 'Bắt đầu học ngay theo trình độ tự đánh giá, tinh chỉnh sau',
      },
    },
  },
  {
    en: {
      screen: {
        cap: 'Before you start your roadmap',
      },
      card: {
        title: 'Start at the right level?',
        sub: 'You rated yourself {level}. Take a quick test so your roadmap fits exactly — or start learning now and fine-tune later.',
        back: 'Back',
        continue: 'Continue',
        footnote: 'If you skip now, you can still take the test later from your first-week checklist.',
      },
      options: {
        placement: {
          label: 'Quick 10-question test',
          desc: 'About 4 minutes · 4 skills · a roadmap that matches where you are',
        },
        skip: {
          label: 'Skip, go to roadmap',
          desc: 'Start learning now at your self-assessed level, fine-tune later',
        },
      },
    },
    de: {
      screen: {
        cap: 'Bevor du in den Lernweg startest',
      },
      card: {
        title: 'Auf dem richtigen Niveau starten?',
        sub: 'Du hast dich mit {level} eingeschätzt. Mach den Schnelltest, damit dein Lernweg genau passt – oder starte gleich und passe später an.',
        back: 'Zurück',
        continue: 'Weiter',
        footnote: 'Auch wenn du jetzt überspringst, kannst du den Test später über die Checkliste der ersten Woche nachholen.',
      },
      options: {
        placement: {
          label: 'Schnelltest mit 10 Fragen',
          desc: 'Etwa 4 Minuten · 4 Fertigkeiten · ein Lernweg, der genau zu dir passt',
        },
        skip: {
          label: 'Überspringen, zum Lernweg',
          desc: 'Sofort nach deiner Selbsteinschätzung starten, später anpassen',
        },
      },
    },
  },
)
