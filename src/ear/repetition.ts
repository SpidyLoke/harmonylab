// Spaced repetition for ear-training items (a Leitner box system).
// A miss sends an item back to box 1, so it comes round again soon; each hit
// moves it up a box and makes it rarer.

export interface RepItem {
  id: string
  box: number // 1..5
  seen: number
  correct: number
  lastSeen: number // ms timestamp
}

export const MAX_BOX = 5

export function newItem(id: string): RepItem {
  return { id, box: 1, seen: 0, correct: 0, lastSeen: 0 }
}

export function recordAnswer(item: RepItem, correct: boolean, now = Date.now()): RepItem {
  return {
    ...item,
    box: correct ? Math.min(MAX_BOX, item.box + 1) : 1,
    seen: item.seen + 1,
    correct: item.correct + (correct ? 1 : 0),
    lastSeen: now,
  }
}

/** Box 1 items are 16 times as likely to come up as box 5 items. */
export function weightOf(item: RepItem): number {
  return Math.pow(2, MAX_BOX - item.box)
}

/**
 * Picks the next item. Never repeats the item just asked if there is any
 * other choice. `rand` is injectable for tests.
 */
export function pickNext(items: RepItem[], lastId: string | null, rand: () => number = Math.random): RepItem {
  const pool = items.length > 1 ? items.filter((i) => i.id !== lastId) : items
  const total = pool.reduce((s, i) => s + weightOf(i), 0)
  let r = rand() * total
  for (const i of pool) {
    r -= weightOf(i)
    if (r <= 0) return i
  }
  return pool[pool.length - 1]
}

export function accuracy(item: RepItem): number | null {
  return item.seen ? item.correct / item.seen : null
}
