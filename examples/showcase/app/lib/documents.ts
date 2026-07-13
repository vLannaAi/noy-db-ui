import type { Vault } from '@noy-db/hub'
import { attachmentSlot } from '@noy-db/ui'

// Demo paperwork for a record — a spread of common file types so the attachments panel shows the
// full range of fileCategory() icons. Blobs don't travel in the demo bundle (see scripts/seed.ts),
// so we seed them lazily/session-only, like the cover. Bytes are zero-filled placeholders at a
// plausible size (the type icon comes from the filename/MIME, not the content).
const DEMO_DOCS: readonly { readonly name: string; readonly mime: string; readonly kb: number }[] = [
  { name: 'provenance.pdf', mime: 'application/pdf', kb: 214 },
  { name: 'appraisal.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kb: 38 },
  { name: 'liner-notes.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kb: 52 },
  { name: 'press-kit.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kb: 256 },
  { name: 'discography.csv', mime: 'text/csv', kb: 6 },
  { name: 'masters-archive.zip', mime: 'application/zip', kb: 180 },
  { name: 'metadata.json', mime: 'application/json', kb: 3 },
  { name: 'catalog.sql', mime: 'application/sql', kb: 12 },
  { name: 'authenticity.pem', mime: 'application/x-pem-file', kb: 2 },
  { name: 'tour-dates.ics', mime: 'text/calendar', kb: 4 },
  { name: 'label-contact.vcf', mime: 'text/vcard', kb: 1 },
  { name: 'collectors-guide.epub', mime: 'application/epub+zip', kb: 148 },
]

const seeded = new Set<string>()

/** Seed the demo document set on a record once per session, unless it already has attachments. */
export async function seedDocuments(vault: Vault, recordId: string): Promise<void> {
  if (seeded.has(recordId)) return
  seeded.add(recordId)
  const blob = vault.collection('records').blob(recordId)
  const existing = await blob.list()
  if (existing.some((s) => s.name.startsWith('att:'))) return // never clobber real uploads
  for (const d of DEMO_DOCS) {
    await blob.put(attachmentSlot(`demo-${d.name}`), new Uint8Array(d.kb * 1024), { filename: d.name, mimeType: d.mime })
  }
}
