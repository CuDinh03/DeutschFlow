/**
 * emojiIconMap — bảng tra emoji → tên icon của `GaIcon`.
 *
 * VÌ SAO CẦN: `skill_tree_nodes.emoji` là cột dữ liệu (VARCHAR(10), mặc định '📖') do các
 * migration nội dung ghi, và nó chảy ra tận UI qua `RoadmapNodeDto.emoji` → thẻ node lộ trình,
 * header trang Học và trang Luyện tập. Không thể bỏ emoji ở đó bằng cách sửa JSX: phải dịch
 * giá trị dữ liệu sang icon ngay tại frontend. Làm ở đây thay vì thêm cột `icon` cho backend
 * để không phải Flyway + deploy BE mới thấy hiệu lực, và để node nội dung mới vẫn chạy được
 * ngay (rơi về `fallback`).
 *
 * Khoá là emoji ĐÃ bỏ variation selector (U+FE0F/U+FE0E) — '🗣️' và '🗣' cùng trỏ một chỗ.
 * Giá trị phải là một khoá CÓ THẬT trong `ICONS` của `GaIcon.tsx`, nếu không icon rơi về
 * vòng tròn rỗng — trông như lỗi tải chứ không như thiết kế.
 */

/** Bỏ variation selector để '🗣️' (có U+FE0F) và '🗣' cùng khớp một khoá. */
function normalize(emoji: string): string {
  return emoji.replace(/[\uFE0E\uFE0F]/g, '').trim()
}

export const EMOJI_ICON: Record<string, string> = {
  // Ngôn ngữ & kỹ năng
  '🔤': 'alphabet',
  '🔢': 'numbers',
  '📖': 'menu_book',
  '📚': 'library_books',
  '📕': 'library_books',
  '📗': 'library_books',
  '📘': 'library_books',
  '📙': 'library_books',
  '📝': 'draw',
  '✏️': 'edit',
  '✍️': 'draw',
  '🎧': 'headphones',
  '🎤': 'mic',
  '🎙️': 'mic',
  '🗣️': 'record_voice_over',
  '💬': 'forum',
  '🔊': 'volume_up',
  '📜': 'description',
  '📋': 'assignment',
  '📰': 'newspaper',
  '❓': 'help',
  '🔍': 'search',
  '📏': 'straighten',
  '📐': 'straighten',
  '🔗': 'link',

  // Chủ đề đời sống
  '👋': 'waving_hand',
  '🙋': 'waving_hand',
  '🤝': 'handshake',
  '🙏': 'volunteer_activism',
  '👤': 'person',
  '🏠': 'home',
  '🏫': 'school',
  '🎓': 'school',
  '🏢': 'corporate_fare',
  '🏛️': 'account_balance',
  '🗓️': 'calendar_month',
  '📅': 'calendar_month',
  '🕐': 'schedule',
  '📍': 'place',
  '📞': 'call',
  '✉️': 'mail',
  '🌍': 'public',
  '✈️': 'flight',
  '🚌': 'directions_bus',
  '🚦': 'signpost',
  '🚫': 'block',
  '🌤️': 'partly_cloudy',
  '☀️': 'sunny',
  '🌅': 'sunrise',
  '🎨': 'palette',
  '🎭': 'theater_comedy',
  '⚽': 'sports_soccer',
  '🎁': 'gift',
  '☕': 'coffee',

  // Nghề nghiệp & ngành
  '💼': 'work',
  '💻': 'computer',
  '🖥️': 'computer',
  '🔧': 'build',
  '🛠️': 'build',
  '⚙️': 'build',
  '🛒': 'shopping_cart',
  '🛍️': 'shopping_bag',
  '🍽️': 'restaurant',
  '👨‍🍳': 'chef',
  '🍞': 'bakery',
  '🥐': 'bakery',
  '🥨': 'bakery',
  '🏥': 'stethoscope',
  '🩺': 'stethoscope',
  '💊': 'medication',
  '❤️‍🩹': 'healing',
  '🩹': 'healing',
  '👁️': 'visibility',
  '👕': 'apparel',
  '🛋️': 'chair',
  '✂️': 'content_cut',
  '🏨': 'hotel',

  // Tiến độ, thành tích, trạng thái
  '🏆': 'emoji_events',
  '🏅': 'military_tech',
  '👑': 'crown',
  '💎': 'diamond',
  '🌟': 'star',
  '⭐': 'star',
  '🎯': 'target',
  '🏁': 'flag',
  '⚡': 'bolt',
  '🔥': 'local_fire_department',
  '🚀': 'rocket',
  '💪': 'fitness',
  '🧠': 'psychology',
  '🧩': 'extension',
  '🧱': 'blocks',
  '🌱': 'eco',
  '🌿': 'eco',
  '♻️': 'refresh',
  '🔄': 'refresh',
  '✨': 'auto_awesome',
  '💡': 'lightbulb',
  '🎉': 'celebration',
  '✅': 'check_circle',
  '❌': 'cancel',
  '⚠️': 'warning',
  '👍': 'thumb_up',
  '🔒': 'lock',
  '🔓': 'lock_open',
  '💾': 'save',
  '🤖': 'smart_toy',
  '💯': 'percent',
  '📈': 'trending_up',
  '🔱': 'auto_awesome',
  // Ba chấm màu chỉ trạng thái trong nội dung: đổi màu sang HÌNH, vì icon một màu thì
  // xanh/đỏ/lam thành ba vòng tròn giống hệt nhau.
  '🔵': 'info',
  '🔴': 'cancel',
  '🟢': 'check_circle',
  '📣': 'campaign',
}

/**
 * Khoá đã chuẩn hoá. PHẢI chuẩn hoá cả hai phía: nhiều khoá trong `EMOJI_ICON` được viết kèm
 * variation selector ('🗣️', '🍽️'), nên chỉ chuẩn hoá đầu vào thì '🗣' vẫn trượt.
 */
const NORMALIZED: Record<string, string> = Object.fromEntries(
  Object.entries(EMOJI_ICON).map(([emoji, name]) => [normalize(emoji), name]),
)

/**
 * Tên icon cho một emoji dữ liệu. Node nội dung mới chưa có trong bảng vẫn ra icon hợp lệ
 * (mặc định `menu_book`, khớp DEFAULT '📖' của cột) chứ không phải vòng tròn rỗng.
 */
export function iconNameForEmoji(emoji: string | null | undefined, fallback = 'menu_book'): string {
  if (!emoji) return fallback
  return NORMALIZED[normalize(emoji)] ?? fallback
}
