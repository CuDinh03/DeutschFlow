import { MAX_IMAGE_BYTES } from '@/lib/feedbackApi'

/**
 * Chuẩn bị ảnh chụp màn hình trước khi tải lên (BR-03). Server nhận PNG/JPEG và tự mã hoá lại; WebP
 * được đổi sang JPEG ngay trên trình duyệt vì máy chủ không giải mã được WebP.
 */
export type PreparedImage = { blob: Blob; name: string } | { error: 'wrong' }

const DIRECT = new Set(['image/png', 'image/jpeg'])

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_IMAGE_BYTES) return { error: 'wrong' }
  if (DIRECT.has(file.type)) return { blob: file, name: file.name || 'image' }
  if (file.type !== 'image/webp') return { error: 'wrong' }
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { error: 'wrong' }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob || blob.size > MAX_IMAGE_BYTES) return { error: 'wrong' }
    return { blob, name: (file.name || 'image').replace(/\.webp$/i, '') + '.jpg' }
  } catch {
    return { error: 'wrong' }
  }
}
