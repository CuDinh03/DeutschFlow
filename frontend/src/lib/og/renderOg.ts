import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import type { ReactElement } from 'react'
import { OG_FONT_FILES } from '@/lib/og/ogCards'
import { OG_SIZE } from '@/lib/ogImage'

/**
 * Vẽ một mẫu ở `ogCards.tsx` thành PNG 1200×630. Font đọc bằng `process.cwd()`: dev chạy ở
 * `frontend/`, bản standalone (Docker) chạy ở thư mục có `public/` copy sang. Nạp một lần mỗi tiến trình.
 *
 * Lưu ý máy dev Windows: `next/og` 14.2 dựng sai đường dẫn tệp nội bộ của nó (`path.join` lên URL
 * `file://`) nên route này lỗi 500 khi chạy `next dev` trên Windows; Linux (production) không bị.
 */
type Fonts = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts']

let fontsPromise: Promise<Fonts> | null = null

function loadFonts(): Promise<Fonts> {
  fontsPromise ??= Promise.all(
    OG_FONT_FILES.map(async ([name, weight, style, file]) => ({
      name,
      weight,
      style,
      data: await readFile(join(process.cwd(), 'public', 'og-fonts', file)),
    })),
  ).catch((e) => {
    fontsPromise = null
    throw e
  })
  return fontsPromise
}

/** `maxAge` giây ở trình duyệt; Cloudflare giữ gấp 7 lần. */
export async function renderOg(node: ReactElement, maxAge = 86400) {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge * 7}, stale-while-revalidate=${maxAge}` },
  })
}
