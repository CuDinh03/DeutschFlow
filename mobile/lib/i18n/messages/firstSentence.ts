import { defineMessages } from '@/lib/i18n'

/**
 * Màn "Câu tiếng Đức đầu tiên" (`app/(auth)/first-sentence.tsx`) + `MentorMonogram`. vi là nguồn;
 * en/de phải khớp từng khoá (tsc).
 *
 * `german.*` và `celebrate.headline` là câu tiếng Đức CÓ CHỦ Ý (mentor chào / học viên phải nói /
 * lời khen) — giữ nguyên ở cả ba bản, KHÔNG dịch. `{name}` = tên mentor hoặc tên học viên.
 */
export const firstSentenceMessages = defineMessages(
  {
    german: {
      greeting: 'Hallo! Ich bin {name}. Und wie heißt du?',
      sentence: 'Hallo, ich bin {name}!',
    },
    intro: {
      caption: 'Khoảnh khắc đầu tiên',
      later: 'Để sau',
      mentorFallback: 'Mentor của bạn',
      replayGreeting: 'Nghe lại lời chào',
      repeatPrompt: 'Nói lại câu này nhé:',
      hint: 'ha-LÔ, ích bin…',
      retry: 'Gần lắm rồi! Nghe lại rồi thử thêm lần nữa nhé.',
    },
    mic: {
      listening: '{name} đang lắng nghe…',
      stop: 'Dừng ghi âm',
      tapToSpeak: 'Bấm để nói',
      recordingLabel: 'Đang nghe… bấm để dừng',
      idleLabel: 'Chạm & nói câu trên',
      reassurance: 'Sai cũng không sao — cứ thử thoải mái.',
      echoA11y: 'Chỉ nghe rồi lặp lại, không dùng micro',
      echo: 'Chỉ nghe — lặp lại (không dùng micro)',
    },
    sentence: {
      play: 'Nghe câu mẫu',
      pronounce: 'Đọc là: {hint}',
    },
    celebrate: {
      headline: 'Du hast es geschafft!',
      echoBody: 'Nghe {name} nói rồi lặp lại thành tiếng — thế là bạn đã có câu tiếng Đức đầu tiên.',
      body: 'Bạn vừa nói câu tiếng Đức đầu tiên của mình.',
      streak: 'Chuỗi ngày 1 bắt đầu',
      firstWord: 'Câu đầu: Hallo',
      weekTitle: 'Tuần đầu của bạn',
      steps: {
        tour: { title: 'Tour trang chủ — 1 phút', sub: 'Biết chỗ học, chỗ luyện nói, chỗ xem chuỗi ngày' },
        speaking: { title: 'Buổi luyện nói đầu với {name}', sub: 'Tình huống chào hỏi ngắn' },
        stage: { title: 'Chặng 1 trên lộ trình của bạn', sub: 'Bắt đầu từ Trang chủ' },
      },
      cta: 'Vào hành trình của tôi',
    },
    mentor: {
      a11yLabel: 'Mentor {name}',
    },
  },
  {
    en: {
      german: {
        greeting: 'Hallo! Ich bin {name}. Und wie heißt du?',
        sentence: 'Hallo, ich bin {name}!',
      },
      intro: {
        caption: 'Your first moment',
        later: 'Later',
        mentorFallback: 'Your mentor',
        replayGreeting: 'Replay the greeting',
        repeatPrompt: 'Now say this sentence:',
        hint: 'HAH-loh, ikh bin…',
        retry: 'So close! Listen once more and give it another try.',
      },
      mic: {
        listening: '{name} is listening…',
        stop: 'Stop recording',
        tapToSpeak: 'Tap to speak',
        recordingLabel: 'Listening… tap to stop',
        idleLabel: 'Tap and say the sentence above',
        reassurance: 'Mistakes are fine — just give it a go.',
        echoA11y: 'Just listen and repeat, without the microphone',
        echo: 'Just listen and repeat (no microphone)',
      },
      sentence: {
        play: 'Play the sample sentence',
        pronounce: 'Sounds like: {hint}',
      },
      celebrate: {
        headline: 'Du hast es geschafft!',
        echoBody: 'You listened to {name} and repeated it out loud — that is your first German sentence.',
        body: 'You just said your first German sentence.',
        streak: 'Day 1 streak started',
        firstWord: 'First sentence: Hallo',
        weekTitle: 'Your first week',
        steps: {
          tour: { title: 'Home tour — 1 minute', sub: 'Find where to learn, practise speaking and check your streak' },
          speaking: { title: 'First speaking session with {name}', sub: 'A short greeting scenario' },
          stage: { title: 'Stage 1 on your roadmap', sub: 'Start from Home' },
        },
        cta: 'Start my journey',
      },
      mentor: {
        a11yLabel: 'Mentor {name}',
      },
    },
    de: {
      german: {
        greeting: 'Hallo! Ich bin {name}. Und wie heißt du?',
        sentence: 'Hallo, ich bin {name}!',
      },
      intro: {
        caption: 'Dein erster Moment',
        later: 'Später',
        mentorFallback: 'Dein Mentor',
        replayGreeting: 'Begrüßung noch einmal anhören',
        repeatPrompt: 'Sprich diesen Satz nach:',
        hint: 'HA-lo, ich bin…',
        retry: 'Fast geschafft! Hör noch einmal zu und versuch es noch mal.',
      },
      mic: {
        listening: '{name} hört zu…',
        stop: 'Aufnahme beenden',
        tapToSpeak: 'Zum Sprechen tippen',
        recordingLabel: 'Ich höre zu… zum Beenden tippen',
        idleLabel: 'Tippen und den Satz oben sprechen',
        reassurance: 'Fehler sind okay – einfach ausprobieren.',
        echoA11y: 'Nur zuhören und nachsprechen, ohne Mikrofon',
        echo: 'Nur zuhören – nachsprechen (ohne Mikrofon)',
      },
      sentence: {
        play: 'Beispielsatz anhören',
        pronounce: 'Aussprache: {hint}',
      },
      celebrate: {
        headline: 'Du hast es geschafft!',
        echoBody: 'Du hast {name} zugehört und laut nachgesprochen – das ist dein erster deutscher Satz.',
        body: 'Du hast gerade deinen ersten deutschen Satz gesagt.',
        streak: 'Tag-1-Serie gestartet',
        firstWord: 'Erster Satz: Hallo',
        weekTitle: 'Deine erste Woche',
        steps: {
          tour: { title: 'Startseiten-Tour – 1 Minute', sub: 'Finde heraus, wo du lernst, sprichst und deine Serie siehst' },
          speaking: { title: 'Erste Sprechübung mit {name}', sub: 'Eine kurze Begrüßungssituation' },
          stage: { title: 'Etappe 1 auf deinem Lernweg', sub: 'Los geht es auf der Startseite' },
        },
        cta: 'Meine Reise starten',
      },
      mentor: {
        a11yLabel: 'Mentor {name}',
      },
    },
  },
)
