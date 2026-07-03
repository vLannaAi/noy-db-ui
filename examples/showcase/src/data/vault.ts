import { createNoydb, readNoydbBundle, type Noydb, type Vault } from '@noy-db/hub'
import { withBlobs } from '@noy-db/hub/blobs'
import { withHistory } from '@noy-db/hub/history'
import { withI18n } from '@noy-db/hub/i18n'
import { memory } from '@noy-db/to-memory'

export const VAULT_NAME = 'vinyl'
export const LANGS = ['en', 'th'] as const

/** Blob field declared on the `records` collection, and the slot under it that holds the cover PNG. */
export const COVER_FIELD = 'cover'
export const COVER_SLOT = 'art'

/**
 * Create a fresh in-memory, encrypted vault with blobs + i18n enabled.
 *
 * Note: `user` is a userId string, not a role. The first user to open a
 * vault becomes 'owner', so toBytes() (which requires owner/admin) works.
 */
export async function buildVault(secret: string): Promise<{ db: Noydb; vault: Vault }> {
  const db = await createNoydb({
    store: memory(),
    user: 'viewer',
    secret,
    blobStrategy: withBlobs(),
    historyStrategy: withHistory(),
    i18nStrategy: withI18n(),
  })
  const vault = await db.openVault(VAULT_NAME, { create: true })
  return { db, vault }
}

/**
 * Reopen a .noydb bundle. Throws if `secret` cannot unlock it.
 *
 * Working sequence (confirmed against sibling runtime):
 *   1. createNoydb with empty memory store + wrong/right passphrase
 *   2. openVault(VAULT_NAME, { create: true }) — creates a fresh owner keyring
 *   3. readNoydbBundle(bytes) — extracts the JSON dump (no passphrase needed)
 *   4. vault.load(dumpJson) — restores keyrings + data, then calls reloadKeyring()
 *      which tries to decrypt the backup's keyring with the session passphrase.
 *      Wrong passphrase → InvalidKeyError thrown here (at load, not at first read).
 */
export async function openVaultFromBundle(bytes: Uint8Array, secret: string): Promise<Vault> {
  const db = await createNoydb({
    store: memory(),
    user: 'viewer',
    secret,
    blobStrategy: withBlobs(),
    historyStrategy: withHistory(),
    i18nStrategy: withI18n(),
  })
  const vault = await db.openVault(VAULT_NAME, { create: true })
  const { dumpJson } = await readNoydbBundle(bytes)
  await vault.load(dumpJson)
  return vault
}
