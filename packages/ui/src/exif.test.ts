import { describe, it, expect } from 'vitest'
import { parseExif } from './exif'

// Build a minimal little-endian EXIF JPEG: IFD0 with Make (ASCII via offset) + Orientation (inline
// SHORT) + a GPS-IFD pointer; the GPS IFD carries lat/lng as 3-rational arrays with N/E refs.
function buildExifJpeg(): Uint8Array {
  const tiff = new Uint8Array(160)
  const dv = new DataView(tiff.buffer)
  const LE = true
  tiff[0] = 0x49; tiff[1] = 0x49; dv.setUint16(2, 0x002a, LE); dv.setUint32(4, 8, LE)

  let p = 8
  const entry = (tag: number, type: number, count: number, value: number): void => {
    dv.setUint16(p, tag, LE); dv.setUint16(p + 2, type, LE); dv.setUint32(p + 4, count, LE); dv.setUint32(p + 8, value, LE); p += 12
  }
  dv.setUint16(p, 3, LE); p += 2          // IFD0: 3 entries
  entry(0x010f, 2, 8, 50)                 // Make → offset 50
  entry(0x0112, 3, 1, 6)                  // Orientation = 6 (inline)
  entry(0x8825, 4, 1, 58)                 // GPS IFD → offset 58
  dv.setUint32(p, 0, LE); p += 4          // no next IFD

  for (const [i, c] of [...'TestCam'].entries()) tiff[50 + i] = c.charCodeAt(0) // "TestCam\0" at 50

  p = 58
  dv.setUint16(p, 4, LE); p += 2          // GPS IFD: 4 entries
  entry(0x0001, 2, 2, 0x0000004e)         // GPSLatitudeRef 'N' (inline)
  entry(0x0002, 5, 3, 112)                // GPSLatitude → 112
  entry(0x0003, 2, 2, 0x00000045)         // GPSLongitudeRef 'E' (inline)
  entry(0x0004, 5, 3, 136)                // GPSLongitude → 136
  dv.setUint32(p, 0, LE)

  const rat = (at: number, n: number, d: number): void => { dv.setUint32(at, n, LE); dv.setUint32(at + 4, d, LE) }
  rat(112, 13, 1); rat(120, 45, 1); rat(128, 0, 1)   // 13° 45' 0"  → 13.75
  rat(136, 100, 1); rat(144, 30, 1); rat(152, 0, 1)  // 100° 30' 0" → 100.5

  const head = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xa8, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00])
  const out = new Uint8Array(head.length + tiff.length)
  out.set(head, 0); out.set(tiff, head.length)
  return out
}

describe('parseExif', () => {
  it('reads make, orientation, and GPS from a JPEG EXIF block', () => {
    const exif = parseExif(buildExifJpeg())
    expect(exif).not.toBeNull()
    expect(exif!.make).toBe('TestCam')
    expect(exif!.orientation).toBe(6)
    expect(exif!.gps).toEqual({ lat: 13.75, lng: 100.5 })
  })

  it('returns null for a non-JPEG (e.g. PNG signature)', () => {
    expect(parseExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeNull()
  })

  it('returns null for a JPEG with no EXIF segment', () => {
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })

  it('never throws on malformed input', () => {
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0xff, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]))).toBeNull()
  })
})
