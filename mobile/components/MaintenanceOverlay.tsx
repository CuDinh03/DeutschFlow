// Màn chặn toàn app khi hệ thống bảo trì (thiết kế §8). Render như MỘT sibling
// absolute-fill ở root layout (giống SplashAnimated) — KHÔNG phải route, KHÔNG
// router.replace (footgun crash root layout đã ghi tại app/_layout.tsx).
//
// Brand-locked (tự mang màu, không phụ thuộc ThemeProvider) để chạy đúng kể cả
// khi mount ngoài cây provider. Hồi phục = TỰ HẠ MÀN, không ép reload/điều hướng.

import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { fonts } from '@/lib/theme/tokens'
import { useMaintenanceStore } from '@/stores/useMaintenanceStore'

const YELLOW = '#FFCD00'
const INK = '#211B0C'
const PAPER = '#FAF7EF'
const GOLD = '#8A6C00'
const GOLD_SOFT = '#FFF3BF'
const MUTED = '#6A6149'
const SUBTLE = '#9A9078'
const LINE = '#E6DFC9'

const POLL_MS = 30_000
const TICK_MS = 15_000

function formatVn(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const sameDay = new Date().toDateString() === d.toDateString()
  return sameDay
    ? `${hh}:${mm}`
    : `${hh}:${mm} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function MaintenanceOverlay() {
  const active = useMaintenanceStore((s) => s.active)
  const info = useMaintenanceStore((s) => s.info)
  const clockSkewMs = useMaintenanceStore((s) => s.clockSkewMs)
  const refresh = useMaintenanceStore((s) => s.refresh)
  const [checking, setChecking] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const poll = setInterval(() => void refresh(), POLL_MS)
    const tick = setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [active, refresh])

  if (!active) return null

  const check = async () => {
    setChecking(true)
    try {
      await refresh()
    } finally {
      setChecking(false)
    }
  }

  const endsAt = info?.endsAtUtc ? Date.parse(info.endsAtUtc) : NaN
  const serverNow = Date.now() + clockSkewMs
  const remainingMin = Number.isFinite(endsAt) ? Math.ceil((endsAt - serverNow) / 60_000) : null

  return (
    <View style={styles.root} pointerEvents="auto">
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🔧</Text>
        </View>
        <Text style={styles.title}>{info?.title || 'Hệ thống đang bảo trì'}</Text>
        {/* Sản phẩm dạy tiếng Đức — giữ một câu Đức làm giọng, mọi ngôn ngữ. */}
        <Text style={styles.de}>Wir sind gleich zurück!</Text>
        <Text style={styles.note}>
          {info?.note || 'Chúng tôi đang nâng cấp hệ thống — bài học và tiến độ của bạn được giữ nguyên.'}
        </Text>

        <View style={styles.eta}>
          {info?.endsAtUtc ? (
            <>
              <Text style={styles.etaTime}>{formatVn(info.endsAtUtc)}</Text>
              <Text style={styles.etaLabel}>
                {remainingMin !== null && remainingMin > 0
                  ? `dự kiến xong · còn ${remainingMin} phút`
                  : 'đang hoàn tất, chờ thêm chút nữa…'}
              </Text>
            </>
          ) : (
            <Text style={styles.etaLabel}>Sẽ thông báo ngay khi hệ thống hoạt động trở lại.</Text>
          )}
        </View>

        <Pressable style={styles.button} onPress={() => void check()} disabled={checking}>
          {checking ? (
            <ActivityIndicator color={PAPER} />
          ) : (
            <Text style={styles.buttonText}>Thử lại ngay</Text>
          )}
        </Pressable>
        <Text style={styles.auto}>tự kiểm tra lại sau 30 giây</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 900,
    backgroundColor: PAPER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: { alignItems: 'center', maxWidth: 400 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: GOLD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconText: { fontSize: 26 },
  title: { fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 29, color: INK, textAlign: 'center' },
  de: { fontFamily: fonts.bodySemi, fontSize: 13, color: GOLD, marginTop: 4 },
  note: { fontFamily: fonts.bodyRegular, fontSize: 14.5, lineHeight: 21, color: MUTED, textAlign: 'center', marginTop: 12 },
  eta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  etaTime: { fontFamily: fonts.monoBold, fontSize: 17, color: INK, fontVariant: ['tabular-nums'] },
  etaLabel: { fontFamily: fonts.bodyRegular, fontSize: 12.5, color: MUTED },
  button: {
    marginTop: 24,
    backgroundColor: INK,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 13,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: { fontFamily: fonts.bodySemi, fontSize: 15, color: PAPER },
  auto: { fontFamily: fonts.bodyRegular, fontSize: 12, color: SUBTLE, marginTop: 10 },
})
