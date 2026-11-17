import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const iconDirectory = resolve('public/icons')
mkdirSync(iconDirectory, { recursive: true })

function parseColor(value) {
  return value.match(/[a-f\d]{2}/gi).map((part) => Number.parseInt(part, 16))
}

function insidePolygon(x, y, points) {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[previous]
    const crosses = (y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1
    if (crosses) inside = !inside
  }
  return inside
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(name, data = Buffer.alloc(0)) {
  const type = Buffer.from(name)
  const size = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])))
  return Buffer.concat([size, type, data, checksum])
}

function createPng(size) {
  const pixels = new Uint8Array(size * size * 4)
  const scale = size / 512
  const background = parseColor('#047857')
  const house = parseColor('#ffffff')
  const door = parseColor('#d1fae5')
  const roof = [[58, 244], [256, 78], [454, 244]]

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sourceX = x / scale
      const sourceY = y / scale
      let color = background
      if (insidePolygon(sourceX, sourceY, roof) || (sourceX >= 116 && sourceX <= 396 && sourceY >= 218 && sourceY <= 438)) {
        color = house
      }
      if (sourceX >= 216 && sourceX <= 296 && sourceY >= 308 && sourceY <= 438) color = door
      const offset = (y * size + x) * 4
      pixels[offset] = color[0]
      pixels[offset + 1] = color[1]
      pixels[offset + 2] = color[2]
      pixels[offset + 3] = 255
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1))
  for (let row = 0; row < size; row += 1) {
    const start = row * (size * 4 + 1)
    scanlines[start] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + row * size * 4, size * 4).copy(scanlines, start + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND'),
  ])
}

for (const [filename, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
  writeFileSync(resolve(iconDirectory, filename), createPng(size))
}
