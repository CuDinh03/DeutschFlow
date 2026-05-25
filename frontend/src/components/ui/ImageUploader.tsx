'use client'

import React, { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { UploadCloud, CheckCircle2, Loader2, X } from 'lucide-react'
import { uploadMedia, MediaAsset } from '@/lib/mediaApi'
import { toast } from 'sonner'
import { Button } from './button'

interface ImageUploaderProps {
  category: string
  tag?: string
  altText?: string
  onUploadSuccess?: (asset: MediaAsset) => void
  onUploadError?: (error: unknown) => void
  className?: string
}

export function ImageUploader({
  category,
  tag = '',
  altText = '',
  onUploadSuccess,
  onUploadError,
  className = '',
}: ImageUploaderProps) {
  const t = useTranslations('media')
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedAsset, setUploadedAsset] = useState<MediaAsset | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast.error(t('uploaderInvalidType'))
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error(t('uploaderMaxSize'))
      return
    }

    setFile(selectedFile)
    setUploadedAsset(null)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)

    try {
      const asset = await uploadMedia(file, category, tag, altText)
      setUploadedAsset(asset)
      toast.success(t('uploaderSuccessToast'))
      if (onUploadSuccess) onUploadSuccess(asset)
      resetState(false)
    } catch (err: unknown) {
      console.error(err)
      const errMsg =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
          ? String((err.response.data as { message?: string }).message)
          : t('uploaderErrorDefault')
      toast.error(errMsg)
      if (onUploadError) onUploadError(err)
    } finally {
      setUploading(false)
    }
  }

  const resetState = (clearAsset = true) => {
    setFile(null)
    setPreviewUrl(null)
    if (clearAsset) setUploadedAsset(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onButtonClick = () => {
    inputRef.current?.click()
  }

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleChange}
        disabled={uploading}
      />

      {!previewUrl && !uploadedAsset && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 min-h-[180px] bg-white/40 backdrop-blur-md ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
          }`}
        >
          <div className="p-3 bg-blue-50 rounded-full mb-3 text-blue-500">
            <UploadCloud size={24} />
          </div>
          <p className="text-sm font-bold text-gray-700 mb-1">{t('uploaderDragHint')}</p>
          <p className="text-xs text-gray-400">{t('uploaderFormats')}</p>
        </div>
      )}

      {previewUrl && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <button
            type="button"
            onClick={() => resetState()}
            className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 rounded-full transition-colors z-10"
            disabled={uploading}
          >
            <X size={16} />
          </button>

          <div className="flex gap-4 items-center">
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate mb-1">{file?.name}</p>
              <p className="text-xs text-gray-400 mb-3">
                {file ? (file.size / 1024).toFixed(1) : 0} KB
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-primary hover:bg-blue-700 text-white font-bold"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {t('uploaderUploading')}
                    </>
                  ) : (
                    t('uploaderUploadBtn')
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => resetState()}
                  disabled={uploading}
                >
                  {t('uploaderCancel')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {uploadedAsset && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-4 items-center animate-fade-in relative">
          <button
            type="button"
            onClick={() => resetState(true)}
            className="absolute top-2 right-2 p-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full transition-colors z-10"
          >
            <X size={14} />
          </button>

          <div className="p-2 bg-green-100 text-green-600 rounded-full shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-green-900 truncate mb-0.5">
              {t('uploaderSuccessTitle')}
            </p>
            <p className="text-xs text-green-700 truncate font-mono select-all">
              {uploadedAsset.url}
            </p>
          </div>
          <div className="shrink-0">
            <img
              src={uploadedAsset.url}
              alt={uploadedAsset.altText || 'Uploaded'}
              className="w-10 h-10 object-cover rounded-lg border border-green-200"
            />
          </div>
        </div>
      )}
    </div>
  )
}
