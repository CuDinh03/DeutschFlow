import type { AusbildungLocale } from '@/lib/ausbildung'

/**
 * Chữ của trang học nghề `/hoc-nghe/` (vi) và `/en/vocational-training/` (en).
 *
 * Để riêng khỏi catalog ba thứ tiếng vì trang chưa có bản tiếng Đức (chờ Impressum), và để người duyệt
 * đọc một chỗ. Mỗi con số phải có nguồn trong `sources`; đổi số thì đổi cả `checkedAt`.
 *
 * Sổ lời hứa: không nói chắc đậu visa, không gọi đây là tư vấn pháp lý, không hứa tìm được chỗ học.
 */

export interface AusbildungStep {
  /** Khoá lưu tiến độ của người dùng: đổi id là mất dấu tick đã lưu. */
  id: string
  title: string
  body: string
  items?: string[]
}

export interface AusbildungCopy {
  meta: { title: string; description: string }
  draftBanner: string
  hero: { cap: string; title: string; sub: string; ctaSteps: string; ctaOccupations: string }
  what: { title: string; points: { title: string; body: string }[] }
  routes: { title: string; intro: string; items: { name: string; law: string; points: string[] }[] }
  steps: {
    title: string
    intro: string
    /** {done} và {total} được thay bằng số. */
    progress: string
    reset: string
    savedNote: string
    items: AusbildungStep[]
  }
  money: { title: string; body: string; points: string[] }
  find: {
    title: string
    intro: string
    portals: { name: string; body: string; url: string }[]
    warning: string
  }
  occupations: { title: string; intro: string; unavailable: string; yearsUnit: string; levelPrefix: string }
  practice: { title: string; body: string; cta: string }
  /** Khối trên trang nghề `/phong-van/[nghe]/`. */
  occupationBlock: {
    cap: string
    years: string
    level: string
    levelNote: string
    paid: string
    findBa: string
    findAusbildungDe: string
    guide: string
  }
  disclaimer: string
  checkedLabel: string
  sourcesTitle: string
}

export const AUSBILDUNG_CHECKED_AT = '31/10/2026'

export const AUSBILDUNG_SOURCES: readonly { label: string; url: string }[] = [
  { label: 'Deutsche Botschaft Hanoi: Visum zur Berufsausbildung', url: 'https://vietnam.diplo.de/vn-de/service/2306814-2306814' },
  { label: '§ 16a AufenthG', url: 'https://www.gesetze-im-internet.de/aufenthg_2004/__16a.html' },
  { label: '§ 17 AufenthG', url: 'https://www.gesetze-im-internet.de/aufenthg_2004/__17.html' },
  { label: 'ausbildung.de: Ausbildung für Nicht-EU-Bürger', url: 'https://www.ausbildung.de/ratgeber/ausbildung-fuer-nicht-eu-buerger/' },
]

export const AUSBILDUNG_COPY: Record<AusbildungLocale, AusbildungCopy> = {
  vi: {
    meta: {
      title: 'Học nghề ở Đức: chọn nghề, tìm chỗ học, thủ tục visa | myDeutschFlow',
      description:
        'Ausbildung là gì, cần B1 hay B2, chứng minh tài chính ra sao và cần giấy tờ gì. Hướng dẫn từng bước bằng tiếng Việt, có nguồn chính thức.',
    },
    draftBanner: 'Bản nháp để duyệt. Nội dung chưa được kiểm tra, chưa dùng cho người học.',
    hero: {
      cap: 'Học nghề ở Đức · Ausbildung',
      title: 'Từ chọn nghề tới nộp hồ sơ visa, từng bước một',
      sub: 'Xem nghề nào có thể học, cần tiếng Đức tới đâu, cần chứng minh bao nhiêu tiền và chuẩn bị giấy tờ gì. Tự đánh dấu việc đã xong.',
      ctaSteps: 'Xem các bước',
      ctaOccupations: 'Xem nghề có thể học',
    },
    what: {
      title: 'Ausbildung là gì',
      points: [
        { title: 'Vừa học vừa làm', body: 'Bạn ký hợp đồng với doanh nghiệp, làm ở doanh nghiệp và học lý thuyết ở trường nghề.' },
        { title: 'Có lương học nghề', body: 'Lương tối thiểu năm 2026 khi không có thoả ước là 724 € năm đầu, tăng dần tới 1.014 € năm thứ tư.' },
        { title: 'Thường kéo dài 2 đến 3,5 năm', body: 'Tuỳ nghề. Xem thời gian của từng nghề ở danh sách bên dưới.' },
      ],
    },
    routes: {
      title: 'Hai đường sang Đức',
      intro: 'Đường nào phù hợp tuỳ việc bạn đã có hợp đồng hay chưa. Đường tìm chỗ tại Đức có thêm điều kiện về tuổi và bằng cấp.',
      items: [
        {
          name: 'Đã có hợp đồng học nghề',
          law: '§ 16a AufenthG',
          points: [
            'Cần chỗ học đã được doanh nghiệp nhận và chứng chỉ tiếng Đức.',
            'Được làm thêm tối đa 20 giờ mỗi tuần, ngoài giờ học nghề.',
            'Điều luật này không đặt giới hạn tuổi 35. Người từ 45 tuổi có thể phải chứng minh an sinh tuổi già.',
          ],
        },
        {
          name: 'Sang Đức để tìm chỗ học',
          law: '§ 17 AufenthG',
          points: [
            'Phải dưới 35 tuổi.',
            'Cần bằng tốt nghiệp đủ điều kiện vào đại học, tiếng Đức tốt và tự lo được sinh hoạt phí.',
            'Tối đa 9 tháng. Được làm tối đa 20 giờ mỗi tuần và thử việc tổng cộng tối đa 2 tuần.',
          ],
        },
      ],
    },
    steps: {
      title: 'Các bước khi đi theo hợp đồng học nghề',
      intro: 'Danh sách theo hướng dẫn của Đại sứ quán Đức tại Việt Nam. Đánh dấu từng việc khi xong.',
      progress: 'Đã xong {done}/{total} bước',
      reset: 'Xoá dấu',
      savedNote: 'Dấu đánh chỉ lưu trên trình duyệt này.',
      items: [
        {
          id: 'chon-nghe',
          title: 'Chọn nghề',
          body: 'Xem thời gian học, mức tiếng thường cần, và thử trả lời câu phỏng vấn của nghề đó xem có hợp không.',
        },
        {
          id: 'tieng-duc',
          title: 'Có chứng chỉ tiếng Đức',
          body: 'Tối thiểu B1. Một số nghề, nhất là y tế, có thể cần B2.',
          items: [
            'Được chấp nhận: Goethe-Institut, telc, ÖSD, ECL; TestDaF từ mức B2.',
            'Chứng chỉ không quá 12 tháng tính tới ngày nộp đơn.',
            'Nếu học khoá tiếng ở Đức trước khi học nghề, mức thấp hơn có thể đủ, kèm giấy xác nhận khoá học.',
          ],
        },
        {
          id: 'hop-dong',
          title: 'Tìm chỗ học và ký hợp đồng',
          body: 'Hợp đồng học nghề phải có chữ ký của tất cả các bên, nộp bản gốc. Chữ ký số được chấp nhận.',
        },
        {
          id: 'xac-nhan',
          title: 'Lấy giấy xác nhận từ phía Đức',
          body: 'Nhờ doanh nghiệp chuẩn bị cùng hợp đồng.',
          items: [
            'Một trong các giấy: hợp đồng hoặc xác nhận của trường nghề, hoặc xác nhận đăng ký của IHK hoặc HWK.',
            'Erklärung zum Beschäftigungsverhältnis do doanh nghiệp điền đủ, có Betriebsnummer.',
            'Nếu có học phí, giấy tờ phải ghi rõ số tiền và cách trả.',
          ],
        },
        {
          id: 'tai-chinh',
          title: 'Chứng minh tài chính',
          body: 'Tối thiểu 1.048 € brutto mỗi tháng. Lương thấp hơn thì phải chứng minh đủ tiền bù phần chênh lệch.',
          items: [
            'Bù bằng Sperrkonto, hoặc trong trường hợp cá biệt bằng Verpflichtungserklärung.',
            'Nhà ở hoặc bữa ăn miễn phí được tính khi xét.',
          ],
        },
        {
          id: 'bao-hiem',
          title: 'Mua bảo hiểm y tế',
          body: 'Chọn một trong ba cách, có hiệu lực từ ngày đi.',
          items: [
            'Bảo hiểm tư nhân ở Đức đạt điều kiện.',
            'Bảo hiểm công ở Đức (có thư của quỹ) cộng bảo hiểm du lịch cho ba tuần đầu.',
            'Bảo hiểm tư nhân nước ngoài đạt điều kiện, gồm cả ở Việt Nam.',
            'Điều kiện gồm: không giới hạn mức chi trả, tự trả tối đa 300 € mỗi năm, chi trả cả bệnh có sẵn.',
          ],
        },
        {
          id: 'ho-so',
          title: 'Chuẩn bị hồ sơ cá nhân',
          body: 'Viết CV và thư động lực bằng chính câu chuyện của bạn.',
          items: [
            'Hộ chiếu còn ít nhất hai trang trống.',
            'CV dạng bảng bằng tiếng Đức, liền mạch, không có khoảng trống.',
            'Thư động lực: vì sao chọn nghề này, nó hợp với quá trình trước đây ra sao, kế hoạch sau khi học xong.',
            'Bằng tốt nghiệp trung học và giấy tờ đào tạo hoặc đại học nếu có.',
          ],
        },
        {
          id: 'nop-ho-so',
          title: 'Nộp hồ sơ',
          body: 'Nên dành khoảng 3 tháng cho việc xét, có thể lâu hơn.',
          items: [
            'Nộp trực tuyến qua Auslandsportal, rồi nộp bản gốc và lấy sinh trắc học tại VFS ở Hà Nội, TP.HCM hoặc Đà Nẵng.',
            'Phí visa 75 €, trả bằng VND, cộng phí dịch vụ của VFS.',
            'Giấy chấp thuận trước (Vorabzustimmung) của cơ quan Đức không bắt buộc nhưng giúp rút ngắn thời gian.',
          ],
        },
        {
          id: 'den-duc',
          title: 'Sau khi tới Đức',
          body: 'Làm các việc này sớm để không lỡ hạn.',
          items: [
            'Đăng ký cư trú tại Bürgeramt trong 14 ngày sau khi chuyển tới.',
            'Xin thẻ cư trú tại Ausländerbehörde trước khi visa hết hạn.',
            'Người học nghề có lương vào bảo hiểm y tế bắt buộc từ ngày bắt đầu học.',
          ],
        },
      ],
    },
    money: {
      title: 'Điều nhiều người tính thiếu',
      body: 'Mức cần chứng minh là 1.048 € brutto mỗi tháng, trong khi lương tối thiểu học nghề năm đầu năm 2026 chỉ là 724 €.',
      points: [
        'Hãy hỏi doanh nghiệp mức lương từng năm trước khi ký.',
        'Tiền làm thêm không dùng để chứng minh tài chính khi xin visa.',
        'Số tiền cụ thể do Đại sứ quán quyết định và có thể đổi theo năm.',
      ],
    },
    find: {
      title: 'Tìm chỗ học nghề ở đâu',
      intro: 'myDeutschFlow không đăng tin tuyển và không nối bạn với doanh nghiệp. Hai trang dưới đây có tin thật, bằng tiếng Đức. Mở một nghề trong danh sách để tới thẳng kết quả của nghề đó.',
      portals: [
        { name: 'Jobsuche của Bundesagentur für Arbeit', body: 'Cổng việc làm của cơ quan lao động liên bang Đức.', url: 'https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4' },
        { name: 'ausbildung.de', body: 'Cổng tư nhân về học nghề, có mô tả nghề và tin tuyển.', url: 'https://www.ausbildung.de/' },
      ],
      warning: 'Đọc kỹ hợp đồng trước khi ký hoặc trả bất kỳ khoản phí nào, kể cả khi làm qua đơn vị trung gian.',
    },
    occupations: {
      title: 'Nghề có thể học',
      intro: 'Các nghề có lương học nghề trong danh mục của myDeutschFlow. Bấm vào nghề để xem câu phỏng vấn và tìm chỗ học.',
      unavailable: 'Chưa tải được danh sách nghề. Vui lòng thử lại sau.',
      yearsUnit: 'năm',
      levelPrefix: 'Thường cần',
    },
    practice: {
      title: 'Doanh nghiệp thường phỏng vấn bạn bằng tiếng Đức',
      body: 'Luyện trả lời đúng nghề và ôn thi B1 ngay trong myDeutschFlow, rồi biết cần sửa gì sau mỗi câu.',
      cta: 'Học thử miễn phí',
    },
    occupationBlock: {
      cap: 'Học nghề này ở Đức',
      years: 'Thời gian thường gặp',
      level: 'Tiếng Đức thường cần',
      levelNote: 'Doanh nghiệp có thể yêu cầu cao hơn.',
      paid: 'Có hợp đồng và lương học nghề',
      findBa: 'Tìm chỗ học trên Jobsuche',
      findAusbildungDe: 'Tìm trên ausbildung.de',
      guide: 'Xem thủ tục và giấy tờ',
    },
    disclaimer:
      'Đây là thông tin chung, không phải tư vấn pháp lý và không bảo đảm được cấp visa. Yêu cầu có thể thay đổi; hãy đối chiếu với Đại sứ quán Đức trước khi nộp.',
    checkedLabel: 'Kiểm tra lần cuối',
    sourcesTitle: 'Nguồn',
  },
  en: {
    meta: {
      title: 'Vocational training in Germany: trades, finding a place, visa steps | myDeutschFlow',
      description:
        'What an Ausbildung is, whether you need B1 or B2, how to prove your finances and which documents to prepare. A step-by-step guide with official sources.',
    },
    draftBanner: 'Draft for review. This content has not been checked and is not for learners yet.',
    hero: {
      cap: 'Vocational training · Ausbildung',
      title: 'From choosing a trade to your visa application, step by step',
      sub: 'See which trades you can train in, how much German you need, what money to prove and which documents to prepare. Tick off each step yourself.',
      ctaSteps: 'See the steps',
      ctaOccupations: 'Browse trades',
    },
    what: {
      title: 'What is an Ausbildung?',
      points: [
        { title: 'Work and learn', body: 'You sign a contract with a company, work there, and study theory at a vocational school.' },
        { title: 'You are paid', body: 'The 2026 legal minimum without a collective agreement is €724 in year one, rising to €1,014 in year four.' },
        { title: 'Usually 2 to 3.5 years', body: 'It depends on the trade. See each trade in the list below.' },
      ],
    },
    routes: {
      title: 'Two routes to Germany',
      intro: 'The route depends on whether you already have a contract. Looking for a place from inside Germany adds conditions on age and school certificates.',
      items: [
        {
          name: 'You already have a training contract',
          law: '§ 16a AufenthG',
          points: [
            'You need a confirmed place with a company and a German certificate.',
            'You may work up to 20 hours a week on top of your training.',
            'This section sets no age limit of 35. Applicants aged 45 or over may need to show pension provision.',
          ],
        },
        {
          name: 'You go to Germany to look for a place',
          law: '§ 17 AufenthG',
          points: [
            'You must be under 35.',
            'You need a school certificate that qualifies for university, good German and funds for your living costs.',
            'Up to 9 months. You may work up to 20 hours a week and do trial work for up to 2 weeks in total.',
          ],
        },
      ],
    },
    steps: {
      title: 'Steps when you have a training contract',
      intro: 'Based on the guidance of the German Embassy in Vietnam. Other countries differ, so check your local German mission.',
      progress: '{done} of {total} steps done',
      reset: 'Clear ticks',
      savedNote: 'Ticks are saved in this browser only.',
      items: [
        {
          id: 'chon-nghe',
          title: 'Choose a trade',
          body: 'Check the length, the usual German level, and try the interview questions for that trade.',
        },
        {
          id: 'tieng-duc',
          title: 'Get a German certificate',
          body: 'B1 at least. Some trades, especially in healthcare, may need B2.',
          items: [
            'Accepted: Goethe-Institut, telc, ÖSD, ECL; TestDaF from B2.',
            'The certificate must be no older than 12 months on the day you apply.',
            'With a German course in Germany before training, a lower level may be enough, with proof of the course.',
          ],
        },
        {
          id: 'hop-dong',
          title: 'Find a place and sign the contract',
          body: 'The training contract needs all signatures and must be the original. Digital signatures are accepted.',
        },
        {
          id: 'xac-nhan',
          title: 'Get confirmation from Germany',
          body: 'Ask the company to prepare these with the contract.',
          items: [
            'One of: a contract or confirmation from the vocational school, or registration confirmed by the IHK or HWK.',
            'Erklärung zum Beschäftigungsverhältnis, completed by the company, with its Betriebsnummer.',
            'If there are school fees, the amount and payment terms must be stated.',
          ],
        },
        {
          id: 'tai-chinh',
          title: 'Prove your finances',
          body: 'At least €1,048 gross a month. If your pay is lower, you must show you can cover the difference.',
          items: [
            'Cover it with a blocked account (Sperrkonto), or in individual cases a Verpflichtungserklärung.',
            'Free housing or meals are taken into account.',
          ],
        },
        {
          id: 'bao-hiem',
          title: 'Get health insurance',
          body: 'Choose one of three options, valid from your travel date.',
          items: [
            'Qualifying private insurance in Germany.',
            'Public insurance in Germany (with a letter from the fund) plus travel insurance for the first three weeks.',
            'Qualifying private insurance from abroad, including Vietnam.',
            'Conditions include: no cover limit, at most €300 excess a year, and pre-existing conditions covered.',
          ],
        },
        {
          id: 'ho-so',
          title: 'Prepare your personal documents',
          body: 'Write your CV and motivation letter from your own story.',
          items: [
            'A passport with at least two blank pages.',
            'A tabular CV in German with no gaps.',
            'A motivation letter: why this trade, how it fits your past, and your plans afterwards.',
            'Your school certificate, plus any training or university documents.',
          ],
        },
        {
          id: 'nop-ho-so',
          title: 'Apply',
          body: 'Allow about 3 months for processing, possibly longer.',
          items: [
            'In Vietnam: apply online via the Auslandsportal, then hand in originals and biometrics at VFS in Hanoi, Ho Chi Minh City or Da Nang.',
            'The visa fee is €75, plus the VFS service fee.',
            'Prior approval (Vorabzustimmung) from the German authorities is optional but speeds things up.',
          ],
        },
        {
          id: 'den-duc',
          title: 'After you arrive',
          body: 'Do these early so you do not miss a deadline.',
          items: [
            'Register your address at the Bürgeramt within 14 days of moving in.',
            'Apply for your residence permit at the Ausländerbehörde before your visa ends.',
            'Paid trainees join statutory health insurance from their first day of training.',
          ],
        },
      ],
    },
    money: {
      title: 'What people often underestimate',
      body: 'You need to show €1,048 gross a month, while the 2026 minimum trainee pay in year one is only €724.',
      points: [
        'Ask the company for the pay in each year before you sign.',
        'Part-time earnings do not count as proof of funds for the visa.',
        'The embassy decides the exact amount, and it can change each year.',
      ],
    },
    find: {
      title: 'Where to find a training place',
      intro: 'myDeutschFlow does not post vacancies or connect you with companies. These two sites have real listings, in German. Open a trade below to go straight to its results.',
      portals: [
        { name: 'Jobsuche by the Bundesagentur für Arbeit', body: 'The job portal of the German Federal Employment Agency.', url: 'https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4' },
        { name: 'ausbildung.de', body: 'A private portal for vocational training, with trade profiles and listings.', url: 'https://www.ausbildung.de/' },
      ],
      warning: 'Read the contract carefully before you sign or pay any fee, including through an agency.',
    },
    occupations: {
      title: 'Trades you can train in',
      intro: 'Paid training trades in the myDeutschFlow catalogue. Open a trade to see its interview questions and find a place.',
      unavailable: 'We could not load the list of trades. Please try again later.',
      yearsUnit: 'years',
      levelPrefix: 'Usually',
    },
    practice: {
      title: 'Companies usually interview you in German',
      body: 'Practise answers for your trade and prepare for B1 in myDeutschFlow, and see what to fix after each answer.',
      cta: 'Try it free',
    },
    occupationBlock: {
      cap: 'Train in this trade in Germany',
      years: 'Usual length',
      level: 'Usual German level',
      levelNote: 'Companies may ask for more.',
      paid: 'Training contract with pay',
      findBa: 'Find a place on Jobsuche',
      findAusbildungDe: 'Search ausbildung.de',
      guide: 'See steps and documents',
    },
    disclaimer:
      'This is general information, not legal advice, and it does not guarantee a visa. Requirements can change, so check with the German mission before you apply.',
    checkedLabel: 'Last checked',
    sourcesTitle: 'Sources',
  },
}
