/**
 * Placement and presentation logic, kept free of React and the DOM so it can
 * be reasoned about and tested without a browser.
 * @module dsh-client-pixel-office/placement
 */

import {
  DESKS, UNGROUPED_KEY, STICKER_COLORS, ACCENTS, NOTE_RATIO, SLEEPY_AFTER_MS,
} from './constants.ts'

export {
  DESKS, UNGROUPED_KEY, STICKER_COLORS, ACCENTS, NOTE_RATIO,
}

/** One placement grid: an id per cell, or null for an empty cell. */
export type Placement = readonly (string | null)[]

/**
 * Stable index derived from an id.
 *
 * Used for sticky-note color and animation delay: deriving both from the id
 * keeps a note's appearance stable across re-renders and desynchronizes the
 * sway of adjacent notes, which a shared animation would lock in phase.
 * @param id - the session or workspace id.
 * @param n - exclusive upper bound.
 * @returns an integer in `[0, n)`.
 */
export function hashIndex(id: string, n: number): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 100000
  return h % n
}

/**
 * Reconcile a placement grid against the ids that currently exist.
 *
 * Existing ids keep their cell so a re-render never shuffles the board;
 * vanished ids free theirs; new ids take the lowest free cell.
 * @param current - the previous grid, or undefined on first placement.
 * @param ids - the ids that should be placed.
 * @param size - total cells.
 * @param keepFree - reserve one cell so the user can always reposition by
 * dragging into a gap; without it a full board cannot be rearranged.
 * @returns the reconciled grid, always of length `size`.
 */
export function fitInto(
  current: Placement | undefined,
  ids: readonly string[],
  size: number,
  keepFree: boolean,
): Placement {
  const next: (string | null)[] = (current ?? []).slice(0, size)
  while (next.length < size) next.push(null)
  for (let i = 0; i < size; i += 1) {
    const cell = next[i]
    if (cell !== null && cell !== undefined && !ids.includes(cell)) next[i] = null
  }
  const capacity = keepFree ? size - 1 : size
  for (const id of ids) {
    if (next.includes(id)) continue
    const filled = next.filter(cell => cell !== null).length
    if (filled >= capacity) break
    const free = next.indexOf(null)
    if (free >= 0) next[free] = id
  }
  return next
}

/**
 * Compare two grids by value.
 * @param a - one grid.
 * @param b - the other grid.
 * @returns whether both hold the same ids in the same cells.
 */
export function sameGrid(a: Placement | undefined, b: Placement | undefined): boolean {
  if (a === undefined || b === undefined || a.length !== b.length) return false
  return a.every((cell, i) => cell === b[i])
}

/**
 * Swap two cells, returning a new grid.
 * @param grid - the source grid.
 * @param from - first cell index.
 * @param to - second cell index.
 * @returns a new grid with the two cells exchanged.
 */
export function swapCells(grid: Placement, from: number, to: number): Placement {
  const next = grid.slice()
  const moved = next[from] ?? null
  next[from] = next[to] ?? null
  next[to] = moved
  return next
}

/* ----------------------------------------------------------------------------
 * v2 feature logic — still pure (no React, no DOM), so it stays unit-testable.
 * --------------------------------------------------------------------------*/

/** One of the four cat states the monitor face can show. */
export type CatState = 'idle' | 'typing' | 'thinking' | 'sleepy'

/** Inputs the cat state machine reduces over. */
export interface CatInput {
  /** Whether any session on the desk is currently streaming (running). */
  readonly running: boolean
  /** Last time the desk was touched (epoch ms), or undefined if never. */
  readonly lastActivity: number | undefined
  /** Whether the user is actively typing in the conversation composer. */
  readonly userTyping: boolean
}

/**
 * Reduce the desk's live signals to one cat state.
 *
 * Precedence: SLEEPY (no activity in 30 min) > ASSIST_THINKING (any session
 * streaming) > USER_TYPING (composer active) > IDLE. A desk whose activity has
 * never been recorded (never opened) is treated as freshly touched, so a new
 * workspace shows IDLE rather than SLEEPY.
 * @param input - the desk's current signals.
 * @returns the cat state to render.
 */
export function deriveCatState(input: CatInput): CatState {
  const idleFor = input.lastActivity === undefined ? 0 : Date.now() - input.lastActivity
  if (idleFor > SLEEPY_AFTER_MS) return 'sleepy'
  if (input.running) return 'thinking'
  if (input.userTyping) return 'typing'
  return 'idle'
}

/**
 * Format an epoch timestamp as a coarse relative label.
 * @param epoch - the timestamp to describe, or undefined for "never".
 * @param now - the reference time (epoch ms).
 * @returns a short Chinese relative-time string.
 */
export function formatRelative(epoch: number | undefined, now: number): string {
  if (epoch === undefined) return '从未'
  const diff = now - epoch
  if (diff < 0) return '刚刚'
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  return `${day} 天前`
}

/** One desk's ranking signals for the today panel. */
export interface DeskActivity {
  readonly id: string
  readonly title: string
  readonly accent: string
  /** How many of the desk's sessions are currently running. */
  readonly running: number
  /** Most recent activity on the desk (epoch ms), 0 if none. */
  readonly lastActivity: number
}

/**
 * Rank desks for the "most active" list.
 *
 * Primary key is running-session count (desc), tie-broken by last activity
 * (desc), so a desk with live links always outranks an idle one even when both
 * were touched recently.
 * @param items - the desks to rank.
 * @returns the same desks, ordered most-active first.
 */
export function rankDesks(items: readonly DeskActivity[]): DeskActivity[] {
  return [...items].sort((a, b) => (
    b.running - a.running
    || b.lastActivity - a.lastActivity
    || a.title.localeCompare(b.title)
  ))
}

/** One note's ranking signals for the today panel. */
export interface NoteActivity {
  readonly sid: string
  readonly title: string
  readonly deskId: string
  /** Last activity on the note (epoch ms), 0 if none. */
  readonly lastActivity: number
}

/**
 * Rank notes for the "recently updated" list by last activity, newest first.
 * @param items - the notes to rank.
 * @returns the same notes, ordered most-recent first.
 */
export function rankNotes(items: readonly NoteActivity[]): NoteActivity[] {
  return [...items].sort((a, b) => (
    b.lastActivity - a.lastActivity
    || a.title.localeCompare(b.title)
  ))
}

/**
 * Pick the highest-activity ids from a desk's placement, newest first.
 *
 * Used by the standby thumbnails (D): the monitor shows the three notes the
 * user most recently touched. Sessions with no recorded activity sort last.
 * @param order - the desk's note placement grid.
 * @param activity - per-session last-activity map.
 * @param limit - how many ids to return.
 * @returns up to `limit` session ids, most-recent first.
 */
export function recentFromOrder(
  order: readonly (string | null)[],
  activity: Readonly<Record<string, number>>,
  limit: number,
): string[] {
  return order
    .filter((sid): sid is string => sid !== null)
    .sort((a, b) => (activity[b] ?? 0) - (activity[a] ?? 0))
    .slice(0, limit)
}
