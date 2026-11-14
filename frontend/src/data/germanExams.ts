/**
 * Dữ liệu các kỳ thi tiếng Đức cho trang SEO `/luyen-thi/[slug]` (checklist C9).
 *
 * Nguyên tắc nội dung: chỉ ghi các SỰ THẬT ỔN ĐỊNH (cấu trúc đề, cách tính điểm, định dạng
 * module) — KHÔNG hardcode lịch thi / lệ phí (biến động, theo địa điểm) mà link sang nguồn
 * chính thức. Thời lượng để "khoảng" + nhắc xác nhận tại nguồn chính thức.
 */

export type ExamProvider = 'Goethe' | 'telc'
export type ExamLevel = 'A2' | 'B1' | 'B2' | 'B1·B2'

export interface ExamModule {
  skill: string
  name: string
  /** Thời lượng khoảng; bỏ trống khi chưa đối chiếu được với nguồn chính thức (trang hiện "Xem trang telc"). */
  durationMin?: number
  description: string
}

export interface ReadinessGroup {
  skill: string
  items: string[]
}

export interface ExamFaq {
  q: string
  a: string
}

export interface GermanExam {
  slug: string
  provider: ExamProvider
  level: ExamLevel
  /** Tên đầy đủ, vd "Goethe-Zertifikat B1". */
  name: string
  /** Nhãn ngắn, vd "Goethe B1". */
  shortName: string
  tagline: string
  metaTitle: string
  metaDescription: string
  overview: string
  whoFor: string
  modules: ExamModule[]
  /** Cách tính điểm / điều kiện đạt. */
  scoring: string
  /** Có thể thi/thi lại từng module riêng không. */
  modular: boolean
  readiness: ReadinessGroup[]
  studyTips: string[]
  faqs: ExamFaq[]
  officialUrl: string
}

const GOETHE_MODULES = (durations: [number, number, number, number]): ExamModule[] => [
  { skill: 'Lesen', name: 'Đọc hiểu (Lesen)', durationMin: durations[0], description: 'Đọc thông báo, email, bài báo, quảng cáo; tìm thông tin và hiểu ý chính.' },
  { skill: 'Hören', name: 'Nghe hiểu (Hören)', durationMin: durations[1], description: 'Nghe hội thoại, thông báo, phỏng vấn ngắn; nắm ý chính và chi tiết.' },
  { skill: 'Schreiben', name: 'Viết (Schreiben)', durationMin: durations[2], description: 'Viết tin nhắn, email hoặc bài nêu ý kiến theo tình huống cho sẵn. Dạng bài và độ dài tăng theo cấp độ.' },
  { skill: 'Sprechen', name: 'Nói (Sprechen)', durationMin: durations[3], description: 'Thi nói theo cặp: hỏi đáp, trình bày một chủ đề, cùng thảo luận hoặc lập kế hoạch. Nhiệm vụ cụ thể tuỳ cấp độ.' },
]

export const GERMAN_EXAMS: GermanExam[] = [
  {
    slug: 'goethe-b1',
    provider: 'Goethe',
    level: 'B1',
    name: 'Goethe-Zertifikat B1',
    shortName: 'Goethe B1',
    tagline: 'Kỳ thi B1 cho du học nghề, điều dưỡng và định cư Đức',
    metaTitle: 'Luyện thi Goethe B1: cấu trúc đề, cách tính điểm, checklist',
    metaDescription:
      'Luyện thi Goethe B1: cấu trúc 4 module, cách tính điểm (mỗi module cần 60/100), checklist ôn theo kỹ năng. Chấm thử bài viết bằng AI miễn phí.',
    overview:
      'Goethe-Zertifikat B1 xác nhận bạn có tiếng Đức bậc trung cấp (B1 theo khung tham chiếu châu Âu CEFR). Nhiều chương trình học nghề, điều dưỡng và thủ tục định cư ở Đức yêu cầu mốc B1. Kỳ thi gồm 4 module độc lập, bạn có thể thi và thi lại từng module.',
    whoFor: 'Người chuẩn bị sang Đức học nghề, làm điều dưỡng, xin định cư lâu dài, hoặc cần một chứng chỉ B1 được công nhận rộng rãi.',
    modules: GOETHE_MODULES([65, 40, 60, 15]),
    scoring: 'Mỗi module tính trên thang 100 điểm; cần đạt tối thiểu 60 điểm (60%) để qua module đó. Vì là kỳ thi module hoá, bạn có thể thi lại riêng module chưa đạt.',
    modular: true,
    readiness: [
      { skill: 'Schreiben (Viết)', items: [
        'Viết được email/thư cá nhân mạch lạc khoảng 80 từ theo tình huống.',
        'Trình bày và bảo vệ ý kiến đơn giản, có lý do (weil, denn, deshalb).',
        'Dùng đúng thì Perfekt và Präteritum cho các động từ thông dụng.',
        'Liên kết câu bằng Konnektoren (wenn, dass, obwohl, trotzdem).',
      ] },
      { skill: 'Sprechen (Nói)', items: [
        'Giới thiệu bản thân và hỏi–đáp về chủ đề quen thuộc trôi chảy.',
        'Cùng bạn thi lập kế hoạch (vd tổ chức một sự kiện) bằng tiếng Đức.',
        'Trình bày ngắn về một chủ đề và phản hồi câu hỏi.',
      ] },
      { skill: 'Đọc và Nghe (Lesen, Hören)', items: [
        'Hiểu ý chính của email, thông báo, bài báo đơn giản.',
        'Nghe nắm thông tin chính trong hội thoại và thông báo đời thường.',
        'Vốn từ khoảng 2.400 từ ở các chủ đề thường gặp (gia đình, công việc, sức khoẻ).',
      ] },
    ],
    studyTips: [
      'Luyện đúng 3 dạng bài của đề: email cho bạn bè, bài nêu ý kiến trên diễn đàn và email trang trọng ngắn (xin lỗi, xin dời hẹn). Bấm giờ 60 phút.',
      'Chấm bài viết thường xuyên để bắt lỗi Artikel, chia động từ, trật tự từ — lặp lại đến khi ổn định.',
      'Luyện Sprechen theo cặp, nhất là phần cùng lập kế hoạch (gemeinsam etwas planen).',
      'Mỗi ngày 15 phút nghe podcast tiếng Đức A2–B1 để quen tốc độ thi.',
    ],
    faqs: [
      { q: 'Goethe B1 có thi lại từng phần được không?', a: 'Có. Goethe-Zertifikat B1 là kỳ thi module hoá: bạn có thể thi và thi lại riêng từng module (Lesen, Hören, Schreiben, Sprechen) mà không phải thi lại toàn bộ.' },
      { q: 'Cần bao nhiêu điểm để đỗ Goethe B1?', a: 'Mỗi module chấm trên thang 100 điểm và cần đạt tối thiểu 60 điểm (60%) để qua module đó.' },
      { q: 'Lịch thi và lệ phí ở đâu?', a: 'Lịch thi và lệ phí thay đổi theo địa điểm — xem tại Goethe-Institut (goethe.de) hoặc trung tâm khảo thí được uỷ quyền gần bạn.' },
    ],
    officialUrl: 'https://www.goethe.de/ins/vn/vi/spr/prf/gzb1.html',
  },
  {
    slug: 'goethe-b2',
    provider: 'Goethe',
    level: 'B2',
    name: 'Goethe-Zertifikat B2',
    shortName: 'Goethe B2',
    tagline: 'Mốc B2 thường cần khi công nhận bằng nghề ở Đức',
    metaTitle: 'Luyện thi Goethe B2: cấu trúc đề, cách tính điểm, checklist',
    metaDescription:
      'Luyện thi Goethe-Zertifikat B2: 4 module độc lập, cách tính điểm, checklist ôn theo kỹ năng. Chấm thử bài viết tiếng Đức bằng AI miễn phí.',
    overview:
      'Goethe-Zertifikat B2 xác nhận trình độ tiếng Đức trung cao cấp (B2). Mốc này thường được yêu cầu khi công nhận bằng nghề (Anerkennung), ví dụ với điều dưỡng. Phần lớn ngành đại học ở Đức cần C1, chỉ một số chương trình chấp nhận B2. Kỳ thi gồm 4 module độc lập.',
    whoFor: 'Người cần B2 để công nhận nghề (điều dưỡng, kỹ thuật), học cao hơn, hoặc làm việc chuyên môn tại Đức.',
    modules: GOETHE_MODULES([65, 40, 75, 15]),
    scoring: 'Mỗi module 100 điểm, đạt tối thiểu 60 điểm (60%). Module hoá — thi/thi lại riêng từng phần.',
    modular: true,
    readiness: [
      { skill: 'Schreiben (Viết)', items: [
        'Viết văn bản mạch lạc, trình bày và lập luận quan điểm phức tạp hơn.',
        'Dùng linh hoạt câu phụ, bị động (Passiv), Konjunktiv II ở mức cơ bản.',
        'Diễn đạt nguyên nhân–hệ quả, so sánh, nhượng bộ chính xác.',
      ] },
      { skill: 'Sprechen (Nói)', items: [
        'Trình bày một chủ đề và bảo vệ quan điểm trước phản biện.',
        'Thảo luận, đề xuất giải pháp và đạt đồng thuận với bạn thi.',
      ] },
      { skill: 'Đọc và Nghe (Lesen, Hören)', items: [
        'Hiểu bài báo, bình luận, văn bản chuyên môn nhẹ.',
        'Nghe hiểu bài giảng/phỏng vấn dài và nắm chi tiết.',
        'Vốn từ khoảng 4.000 từ, gồm nhiều chủ đề trừu tượng và chuyên môn.',
      ] },
    ],
    studyTips: [
      'Tập viết bài nêu ý kiến trên diễn đàn (Forumsbeitrag) và email trang trọng, đủ mở bài, thân bài, kết bài. Bấm giờ 75 phút.',
      'Chấm bài định kỳ để kiểm soát lỗi cấu trúc câu phức và liên kết ý.',
      'Đọc báo Đức (đơn giản hoá) mỗi ngày để tăng tốc độ đọc cho phần Lesen.',
    ],
    faqs: [
      { q: 'Goethe B2 khác B1 ở đâu?', a: 'B2 đòi hỏi diễn đạt quan điểm phức tạp, hiểu văn bản chuyên môn nhẹ và vốn từ rộng hơn nhiều so với B1; cấu trúc vẫn 4 module độc lập.' },
      { q: 'Đỗ B2 cần bao nhiêu điểm?', a: 'Tối thiểu 60/100 điểm mỗi module.' },
    ],
    officialUrl: 'https://www.goethe.de/ins/vn/vi/spr/prf/gzb2.html',
  },
  {
    slug: 'goethe-a2',
    provider: 'Goethe',
    level: 'A2',
    name: 'Goethe-Zertifikat A2',
    shortName: 'Goethe A2',
    tagline: 'Bước đệm sơ cấp trước khi lên B1',
    metaTitle: 'Luyện thi Goethe A2: cấu trúc đề và checklist ôn thi',
    metaDescription:
      'Luyện thi Goethe-Zertifikat A2: cấu trúc 4 phần Lesen, Hören, Schreiben, Sprechen và checklist ôn theo kỹ năng. Chấm thử bài viết bằng AI miễn phí.',
    overview:
      'Goethe-Zertifikat A2 xác nhận trình độ sơ cấp (A2): giao tiếp được trong các tình huống đời thường đơn giản. Đây là bước đệm tốt trước khi luyện B1, mốc mà nhiều chương trình học nghề và điều dưỡng yêu cầu.',
    whoFor: 'Người mới học muốn có một mốc A2 trước khi lên B1.',
    modules: GOETHE_MODULES([30, 30, 30, 15]),
    scoring: 'Kết quả tính trên thang 100 điểm; cần đạt tối thiểu 60% để đỗ.',
    modular: false,
    readiness: [
      { skill: 'Schreiben (Viết)', items: [
        'Viết tin nhắn/email ngắn về việc cá nhân (hẹn gặp, xin lỗi, mời).',
        'Dùng đúng thì Perfekt cơ bản và động từ khuyết thiếu (Modalverben).',
      ] },
      { skill: 'Sprechen (Nói)', items: [
        'Giới thiệu bản thân, hỏi–đáp thông tin cá nhân quen thuộc.',
        'Trao đổi để thống nhất một việc đơn giản (vd hẹn giờ).',
      ] },
      { skill: 'Đọc và Nghe (Lesen, Hören)', items: [
        'Hiểu thông báo, biển báo, email ngắn đời thường.',
        'Vốn từ khoảng 1.300 từ ở chủ đề gần gũi.',
      ] },
    ],
    studyTips: [
      'Luyện mẫu câu cố định cho từng dạng email ngắn để viết nhanh, đúng.',
      'Chấm bài viết để sửa lỗi Artikel/giống danh từ ngay từ A2 — nền tảng cho B1.',
    ],
    faqs: [
      { q: 'Học A2 rồi có cần thi A2 không?', a: 'Không bắt buộc nếu đích của bạn là B1 — nhưng thi A2 cho bạn mốc đánh giá khách quan và quen định dạng thi Goethe.' },
    ],
    officialUrl: 'https://www.goethe.de/ins/vn/vi/spr/prf/gza2.html',
  },
  {
    slug: 'telc-b1',
    provider: 'telc',
    level: 'B1',
    name: 'telc Deutsch B1',
    shortName: 'telc B1',
    tagline: 'Kỳ thi B1 có phần Sprachbausteine, có thi thử online trên myDeutschFlow',
    metaTitle: 'Luyện thi telc Deutsch B1: cấu trúc đề, điểm đỗ, thi thử',
    metaDescription:
      'Luyện thi telc Deutsch B1: cấu trúc đề, cách tính điểm, checklist ôn thi. Thi thử telc B1 đủ 4 kỹ năng trên myDeutschFlow, không cần thanh toán trước.',
    overview:
      'telc Deutsch B1 là kỳ thi B1 được nhiều cơ quan và nhà tuyển dụng tại Đức công nhận, tương đương B1 khung CEFR. Bài thi gồm phần viết (đọc hiểu, ngữ pháp–từ vựng "Sprachbausteine", nghe hiểu, viết) và phần thi nói (thường theo cặp).',
    whoFor: 'Người cần chứng chỉ B1 để đi làm hoặc định cư ở Đức, nhất là khi nơi nhận hồ sơ chấp nhận telc.',
    modules: [
      { skill: 'Leseverstehen', name: 'Đọc hiểu và Sprachbausteine', durationMin: 90, description: 'Đọc hiểu và Sprachbausteine (bài tập ngữ pháp, từ vựng đặc trưng của telc).' },
      { skill: 'Hörverstehen', name: 'Nghe hiểu', durationMin: 30, description: 'Nghe hội thoại, thông báo và phỏng vấn ngắn.' },
      { skill: 'Schreiben', name: 'Viết', durationMin: 30, description: 'Viết một lá thư/email theo tình huống cho sẵn.' },
      { skill: 'Sprechen', name: 'Nói', durationMin: 15, description: 'Thi nói theo cặp: làm quen, trao đổi về chủ đề, cùng giải quyết một nhiệm vụ.' },
    ],
    scoring: 'Tổng 300 điểm: phần thi viết 225 điểm, phần nói 75 điểm. Cần đạt ít nhất 60% ở từng phần (135 và 45 điểm). Xem barem chi tiết ở trang chính thức của telc.',
    modular: false,
    readiness: [
      { skill: 'Schreiben (Viết)', items: [
        'Viết thư/email B1 đúng bố cục: chào hỏi, nội dung, kết thư.',
        'Xử lý đủ 4 ý gợi ý (Leitpunkte) của đề.',
        'Liên kết ý bằng Konnektoren và chia động từ chính xác.',
      ] },
      { skill: 'Sprachbausteine', items: [
        'Quen dạng điền từ/chọn đáp án ngữ pháp–từ vựng đặc trưng telc.',
        'Nắm vững giới từ + cách, liên từ, cấu trúc câu thường gặp.',
      ] },
      { skill: 'Nói và Nghe (Sprechen, Hören)', items: [
        'Phối hợp với bạn thi để hoàn thành nhiệm vụ chung.',
        'Nghe nắm ý chính và chi tiết trong hội thoại đời thường.',
      ] },
    ],
    studyTips: [
      'Luyện riêng phần Sprachbausteine — đây là điểm khác biệt lớn của telc so với Goethe.',
      'Chấm bài viết theo đúng tiêu chí telc (xử lý đủ ý gợi ý và độ chính xác ngôn ngữ).',
      'Luyện nói theo cặp với dạng "cùng giải quyết nhiệm vụ".',
    ],
    faqs: [
      { q: 'telc B1 và Goethe B1 cái nào được công nhận?', a: 'Cả hai đều là kỳ thi B1 được công nhận rộng rãi. Hãy kiểm tra yêu cầu cụ thể của chương trình/cơ quan bạn nộp — một số nơi chấp nhận cả hai.' },
      { q: 'Sprachbausteine là gì?', a: 'Là phần bài tập ngữ pháp–từ vựng đặc trưng của telc (điền từ/chọn đáp án), không có ở định dạng Goethe.' },
    ],
    officialUrl: 'https://www.telc.net/',
  },
  {
    slug: 'telc-b2',
    provider: 'telc',
    level: 'B2',
    name: 'telc Deutsch B2',
    shortName: 'telc B2',
    tagline: 'Bậc B2 theo định dạng telc cho công việc và công nhận nghề',
    metaTitle: 'Luyện thi telc Deutsch B2: cấu trúc đề và checklist',
    metaDescription:
      'Luyện thi telc Deutsch B2: phần thi viết (đọc, Sprachbausteine, nghe, viết), thi nói và checklist ôn theo kỹ năng. Chấm thử bài viết bằng AI miễn phí.',
    overview:
      'telc Deutsch B2 xác nhận trình độ B2 theo định dạng telc, được dùng cho công việc chuyên môn và một số chương trình công nhận nghề. Bài thi gồm phần viết và phần nói tương tự cấu trúc telc B1 nhưng độ khó cao hơn.',
    whoFor: 'Người cần B2 cho công việc/công nhận nghề và quen định dạng telc.',
    modules: [
      { skill: 'Leseverstehen', name: 'Đọc hiểu và Sprachbausteine', durationMin: 90, description: 'Đọc hiểu và Sprachbausteine ở mức B2.' },
      { skill: 'Hörverstehen', name: 'Nghe hiểu', durationMin: 20, description: 'Nghe văn bản dài hơn, nhiều chi tiết.' },
      { skill: 'Schreiben', name: 'Viết', durationMin: 30, description: 'Viết văn bản (thư/khiếu nại/ý kiến) ở mức B2.' },
      { skill: 'Sprechen', name: 'Nói', durationMin: 15, description: 'Thi nói theo cặp: trình bày, thảo luận, đạt đồng thuận.' },
    ],
    scoring: 'Tính điểm theo phần viết và phần nói, cần đạt ngưỡng mỗi phần. Xem barem chi tiết tại telc.',
    modular: false,
    readiness: [
      { skill: 'Schreiben (Viết)', items: [
        'Viết văn bản B2 lập luận rõ ràng, dùng cấu trúc câu phức.',
        'Diễn đạt quan điểm, so sánh, nhượng bộ chính xác.',
      ] },
      { skill: 'Nói và Nghe (Sprechen, Hören)', items: [
        'Trình bày và phản biện một chủ đề; thương lượng đạt đồng thuận.',
        'Nghe hiểu nội dung dài, nắm chi tiết và hàm ý.',
      ] },
    ],
    studyTips: [
      'Nâng độ chính xác ngôn ngữ — ở B2, lỗi cấu trúc bị trừ điểm nặng hơn.',
      'Chấm bài viết định kỳ để theo dõi tiến bộ về độ phức tạp và độ chính xác.',
    ],
    faqs: [
      { q: 'telc B2 dùng cho điều dưỡng được không?', a: 'Một số chương trình điều dưỡng yêu cầu B2; ngoài ra có kỳ thi telc Deutsch B1·B2 Pflege chuyên ngành. Hãy kiểm tra yêu cầu cụ thể của nơi bạn nộp.' },
    ],
    officialUrl: 'https://www.telc.net/',
  },
  {
    slug: 'telc-pflege-b1-b2',
    provider: 'telc',
    level: 'B1·B2',
    name: 'telc Deutsch B1·B2 Pflege',
    shortName: 'telc Pflege',
    tagline: 'Tiếng Đức chuyên ngành điều dưỡng cho lộ trình sang Đức',
    metaTitle: 'Luyện thi telc Pflege B1·B2 (điều dưỡng): cấu trúc đề',
    metaDescription:
      'Luyện thi telc Deutsch B1·B2 Pflege, tiếng Đức cho điều dưỡng: chăm sóc, bàn giao ca, giao tiếp với bệnh nhân. Checklist ôn thi và chấm thử bài viết miễn phí.',
    overview:
      'telc Deutsch B1·B2 Pflege là kỳ thi tiếng Đức chuyên ngành điều dưỡng, kiểm tra năng lực ngôn ngữ trong bối cảnh chăm sóc: giao tiếp với bệnh nhân/người nhà, bàn giao ca, ghi chép chăm sóc. Đây là mốc quan trọng cho lộ trình điều dưỡng sang Đức.',
    whoFor: 'Điều dưỡng viên/học viên chuẩn bị làm việc trong ngành chăm sóc tại Đức.',
    modules: [
      // Thời lượng chưa đối chiếu được với telc (rà câu chữ 14/11/2026): không ghi số phút, trang dẫn sang telc.
      { skill: 'Schriftlich', name: 'Phần viết (nghe, đọc, viết)', description: 'Đọc và nghe tình huống chăm sóc, viết văn bản chuyên ngành (vd ghi chú bàn giao).' },
      { skill: 'Mündlich', name: 'Phần nói', description: 'Tình huống nói chuyên ngành: trao đổi với bệnh nhân, bàn giao ca, tư vấn.' },
    ],
    scoring: 'Một bài thi, kết quả xếp B1 hoặc B2 tuỳ điểm đạt được. Barem chi tiết xem ở trang chính thức của telc.',
    modular: false,
    readiness: [
      { skill: 'Từ vựng chuyên ngành', items: [
        'Thuộc từ vựng cơ thể, triệu chứng, thuốc, thiết bị chăm sóc cơ bản.',
        'Diễn đạt được quy trình chăm sóc và hướng dẫn bệnh nhân.',
      ] },
      { skill: 'Giao tiếp tại nơi làm', items: [
        'Bàn giao ca rõ ràng (tình trạng, việc đã làm, lưu ý).',
        'Trấn an và hỏi thông tin bệnh nhân lịch sự, đúng mực.',
      ] },
      { skill: 'Viết chuyên ngành', items: [
        'Viết ghi chú/bàn giao ngắn gọn, chính xác, đúng thuật ngữ.',
      ] },
    ],
    studyTips: [
      'Học từ vựng theo tình huống chăm sóc thực tế thay vì học rời rạc.',
      'Luyện viết ghi chú bàn giao và chấm để chuẩn hoá thuật ngữ chuyên ngành.',
      'Nắm vững B1–B2 tổng quát trước, rồi phủ lớp từ vựng Pflege lên trên.',
    ],
    faqs: [
      { q: 'telc Pflege khác telc B2 thường ở đâu?', a: 'telc B1·B2 Pflege tập trung vào tiếng Đức trong bối cảnh điều dưỡng (giao tiếp bệnh nhân, bàn giao ca, ghi chép chăm sóc) thay vì chủ đề tổng quát.' },
      { q: 'Cần học đến đâu trước khi thi Pflege?', a: 'Nên vững nền tảng B1–B2 tổng quát rồi bổ sung từ vựng và tình huống chuyên ngành điều dưỡng.' },
    ],
    officialUrl: 'https://www.telc.net/',
  },
]

export function getExamBySlug(slug: string): GermanExam | undefined {
  return GERMAN_EXAMS.find((e) => e.slug === slug)
}

/** Câu thay cho thời lượng khi kỳ thi chưa có số phút đối chiếu được. */
export const OFFICIAL_DURATION_NOTE = 'Xem thời lượng chính thức ở trang telc.'

/** Tổng số phút; `null` khi có phần thi chưa ghi thời lượng. */
export function totalDurationMin(exam: GermanExam): number | null {
  if (exam.modules.some((m) => m.durationMin === undefined)) return null
  return exam.modules.reduce((sum, m) => sum + (m.durationMin ?? 0), 0)
}
