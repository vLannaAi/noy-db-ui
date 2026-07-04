import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useTraverse } from './use-traverse'
import type { FoundSetSnapshot } from './traverse'

const SNAP: FoundSetSnapshot = {
  kind: 'query', entity: 'records', query: 'q', title: 't', total: 9, capturedAt: 'now',
  items: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: id.toUpperCase() })),
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

function make(startId = 'a') {
  const currentId = ref(startId)
  const settled: string[] = []
  const t = useTraverse({
    snapshot: () => SNAP,
    currentId: () => currentId.value,
    onSettle: (id) => { settled.push(id); currentId.value = id }, // simulates router.replace landing
  })
  return { t, settled, currentId }
}

describe('useTraverse — skim', () => {
  it('rapid steps move the cursor instantly and settle ONCE at the end', () => {
    const { t, settled } = make('a')
    t.go(1); t.go(1); t.go(1)                      // a → cursor d, three steps inside 250ms
    expect(t.cursor.value).toBe(3)
    expect(t.cursorItem.value!.id).toBe('d')
    expect(t.skimming.value).toBe(true)
    expect(settled).toEqual([])                     // nothing fetched yet
    vi.advanceTimersByTime(250)
    expect(settled).toEqual(['d'])                  // one settle
    expect(t.skimming.value).toBe(false)            // currentId landed → skim cleared
  })
  it('slow steps settle each one', () => {
    const { t, settled } = make('a')
    t.go(1); vi.advanceTimersByTime(250)
    t.go(1); vi.advanceTimersByTime(250)
    expect(settled).toEqual(['b', 'c'])
  })
  it('clamps at the ends and tracks lastDirection', () => {
    const { t } = make('a')
    t.go(-1)
    expect(t.cursor.value).toBe(0)
    expect(t.lastDirection.value).toBe(-1)
    t.go(1); expect(t.lastDirection.value).toBe(1)
  })
  it('a settle for an already-current id does not fire', () => {
    const { t, settled } = make('a')
    t.go(1); t.go(-1)                               // back to a
    vi.advanceTimersByTime(250)
    expect(settled).toEqual([])
  })
  it('goTo/first/last settle immediately', () => {
    const { t, settled } = make('a')
    t.last()
    expect(settled).toEqual(['e'])
    t.first()
    expect(settled).toEqual(['e', 'a'])
    t.goTo(2)
    expect(settled).toEqual(['e', 'a', 'c'])
  })
  it('generation guard: an immediate settle after pending skim kills the old timer', () => {
    const { t, settled } = make('a')
    t.go(1)                                          // pending settle for b
    t.last()                                         // immediate settle e
    vi.advanceTimersByTime(300)
    expect(settled).toEqual(['e'])                   // b never fired
  })
  it('external currentId change re-syncs the cursor', async () => {
    const { t, currentId } = make('a')
    currentId.value = 'd'
    await Promise.resolve()                          // let the watcher flush
    expect(t.cursor.value).toBe(3)
    expect(t.skimming.value).toBe(false)
  })
})
