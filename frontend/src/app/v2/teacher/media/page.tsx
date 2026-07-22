'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, ExternalLink, Pencil, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { deleteMedia, listMedia, updateMediaMetadata, uploadMedia, type MediaAsset } from '@/lib/mediaApi'
import { GaBtn, GaPageHdr, LoadingState, EmptyState, TkModal, TkSearch, TkSeg } from '@/components/ui-v2'
import { GaSection } from '../../analyticsShared'

// Port 1:1 của /teacher/media (v1) sang vỏ Galerie. Cùng plumbing, cùng ràng buộc backend:
//   • GET  /api/v2/media          → teacher CHỈ thấy ảnh do chính mình upload (MediaAssetService.listForTeacher)
//   • POST /api/v2/media/upload   → teacher chỉ được upload category TEACHER_MATERIAL | ASSIGNMENT |
//                                   AVATAR | GENERAL (MediaCategory.TEACHER_UPLOAD); v1 chỉ mở 2 loại đầu → giữ nguyên
//   • DELETE/PATCH /api/v2/media/{id} → chỉ uploader (hoặc ADMIN) được sửa/xoá
// Giới hạn upload (image/* + 5MB) trùng khớp validate phía backend (MediaAssetService.uploadMedia).

const PAGE_SIZE = 16
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

// Phải khớp ĐÚNG MediaAssetService.ALLOWED_CONTENT_TYPES ở backend. image/svg+xml bị loại có chủ
// đích (audit SEC-9: SVG nhúng <script> → stored XSS trên bucket public-read). v1 chỉ kiểm
// `startsWith('image/')` nên SVG lọt qua client rồi ăn 400 kèm thông báo tiếng Anh thô từ server —
// chặn tại đây để báo lỗi đúng ngôn ngữ và không tốn một vòng upload.
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
const ACCEPT_ATTR = ALLOWED_MIME.join(',')

type TabId = 'TEACHER_MATERIAL' | 'ASSIGNMENT' | 'ALL'

export default function V2TeacherMediaPage() {
  const t = useTranslations('v2.teacher.media')
  const tc = useTranslations('v2.common')

  const [activeCategory, setActiveCategory] = useState<TabId>('TEACHER_MATERIAL')
  const [mediaList, setMediaList] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Sửa metadata (tag + altText)
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null)
  const [editAltText, setEditAltText] = useState('')
  const [editTag, setEditTag] = useState('')
  const [updating, setUpdating] = useState(false)

  // Form upload
  const [uploadCategory, setUploadCategory] = useState('TEACHER_MATERIAL')
  const [uploadTag, setUploadTag] = useState('')
  const [uploadAlt, setUploadAlt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(
    async (category: string, page: number) => {
      setLoading(true)
      try {
        const res = await listMedia(category, page, PAGE_SIZE)
        setMediaList(res.content)
        setTotalPages(res.totalPages)
      } catch (err: unknown) {
        toast.error(apiMessage(err) || t('loadError'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void fetchMedia(activeCategory, currentPage)
  }, [activeCategory, currentPage, fetchMedia])

  const handleCategoryChange = (cat: TabId) => {
    setActiveCategory(cat)
    setCurrentPage(0)
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const pickFile = (selected: File) => {
    if (!ALLOWED_MIME.includes(selected.type.toLowerCase())) {
      toast.error(t('invalidType'))
      return
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error(t('maxSize'))
      return
    }
    // Object URL tạo MỘT lần khi chọn file (không tạo trong render) và luôn revoke khi bỏ chọn —
    // tạo trong JSX sẽ rò một blob URL mới mỗi lần component re-render.
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(selected)
    })
    setFile(selected)
  }

  const resetUploadForm = () => {
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setUploadTag('')
    setUploadAlt('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const asset = await uploadMedia(file, uploadCategory, uploadTag, uploadAlt)
      // Chèn vào đầu list và cắt về đúng PAGE_SIZE — ảnh mới nhất nằm trang 0 (sort createdAt DESC).
      setMediaList((prev) => [asset, ...prev].slice(0, PAGE_SIZE))
      toast.success(t('uploadSuccess'))
      resetUploadForm()
    } catch (err: unknown) {
      toast.error(apiMessage(err) || t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  // ── Xoá / sửa ─────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (deleteConfirmId == null) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    try {
      await deleteMedia(id)
      toast.success(t('deleteSuccess'))
      setMediaList((prev) => prev.filter((item) => item.id !== id))
    } catch (err: unknown) {
      toast.error(apiMessage(err) || t('deleteError'))
    }
  }

  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset)
    setEditAltText(asset.altText || '')
    setEditTag(asset.tag || '')
  }

  const handleUpdateMetadata = async () => {
    if (!editingAsset) return
    setUpdating(true)
    try {
      const updated = await updateMediaMetadata(editingAsset.id, editAltText, editTag)
      setMediaList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(t('updateSuccess'))
      setEditingAsset(null)
    } catch (err: unknown) {
      toast.error(apiMessage(err) || t('updateError'))
    } finally {
      setUpdating(false)
    }
  }

  const handleCopyUrl = (url: string, id: number) => {
    void navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success(t('copySuccess'))
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Lọc client-side trên trang hiện tại (giống v1) — backend chưa có full-text search cho media.
  const filteredList = mediaList.filter((item) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query) return true
    return (
      item.originalName.toLowerCase().includes(query) ||
      (item.tag && item.tag.toLowerCase().includes(query)) ||
      (item.altText && item.altText.toLowerCase().includes(query)) ||
      item.s3Key.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <GaSection title={t('uploadSection')} className="mb-[22px]">
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('categoryLabel')}
                </span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] font-semibold text-ga-ink"
                >
                  <option value="TEACHER_MATERIAL">{t('catTeacherMaterial')}</option>
                  <option value="ASSIGNMENT">{t('catAssignment')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('tagLabel')}
                </span>
                <input
                  value={uploadTag}
                  onChange={(e) => setUploadTag(e.target.value)}
                  placeholder={t('tagPlaceholder')}
                  className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] text-ga-ink"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                  {t('altLabel')}
                </span>
                <input
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  placeholder={t('altPlaceholder')}
                  className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] text-ga-ink"
                />
              </label>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_ATTR}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const picked = e.target.files?.[0]
                  if (picked) pickFile(picked)
                }}
              />

              {!file ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                    const dropped = e.dataTransfer.files?.[0]
                    if (dropped) pickFile(dropped)
                  }}
                  className="flex h-full min-h-[168px] w-full flex-col items-center justify-center gap-2 rounded-ga border border-dashed px-6 py-8 text-center transition-colors"
                  style={{
                    borderColor: dragActive ? 'var(--ga-accent)' : 'var(--ga-line)',
                    background: dragActive ? 'var(--ga-accent-soft)' : 'var(--ga-surface)',
                  }}
                >
                  <UploadCloud size={22} className="text-ga-accent" aria-hidden />
                  <span className="ga-ui text-[13.5px] font-semibold text-ga-ink">{t('dropHint')}</span>
                  <span className="ga-ui text-[12px] text-ga-muted">{t('dropFormats')}</span>
                </button>
              ) : (
                <div className="flex h-full min-h-[168px] flex-col justify-between rounded-ga border border-ga-line bg-ga-surface p-4">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl ?? ''}
                      alt={file.name}
                      className="h-[72px] w-[72px] shrink-0 border border-ga-line object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="ga-ui truncate text-[13.5px] font-semibold text-ga-ink" title={file.name}>
                        {file.name}
                      </p>
                      <p className="ga-ui mt-0.5 text-[12px] text-ga-muted">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetUploadForm}
                      disabled={uploading}
                      aria-label={tc('cancel')}
                      className="grid h-10 w-10 shrink-0 place-items-center text-ga-subtle transition-colors hover:text-ga-ink lg:h-7 lg:w-7"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <GaBtn variant="yellow" loading={uploading} disabled={uploading} onClick={handleUpload}>
                      {uploading ? t('uploading') : t('uploadBtn')}
                    </GaBtn>
                    <GaBtn variant="ghost" disabled={uploading} onClick={resetUploadForm}>
                      {tc('cancel')}
                    </GaBtn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GaSection>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <TkSearch
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="max-w-sm"
          />
          <TkSeg<TabId>
            aria-label={t('categoryLabel')}
            value={activeCategory}
            onValueChange={handleCategoryChange}
            options={[
              { value: 'TEACHER_MATERIAL', label: t('catTeacherMaterial') },
              { value: 'ASSIGNMENT', label: t('catAssignment') },
              { value: 'ALL', label: t('catAll') },
            ]}
          />
        </div>

        {loading ? (
          <LoadingState label={t('loading')} />
        ) : filteredList.length === 0 ? (
          <EmptyState variant="invite" icon="photo_library" title={t('emptyTitle')} description={t('emptyHint')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredList.map((item) => (
              <div key={item.id} className="flex flex-col overflow-hidden border border-ga-line bg-ga-card">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.altText || item.originalName}
                    className="h-[132px] w-full bg-ga-surface object-cover"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 bg-ga-ink px-1.5 py-[3px] text-[9.5px] font-bold uppercase tracking-[0.06em] text-ga-bg">
                    {item.category === 'ASSIGNMENT' ? t('catAssignmentShort') : t('catMaterialShort')}
                  </span>
                  {item.tag && (
                    <span
                      className="absolute right-2 top-2 px-1.5 py-[3px] text-[9.5px] font-bold"
                      style={{ background: 'var(--ga-yellow)', color: 'var(--ga-ink)' }}
                    >
                      #{item.tag}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="ga-ui truncate text-[12.5px] font-semibold text-ga-ink" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-ga-subtle" title={item.s3Key}>
                      {t('keyPrefix')} {item.s3Key}
                    </p>
                    {item.altText && (
                      <p className="ga-ui mt-1 truncate text-[11.5px] italic text-ga-muted">{item.altText}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-ga-line pt-2">
                    <span className="ga-ui text-[10.5px] font-semibold text-ga-subtle">
                      {(item.fileSize / 1024).toFixed(0)} KB
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.url, item.id)}
                        title={t('copyUrl')}
                        aria-label={t('copyUrl')}
                        className="grid h-10 w-10 place-items-center text-ga-subtle transition-colors hover:text-ga-ink lg:h-7 lg:w-7"
                      >
                        {copiedId === item.id ? (
                          <Check size={14} className="text-ga-green" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        title={t('edit')}
                        aria-label={t('edit')}
                        className="grid h-10 w-10 place-items-center text-ga-subtle transition-colors hover:text-ga-ink lg:h-7 lg:w-7"
                      >
                        <Pencil size={14} />
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        title={t('viewOriginal')}
                        aria-label={t('viewOriginal')}
                        className="grid h-10 w-10 place-items-center text-ga-subtle transition-colors hover:text-ga-ink lg:h-7 lg:w-7"
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        title={t('delete')}
                        aria-label={t('delete')}
                        className="grid h-10 w-10 place-items-center text-ga-subtle transition-colors hover:text-ga-red lg:h-7 lg:w-7"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <GaBtn
              variant="ghost"
              size="sm"
              disabled={currentPage === 0 || loading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              {t('pagePrev')}
            </GaBtn>
            <span className="ga-ui text-[12.5px] font-semibold text-ga-muted">
              {t('pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <GaBtn
              variant="ghost"
              size="sm"
              disabled={currentPage >= totalPages - 1 || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              {t('pageNext')}
            </GaBtn>
          </div>
        )}
      </div>

      <TkModal
        open={deleteConfirmId != null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        size="sm"
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirm')}
        footer={
          <>
            <GaBtn variant="ghost" onClick={() => setDeleteConfirmId(null)}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn variant="primary" onClick={confirmDelete}>
              {t('delete')}
            </GaBtn>
          </>
        }
      >
        <p className="ga-ui text-[13.5px] text-ga-muted">{t('deleteIrreversible')}</p>
      </TkModal>

      <TkModal
        open={editingAsset != null}
        onOpenChange={(open) => !open && setEditingAsset(null)}
        size="sm"
        title={t('editTitle')}
        footer={
          <>
            <GaBtn variant="ghost" disabled={updating} onClick={() => setEditingAsset(null)}>
              {tc('cancel')}
            </GaBtn>
            <GaBtn variant="yellow" loading={updating} disabled={updating} onClick={handleUpdateMetadata}>
              {updating ? t('saving') : tc('save')}
            </GaBtn>
          </>
        }
      >
        {editingAsset && (
          <div className="flex flex-col gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={editingAsset.url}
              alt={editingAsset.originalName}
              className="max-h-[220px] w-full border border-ga-line bg-ga-surface object-contain"
            />
            <label className="flex flex-col gap-1.5">
              <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                {t('tagLabel')}
              </span>
              <input
                value={editTag}
                onChange={(e) => setEditTag(e.target.value)}
                placeholder={t('tagPlaceholder')}
                className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] text-ga-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-ga-muted">
                {t('altLabel')}
              </span>
              <input
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                placeholder={t('altPlaceholder')}
                className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[13.5px] text-ga-ink"
              />
            </label>
          </div>
        )}
      </TkModal>
    </div>
  )
}
