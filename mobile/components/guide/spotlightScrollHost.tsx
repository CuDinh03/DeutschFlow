// Cầu nối "màn nào chứa neo spotlight thì cuộn được tới neo đó".
//
// Screen (scroll) và các ScrollView tự dựng bọc nội dung bằng
// SpotlightScrollHostProvider với ref ScrollView của mình; useSpotlightTarget
// đọc ref ấy và đăng ký kèm neo, để SpotlightTourProvider cuộn neo vào tầm
// nhìn TRƯỚC khi đo ô khoét (lib/spotlightReveal). Trước 05/09, bước có neo
// nằm dưới màn (thẻ "Ôn tập hôm nay" của tour SRS bị thanh tab lấp) rơi về
// tooltip giữa màn — người dùng không biết bấm vào đâu.
//
// File riêng, không import gì từ components/ui hay SpotlightTour để
// Screen ↔ SpotlightTour không thành vòng import.

import { createContext, useContext, type RefObject } from 'react'
import type { ScrollView } from 'react-native'

export type SpotlightScrollHostRef = RefObject<ScrollView | null>

const SpotlightScrollHostCtx = createContext<SpotlightScrollHostRef | null>(null)

/** Bọc phần nội dung nằm trong một ScrollView; `value` = ref của ScrollView đó. */
export const SpotlightScrollHostProvider = SpotlightScrollHostCtx.Provider

/** ScrollView gần nhất bọc quanh; null = neo không nằm trong vùng cuộn (vd tab bar). */
export function useSpotlightScrollHost(): SpotlightScrollHostRef | null {
  return useContext(SpotlightScrollHostCtx)
}
