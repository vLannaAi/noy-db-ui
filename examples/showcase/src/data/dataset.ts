import type { Artist, Label, Record } from './types'

export const artists: Artist[] = [
  { id: 'ar1', name: 'The Midnight Echoes', country: 'GB', formedYear: 1971, genre: 'rock' },
  { id: 'ar2', name: 'Blue Quartet', country: 'US', formedYear: 1959, genre: 'jazz' },
  { id: 'ar3', name: 'Marvelle', country: 'US', formedYear: 1966, genre: 'soul' },
  { id: 'ar4', name: 'Neon Circuit', country: 'DE', formedYear: 1978, genre: 'electronic' },
  { id: 'ar5', name: 'Crate Diggers', country: 'US', formedYear: 1992, genre: 'hiphop' },
  { id: 'ar6', name: 'Aurelia Strings', country: 'AT', formedYear: 1948, genre: 'classical' },
  { id: 'ar7', name: 'Velvet Static', country: 'GB', formedYear: 1985, genre: 'rock' },
  { id: 'ar8', name: 'Sun Ra Tribute', country: 'US', formedYear: 1974, genre: 'jazz' },
  { id: 'ar9', name: 'Tokyo Pulse', country: 'JP', formedYear: 1983, genre: 'electronic' },
]

export const labels: Label[] = [
  { id: 'lb1', name: 'Groove Hill', country: 'US', founded: 1958 },
  { id: 'lb2', name: 'Northern Wax', country: 'GB', founded: 1969 },
  { id: 'lb3', name: 'Kosmos Audio', country: 'DE', founded: 1975 },
  { id: 'lb4', name: 'Deep Crate', country: 'US', founded: 1990 },
  { id: 'lb5', name: 'Sakura Sound', country: 'JP', founded: 1981 },
]

// 24 records — vary every enum, ref, and numeric field.
export const records: Record[] = [
  { id: 'rc01', title: 'Echoes at Dawn', artistId: 'ar1', labelId: 'lb2', year: 1973, genre: 'rock', format: 'LP', condition: 'NM', durationMin: 42.5, trackCount: 9, rating: 5, priceUsd: 34, purchasedOn: '2024-03-11', favorite: true, notes: 'Gatefold sleeve, first press.' },
  { id: 'rc02', title: 'Quartet in Blue', artistId: 'ar2', labelId: 'lb1', year: 1961, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 38.2, trackCount: 6, rating: 5, priceUsd: 58, purchasedOn: '2023-11-02', favorite: true, notes: 'Mono pressing.' },
  { id: 'rc03', title: 'Sweet Marvelle', artistId: 'ar3', labelId: 'lb1', year: 1968, genre: 'soul', format: 'LP', condition: 'VG', durationMin: 35.0, trackCount: 10, rating: 4, priceUsd: 22, purchasedOn: '2024-01-19', favorite: false, notes: 'Light surface noise side B.' },
  { id: 'rc04', title: 'Circuit Bloom', artistId: 'ar4', labelId: 'lb3', year: 1981, genre: 'electronic', format: '12"', condition: 'NM', durationMin: 18.4, trackCount: 3, rating: 4, priceUsd: 27, purchasedOn: '2024-05-06', favorite: false, notes: 'Extended club mix.' },
  { id: 'rc05', title: 'Boom Bap Almanac', artistId: 'ar5', labelId: 'lb4', year: 1995, genre: 'hiphop', format: 'LP', condition: 'M', durationMin: 51.0, trackCount: 14, rating: 5, priceUsd: 45, purchasedOn: '2024-02-28', favorite: true, notes: 'Sealed reissue.' },
  { id: 'rc06', title: 'Adagio for Strings', artistId: 'ar6', labelId: 'lb3', year: 1955, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 47.3, trackCount: 4, rating: 4, priceUsd: 30, purchasedOn: '2023-09-14', favorite: false, notes: 'Deutsche pressing.' },
  { id: 'rc07', title: 'Static Velvet', artistId: 'ar7', labelId: 'lb2', year: 1987, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 22.0, trackCount: 4, rating: 3, priceUsd: 15, purchasedOn: '2024-04-21', favorite: false, notes: '' },
  { id: 'rc08', title: 'Space Chant', artistId: 'ar8', labelId: 'lb1', year: 1976, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 44.6, trackCount: 7, rating: 4, priceUsd: 40, purchasedOn: '2023-12-09', favorite: false, notes: 'Spiritual jazz classic.' },
  { id: 'rc09', title: 'Tokyo Pulse I', artistId: 'ar9', labelId: 'lb5', year: 1984, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 39.9, trackCount: 8, rating: 5, priceUsd: 62, purchasedOn: '2024-06-01', favorite: true, notes: 'City pop crossover.' },
  { id: 'rc10', title: 'Echoes at Dusk', artistId: 'ar1', labelId: 'lb2', year: 1975, genre: 'rock', format: 'LP', condition: 'VG+', durationMin: 40.1, trackCount: 8, rating: 4, priceUsd: 28, purchasedOn: '2024-03-12', favorite: false, notes: '' },
  { id: 'rc11', title: 'Blue Note Sketches', artistId: 'ar2', labelId: 'lb1', year: 1963, genre: 'jazz', format: 'LP', condition: 'VG', durationMin: 36.8, trackCount: 6, rating: 4, priceUsd: 33, purchasedOn: '2023-10-30', favorite: false, notes: '' },
  { id: 'rc12', title: 'Marvelle Live', artistId: 'ar3', labelId: 'lb1', year: 1970, genre: 'soul', format: 'LP', condition: 'G', durationMin: 48.0, trackCount: 11, rating: 3, priceUsd: 18, purchasedOn: '2024-01-20', favorite: false, notes: 'Well-played copy.' },
  { id: 'rc13', title: 'Neon Drift', artistId: 'ar4', labelId: 'lb3', year: 1983, genre: 'electronic', format: 'Single', condition: 'NM', durationMin: 7.5, trackCount: 2, rating: 3, priceUsd: 12, purchasedOn: '2024-05-07', favorite: false, notes: '' },
  { id: 'rc14', title: 'Crate Diggers Vol. 2', artistId: 'ar5', labelId: 'lb4', year: 1997, genre: 'hiphop', format: 'LP', condition: 'NM', durationMin: 49.5, trackCount: 13, rating: 4, priceUsd: 38, purchasedOn: '2024-03-01', favorite: false, notes: '' },
  { id: 'rc15', title: 'Concerto No. 3', artistId: 'ar6', labelId: 'lb3', year: 1958, genre: 'classical', format: 'LP', condition: 'VG+', durationMin: 52.2, trackCount: 3, rating: 5, priceUsd: 41, purchasedOn: '2023-09-15', favorite: true, notes: '' },
  { id: 'rc16', title: 'Velvet Static II', artistId: 'ar7', labelId: 'lb2', year: 1989, genre: 'rock', format: 'LP', condition: 'VG', durationMin: 43.0, trackCount: 10, rating: 3, priceUsd: 20, purchasedOn: '2024-04-22', favorite: false, notes: '' },
  { id: 'rc17', title: 'Cosmic Suite', artistId: 'ar8', labelId: 'lb1', year: 1978, genre: 'jazz', format: '12"', condition: 'NM', durationMin: 19.8, trackCount: 2, rating: 4, priceUsd: 26, purchasedOn: '2023-12-10', favorite: false, notes: '' },
  { id: 'rc18', title: 'Tokyo Pulse II', artistId: 'ar9', labelId: 'lb5', year: 1986, genre: 'electronic', format: 'LP', condition: 'M', durationMin: 41.2, trackCount: 9, rating: 5, priceUsd: 70, purchasedOn: '2024-06-02', favorite: true, notes: 'Obi strip intact.' },
  { id: 'rc19', title: 'Midnight Reprise', artistId: 'ar1', labelId: 'lb2', year: 1979, genre: 'rock', format: 'EP', condition: 'NM', durationMin: 24.5, trackCount: 5, rating: 4, priceUsd: 19, purchasedOn: '2024-03-13', favorite: false, notes: '' },
  { id: 'rc20', title: 'After Hours', artistId: 'ar2', labelId: 'lb1', year: 1965, genre: 'jazz', format: 'LP', condition: 'VG+', durationMin: 37.7, trackCount: 7, rating: 4, priceUsd: 35, purchasedOn: '2023-11-03', favorite: false, notes: '' },
  { id: 'rc21', title: 'Soul Revival', artistId: 'ar3', labelId: 'lb4', year: 1972, genre: 'soul', format: 'Single', condition: 'VG', durationMin: 6.8, trackCount: 2, rating: 3, priceUsd: 10, purchasedOn: '2024-01-21', favorite: false, notes: '' },
  { id: 'rc22', title: 'Kosmos Drift', artistId: 'ar4', labelId: 'lb3', year: 1985, genre: 'electronic', format: 'LP', condition: 'NM', durationMin: 45.0, trackCount: 8, rating: 4, priceUsd: 32, purchasedOn: '2024-05-08', favorite: false, notes: '' },
  { id: 'rc23', title: 'Diggin Deeper', artistId: 'ar5', labelId: 'lb4', year: 1999, genre: 'hiphop', format: '12"', condition: 'M', durationMin: 16.5, trackCount: 3, rating: 4, priceUsd: 24, purchasedOn: '2024-03-02', favorite: false, notes: '' },
  { id: 'rc24', title: 'String Theory', artistId: 'ar6', labelId: 'lb3', year: 1961, genre: 'classical', format: 'LP', condition: 'VG', durationMin: 50.0, trackCount: 5, rating: 4, priceUsd: 29, purchasedOn: '2023-09-16', favorite: false, notes: '' },
]
