import { z } from 'zod'

export const GENRES = ['rock', 'jazz', 'soul', 'electronic', 'hiphop', 'classical'] as const
export const FORMATS = ['LP', 'EP', 'Single', '12"'] as const
export const CONDITIONS = ['M', 'NM', 'VG+', 'VG', 'G'] as const

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.record(z.string()),
  country: z.string(),       // ISO-3166 alpha-2 (semanticType: country)
  formedYear: z.number().int(),
  genre: z.enum(GENRES),
})
export const LabelSchema = z.object({
  id: z.string(),
  name: z.record(z.string()),
  country: z.string(),
  founded: z.number().int(),
  notes: z.record(z.string()).optional(),
})
export const RecordSchema = z.object({
  id: z.string(),
  title: z.record(z.string()),
  artistId: z.string(),
  labelId: z.string(),
  year: z.number().int(),
  genre: z.enum(GENRES),
  format: z.enum(FORMATS),
  condition: z.enum(CONDITIONS),
  durationMin: z.number(),
  trackCount: z.number().int(),
  rating: z.number().int().min(1).max(5),
  priceUsd: z.number(),
  purchasedOn: z.string(),   // ISO date
  favorite: z.boolean(),
  notes: z.string(),
})

export type Artist = z.infer<typeof ArtistSchema>
export type Label = z.infer<typeof LabelSchema>
export type Record = z.infer<typeof RecordSchema>
