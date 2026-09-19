import { defineMessages } from '@/lib/i18n'

/**
 * M8b — Kiểm tra đầu vào 10 câu (`app/(auth)/placement.tsx`). vi là nguồn; en/de phải khớp từng
 * khoá (tsc). Câu hỏi/đáp án là DỮ LIỆU từ API — không nằm ở đây. Tên kỹ năng (Nghe/Nói/Đọc/Viết)
 * và câu chữ màn kết quả vẫn ở `lib/placementTest.ts` (ngoài phạm vi PR này).
 */
export const placementMessages = defineMessages(
  {
    loading: {
      title: 'Đang chuẩn bị 10 câu…',
      sub: 'Bốn kỹ năng, khoảng 4 phút. Bỏ qua lúc nào cũng được.',
    },
    error: {
      cap: 'Kiểm tra đầu vào',
      title: 'Chưa tạo được bài kiểm tra',
      fallback: 'Vui lòng thử lại sau.',
      body: 'Lộ trình của bạn đã được tạo theo trình độ tự đánh giá — vào học ngay cũng được, làm bài kiểm tra sau trong danh sách tuần đầu.',
      cta: 'Vào lộ trình của tôi',
    },
    header: {
      cap: 'Kiểm tra đầu vào · {level}',
      skip: 'Bỏ qua',
      skipA11y: 'Bỏ qua bài kiểm tra, vào lộ trình',
      progressA11y: 'Câu {current} trên {total}',
    },
    audio: {
      listenA11y: 'Nghe đoạn tiếng Đức',
      listen: 'Nghe đoạn này',
    },
    answer: {
      label: 'Câu trả lời của bạn',
      placeholder: 'Viết bằng tiếng Đức…',
    },
    nav: {
      prev: 'Trước',
      next: 'Tiếp',
      submit: 'Nộp bài',
    },
    submitFailed: {
      title: 'Chưa nộp được',
    },
    confirm: {
      title: 'Còn {count} câu chưa trả lời',
      body: 'Câu bỏ trống tính là sai. Nộp luôn hay xem lại?',
      review: 'Xem lại',
      submit: 'Nộp bài',
    },
  },
  {
    en: {
      loading: {
        title: 'Preparing 10 questions…',
        sub: 'Four skills, about 4 minutes. You can skip at any time.',
      },
      error: {
        cap: 'Placement test',
        title: 'Could not create the test',
        fallback: 'Please try again later.',
        body: 'Your roadmap has already been built from your self-assessed level — you can start learning right away and take the test later from your first-week checklist.',
        cta: 'Go to my roadmap',
      },
      header: {
        cap: 'Placement test · {level}',
        skip: 'Skip',
        skipA11y: 'Skip the test and go to the roadmap',
        progressA11y: 'Question {current} of {total}',
      },
      audio: {
        listenA11y: 'Listen to the German audio',
        listen: 'Listen to this',
      },
      answer: {
        label: 'Your answer',
        placeholder: 'Write in German…',
      },
      nav: {
        prev: 'Back',
        next: 'Next',
        submit: 'Submit',
      },
      submitFailed: {
        title: 'Could not submit',
      },
      confirm: {
        title: '{count} questions still unanswered',
        body: 'Blank answers count as wrong. Submit now or review first?',
        review: 'Review',
        submit: 'Submit',
      },
    },
    de: {
      loading: {
        title: 'Bereite 10 Fragen vor…',
        sub: 'Vier Fertigkeiten, etwa 4 Minuten. Du kannst jederzeit überspringen.',
      },
      error: {
        cap: 'Einstufungstest',
        title: 'Der Test konnte nicht erstellt werden',
        fallback: 'Bitte versuche es später noch einmal.',
        body: 'Dein Lernweg wurde bereits nach deiner Selbsteinschätzung erstellt – du kannst sofort loslegen und den Test später über die Checkliste der ersten Woche nachholen.',
        cta: 'Zu meinem Lernweg',
      },
      header: {
        cap: 'Einstufungstest · {level}',
        skip: 'Überspringen',
        skipA11y: 'Test überspringen und zum Lernweg gehen',
        progressA11y: 'Frage {current} von {total}',
      },
      audio: {
        listenA11y: 'Deutschen Text anhören',
        listen: 'Anhören',
      },
      answer: {
        label: 'Deine Antwort',
        placeholder: 'Auf Deutsch schreiben…',
      },
      nav: {
        prev: 'Zurück',
        next: 'Weiter',
        submit: 'Abgeben',
      },
      submitFailed: {
        title: 'Abgabe fehlgeschlagen',
      },
      confirm: {
        title: 'Noch {count} Fragen unbeantwortet',
        body: 'Leere Antworten zählen als falsch. Jetzt abgeben oder noch einmal ansehen?',
        review: 'Ansehen',
        submit: 'Abgeben',
      },
    },
  },
)
