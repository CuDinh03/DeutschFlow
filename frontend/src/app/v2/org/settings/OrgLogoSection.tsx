'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { getOrgLogo, removeOrgLogo, uploadOrgLogo } from '@/lib/orgApi'
import { GaBtn, GaCap } from '@/components/ui-v2'
import { OrgWriteGate } from '../../OrgLicenseGate'

/**
 * Logo trung tâm in trên chứng nhận và phiếu đánh giá (đợt 4A A+B+E). Kiểm ở đây chỉ để báo sớm; máy
 * chủ tự kiểm chữ ký tệp và trần 1 MB. Giấy đã cấp giữ bản chụp logo lúc cấp nên đổi logo không đụng
 * tới chúng. URL trả về đã ký vì bucket private.
 */
const MAX_BYTES = 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

export function OrgLogoSection() {
  const t = useTranslations('v2.org.settings')
  const inputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    getOrgLogo()
      .then((url) => {
        if (!live) return
        setLogoUrl(url)
        setLoaded(true)
      })
      .catch((e: unknown) => {
        if (live) setLoadError(apiMessage(e))
      })
    return () => {
      live = false
    }
  }, [])

  const onPick = async (file: File | undefined): Promise<void> => {
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      toast.error(t('logoBadType'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('logoTooLarge'))
      return
    }
    setBusy(true)
    try {
      setLogoUrl(await uploadOrgLogo(file))
      toast.success(t('logoUploaded'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (): Promise<void> => {
    setBusy(true)
    try {
      await removeOrgLogo()
      setLogoUrl(null)
      toast.success(t('logoRemoved'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="border border-ga-line bg-ga-card p-4">
      <GaCap className="mb-2 block">{t('logoCap')}</GaCap>
      {loadError ? (
        <p className="m-0 text-ga-small text-ga-red">{loadError}</p>
      ) : (
        <>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={t('logoAlt')} className="mb-3 h-14 w-auto object-contain" />
          ) : loaded ? (
            <p className="m-0 mb-3 text-ga-small text-ga-muted">{t('logoEmpty')}</p>
          ) : null}
          <p className="ga-ui m-0 mb-3 text-ga-caption leading-[1.5] text-ga-muted">{t('logoHint')}</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            className="hidden"
            aria-label={t('logoChoose')}
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <div className="flex flex-wrap gap-2">
            <OrgWriteGate>
              <GaBtn variant="ghost" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
                {logoUrl ? t('logoReplace') : t('logoChoose')}
              </GaBtn>
            </OrgWriteGate>
            {logoUrl && (
              <OrgWriteGate>
                <GaBtn variant="ghost" size="sm" disabled={busy} onClick={() => void onRemove()}>
                  {t('logoRemove')}
                </GaBtn>
              </OrgWriteGate>
            )}
          </div>
        </>
      )}
    </section>
  )
}
