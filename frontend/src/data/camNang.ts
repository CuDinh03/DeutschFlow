/**
 * Cẩm nang — trang nội dung theo từ khoá (đợt D, kế hoạch cải thiện trang chủ 08/11/2026). Chỉ tiếng
 * Việt. Thứ tự dự kiến: bếp → điều dưỡng (chờ bộ Pflege được duyệt) → Goethe B1 → telc B1 → Ausbildung,
 * mỗi tháng 2 bài.
 *
 * Luật nội dung (sổ lời hứa): câu hỏi phỏng vấn chỉ lấy từ bộ câu hỏi ĐÃ DUYỆT của sản phẩm (chép
 * nguyên văn), câu trả lời mẫu ghi rõ là minh hoạ; không đưa con số, mức lương hay quy định visa chưa
 * kiểm chứng.
 */

import { COMMON_QUESTIONS, COMMON_FOUND_ROLE_QUESTION, COMMON_INTRO_QUESTION, COMMON_MOTIVATION_QUESTION, fillPosition } from '@/data/interviewSamples'

export interface GuideQuestion {
  de: string
  vi: string
  tip: string
  /** Câu trả lời mẫu — minh hoạ, không phải đáp án duy nhất. */
  sample: string
}

/** Một mẫu nói trọn (vd mẫu giới thiệu bản thân trình độ A2) — câu tiếng Đức kèm bản dịch. */
export interface GuideTemplate {
  label: string
  de: string
  vi: string
  /** Trang nghề liên quan, nếu mẫu gắn với một nghề. */
  href?: string
}

export interface GuideArticle {
  slug: string
  title: string
  description: string
  h1: string
  lead: string
  /** YYYY-MM-DD */
  published: string
  /** Nhãn ngắn ở đường dẫn và thẻ mục lục (vd "Nghề bếp"). */
  topic: string
  /**
   * Bản nháp: câu tiếng Đức chưa được giáo viên duyệt. Trang vẫn dựng (để owner xem) nhưng `noindex`,
   * không vào sitemap/mục lục, và gắn nhãn "Cần duyệt" cạnh mọi câu tiếng Đức mẫu.
   */
  draft?: boolean
  /** Mã nghề để dẫn sang trang nghề và mở buổi luyện đúng nghề. Bài không gắn nghề thì bỏ trống. */
  occupationCode?: string
  occupationNameDe?: string
  interviewer?: string
  intro: string
  /** Khung trả lời theo bước, có cụm từ tiếng Đức dùng được ngay. */
  steps?: { title: string; body: string; phrases: string[] }[]
  /** Nhóm mẫu nói trọn (theo trình độ, theo nghề…). */
  templateGroups?: { heading: string; intro: string; items: GuideTemplate[] }[]
  questionsHeading?: string
  questions: GuideQuestion[]
  vocabHeading?: string
  vocab: { de: string; vi: string }[]
  mistakes: { wrong: string; right: string; why: string }[]
  practiceHeading?: string
  practice: string
  /** Liên kết nội bộ "Đọc tiếp" — trang nghề, luyện thi, bài cẩm nang khác. */
  related?: { href: string; label: string }[]
  faqs: { q: string; a: string }[]
}

/** Mọi bài, kể cả bản nháp — chỉ dùng để dựng trang. Sitemap và mục lục dùng `GUIDE_ARTICLES`. */
export const ALL_GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: 'phong-van-tieng-duc-nghe-bep',
    title: 'Phỏng vấn tiếng Đức nghề bếp (Koch/Köchin): câu hỏi, từ vựng, cách trả lời',
    description:
      'Cẩm nang phỏng vấn xin việc nghề bếp bằng tiếng Đức: ba câu hỏi tiêu biểu, gợi ý cách trả lời, từ vựng trong bếp và lỗi ngữ pháp người Việt hay gặp. Luyện thử miễn phí với AI.',
    h1: 'Phỏng vấn tiếng Đức nghề bếp: câu hỏi, từ vựng và cách trả lời',
    lead:
      'Dành cho người chuẩn bị phỏng vấn vị trí Koch/Köchin (đầu bếp) ở Đức, dù đi theo diện học nghề (Ausbildung) hay đã có kinh nghiệm. Bài này lấy ba câu hỏi tiêu biểu, chép nguyên văn từ bộ câu hỏi nghề bếp đã duyệt của myDeutschFlow.',
    published: '2026-11-08',
    topic: 'Nghề bếp',
    occupationCode: 'koch',
    occupationNameDe: 'Koch/Köchin',
    interviewer: 'Klaus',
    intro:
      'Trong buổi luyện nghề bếp, câu hỏi thường xoay quanh ba chủ đề: bạn là ai và đã làm gì trong bếp, bạn xử lý vệ sinh an toàn thực phẩm thế nào, và bạn giữ nhịp ra sao lúc đông khách. Người phỏng vấn muốn nghe ví dụ cụ thể, không chỉ một danh sách kỹ năng.',
    questions: [
      {
        de: 'Bitte stellen Sie sich kurz vor: Werdegang, relevante Erfahrung für Koch/Köchin, und Ihr nächster Schritt.',
        vi: 'Mời bạn giới thiệu ngắn về bản thân: quá trình học tập và làm việc, kinh nghiệm liên quan đến vị trí Koch/Köchin, và bước tiếp theo bạn hướng tới.',
        tip: 'Trả lời trong khoảng một phút, theo thứ tự: bạn là ai, đã học hoặc làm gì trong bếp (vị trí, loại nhà hàng, bao lâu), rồi bước tiếp theo — ví dụ bắt đầu Ausbildung hoặc làm ở bếp một nhà hàng ở Đức.',
        sample:
          'Ich heiße Minh und komme aus Hanoi. Ich habe drei Jahre in einem Restaurant gearbeitet, zuletzt an der warmen Küche. Jetzt möchte ich in Deutschland als Koch arbeiten und mich weiterentwickeln.',
      },
      {
        de: 'Nennen Sie einen HACCP-/Hygiene-Vorfall in der Küche und Ihre sofortigen Maßnahmen.',
        vi: 'Hãy kể một sự cố HACCP/vệ sinh trong bếp và những việc bạn làm ngay lập tức.',
        tip: 'Kể theo trình tự tình huống → việc bạn làm → kết quả. Chọn một sự cố có thật và nhỏ (phòng lạnh quá nhiệt độ, nguyên liệu hết hạn), nói rõ bạn tách hàng, báo bếp trưởng và ghi vào sổ kiểm tra.',
        sample:
          'Einmal war die Temperatur im Kühlraum zu hoch. Ich habe die Ware sofort aussortiert, den Küchenchef informiert und alles im HACCP-Protokoll dokumentiert.',
      },
      {
        de: 'Wie organisieren Sie die Station in der Rush Hour für Koch/Köchin? Konkretes Beispiel.',
        vi: 'Bạn tổ chức khu vực làm việc vào giờ cao điểm ở vị trí Koch/Köchin như thế nào? Ví dụ cụ thể.',
        tip: 'Nói về khâu chuẩn bị trước giờ phục vụ (Mise en place), thứ tự làm món theo phiếu, và cách phối hợp với các vị trí khác. Một ví dụ có con số của chính bạn (số suất, số món) làm câu trả lời đáng tin hơn.',
        sample:
          'Vor dem Service bereite ich meine Mise en place vollständig vor. In der Rush Hour arbeite ich die Bons der Reihe nach ab und spreche mich mit dem Pass ab.',
      },
    ],
    vocab: [
      { de: 'der Koch / die Köchin', vi: 'đầu bếp' },
      { de: 'der Küchenchef / die Küchenchefin', vi: 'bếp trưởng' },
      { de: 'der Posten, die Station', vi: 'vị trí, khu vực làm việc trong bếp' },
      { de: 'die Mise en place', vi: 'khâu chuẩn bị nguyên liệu, dụng cụ trước giờ phục vụ' },
      { de: 'der Service', vi: 'giờ phục vụ khách' },
      { de: 'der Bon', vi: 'phiếu gọi món' },
      { de: 'der Pass', vi: 'quầy ra món' },
      { de: 'die Hygiene', vi: 'vệ sinh' },
      { de: 'das HACCP-Protokoll', vi: 'sổ ghi kiểm soát an toàn thực phẩm' },
      { de: 'der Kühlraum', vi: 'phòng lạnh' },
      { de: 'die Schicht', vi: 'ca làm' },
      { de: 'der Dienstplan', vi: 'lịch làm việc' },
      { de: 'die Allergene', vi: 'chất gây dị ứng' },
    ],
    mistakes: [
      {
        wrong: 'Letztes Jahr ich habe in einem Restaurant gearbeitet.',
        right: 'Letztes Jahr habe ich in einem Restaurant gearbeitet.',
        why: 'Câu mở đầu bằng trạng từ thời gian thì động từ chia đứng ở vị trí thứ hai, chủ ngữ lùi ra sau.',
      },
      {
        wrong: 'Ich habe nach Deutschland gekommen.',
        right: 'Ich bin nach Deutschland gekommen.',
        why: 'Động từ chỉ sự di chuyển như kommen, fahren, fliegen dùng sein ở thì hoàn thành.',
      },
      {
        wrong: 'Ich möchte als Koch arbeiten, weil ich habe Erfahrung.',
        right: 'Ich möchte als Koch arbeiten, weil ich Erfahrung habe.',
        why: 'Trong câu phụ bắt đầu bằng weil, dass, wenn, động từ chia đứng cuối câu.',
      },
      {
        wrong: 'Ich bin ein Koch.',
        right: 'Ich bin Koch.',
        why: 'Khi nói nghề của mình, tiếng Đức thường không dùng mạo từ.',
      },
    ],
    vocabHeading: 'Từ vựng trong bếp nên thuộc',
    related: [
      { href: '/cam-nang/gioi-thieu-ban-than-bang-tieng-duc/', label: 'Giới thiệu bản thân bằng tiếng Đức khi phỏng vấn: khung 5 bước và mẫu A1–B1' },
      { href: '/phong-van/kuechenchef/', label: 'Phỏng vấn tiếng Đức vị trí bếp trưởng (Küchenchef)' },
      { href: '/phong-van/kellner/', label: 'Phỏng vấn tiếng Đức nghề phục vụ nhà hàng (Kellner)' },
    ],
    practice:
      'Trên myDeutschFlow, Klaus — người phỏng vấn nghề bếp — hỏi bạn bằng giọng nói những câu cùng chủ đề như trên; Klaus có thể hỏi thêm câu khác hoặc hỏi theo cách khác. Bạn trả lời bằng tiếng Đức, rồi nhận báo cáo chấm từng phần của buổi: câu bạn đã nói, câu nên nói và bài luyện tiếp.',
    faqs: [
      {
        q: 'Phỏng vấn nghề bếp ở Đức cần trình độ tiếng Đức nào?',
        a: 'Tuỳ chương trình và nhà tuyển dụng. Nhiều chương trình học nghề yêu cầu từ B1, có nơi yêu cầu B2. Hãy kiểm tra yêu cầu của nơi bạn ứng tuyển.',
      },
      {
        q: 'Luyện phỏng vấn nghề bếp trên myDeutschFlow có mất phí không?',
        a: 'Bạn luyện thử miễn phí, không cần thanh toán trước.',
      },
      {
        q: 'Sau buổi luyện tôi nhận được gì?',
        a: 'Một báo cáo chấm từng phần của buổi, trích lại câu bạn đã nói, đưa câu nên nói và gợi ý bài luyện tiếp theo.',
      },
    ],
  },
  {
    slug: 'gioi-thieu-ban-than-bang-tieng-duc',
    title: 'Giới thiệu bản thân bằng tiếng Đức khi phỏng vấn: mẫu A1–B1',
    description:
      'Cách giới thiệu bản thân bằng tiếng Đức khi phỏng vấn xin việc, du học nghề: khung 5 bước, mẫu A1, A2, B1, mẫu theo nghề và lỗi hay gặp. Luyện thử với AI.',
    h1: 'Giới thiệu bản thân bằng tiếng Đức khi phỏng vấn: khung 5 bước và mẫu theo trình độ',
    lead:
      'Dành cho người Việt chuẩn bị phỏng vấn xin việc hoặc du học nghề (Ausbildung) ở Đức. Trong buổi luyện trên myDeutschFlow, câu đầu tiên luôn là lời mời giới thiệu bản thân. Bài này đưa khung trả lời 5 bước, mẫu theo trình độ A1, A2, B1 và mẫu cho ba nghề.',
    published: '2026-11-13',
    topic: 'Giới thiệu bản thân',
    draft: true,
    intro:
      'Phần giới thiệu bản thân thường chỉ dài một đến hai phút, nhưng đó là lần đầu người phỏng vấn nghe bạn nói tiếng Đức. Họ không cần nghe lại cả hồ sơ. Họ muốn biết bạn là ai, bạn đã học và làm gì liên quan đến vị trí, và bạn muốn đi tiếp đến đâu. Chuẩn bị kỹ phần này cũng giúp bạn bình tĩnh hơn ở các câu sau.',
    steps: [
      {
        title: 'Chào, nói tên và quê',
        body: 'Một đến hai câu. Nói tên gọi trước rồi đến họ, để người nghe gọi bạn cho đúng.',
        phrases: ['Guten Tag, mein Name ist …', 'Ich bin … Jahre alt und komme aus …'],
      },
      {
        title: 'Học vấn, bằng cấp',
        body: 'Chỉ nêu bằng cấp gần nhất và liên quan nhất đến vị trí. Không cần kể từ thời phổ thông nếu bạn đã học nghề hoặc đại học.',
        phrases: ['Ich habe … abgeschlossen.', 'Ich habe eine Ausbildung zur/zum … gemacht.', 'Ich habe … studiert.'],
      },
      {
        title: 'Kinh nghiệm liên quan',
        body: 'Phần quan trọng nhất: vị trí, nơi làm, bao lâu, và một hai việc cụ thể bạn đã làm. Người phỏng vấn sẽ hỏi tiếp từ đây, nên chọn việc bạn kể được chi tiết.',
        phrases: ['Ich habe … Jahre als … gearbeitet.', 'Zu meinen Aufgaben gehörten …', 'Ich war für … zuständig.'],
      },
      {
        title: 'Trình độ tiếng Đức',
        body: 'Nói trình độ bạn đang có và việc bạn đang học tiếp. Nói đúng sự thật: người phỏng vấn nghe được trình độ của bạn ngay trong buổi.',
        phrases: ['Ich lerne seit … Deutsch.', 'Ich habe das Zertifikat B1.', 'Zurzeit bereite ich mich auf B2 vor.'],
      },
      {
        title: 'Mục tiêu và lý do',
        body: 'Kết bằng bước tiếp theo của bạn và nối nó với vị trí đang phỏng vấn. Một lý do cụ thể có sức nặng hơn ba lý do chung chung.',
        phrases: ['Ich möchte …, weil …', 'Mein nächster Schritt ist …'],
      },
    ],
    templateGroups: [
      {
        heading: 'Mẫu giới thiệu bản thân theo trình độ',
        intro: 'Ba mẫu dưới đây dùng cùng khung 5 bước. Câu ở mẫu A1 ngắn và đơn giản; lên B1 thì câu dài hơn, có câu phụ với weil và nói rõ nhiệm vụ đã làm. Hãy thay bằng thông tin thật của bạn.',
        items: [
          {
            label: 'Mẫu A1',
            de: 'Guten Tag! Mein Name ist Lan. Ich bin 20 Jahre alt und komme aus Vietnam. Ich wohne in Thanh Hoa. Ich habe die Schule abgeschlossen. Ich lerne seit sechs Monaten Deutsch. Ich möchte in Deutschland eine Ausbildung zur Pflegefachfrau machen.',
            vi: 'Xin chào! Tôi tên là Lan. Tôi 20 tuổi và đến từ Việt Nam. Tôi sống ở Thanh Hoá. Tôi đã học xong phổ thông. Tôi học tiếng Đức được sáu tháng. Tôi muốn học nghề điều dưỡng ở Đức.',
          },
          {
            label: 'Mẫu A2',
            de: 'Guten Tag, mein Name ist Nam. Ich bin 24 Jahre alt und komme aus Nghe An. Nach der Schule habe ich zwei Jahre in einem Hotel gearbeitet. Ich war an der Rezeption und habe Gäste begrüßt und Zimmer vergeben. Seit einem Jahr lerne ich Deutsch und habe das Zertifikat A2. Ich möchte eine Ausbildung zum Hotelfachmann machen, weil ich gern mit Menschen arbeite.',
            vi: 'Xin chào, tôi tên là Nam. Tôi 24 tuổi, quê ở Nghệ An. Sau khi học xong phổ thông, tôi làm ở một khách sạn hai năm. Tôi làm ở quầy lễ tân, đón khách và xếp phòng. Tôi học tiếng Đức được một năm và có chứng chỉ A2. Tôi muốn học nghề nhân viên khách sạn vì tôi thích làm việc với mọi người.',
          },
          {
            label: 'Mẫu B1',
            de: 'Guten Tag, mein Name ist Hoa. Ich bin 26 Jahre alt und komme aus Da Nang. In Vietnam habe ich eine Ausbildung zur Krankenpflegerin abgeschlossen. Danach habe ich drei Jahre in einem Krankenhaus auf einer internistischen Station gearbeitet. Zu meinen Aufgaben gehörten die Grundpflege, das Messen der Vitalwerte und die Dokumentation. Das Zertifikat B1 habe ich schon, jetzt bereite ich mich auf B2 vor. Ich möchte in Deutschland als Pflegefachkraft arbeiten, weil ich mich fachlich weiterentwickeln möchte. Mein nächster Schritt ist die Anerkennung meines Abschlusses.',
            vi: 'Xin chào, tôi tên là Hoa. Tôi 26 tuổi, đến từ Đà Nẵng. Ở Việt Nam tôi đã học xong nghề điều dưỡng. Sau đó tôi làm ba năm ở khoa nội của một bệnh viện. Công việc của tôi gồm chăm sóc cơ bản, đo các chỉ số sinh tồn và ghi chép hồ sơ. Tôi đã có chứng chỉ B1 và đang ôn thi B2. Tôi muốn làm điều dưỡng ở Đức vì muốn phát triển chuyên môn. Bước tiếp theo của tôi là xin công nhận bằng.',
          },
        ],
      },
      {
        heading: 'Mẫu giới thiệu bản thân theo nghề',
        intro: 'Cùng một khung, nhưng phần kinh nghiệm phải dùng từ của nghề. Đây là chỗ người phỏng vấn nghe ra bạn có thật sự làm nghề hay không.',
        items: [
          {
            label: 'Nghề bếp (Koch/Köchin)',
            href: '/phong-van/koch/',
            de: 'Mein Name ist Tuan, ich komme aus Hai Phong. Ich habe zwei Jahre in der Küche eines Hotels gearbeitet, zuerst als Küchenhilfe, später als Beikoch. Ich kenne die Mise en place und die HACCP-Regeln. Ich möchte eine Ausbildung zum Koch machen, weil ich die europäische Küche von Grund auf lernen möchte.',
            vi: 'Tôi tên là Tuấn, đến từ Hải Phòng. Tôi làm hai năm trong bếp của một khách sạn, đầu tiên là phụ bếp, sau đó là bếp phó. Tôi quen khâu chuẩn bị trước giờ phục vụ và các quy định an toàn thực phẩm HACCP. Tôi muốn học nghề đầu bếp vì muốn học bài bản về ẩm thực châu Âu.',
          },
          {
            label: 'Nghề điều dưỡng (Pflegefachkraft)',
            href: '/phong-van/pflegefachkraft/',
            de: 'Mein Name ist Linh. Ich habe in Vietnam Krankenpflege studiert und zwei Jahre in einem Krankenhaus gearbeitet. Ich habe Patienten bei der Körperpflege unterstützt, Vitalwerte gemessen und alles dokumentiert. Zurzeit lerne ich Deutsch auf B2-Niveau. Mein Ziel ist die Anerkennung meines Abschlusses, damit ich in Deutschland als Pflegefachkraft arbeiten kann.',
            vi: 'Tôi tên là Linh. Tôi học điều dưỡng ở Việt Nam và làm hai năm trong bệnh viện. Tôi hỗ trợ người bệnh vệ sinh cá nhân, đo chỉ số sinh tồn và ghi chép đầy đủ. Hiện tôi đang học tiếng Đức trình độ B2. Mục tiêu của tôi là được công nhận bằng để làm điều dưỡng ở Đức.',
          },
          {
            label: 'Nghề phục vụ nhà hàng (Kellner/Kellnerin)',
            href: '/phong-van/kellner/',
            de: 'Mein Name ist Thao. Ich habe ein Jahr als Kellnerin in einem Café in Ho-Chi-Minh-Stadt gearbeitet. Ich habe Bestellungen aufgenommen, Getränke serviert und kassiert. Ich arbeite gern im Team und bleibe freundlich, auch wenn viel los ist. In Deutschland möchte ich eine Ausbildung zur Fachfrau für Restaurants und Veranstaltungsgastronomie machen.',
            vi: 'Tôi tên là Thảo. Tôi làm phục vụ một năm ở một quán cà phê tại TP. Hồ Chí Minh. Tôi nhận gọi món, mang đồ uống và thu tiền. Tôi thích làm việc nhóm và vẫn giữ thái độ vui vẻ cả khi quán đông khách. Ở Đức tôi muốn học nghề phục vụ nhà hàng và sự kiện.',
          },
        ],
      },
    ],
    questionsHeading: 'Ba câu hỏi mở đầu trong buổi luyện',
    questions: [
      {
        de: fillPosition(COMMON_INTRO_QUESTION, 'Pflegefachmann/-frau'),
        vi: 'Mời bạn giới thiệu ngắn về bản thân: quá trình học tập và làm việc, kinh nghiệm liên quan đến vị trí Pflegefachmann/-frau (điều dưỡng), và bước tiếp theo bạn hướng tới.',
        tip: 'Câu hỏi đã gợi sẵn ba ý: quá trình (Werdegang), kinh nghiệm liên quan, bước tiếp theo. Trả lời theo khung 5 bước ở trên, khoảng một phút, và kết bằng bước tiếp theo của bạn.',
        sample:
          'Mein Name ist Linh, ich komme aus Hue. Ich habe in Vietnam Krankenpflege studiert und zwei Jahre in einem Krankenhaus gearbeitet. Zurzeit lerne ich Deutsch auf B2-Niveau. Mein nächster Schritt ist die Anerkennung meines Abschlusses in Deutschland.',
      },
      {
        de: fillPosition(COMMON_MOTIVATION_QUESTION, 'Pflegefachmann/-frau'),
        vi: 'Điều gì ở vị trí Pflegefachmann/-frau (điều dưỡng) khiến bạn đặc biệt quan tâm?',
        tip: 'Câu này thường đến ngay sau phần giới thiệu, nên đừng nói hết lý do ở phần giới thiệu. Giữ lại một lý do cụ thể, gắn với trải nghiệm của chính bạn.',
        sample:
          'Mich interessiert besonders die Arbeit mit älteren Menschen. Ich habe meine Großmutter lange gepflegt und weiß, wie wichtig Geduld ist. Außerdem gefällt mir, dass die Pflege in Deutschland klare Standards hat.',
      },
      {
        de: COMMON_FOUND_ROLE_QUESTION,
        vi: 'Bạn biết đến vị trí này bằng cách nào, và bạn mong đợi gì ở đội ngũ?',
        tip: 'Trả lời thật nơi bạn biết đến vị trí (trang tuyển dụng, chương trình học nghề, người quen), rồi nêu một mong đợi hợp lý như được hướng dẫn khi mới vào làm.',
        sample:
          'Ich habe die Stelle auf der Webseite Ihres Hauses gefunden. Vom Team erwarte ich eine gute Einarbeitung und offene Kommunikation. Ich frage lieber einmal mehr nach, als einen Fehler zu machen.',
      },
    ],
    vocabHeading: 'Từ vựng nên thuộc cho phần giới thiệu',
    vocab: [
      { de: 'das Vorstellungsgespräch', vi: 'buổi phỏng vấn xin việc' },
      { de: 'sich vorstellen', vi: 'giới thiệu bản thân' },
      { de: 'der Lebenslauf', vi: 'sơ yếu lý lịch' },
      { de: 'der Werdegang', vi: 'quá trình học tập và làm việc' },
      { de: 'die Ausbildung', vi: 'học nghề, khoá đào tạo nghề' },
      { de: 'der Abschluss', vi: 'bằng tốt nghiệp' },
      { de: 'die Berufserfahrung', vi: 'kinh nghiệm làm việc' },
      { de: 'die Stelle', vi: 'vị trí, chỗ làm' },
      { de: 'die Aufgabe', vi: 'nhiệm vụ, công việc' },
      { de: 'zuständig sein für', vi: 'phụ trách việc gì' },
      { de: 'die Stärke', vi: 'điểm mạnh' },
      { de: 'das Zertifikat', vi: 'chứng chỉ' },
      { de: 'die Anerkennung', vi: 'sự công nhận (bằng cấp)' },
      { de: 'die Einarbeitung', vi: 'giai đoạn hướng dẫn khi mới vào làm' },
    ],
    mistakes: [
      {
        wrong: 'Ich bin 24 Jahre.',
        right: 'Ich bin 24 Jahre alt.',
        why: 'Khi nói tuổi, tiếng Đức cần có alt ở cuối câu.',
      },
      {
        wrong: 'Ich komme von Vietnam.',
        right: 'Ich komme aus Vietnam.',
        why: 'Nói quê quán, đất nước mình đến từ thì dùng aus, không dùng von.',
      },
      {
        wrong: 'Ich habe seit einem Jahr Deutsch gelernt.',
        right: 'Ich lerne seit einem Jahr Deutsch.',
        why: 'Việc bắt đầu trong quá khứ và vẫn đang tiếp diễn thì dùng seit với thì hiện tại.',
      },
      {
        wrong: 'Ich möchte arbeiten in Deutschland.',
        right: 'Ich möchte in Deutschland arbeiten.',
        why: 'Khi có động từ khuyết thiếu như möchte, động từ nguyên mẫu đứng cuối câu.',
      },
      {
        wrong: 'Ich möchte eine Ausbildung machen, weil ich arbeite gern mit Menschen.',
        right: 'Ich möchte eine Ausbildung machen, weil ich gern mit Menschen arbeite.',
        why: 'Trong câu phụ bắt đầu bằng weil, động từ chia đứng cuối câu.',
      },
    ],
    practiceHeading: 'Luyện phần giới thiệu với người phỏng vấn AI',
    practice:
      'Trên myDeutschFlow, bạn chọn nghề của mình, và người phỏng vấn AI mở đầu buổi luyện bằng lời mời giới thiệu bản thân, rồi hỏi tiếp như một buổi phỏng vấn thật. Bạn trả lời bằng giọng nói, rồi nhận báo cáo chấm từng phần của buổi: câu bạn đã nói, câu nên nói và bài luyện tiếp.',
    related: [
      { href: '/phong-van/pflegefachkraft/', label: 'Phỏng vấn tiếng Đức nghề điều dưỡng (Pflegefachkraft)' },
      { href: '/phong-van/koch/', label: 'Phỏng vấn tiếng Đức nghề đầu bếp (Koch/Köchin)' },
      { href: '/phong-van/kellner/', label: 'Phỏng vấn tiếng Đức nghề phục vụ nhà hàng (Kellner)' },
      { href: '/cam-nang/phong-van-tieng-duc-nghe-bep/', label: 'Cẩm nang phỏng vấn tiếng Đức nghề bếp' },
      { href: '/phong-van/', label: 'Xem tất cả nghề có luyện phỏng vấn' },
    ],
    faqs: [
      {
        q: 'Giới thiệu bản thân khi phỏng vấn tiếng Đức nên dài bao lâu?',
        a: 'Khoảng một đến hai phút, tức chừng sáu đến mười câu. Ngắn quá thì người phỏng vấn không có gì để hỏi tiếp, dài quá thì dễ lạc ý và lộ lỗi ngữ pháp.',
      },
      {
        q: 'Có nên học thuộc lòng bài giới thiệu không?',
        a: 'Nên thuộc khung và các cụm từ, không nên thuộc từng chữ. Người phỏng vấn thường hỏi tiếp ngay vào một chi tiết bạn vừa nói, nên bạn cần nói lại được bằng lời của mình.',
      },
      {
        q: 'Xưng hô Sie hay du trong buổi phỏng vấn?',
        a: 'Luôn dùng Sie, trừ khi người phỏng vấn chủ động mời bạn dùng du.',
      },
      {
        q: 'Người Đức gọi tôi bằng họ hay tên?',
        a: 'Trong phỏng vấn họ thường gọi bằng họ, kèm Herr hoặc Frau. Tên người Việt dễ gây nhầm vì họ đứng trước, nên bạn có thể nói rõ: Mein Vorname ist Lan, mein Nachname ist Nguyen.',
      },
      {
        q: 'Luyện phần giới thiệu trên myDeutschFlow có mất phí không?',
        a: 'Bạn luyện thử miễn phí, không cần thẻ.',
      },
    ],
  },
  {
    slug: 'phong-van-du-hoc-nghe-duc',
    title: 'Phỏng vấn du học nghề Đức: câu hỏi thường gặp, cách trả lời',
    description:
      'Chuẩn bị phỏng vấn du học nghề Đức (Ausbildung): 6 câu hỏi thường gặp kèm cách trả lời, câu nên hỏi lại nhà tuyển dụng, từ vựng, lỗi hay gặp. Luyện thử với AI.',
    h1: 'Phỏng vấn du học nghề Đức: câu hỏi thường gặp và cách trả lời',
    lead:
      'Dành cho người Việt đang xin chỗ học nghề (Ausbildung) ở Đức và chuẩn bị phỏng vấn với nơi đào tạo. Bài đi từ cách chuẩn bị, sáu câu hỏi hay gặp kèm cách trả lời và câu mẫu tiếng Đức, đến những câu bạn nên hỏi lại nhà tuyển dụng.',
    published: '2026-11-13',
    topic: 'Du học nghề',
    draft: true,
    intro:
      'Trên hành trình du học nghề, bạn có thể gặp nhiều buổi phỏng vấn khác nhau: với doanh nghiệp hoặc cơ sở nhận bạn học nghề (Ausbildungsbetrieb), có khi với chương trình hay đơn vị giới thiệu, và có thể cả ở bước xin thị thực. Bài này tập trung vào buổi phỏng vấn với nơi đào tạo, vì đó là buổi quyết định bạn có nhận được hợp đồng học nghề (Ausbildungsvertrag) hay không. Buổi này thường bằng tiếng Đức, nhiều nơi phỏng vấn qua video. Người phỏng vấn muốn biết ba điều: bạn có hiểu nghề mình chọn không, bạn có đủ tiếng Đức để học và làm việc không, và bạn có phải người họ muốn làm cùng trong ba năm tới không.',
    steps: [
      {
        title: 'Hiểu rõ mô hình học nghề kép',
        body: 'Phần lớn chương trình học nghề ở Đức là học nghề kép (duale Ausbildung): bạn vừa học lý thuyết ở trường nghề (Berufsschule), vừa làm việc thật ở nơi đào tạo, và được trả phụ cấp học nghề. Người phỏng vấn đánh giá cao ứng viên nói được điều này bằng lời của mình, vì nó cho thấy bạn hiểu mình sẽ làm gì mỗi ngày, không chỉ "muốn sang Đức".',
        phrases: ['Die Ausbildung ist dual: Ich lerne in der Berufsschule und arbeite im Betrieb.', 'Ich weiß, dass die Ausbildung meistens drei Jahre dauert.'],
      },
      {
        title: 'Tìm hiểu nơi đào tạo',
        body: 'Đọc kỹ trang web và tin tuyển dụng của nơi bạn phỏng vấn: họ làm gì, ở thành phố nào, học viên làm ở bộ phận nào. Chọn một chi tiết cụ thể để nhắc lại trong buổi phỏng vấn. Một câu như "Tôi đọc trên trang web của quý vị rằng…" làm câu trả lời của bạn khác hẳn một câu học thuộc.',
        phrases: ['Auf Ihrer Webseite habe ich gelesen, dass …', 'Mir gefällt besonders, dass Ihr Betrieb …'],
      },
      {
        title: 'Chuẩn bị phần giới thiệu bản thân',
        body: 'Gần như buổi phỏng vấn nào cũng mở đầu bằng lời mời giới thiệu bản thân. Chuẩn bị một bản khoảng một phút theo khung: tên và quê, học vấn, kinh nghiệm liên quan, trình độ tiếng Đức, mục tiêu. Đừng học thuộc từng chữ; hãy thuộc khung để nói lại được bằng lời của mình.',
        phrases: ['Guten Tag, mein Name ist …', 'Ich möchte eine Ausbildung zur/zum … machen, weil …'],
      },
      {
        title: 'Chuẩn bị ba câu chuyện có thật',
        body: 'Các câu hỏi về mâu thuẫn, áp lực và sai sót đều đòi một ví dụ cụ thể. Chuẩn bị trước ba câu chuyện thật từ việc làm thêm, thực tập, việc nhà hoặc việc học, rồi kể theo trình tự: tình huống, nhiệm vụ của bạn, việc bạn làm, kết quả (cách kể STAR). Chưa đi làm cũng không sao: người phỏng vấn biết bạn đang xin học nghề, họ cần thấy cách bạn suy nghĩ và hành động.',
        phrases: ['Die Situation war so: …', 'Meine Aufgabe war …', 'Ich habe dann …', 'Am Ende …'],
      },
      {
        title: 'Chuẩn bị câu hỏi để hỏi lại',
        body: 'Cuối buổi, người phỏng vấn gần như luôn hỏi bạn có câu hỏi gì không. Trả lời "không" làm bạn trông thiếu quan tâm. Chuẩn bị sẵn hai đến ba câu về việc học và làm trong những tuần đầu (gợi ý ở phần dưới).',
        phrases: ['Ja, ich habe noch eine Frage: …', 'Darf ich noch etwas fragen?'],
      },
    ],
    templateGroups: [
      {
        heading: 'Trả lời câu "Vì sao bạn chọn học nghề ở Đức?"',
        intro: 'Người phỏng vấn muốn nghe lý do thật và cụ thể. Tránh trả lời chỉ bằng thu nhập hay "nước Đức phát triển". Gắn lý do với nghề, với trải nghiệm của bạn và với kế hoạch sau khi học xong. Ba mẫu dưới đây là minh hoạ; hãy thay bằng câu chuyện của bạn.',
        items: [
          {
            label: 'Vì sao chọn học nghề (Ausbildung)',
            de: 'Ich möchte einen Beruf richtig lernen, mit Theorie und Praxis. In der dualen Ausbildung arbeite ich vom ersten Tag an im Betrieb und lerne gleichzeitig in der Berufsschule. Das passt zu mir, weil ich am besten lerne, wenn ich etwas selbst mache.',
            vi: 'Tôi muốn học một nghề cho bài bản, có cả lý thuyết và thực hành. Trong học nghề kép, tôi làm việc ở doanh nghiệp ngay từ ngày đầu và đồng thời học ở trường nghề. Cách này hợp với tôi, vì tôi học tốt nhất khi được tự tay làm.',
          },
          {
            label: 'Vì sao chọn nghề này (ví dụ điều dưỡng)',
            href: '/phong-van/pflegefachkraft/',
            de: 'Ich habe meine Großmutter zwei Jahre lang zu Hause gepflegt. Dabei habe ich gemerkt, dass mir die Arbeit mit Menschen Freude macht, auch wenn sie anstrengend ist. Deshalb möchte ich die Pflege professionell lernen.',
            vi: 'Tôi đã chăm bà tôi ở nhà hai năm. Qua đó tôi nhận ra mình thích làm việc với con người, dù công việc vất vả. Vì vậy tôi muốn học điều dưỡng một cách chuyên nghiệp.',
          },
          {
            label: 'Kế hoạch sau khi học xong',
            de: 'Nach der Ausbildung möchte ich in meinem Beruf weiterarbeiten, am liebsten in Ihrem Betrieb. Später kann ich mir auch eine Weiterbildung vorstellen.',
            vi: 'Sau khi học xong, tôi muốn tiếp tục làm nghề, tốt nhất là ở chính nơi của quý vị. Sau này tôi cũng nghĩ đến việc học nâng cao.',
          },
        ],
      },
      {
        heading: 'Câu nên hỏi lại nhà tuyển dụng',
        intro: 'Câu hỏi tốt cho thấy bạn đã nghĩ đến việc học và làm thật sự. Chọn hai đến ba câu, đừng hỏi những gì tin tuyển dụng đã ghi rõ.',
        items: [
          { label: 'Về những tuần đầu', de: 'Wie sieht die Einarbeitung in den ersten Wochen aus?', vi: 'Những tuần đầu, học viên được hướng dẫn như thế nào?' },
          { label: 'Về người hướng dẫn', de: 'Wer ist während der Ausbildung mein Ansprechpartner im Betrieb?', vi: 'Trong thời gian học nghề, ai là người tôi liên hệ ở doanh nghiệp?' },
          { label: 'Về lịch học', de: 'An welchen Tagen bin ich in der Berufsschule?', vi: 'Tôi học ở trường nghề vào những ngày nào?' },
          { label: 'Về chỗ ở', de: 'Unterstützen Sie Auszubildende bei der Wohnungssuche?', vi: 'Quý vị có hỗ trợ học viên tìm chỗ ở không?' },
        ],
      },
    ],
    questionsHeading: 'Sáu câu hỏi thường gặp và cách trả lời',
    questions: [
      {
        de: fillPosition(COMMON_MOTIVATION_QUESTION, 'Koch/Köchin'),
        vi: 'Điều gì ở vị trí Koch/Köchin (đầu bếp) khiến bạn đặc biệt quan tâm?',
        tip: 'Nêu một lý do cụ thể gắn với nghề, không phải với nước Đức nói chung. Nếu có, nhắc một điều bạn đọc được về nơi đào tạo. Hai đến ba câu là đủ.',
        sample:
          'Mich interessiert, dass ich in der Ausbildung alles von Grund auf lerne: Techniken, Hygiene und die Organisation in der Küche. In Vietnam habe ich in einem Restaurant ausgeholfen und gesehen, wie wichtig gute Abläufe sind.',
      },
      {
        de: COMMON_QUESTIONS.typicalDay,
        vi: 'Hãy mô tả một ngày làm việc điển hình ở chỗ làm gần nhất của bạn — cụ thể và theo trình tự thời gian.',
        tip: 'Chưa đi làm chính thức thì kể về đợt thực tập, việc làm thêm hoặc một ngày phụ giúp cửa hàng của gia đình. Kể theo giờ: bắt đầu lúc mấy giờ, làm gì trước, làm gì sau. Dùng thì quá khứ (Perfekt) và các từ nối zuerst, danach, am Nachmittag.',
        sample:
          'In meinem Praktikum im Pflegeheim habe ich um sechs Uhr angefangen. Zuerst gab es die Übergabe, danach habe ich bei der Grundpflege geholfen und das Frühstück verteilt. Am Nachmittag habe ich mit den Bewohnern Zeit verbracht und bei der Dokumentation geholfen.',
      },
      {
        de: COMMON_QUESTIONS.conflict,
        vi: 'Hãy kể về một mâu thuẫn trong nhóm: tình huống, nhiệm vụ của bạn, việc bạn đã làm và kết quả.',
        tip: 'Câu hỏi đã chỉ sẵn trình tự STAR, hãy kể đúng theo đó. Chọn mâu thuẫn nhỏ và đã giải quyết được. Đừng đổ lỗi cho người khác; nói rõ bạn đã lắng nghe và đề xuất gì.',
        sample:
          'In meinem Nebenjob wollten zwei Kollegen am Wochenende nicht arbeiten. Ich sollte den Plan mit dem Schichtleiter klären. Ich habe mit beiden gesprochen und einen Tausch vorgeschlagen. Am Ende waren beide einverstanden, und der Plan war rechtzeitig fertig.',
      },
      {
        de: COMMON_QUESTIONS.stress,
        vi: 'Hãy mô tả một tình huống căng thẳng vì gấp thời gian — chính xác bạn đã làm gì và kết quả ra sao?',
        tip: 'Người phỏng vấn muốn nghe bạn giữ bình tĩnh và sắp xếp việc thế nào. Nói rõ bạn ưu tiên việc gì trước, phối hợp với ai, và kết quả cuối cùng.',
        sample:
          'Bei einer Hochzeit im Restaurant kamen plötzlich zwanzig Gäste mehr als geplant. Ich habe zuerst die Getränke vorbereitet und mit der Küche abgesprochen, welche Gerichte zuerst kommen. Am Ende wurden alle Gäste pünktlich bedient.',
      },
      {
        de: COMMON_QUESTIONS.mistake,
        vi: 'Hãy kể về một lỗi trong công việc: phát hiện ra thế nào, khắc phục ra sao, bạn rút ra bài học gì?',
        tip: 'Chọn một lỗi thật nhưng không nghiêm trọng, và dành nhiều thời gian nhất cho phần bài học. Câu trả lời "tôi chưa bao giờ mắc lỗi" luôn bị đánh giá thấp.',
        sample:
          'Einmal habe ich eine Bestellung falsch notiert. Der Gast hat es beim Servieren bemerkt. Ich habe mich entschuldigt und das richtige Gericht sofort nachbestellt. Seitdem lese ich jede Bestellung noch einmal vor.',
      },
      {
        de: COMMON_QUESTIONS.closing,
        vi: 'Bạn có câu hỏi nào cho chúng tôi không?',
        tip: 'Luôn có sẵn hai câu. Hỏi về việc học và làm (hướng dẫn những tuần đầu, lịch trường nghề), không hỏi những điều tin tuyển dụng đã ghi rõ.',
        sample: 'Ja, gern. Wie sieht die Einarbeitung in den ersten Wochen aus? Und an welchen Tagen bin ich in der Berufsschule?',
      },
    ],
    vocabHeading: 'Từ vựng du học nghề nên thuộc',
    vocab: [
      { de: 'die duale Ausbildung', vi: 'học nghề kép (trường nghề + doanh nghiệp)' },
      { de: 'der Ausbildungsbetrieb', vi: 'doanh nghiệp, cơ sở đào tạo nghề' },
      { de: 'die Berufsschule', vi: 'trường nghề' },
      { de: 'der/die Auszubildende (Azubi)', vi: 'học viên học nghề' },
      { de: 'der Ausbilder / die Ausbilderin', vi: 'người hướng dẫn nghề' },
      { de: 'der Ausbildungsvertrag', vi: 'hợp đồng học nghề' },
      { de: 'die Ausbildungsvergütung', vi: 'phụ cấp học nghề' },
      { de: 'die Probezeit', vi: 'thời gian thử việc' },
      { de: 'die Einarbeitung', vi: 'giai đoạn hướng dẫn khi mới vào' },
      { de: 'die Bewerbung', vi: 'hồ sơ xin học, xin việc' },
      { de: 'das Anschreiben', vi: 'thư xin việc' },
      { de: 'das Praktikum', vi: 'thực tập' },
      { de: 'der Nebenjob', vi: 'việc làm thêm' },
      { de: 'die Schicht', vi: 'ca làm' },
      { de: 'das Visum', vi: 'thị thực' },
      { de: 'die Unterkunft', vi: 'chỗ ở' },
    ],
    mistakes: [
      {
        wrong: 'Ich interessiere mich an der Pflege.',
        right: 'Ich interessiere mich für die Pflege.',
        why: 'Động từ sich interessieren đi với giới từ für, không đi với an.',
      },
      {
        wrong: 'Ich freue mich für die Ausbildung.',
        right: 'Ich freue mich auf die Ausbildung.',
        why: 'Mong chờ điều sắp đến dùng sich freuen auf; sich freuen für là mừng cho người khác.',
      },
      {
        wrong: 'Wann ich in Deutschland bin, möchte ich viel lernen.',
        right: 'Wenn ich in Deutschland bin, möchte ich viel lernen.',
        why: 'Wann dùng để hỏi thời gian; mệnh đề "khi…" nói về điều kiện hoặc thời điểm trong tương lai dùng wenn.',
      },
      {
        wrong: 'Ich habe 2023 die Schule fertig.',
        right: 'Ich habe die Schule 2023 abgeschlossen.',
        why: 'Fertig là tính từ, không làm động từ được. Nói học xong dùng abschließen (abgeschlossen) hoặc mit der Schule fertig sein.',
      },
    ],
    practiceHeading: 'Luyện phỏng vấn học nghề với người phỏng vấn AI',
    practice:
      'Trên myDeutschFlow, bạn chọn nghề muốn học, và người phỏng vấn AI hỏi bạn bằng giọng nói như một buổi phỏng vấn thật: giới thiệu bản thân, lý do chọn nghề, các câu kể chuyện như trên, rồi đến câu hỏi chuyên môn của nghề. Câu hỏi có thể khác hoặc được hỏi theo cách khác. Bạn trả lời bằng tiếng Đức, rồi nhận báo cáo chấm từng phần của buổi: câu bạn đã nói, câu nên nói và bài luyện tiếp.',
    related: [
      { href: '/cam-nang/gioi-thieu-ban-than-bang-tieng-duc/', label: 'Giới thiệu bản thân bằng tiếng Đức khi phỏng vấn: khung 5 bước và mẫu A1–B1' },
      { href: '/cam-nang/phong-van-tieng-duc-nghe-bep/', label: 'Cẩm nang phỏng vấn tiếng Đức nghề bếp' },
      { href: '/phong-van/pflegefachkraft/', label: 'Phỏng vấn tiếng Đức nghề điều dưỡng (Pflegefachkraft)' },
      { href: '/phong-van/koch/', label: 'Phỏng vấn tiếng Đức nghề đầu bếp (Koch/Köchin)' },
      { href: '/luyen-thi/telc-pflege-b1-b2/', label: 'Luyện thi telc Deutsch B1·B2 Pflege' },
      { href: '/luyen-thi/goethe-b1/', label: 'Luyện thi Goethe-Zertifikat B1' },
      { href: '/phong-van/', label: 'Xem tất cả nghề có luyện phỏng vấn' },
    ],
    faqs: [
      {
        q: 'Phỏng vấn du học nghề Đức cần trình độ tiếng Đức nào?',
        a: 'Tuỳ nghề, chương trình và nơi đào tạo. Nhiều nơi yêu cầu từ B1, có nơi yêu cầu B2. Hãy xem yêu cầu trong tin tuyển dụng hoặc hỏi trực tiếp nơi bạn ứng tuyển.',
      },
      {
        q: 'Phỏng vấn xin thị thực ở Đại sứ quán hỏi những gì?',
        a: 'Bài này không liệt kê bộ câu hỏi xin thị thực, vì quy trình và giấy tờ do cơ quan đại diện Đức quy định và có thể thay đổi. Hãy xem thông tin chính thức trên trang của Đại sứ quán Đức tại Việt Nam (vietnam.diplo.de) và cổng Make it in Germany (make-it-in-germany.com). Nguyên tắc chung: trả lời đúng sự thật và khớp với hồ sơ của bạn.',
      },
      {
        q: 'Không hiểu câu hỏi thì nói thế nào?',
        a: 'Hỏi lại một cách lịch sự là hoàn toàn bình thường: Könnten Sie die Frage bitte wiederholen? hoặc Entschuldigung, meinen Sie …? Hỏi lại tốt hơn nhiều so với trả lời sai ý.',
      },
      {
        q: 'Phỏng vấn qua video cần chuẩn bị gì?',
        a: 'Thử trước camera, micro và đường truyền; ngồi chỗ yên tĩnh, đủ sáng; ăn mặc như đi phỏng vấn trực tiếp; để sẵn giấy bút và ghi chú ngắn. Nhìn vào camera khi nói để người phỏng vấn thấy bạn đang nhìn họ.',
      },
      {
        q: 'Có nên hỏi về phụ cấp học nghề trong buổi phỏng vấn không?',
        a: 'Có thể hỏi nếu tin tuyển dụng chưa ghi, nhưng nên để sau các câu về việc học và làm. Phụ cấp và điều kiện cụ thể sẽ ghi trong hợp đồng học nghề.',
      },
      {
        q: 'Luyện phỏng vấn trên myDeutschFlow có mất phí không?',
        a: 'Bạn luyện thử miễn phí, không cần thẻ.',
      },
    ],
  },
]

/** Bài đã đăng (không phải bản nháp) — vào sitemap và mục lục `/cam-nang/`. */
export const GUIDE_ARTICLES: GuideArticle[] = ALL_GUIDE_ARTICLES.filter((a) => !a.draft)

export function guideArticle(slug: string): GuideArticle | undefined {
  return ALL_GUIDE_ARTICLES.find((a) => a.slug === slug)
}

/** Liên kết "Đọc tiếp" không được trỏ tới bản nháp — bài nháp `noindex`, chưa duyệt câu tiếng Đức. */
export function publishedRelated(a: GuideArticle): { href: string; label: string }[] {
  const drafts = new Set(ALL_GUIDE_ARTICLES.filter((g) => g.draft).map((g) => `/cam-nang/${g.slug}/`))
  return (a.related ?? []).filter((r) => !drafts.has(r.href))
}

/** Tiêu đề thẻ `<title>` của một bài: tên bài + thương hiệu, cùng kiểu với trang mục lục `/cam-nang/`. */
export function guideDocumentTitle(title: string): string {
  return `${title} · myDeutschFlow`
}
