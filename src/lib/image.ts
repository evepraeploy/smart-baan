import imageCompression from 'browser-image-compression'
import { messages } from './messages.th'

export type CompressedSlip = {
  file: File
  originalSize: number
  compressedSize: number
  ext: 'webp' | 'jpg'
}

const maxOriginalSize = 20 * 1024 * 1024
const maxCompressedSize = 200 * 1024

function supportsWebp(): boolean {
  const canvas = document.createElement('canvas')
  return canvas.toDataURL('image/webp').startsWith('data:image/webp')
}

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

export async function compressSlipImage(file: File): Promise<CompressedSlip> {
  if (!file.type.startsWith('image/') && !isHeic(file)) throw new Error(messages.imageInvalid)
  if (file.size > maxOriginalSize) throw new Error(messages.imageTooLarge)

  const originalSize = file.size
  let source = file
  if (isHeic(file)) {
    try {
      const convert = (await import('heic2any')).default
      const converted = await convert({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      const blob = Array.isArray(converted) ? converted[0] : converted
      source = new File([blob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' })
    } catch {
      throw new Error(messages.imageCompressFailed)
    }
  }

  const webp = supportsWebp()
  const mime = webp ? 'image/webp' : 'image/jpeg'
  const ext = webp ? 'webp' : 'jpg'
  const options = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    initialQuality: 0.8,
    fileType: mime,
  }
  let output = await imageCompression(source, options)
  if (output.size > maxCompressedSize) {
    output = await imageCompression(source, { ...options, maxWidthOrHeight: 1024 })
  }
  if (output.type !== mime || output.size > maxCompressedSize) throw new Error(messages.imageCompressFailed)
  const result = new File([output], `slip.${ext}`, { type: mime })
  return { file: result, originalSize, compressedSize: result.size, ext }
}
