// Minimal EXIF reader for JPEG attachments — pulls the handful of fields worth surfacing (camera,
// lens, capture time, exposure, GPS, orientation) straight from the file's APP1 / TIFF block. No
// dependency, offline, and returns `null` for a non-JPEG or an EXIF-less file. The metadata already
// lives inside the (decrypted) bytes — the natural store for a zero-knowledge vault, where there is
// no server-side metadata bag to sync into.
//
// TIFF/EXIF layout in brief: JPEG APP1 (`FFE1`) → `"Exif\0\0"` → TIFF header (byte order + IFD0
// offset) → IFD0 (Make/Model/Orientation + pointers to the Exif sub-IFD and the GPS IFD). All
// offsets are relative to the TIFF header start. Any malformed read throws and is caught → `null`.

export interface ExifData {
  /** 1–8; the TIFF orientation. Browsers auto-apply it to `<img>`, but it's worth showing. */
  readonly orientation?: number
  readonly make?: string
  readonly model?: string
  readonly lens?: string
  /** Capture time, normalized to `YYYY-MM-DD HH:MM`. */
  readonly takenAt?: string
  /** e.g. `1/250s`. */
  readonly exposure?: string
  /** e.g. `f/2.8`. */
  readonly fNumber?: string
  readonly iso?: number
  /** e.g. `35mm`. */
  readonly focalLength?: string
  /** Decimal degrees (signed: south / west negative). */
  readonly gps?: { readonly lat: number; readonly lng: number }
}

interface Entry { readonly type: number; readonly count: number; readonly valueOff: number }
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

/** Parse EXIF from JPEG bytes. Returns the fields it recognises, or `null` if there are none. */
export function parseExif(input: Uint8Array): ExifData | null {
  try {
    const b = input
    if (b.length < 12 || b[0] !== 0xff || b[1] !== 0xd8) return null // not a JPEG

    // Walk the JPEG markers to the APP1 (`FFE1`) segment that begins with `Exif\0\0`.
    let off = 2
    let tiff = -1
    while (off + 4 <= b.length) {
      if (b[off] !== 0xff) break
      const marker = b[off + 1]
      if (marker === 0xda || marker === 0xd9) break // start-of-scan / end-of-image: no metadata past here
      const segLen = (b[off + 2]! << 8) | b[off + 3]!
      if (segLen < 2) break
      if (marker === 0xe1 && b[off + 4] === 0x45 && b[off + 5] === 0x78 && b[off + 6] === 0x69
        && b[off + 7] === 0x66 && b[off + 8] === 0x00 && b[off + 9] === 0x00) {
        tiff = off + 10
        break
      }
      off += 2 + segLen
    }
    if (tiff < 0) return null

    const view = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const le = b[tiff] === 0x49 ? true : b[tiff] === 0x4d ? false : null
    if (le === null) return null
    // Readers indexed relative to the TIFF header start.
    const u8 = (p: number): number => view.getUint8(tiff + p)
    const u16 = (p: number): number => view.getUint16(tiff + p, le)
    const u32 = (p: number): number => view.getUint32(tiff + p, le)

    const readIfd = (ifdOff: number): Map<number, Entry> => {
      const m = new Map<number, Entry>()
      if (ifdOff <= 0) return m
      const n = u16(ifdOff)
      for (let i = 0; i < n; i++) {
        const e = ifdOff + 2 + i * 12
        m.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 })
      }
      return m
    }
    const dataOff = (t: Entry): number => {
      const total = (TYPE_SIZE[t.type] ?? 1) * t.count
      return total <= 4 ? t.valueOff : u32(t.valueOff) // small values sit inline; larger ones point out
    }
    const asciiOf = (m: Map<number, Entry>, tag: number): string | undefined => {
      const t = m.get(tag)
      if (!t || t.type !== 2) return undefined
      const base = dataOff(t)
      let s = ''
      for (let i = 0; i < t.count; i++) { const c = u8(base + i); if (c === 0) break; s += String.fromCharCode(c) }
      return s.trim() || undefined
    }
    const shortOf = (m: Map<number, Entry>, tag: number): number | undefined => {
      const t = m.get(tag)
      if (!t) return undefined
      if (t.type === 3) return u16(t.valueOff)
      if (t.type === 4) return u32(t.valueOff)
      return undefined
    }
    const ratOf = (m: Map<number, Entry>, tag: number): number | undefined => {
      const t = m.get(tag)
      if (!t || (t.type !== 5 && t.type !== 10)) return undefined
      const base = dataOff(t)
      const num = t.type === 10 ? view.getInt32(tiff + base, le) : u32(base)
      const den = t.type === 10 ? view.getInt32(tiff + base + 4, le) : u32(base + 4)
      return den === 0 ? undefined : num / den
    }
    const ratsOf = (m: Map<number, Entry>, tag: number): number[] | undefined => {
      const t = m.get(tag)
      if (!t || t.type !== 5) return undefined
      const base = dataOff(t)
      const out: number[] = []
      for (let i = 0; i < t.count; i++) { const den = u32(base + i * 8 + 4); out.push(den === 0 ? 0 : u32(base + i * 8) / den) }
      return out
    }

    const ifd0 = readIfd(u32(4))
    const exifP = shortOf(ifd0, 0x8769)
    const exif = exifP ? readIfd(exifP) : new Map<number, Entry>()
    const gpsP = shortOf(ifd0, 0x8825)
    const gps = gpsP ? readIfd(gpsP) : new Map<number, Entry>()

    const out: { -readonly [K in keyof ExifData]?: ExifData[K] } = {}
    const orientation = shortOf(ifd0, 0x0112); if (orientation) out.orientation = orientation
    const make = asciiOf(ifd0, 0x010f); if (make) out.make = make
    const model = asciiOf(ifd0, 0x0110); if (model) out.model = model
    const lens = asciiOf(exif, 0xa434); if (lens) out.lens = lens

    const taken = asciiOf(exif, 0x9003) ?? asciiOf(ifd0, 0x0132)
    if (taken) {
      const mt = taken.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/)
      out.takenAt = mt ? `${mt[1]}-${mt[2]}-${mt[3]} ${mt[4]}:${mt[5]}` : taken
    }
    const et = ratOf(exif, 0x829a); if (et !== undefined) out.exposure = et > 0 && et < 1 ? `1/${Math.round(1 / et)}s` : `${+et.toFixed(1)}s`
    const fn = ratOf(exif, 0x829d); if (fn !== undefined) out.fNumber = `f/${+fn.toFixed(1)}`
    const iso = shortOf(exif, 0x8827); if (iso) out.iso = iso
    const fl = ratOf(exif, 0x920a); if (fl !== undefined) out.focalLength = `${Math.round(fl)}mm`

    const latRef = asciiOf(gps, 0x0001); const lat = ratsOf(gps, 0x0002)
    const lngRef = asciiOf(gps, 0x0003); const lng = ratsOf(gps, 0x0004)
    if (lat && lng && lat.length === 3 && lng.length === 3) {
      let latD = lat[0]! + lat[1]! / 60 + lat[2]! / 3600
      let lngD = lng[0]! + lng[1]! / 60 + lng[2]! / 3600
      if (latRef === 'S') latD = -latD
      if (lngRef === 'W') lngD = -lngD
      out.gps = { lat: +latD.toFixed(6), lng: +lngD.toFixed(6) }
    }

    return Object.keys(out).length ? out : null
  } catch {
    return null // malformed EXIF — never throw at a display path
  }
}
