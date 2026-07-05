// ─────────────────────────────────────────────────────────────────────────────
// Chia làn (lane) cho các buổi trùng giờ trong MỘT cột ngày của lưới lịch tuần.
// Nếu hai buổi chồng thời gian, chúng phải nằm cạnh nhau (mỗi buổi chiếm 1 phần
// bề rộng cột) thay vì đè lên nhau. Hàm thuần, không phụ thuộc React → test được.
//
// Thuật toán = tô màu đồ thị khoảng (interval-graph greedy colouring):
//   1. Sắp theo giờ bắt đầu (rồi giờ kết thúc, rồi thứ tự gốc cho ổn định).
//   2. Gán mỗi buổi vào làn rảnh có chỉ số nhỏ nhất (làn mà buổi cuối đã kết thúc
//      trước khi buổi này bắt đầu) — không có thì mở làn mới.
//   3. Quét thành từng "cụm" chồng lấn liên thông; số làn của cụm = làn lớn nhất
//      trong cụm + 1. Mọi buổi trong cụm chia đều bề rộng theo số làn đó.
// ─────────────────────────────────────────────────────────────────────────────

export interface LaneResult<T> {
  /** Phần tử gốc. */
  item: T
  /** Chỉ số làn (0-based) của buổi trong cụm. */
  lane: number
  /** Tổng số làn của cụm chứa buổi này (mẫu số để chia bề rộng cột). */
  lanes: number
}

/**
 * Gán làn cho danh sách buổi để buổi trùng giờ nằm cạnh nhau.
 * @param items    Danh sách buổi (bất kỳ shape nào).
 * @param getStart Mốc bắt đầu (đơn vị tuỳ ý, thường là phút trong ngày).
 * @param getEnd   Mốc kết thúc; buổi kết thúc đúng lúc buổi khác bắt đầu KHÔNG tính là chồng.
 * @returns Mỗi buổi kèm { lane, lanes }; thứ tự trả về đã sắp theo giờ bắt đầu.
 */
export function assignLanes<T>(
  items: readonly T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
): LaneResult<T>[] {
  const placed = items
    .map((item, idx) => ({ item, idx, start: getStart(item), end: getEnd(item), lane: 0, lanes: 1 }))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.idx - b.idx)

  // Bước 2: gán làn tham lam. laneEnds[i] = giờ kết thúc của buổi cuối trên làn i.
  const laneEnds: number[] = []
  for (const e of placed) {
    let lane = laneEnds.findIndex((end) => end <= e.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(e.end)
    } else {
      laneEnds[lane] = e.end
    }
    e.lane = lane
  }

  // Bước 3: gán số làn của từng cụm chồng lấn liên thông.
  const finalizeCluster = (from: number, to: number): void => {
    let maxLane = 0
    for (let i = from; i < to; i++) maxLane = Math.max(maxLane, placed[i].lane)
    const lanes = maxLane + 1
    for (let i = from; i < to; i++) placed[i].lanes = lanes
  }

  let clusterStart = 0
  let clusterMaxEnd = -Infinity
  for (let i = 0; i < placed.length; i++) {
    const e = placed[i]
    // Buổi bắt đầu sau khi cụm hiện tại đã đóng hẳn → chốt cụm cũ, mở cụm mới.
    if (i > clusterStart && e.start >= clusterMaxEnd) {
      finalizeCluster(clusterStart, i)
      clusterStart = i
      clusterMaxEnd = -Infinity
    }
    clusterMaxEnd = Math.max(clusterMaxEnd, e.end)
  }
  finalizeCluster(clusterStart, placed.length)

  return placed.map(({ item, lane, lanes }) => ({ item, lane, lanes }))
}
