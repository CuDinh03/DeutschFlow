import Link from 'next/link'
import { GaCap, GaLogo, GaBtn } from '@/components/ui-v2'

/** /v2 index — entry into the Galerie 2.0 preview. */
export default function V2IndexPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <GaLogo />
      <div>
        <GaCap className="text-ga-accent">Galerie 2.0 · UI 2.0</GaCap>
        <h1 className="mt-2 font-ga-display text-[36px] font-medium leading-[1.15] tracking-[-0.015em] text-ga-ink">
          Bản nền tảng (Phase 1)
        </h1>
        <p className="ga-ui mt-2 text-[14.5px] text-ga-muted">
          Token + thư viện thành phần + shell vai trò, sau cờ <code>galerie-v2</code>. Bản UI cũ vẫn chạy.
        </p>
      </div>
      <div>
        <GaBtn asChild>
          <Link href="/v2/teacher">Mở proof Giáo viên →</Link>
        </GaBtn>
      </div>
    </div>
  )
}
