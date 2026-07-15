'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { TkSeg } from '@/components/ui-v2'

/**
 * Chuyển giữa hai trò chơi — ĐÂY LÀ ĐƯỜNG VÀO của /v2/student/game/lego.
 *
 * - `blank` → /v2/student/game      : điền chỗ trống, ngân hàng NGỮ PHÁP (grammar syllabus).
 * - `lego`  → /v2/student/game/lego : ghép câu, ngân hàng TỪ VỰNG (GET /words) — port của /game v1.
 *
 * Nav sidebar chỉ có một mục "Trò chơi"; switch này là tab giữa hai chế độ, nên không cần
 * thêm mục nav thứ hai.
 */
export type GameMode = 'blank' | 'lego'

const ROUTES: Record<GameMode, string> = {
  blank: '/v2/student/game',
  lego: '/v2/student/game/lego',
}

export function GameModeSwitch({ active }: { active: GameMode }) {
  const t = useTranslations('v2.student.game.modes')
  const router = useRouter()

  return (
    <TkSeg<GameMode>
      aria-label={t('label')}
      value={active}
      onValueChange={(mode) => {
        if (mode !== active) router.push(ROUTES[mode])
      }}
      options={[
        { value: 'blank', label: t('blank') },
        { value: 'lego', label: t('lego') },
      ]}
    />
  )
}
