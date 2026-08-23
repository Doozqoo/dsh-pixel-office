/**
 * Placement and presentation logic, kept free of React and the DOM so it can
 * be reasoned about and tested without a browser.
 * @module dsh-client-pixel-office/placement
 */

/** Desks in the top-down view: a 6x4 grid (6 columns, 4 rows). */
export const DESKS = 24

/** Sticky-note paper colors, chosen per session id so a note keeps its color. */
export const STICKER_COLORS = ['#ffeda8', '#ffbacf', '#bdf7c7', '#bddbff', '#b0f2eb'] as const

/** Neon accent colors, assigned per workspace id so each desk keeps its color. */
export const ACCENTS = ['#5cff9e', '#5ce0ff', '#ffe35c', '#ff5cab', '#ff9e1c', '#6699ff'] as const

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

/** Aspect ratio of one sticky note (width / height), used to size matrix cells. */
export const NOTE_RATIO = 156 / 168
