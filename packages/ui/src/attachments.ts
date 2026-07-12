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
