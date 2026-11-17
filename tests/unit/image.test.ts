import { beforeEach, describe, expect, it, vi } from 'vitest'
import imageCompression from 'browser-image-compression'
import { compressSlipImage } from '../../src/lib/image'
import { messages } from '../../src/lib/messages.th'

vi.mock('browser-image-compression', () => ({ default: vi.fn() }))

const mockedCompression = vi.mocked(imageCompression)

describe('compressSlipImage', () => {
  beforeEach(() => {
    mockedCompression.mockReset()
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,')
  })

  it('ลองย่อซ้ำที่ความกว้าง 1024 เมื่อผลลัพธ์แรกเกิน 200 KB', async () => {
    mockedCompression
      .mockResolvedValueOnce(new Blob([new Uint8Array(210 * 1024)], { type: 'image/webp' }) as File)
      .mockResolvedValueOnce(new Blob([new Uint8Array(150 * 1024)], { type: 'image/webp' }) as File)
    const input = new File(['source'], 'slip.png', { type: 'image/png' })

    const result = await compressSlipImage(input)

    expect(mockedCompression).toHaveBeenCalledTimes(2)
    expect(mockedCompression.mock.calls[0][1]?.maxWidthOrHeight).toBe(1280)
    expect(mockedCompression.mock.calls[1][1]?.maxWidthOrHeight).toBe(1024)
    expect(result.ext).toBe('webp')
    expect(result.compressedSize).toBeLessThanOrEqual(200 * 1024)
  })

  it('เลือก JPEG เมื่อเบราว์เซอร์ไม่รองรับ WebP', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,')
    mockedCompression.mockResolvedValueOnce(new Blob(['compressed'], { type: 'image/jpeg' }) as File)
    const result = await compressSlipImage(new File(['source'], 'slip.png', { type: 'image/png' }))
    expect(mockedCompression.mock.calls[0][1]?.fileType).toBe('image/jpeg')
    expect(result.ext).toBe('jpg')
    expect(result.file.type).toBe('image/jpeg')
  })

  it('ปฏิเสธไฟล์ที่ไม่ใช่รูปภาพ', async () => {
    await expect(compressSlipImage(new File(['text'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow(messages.imageInvalid)
    expect(mockedCompression).not.toHaveBeenCalled()
  })

  it('ปฏิเสธไฟล์ต้นฉบับที่ใหญ่กว่า 20 MB', async () => {
    const input = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })
    await expect(compressSlipImage(input)).rejects.toThrow(messages.imageTooLarge)
    expect(mockedCompression).not.toHaveBeenCalled()
  })

  it('ปฏิเสธผลลัพธ์ที่ชนิดไฟล์ไม่ตรงกับที่ขอ', async () => {
    mockedCompression.mockResolvedValueOnce(new Blob(['bad'], { type: 'image/jpeg' }) as File)
    await expect(compressSlipImage(new File(['source'], 'slip.png', { type: 'image/png' }))).rejects.toThrow(messages.imageCompressFailed)
  })
})
