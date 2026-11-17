/**
 * Bot AI (owner chốt 14/11/2026, theo đề xuất): CHO bot tìm kiếm và trích dẫn — trả lời câu hỏi
 * người dùng kèm link về site — đọc như mọi bot (vẫn chặn khu vực riêng tư); CHẶN bot thu dữ liệu để
 * huấn luyện mô hình. Danh sách tên bot theo tài liệu công khai của từng hãng; cần đối chiếu cài đặt
 * Cloudflare (AI Crawl Control) để hai lớp không mâu thuẫn.
 */
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User', 'Claude-SearchBot', 'Claude-User'] as const
/**
 * `Google-Extended` KHÔNG nằm trong danh sách chặn (owner chốt 18/11/2026): token này điều khiển cả việc
 * Gemini dùng nội dung để trả lời, chặn nó làm Gemini ít trích dẫn myDeutschFlow. Google Search và AI
 * Overviews vẫn do Googlebot (luật `*`).
 */
export const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Applebot-Extended', 'CCBot', 'Bytespider', 'meta-externalagent'] as const
