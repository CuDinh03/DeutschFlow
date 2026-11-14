/**
 * Cẩm nang — trang nội dung theo từ khoá (đợt D, kế hoạch cải thiện trang chủ 08/11/2026). Chỉ tiếng
 * Việt. Thứ tự dự kiến: bếp → điều dưỡng (chờ bộ Pflege được duyệt) → Goethe B1 → telc B1 → Ausbildung,
 * mỗi tháng 2 bài.
 *
 * Luật nội dung (sổ lời hứa): câu hỏi phỏng vấn chỉ lấy từ bộ câu hỏi ĐÃ DUYỆT của sản phẩm (chép
 * nguyên văn), câu trả lời mẫu ghi rõ là minh hoạ; không đưa con số, mức lương hay quy định visa chưa
 * kiểm chứng.
 */

export interface GuideQuestion {
  de: string
  vi: string
  tip: string
  /** Câu trả lời mẫu — minh hoạ, không phải đáp án duy nhất. */
  sample: string
}

export interface GuideArticle {
  slug: string
  title: string
  description: string
  h1: string
  lead: string
  /** YYYY-MM-DD */
  published: string
  /** Mã nghề để dẫn sang trang nghề và mở buổi luyện đúng nghề. */
  occupationCode: string
  occupationNameDe: string
  interviewer: string
  intro: string
  questions: GuideQuestion[]
  vocab: { de: string; vi: string }[]
  mistakes: { wrong: string; right: string; why: string }[]
  practice: string
  faqs: { q: string; a: string }[]
}

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: 'phong-van-tieng-duc-nghe-bep',
    title: 'Phỏng vấn tiếng Đức nghề bếp (Koch/Köchin): câu hỏi, từ vựng, cách trả lời',
    description:
      'Cẩm nang phỏng vấn xin việc nghề bếp bằng tiếng Đức: ba câu hỏi tiêu biểu, gợi ý cách trả lời, từ vựng trong bếp và lỗi ngữ pháp người Việt hay gặp. Luyện thử miễn phí với AI.',
    h1: 'Phỏng vấn tiếng Đức nghề bếp: câu hỏi, từ vựng và cách trả lời',
    lead:
      'Dành cho người chuẩn bị phỏng vấn vị trí Koch/Köchin (đầu bếp) ở Đức, dù đi theo diện học nghề (Ausbildung) hay đã có kinh nghiệm. Bài này lấy ba câu hỏi tiêu biểu, chép nguyên văn từ bộ câu hỏi nghề bếp đã duyệt của myDeutschFlow.',
    published: '2026-11-08',
    occupationCode: 'koch',
    occupationNameDe: 'Koch/Köchin',
    interviewer: 'Klaus',
    intro:
      'Trong buổi luyện nghề bếp, câu hỏi thường xoay quanh ba chủ đề: bạn là ai và đã làm gì trong bếp, bạn xử lý vệ sinh an toàn thực phẩm thế nào, và bạn giữ nhịp ra sao lúc đông khách. Người phỏng vấn muốn nghe ví dụ cụ thể, không chỉ một danh sách kỹ năng.',
    questions: [
      {
        de: 'Bitte stellen Sie sich kurz vor: Ihr Werdegang, Ihre Erfahrung als Koch/Köchin und Ihr nächster Schritt.',
        vi: 'Mời bạn giới thiệu ngắn về bản thân: quá trình học và làm việc, kinh nghiệm ở vị trí Koch/Köchin và dự định sắp tới.',
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
]

export function guideArticle(slug: string): GuideArticle | undefined {
  return GUIDE_ARTICLES.find((a) => a.slug === slug)
}

/** Tiêu đề thẻ `<title>` của một bài: tên bài + thương hiệu, cùng kiểu với trang mục lục `/cam-nang/`. */
export function guideDocumentTitle(title: string): string {
  return `${title} · myDeutschFlow`
}
