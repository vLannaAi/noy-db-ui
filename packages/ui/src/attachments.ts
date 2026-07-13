// Attachment-gallery helpers — the Item-family blob surface (Item Release P5).
//
// A record's blob handle (`collection.blob(id)`) holds freeform-named slots: the cover lives in a
// reserved slot, attachments in `att:<uuid>` slots. `attachmentList` filters a `blob(id).list()`
// result to the attachment slots and derives the per-item view model (kind, human size, mime).
// Pure + framework-free; AttachmentGallery.vue renders it and owns the objectURL lifecycle.

/** The slot-name prefix that marks a user attachment (keeps the cover + named slots out). */
export const ATTACHMENT_PREFIX = 'att:'

/** A `blob(id).list()` entry — the fields this module reads (the hub returns more, e.g. eTag). */
export interface BlobSlotInfo {
  readonly name: string
  readonly filename?: string
  readonly size?: number
  readonly mimeType?: string
  readonly uploadedAt?: string
}

export interface AttachmentItem {
  /** The full slot name (`att:<uuid>`) — pass to `blob(id).get/delete`. */
  readonly slot: string
  /** Display filename (falls back to the slot's uuid tail). */
  readonly filename: string
  readonly mime: string
  readonly size: number
  readonly humanSize: string
  readonly kind: 'image' | 'file'
  readonly uploadedAt?: string
}

/** `1234` → `1.2 KB`. Binary units, one decimal above KB. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${units[i]}`
}

/** Make an `att:` slot name for a fresh upload. Caller supplies the uuid (framework-free). */
export function attachmentSlot(uuid: string): string {
  return `${ATTACHMENT_PREFIX}${uuid}`
}

/** Display classification for an attachment — drives the row icon + a friendly type label. */
export interface FileCategory {
  readonly category: 'image' | 'pdf' | 'spreadsheet' | 'document' | 'presentation' | 'archive' | 'audio' | 'video' | 'text' | 'file'
  /** Friendly type name, e.g. `PDF document`, `Spreadsheet`. */
  readonly label: string
  /** Lucide icon class for the tile (only a fallback for images, which show a thumbnail). */
  readonly icon: string
}

/**
 * Classify an attachment by MIME type (preferred) then filename extension into a display category,
 * with a friendly label and an icon — so a non-image (a PDF, a spreadsheet, an archive) reads as
 * what it is instead of a generic blob. The hub MIME-sniffs by magic bytes, so `mime` is reliable
 * even when the browser gave no `file.type`.
 */
export function fileCategory(mime: string, filename: string): FileCategory {
  const m = mime.toLowerCase()
  const ext = (filename.split('.').pop() ?? '').toLowerCase()
  const is = (...exts: string[]): boolean => exts.includes(ext)

  if (m.startsWith('image/')) return { category: 'image', label: 'Image', icon: 'i-lucide-image' }
  if (m.startsWith('audio/') || is('mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a')) return { category: 'audio', label: 'Audio', icon: 'i-lucide-file-audio' }
  if (m.startsWith('video/') || is('mp4', 'mov', 'mkv', 'avi', 'webm')) return { category: 'video', label: 'Video', icon: 'i-lucide-file-video' }
  if (m === 'application/pdf' || is('pdf')) return { category: 'pdf', label: 'PDF document', icon: 'i-lucide-file-text' }
  if (m.includes('spreadsheet') || m === 'application/vnd.ms-excel' || m === 'text/csv' || is('xlsx', 'xls', 'csv', 'ods')) return { category: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet' }
  if (m.includes('presentation') || is('ppt', 'pptx', 'odp')) return { category: 'presentation', label: 'Presentation', icon: 'i-lucide-file-text' }
  if (m.includes('word') || m === 'application/msword' || is('doc', 'docx', 'odt', 'rtf', 'pages')) return { category: 'document', label: 'Document', icon: 'i-lucide-file-text' }
  if (m.includes('zip') || m.includes('compressed') || m.includes('tar') || is('zip', 'tar', 'gz', 'rar', '7z')) return { category: 'archive', label: 'Archive', icon: 'i-lucide-file-archive' }
  if (m.startsWith('text/') || is('txt', 'md', 'json', 'xml', 'yaml', 'yml')) return { category: 'text', label: 'Text file', icon: 'i-lucide-file-text' }
  return { category: 'file', label: 'File', icon: 'i-lucide-file' }
}

/**
 * Filter a `blob(id).list()` result to the attachment slots (`att:` prefix) and shape each into an
 * `AttachmentItem`. Non-attachment slots (the cover, any named slot) are dropped. Sorted by upload
 * time ascending (stable insertion order) so a freshly-added item lands at the end.
 */
export function attachmentList(slots: readonly BlobSlotInfo[]): AttachmentItem[] {
  return slots
    .filter((s) => s.name.startsWith(ATTACHMENT_PREFIX))
    .map((s) => {
      const mime = s.mimeType ?? 'application/octet-stream'
      const size = s.size ?? 0
      return {
        slot: s.name,
        filename: s.filename && s.filename !== s.name ? s.filename : s.name.slice(ATTACHMENT_PREFIX.length),
        mime,
        size,
        humanSize: humanSize(size),
        kind: mime.startsWith('image/') ? 'image' : 'file',
        ...(s.uploadedAt !== undefined ? { uploadedAt: s.uploadedAt } : {}),
      } satisfies AttachmentItem
    })
    .sort((a, b) => (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? ''))
}
