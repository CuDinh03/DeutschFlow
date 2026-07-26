/**
 * Ghép transcript của mic vào ô nhập đang có (R-W8).
 *
 * Trước đây call-site làm `setInputText(text)` — transcript về MUỘN sẽ ghi đè thẳng lên câu người
 * dùng vừa gõ (hiện tượng "text cũ quay lại ô nhập" trong ảnh ④ đêm 23/07). Nguyên tắc §8.1.4 của
 * báo cáo: *draft của user là tài sản, không được xoá khi chưa có xác nhận* — nên ghép, không đè.
 */
export function mergeTranscriptIntoDraft(draft: string, transcript: string): string {
  const typed = draft.trim();
  const spoken = transcript.trim();
  if (!spoken) return draft;
  return typed ? `${typed} ${spoken}` : spoken;
}
