'use client'

import React, { useState, useEffect } from 'react'
import {
  Image as ImageIcon,
  Copy,
  Trash2,
  Edit2,
  Calendar,
  Grid,
  List as ListIcon,
  Search,
  ExternalLink,
  Loader2,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import AdminShell from '@/components/admin/AdminShell'
import { ImageUploader } from '@/components/ui/ImageUploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { listMedia, deleteMedia, updateMediaMetadata, MediaAsset } from '@/lib/mediaApi'
import { useTranslations } from 'next-intl'

const CATEGORY_KEYS = [
  { value: 'ALL', labelKey: 'categoryAll' },
  { value: 'LANDING', labelKey: 'categoryLanding' },
  { value: 'LESSON', labelKey: 'categoryLesson' },
  { value: 'PERSONA', labelKey: 'categoryPersona' },
  { value: 'ACHIEVEMENT', labelKey: 'categoryAchievement' },
  { value: 'NEWS', labelKey: 'categoryNews' },
  { value: 'TEACHER_MATERIAL', labelKey: 'categoryTeacherMaterial' },
  { value: 'ASSIGNMENT', labelKey: 'categoryAssignment' },
  { value: 'AVATAR', labelKey: 'categoryAvatar' },
  { value: 'GENERAL', labelKey: 'categoryGeneral' },
] as const

export default function AdminMediaPage() {
  const t = useTranslations('media')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [mediaList, setMediaList] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  
  // Edit dialog state
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null)
  const [editAltText, setEditAltText] = useState('')
  const [editTag, setEditTag] = useState('')
  const [updating, setUpdating] = useState(false)

  // Upload custom config state
  const [uploadCategory, setUploadCategory] = useState('LANDING')
  const [uploadTag, setUploadTag] = useState('')
  const [uploadAlt, setUploadAlt] = useState('')

  const fetchMedia = async (category: string, page: number) => {
    setLoading(true)
    try {
      const res = await listMedia(category, page, 16)
      setMediaList(res.content)
      setTotalPages(res.totalPages)
    } catch (err: any) {
      console.error(err)
      toast.error(t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMedia(activeCategory, currentPage)
  }, [activeCategory, currentPage])

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat)
    setCurrentPage(0)
  }

  const confirmDelete = async () => {
    if (deleteConfirmId == null) return
    const id = deleteConfirmId
    setDeleteConfirmId(null)
    try {
      await deleteMedia(id)
      toast.success(t('deleteSuccess'))
      setMediaList((prev) => prev.filter((item) => item.id !== id))
    } catch (err: unknown) {
      toast.error(t('deleteError'))
    }
  }

  const handleCopyUrl = (url: string, id: number) => {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success(t('copySuccess'))
    setTimeout(() => setCopiedId(null), 2000)
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
    } catch (err: any) {
      console.error(err)
      toast.error(t('updateError'))
    } finally {
      setUpdating(false)
    }
  }

  const handleUploadSuccess = (newAsset: MediaAsset) => {
    setMediaList((prev) => [newAsset, ...prev].slice(0, 16))
    // Clear tags
    setUploadTag('')
    setUploadAlt('')
  }

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
    <AdminShell
      title={t('adminTitle')}
      subtitle={t('adminSubtitle')}
      activeNav="media"
    >
      <div className="space-y-6">
        {/* Upload block */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ImageIcon size={18} className="text-blue-500" />
            {t('uploadNewTitle')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  {t('categoryLabel')}
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {CATEGORY_KEYS.filter((c) => c.value !== 'ALL').map((c) => (
                    <option key={c.value} value={c.value}>
                      {t(c.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                    {t('tagLabel')}
                  </label>
                  <Input
                    placeholder={t('tagPlaceholder')}
                    value={uploadTag}
                    onChange={(e) => setUploadTag(e.target.value)}
                    className="bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                    {t('altLabel')}
                  </label>
                  <Input
                    placeholder={t('altPlaceholder')}
                    value={uploadAlt}
                    onChange={(e) => setUploadAlt(e.target.value)}
                    className="bg-gray-50 border-gray-200 focus:bg-white transition-all rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <ImageUploader
                category={uploadCategory}
                tag={uploadTag}
                altText={uploadAlt}
                onUploadSuccess={handleUploadSuccess}
              />
            </div>
          </div>
        </div>

        {/* Gallery Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200 rounded-xl"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto py-1 scrollbar-none shrink-0">
            {CATEGORY_KEYS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                  activeCategory === cat.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Media Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <p className="text-sm font-medium">{t('loadingGallery')}</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <ImageIcon size={48} className="text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-700">{t('emptyTitle')}</h3>
            <p className="text-xs text-gray-400 mt-1">{t('emptyHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredList.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                {/* Image Preview Box */}
                <div className="aspect-video relative bg-gray-50 border-b border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={item.url}
                    alt={item.altText || item.originalName}
                    className="max-h-full max-w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {item.category}
                  </span>
                  
                  {item.tag && (
                    <span className="absolute top-2 right-2 bg-blue-600/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                      #{item.tag}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-800 truncate" title={item.originalName}>
                      {item.originalName}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate" title={item.s3Key}>
                      {t('keyPrefix')} {item.s3Key}
                    </p>
                    {item.altText && (
                      <p className="text-xs text-gray-500 italic truncate mt-1">
                        &ldquo;{item.altText}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 mt-4 pt-3 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-semibold">
                      {(item.fileSize / 1024).toFixed(0)} KB
                    </span>

                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCopyUrl(item.url, item.id)}
                        className="h-8 w-8 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title={t('copyUrl')}
                      >
                        {copiedId === item.id ? (
                          <Check className="h-4 w-4 text-green-500 animate-pulse" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditModal(item)}
                        className="h-8 w-8 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title={t('edit')}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors"
                        title={t('viewOriginal')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-400 transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0 || loading}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="rounded-xl"
            >
              {t('pagePrev')}
            </Button>
            <span className="text-xs text-gray-500 font-bold">
              {t('pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1 || loading}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="rounded-xl"
            >
              {t('pageNext')}
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmId != null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Metadata Modal */}
      <Dialog open={!!editingAsset} onOpenChange={(open) => !open && setEditingAsset(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Edit2 size={18} className="text-blue-500" />
              {t('editDialogTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">Chỉnh sửa thông tin tài nguyên media</DialogDescription>
          </DialogHeader>
          {editingAsset && (
            <div className="space-y-4 py-4">
              <div className="aspect-video bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
                <img
                  src={editingAsset.url}
                  alt={editingAsset.originalName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  {t('tagLabel')}
                </label>
                <Input
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  placeholder={t('tagEditPlaceholder')}
                  className="rounded-xl border-gray-200 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  {t('altLabel')}
                </label>
                <Input
                  value={editAltText}
                  onChange={(e) => setEditAltText(e.target.value)}
                  placeholder={t('altEditPlaceholder')}
                  className="rounded-xl border-gray-200 focus:bg-white"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAsset(null)}
                  disabled={updating}
                  className="rounded-xl"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={handleUpdateMetadata}
                  disabled={updating}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  {updating ? t('saving') : t('saveChanges')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
