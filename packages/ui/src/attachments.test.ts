import { describe, it, expect } from 'vitest'
import { attachmentList, humanSize, attachmentSlot, ATTACHMENT_PREFIX, fileCategory, type BlobSlotInfo } from './attachments'

describe('humanSize', () => {
  it('scales bytes to binary units', () => {
    expect(humanSize(500)).toBe('500 B')
    expect(humanSize(1024)).toBe('1.0 KB')
    expect(humanSize(1536)).toBe('1.5 KB')
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
  it('guards bad input', () => {
    expect(humanSize(-1)).toBe('—')
    expect(humanSize(NaN)).toBe('—')
  })
})

describe('attachmentSlot', () => {
  it('prefixes a uuid', () => {
    expect(attachmentSlot('abc-123')).toBe('att:abc-123')
    expect(attachmentSlot('x').startsWith(ATTACHMENT_PREFIX)).toBe(true)
  })
})

describe('attachmentList', () => {
  const slots: BlobSlotInfo[] = [
    { name: 'art', filename: 'cover', size: 12000, mimeType: 'image/png', uploadedAt: '2026-07-01T00:00:00Z' }, // cover — excluded
    { name: 'att:2', filename: 'invoice.pdf', size: 2048, mimeType: 'application/pdf', uploadedAt: '2026-07-03T00:00:00Z' },
    { name: 'att:1', filename: 'sleeve.png', size: 1024, mimeType: 'image/png', uploadedAt: '2026-07-02T00:00:00Z' },
  ]

  it('keeps only att: slots, dropping the cover', () => {
    expect(attachmentList(slots).map((a) => a.slot)).toEqual(['att:1', 'att:2'])
  })

  it('sorts by upload time ascending (newest last)', () => {
    expect(attachmentList(slots).map((a) => a.filename)).toEqual(['sleeve.png', 'invoice.pdf'])
  })

  it('classifies image vs file by mime', () => {
    const byKind = Object.fromEntries(attachmentList(slots).map((a) => [a.filename, a.kind]))
    expect(byKind).toEqual({ 'sleeve.png': 'image', 'invoice.pdf': 'file' })
  })

  it('derives filename + human size + mime', () => {
    const pdf = attachmentList(slots).find((a) => a.slot === 'att:2')!
    expect(pdf).toMatchObject({ filename: 'invoice.pdf', mime: 'application/pdf', size: 2048, humanSize: '2.0 KB' })
  })

  it('falls back to the uuid tail and octet-stream when metadata is missing', () => {
    const item = attachmentList([{ name: 'att:bare-uuid' }])[0]
    expect(item).toMatchObject({ filename: 'bare-uuid', mime: 'application/octet-stream', kind: 'file', size: 0, humanSize: '0 B' })
  })

  it('treats a filename equal to the slot name as absent (uses the tail)', () => {
    const item = attachmentList([{ name: 'att:xyz', filename: 'att:xyz', size: 10 }])[0]
    expect(item.filename).toBe('xyz')
  })
})

describe('fileCategory', () => {
  it('classifies by MIME first', () => {
    expect(fileCategory('image/png', 'x.png').category).toBe('image')
    expect(fileCategory('application/pdf', 'x').category).toBe('pdf')
    expect(fileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'budget.xlsx').category).toBe('spreadsheet')
    expect(fileCategory('audio/mpeg', 'track').category).toBe('audio')
    expect(fileCategory('video/mp4', 'clip').category).toBe('video')
  })
  it('falls back to the extension when MIME is generic', () => {
    expect(fileCategory('application/octet-stream', 'sheet.csv').category).toBe('spreadsheet')
    expect(fileCategory('application/octet-stream', 'notes.docx').category).toBe('document')
    expect(fileCategory('application/octet-stream', 'bundle.zip').category).toBe('archive')
    expect(fileCategory('application/octet-stream', 'readme.md').category).toBe('text')
  })
  it('gives a friendly label and an icon, defaulting to a generic file', () => {
    expect(fileCategory('application/vnd.ms-excel', 'q.xls')).toMatchObject({ label: 'Spreadsheet', icon: 'i-lucide-sheet' })
    const unknown = fileCategory('application/x-weird', 'mystery.bin')
    expect(unknown).toMatchObject({ category: 'file', label: 'File', icon: 'i-lucide-file' })
  })
})
