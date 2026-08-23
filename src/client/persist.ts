/**
 * Scene persistence across page loads.
 *
 * Desk layout and note placement are user-arranged data, not derived state:
 * rebuilding them from the live workspace and session lists on every load
 * discards the arrangement and drops every desk back to the order the service
 * happens to publish. This module stores just the arranged slice in
 * `localStorage` and restores it as the store's seed.
 *
 * Only plain owned data is written. Live service objects never reach here.
 * @module dsh-client-pixel-office/persist
 */
import type { Placement } from './placement.ts'
import type { SceneState, Store } from './store.ts'

/**
 * Storage key, versioned.
 *
 * A schema change gets a new suffix rather than a migration: the payload is a
 * cosmetic arrangement, so discarding an unreadable old shape costs the user
 * one re-drag, while silently mis-reading it would scramble the board.
 */
const STORAGE_KEY = 'dsh-pixel-office:scene:v1'

/**
 * The scene fields worth surviving a reload.
 *
 * `limit` is included even though the board measures it on mount: it is the
 * width `order`'s grids were built at. Restoring the grids under the default
 * placeholder would make the first reconcile pass truncate them to 12 cells and
 * reflow every note past that point, before the measurement could correct it.
 */
export type PersistedScene = Pick<
  SceneState, 'layout' | 'order' | 'labels' | 'limit' | 'intensity' | 'grid'
>

/**
 * Narrow unknown JSON to a placement grid.
 *
 * Anything that is not an array of string-or-null is rejected whole rather
 * than repaired: a partially-trusted grid could place a foreign id into a
 * cell, and the reconcile pass would then treat it as a live session.
 * @param value - parsed JSON of unknown shape.
 * @returns the grid, or undefined when the shape is wrong.
 */
function readPlacement(value: unknown): Placement | undefined {
  if (!Array.isArray(value)) return undefined
  for (const cell of value) {
    if (cell !== null && typeof cell !== 'string') return undefined
  }
  return value as Placement
}

/**
 * Narrow unknown JSON to a string-keyed record of grids.
 * @param value - parsed JSON of unknown shape.
 * @returns the record, keeping only entries whose grid is well-formed.
 */
function readOrder(value: unknown): Record<string, Placement> {
  const out: Record<string, Placement> = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const grid = readPlacement(raw)
    if (grid !== undefined) out[key] = grid
  }
  return out
}

/**
 * Narrow unknown JSON to a string-to-string record.
 * @param value - parsed JSON of unknown shape.
 * @returns the record, keeping only string values.
 */
function readLabels(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return out
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string') out[key] = raw
  }
  return out
}

/**
 * Read the stored arrangement.
 *
 * Every failure path returns undefined so the scene falls back to a fresh
 * layout: storage can be disabled, full, or hold a payload written by another
 * version, and none of those should stop the plugin from mounting.
 * @returns the restored slice, or undefined when nothing usable is stored.
 */
export function loadScene(): Partial<PersistedScene> | undefined {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage disabled (private mode, blocked cookies). Not an error.
    return undefined
  }
  if (raw === null || raw === '') return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const source = parsed as Record<string, unknown>

  // Built as a mutable local: `SceneState`'s fields are readonly and `Pick`
  // preserves that, so the object is assembled here and returned as the
  // readonly slice.
  const restored: {
    -readonly [K in keyof PersistedScene]?: PersistedScene[K]
  } = {
    order: readOrder(source.order),
    labels: readLabels(source.labels),
  }
  const layout = readPlacement(source.layout)
  if (layout !== undefined) restored.layout = layout
  // Guard the range: a corrupt or hostile value here would size the matrix.
  if (
    typeof source.limit === 'number'
    && Number.isInteger(source.limit)
    && source.limit > 0
    && source.limit <= 512
  ) restored.limit = source.limit
  if (source.intensity === 'calm' || source.intensity === 'overdrive') {
    restored.intensity = source.intensity
  }
  if (typeof source.grid === 'boolean') restored.grid = source.grid
  return restored
}

/**
 * Mirror the arranged slice into storage whenever it changes.
 *
 * `store.set` fires on every pointer move during a drag, so the subscriber
 * first compares the five persisted fields by identity. The store merges
 * shallowly, so an untouched field keeps its reference and the common case
 * costs five comparisons and no serialization.
 * @param store - the scene store to observe.
 * @returns a disposer that stops mirroring.
 */
export function persistScene(store: Store): () => void {
  let last: PersistedScene | undefined

  const write = (): void => {
    const state = store.get()
    if (
      last !== undefined
      && last.layout === state.layout
      && last.order === state.order
      && last.labels === state.labels
      && last.limit === state.limit
      && last.intensity === state.intensity
      && last.grid === state.grid
    ) return

    const snapshot: PersistedScene = {
      layout: state.layout,
      order: state.order,
      labels: state.labels,
      limit: state.limit,
      intensity: state.intensity,
      grid: state.grid,
    }
    last = snapshot
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Quota exceeded or storage disabled: the scene still works in memory.
    }
  }

  write()
  return store.subscribe(write)
}

/**
 * Drop stored entries for workspaces and sessions that no longer exist.
 *
 * Without this, every deleted workspace leaves its note grid behind and the
 * payload grows without bound. Returns the same references when nothing is
 * stale, so the caller can skip a redundant store write.
 * @param order - note placement per workspace id.
 * @param labels - display text per session id.
 * @param liveWorkspaceIds - workspace ids that currently exist.
 * @param liveSessionIds - session ids that currently exist.
 * @returns the pruned records, or the originals when already clean.
 */
export function pruneScene(
  order: Readonly<Record<string, Placement>>,
  labels: Readonly<Record<string, string>>,
  liveWorkspaceIds: readonly string[],
  liveSessionIds: readonly string[],
): { order: Readonly<Record<string, Placement>>; labels: Readonly<Record<string, string>> } {
  const workspaces = new Set(liveWorkspaceIds)
  const sessions = new Set(liveSessionIds)

  const orderKeys = Object.keys(order)
  const labelKeys = Object.keys(labels)
  const staleOrder = orderKeys.some(key => !workspaces.has(key))
  const staleLabels = labelKeys.some(key => !sessions.has(key))
  if (!staleOrder && !staleLabels) return { order, labels }

  const nextOrder: Record<string, Placement> = {}
  for (const key of orderKeys) if (workspaces.has(key)) nextOrder[key] = order[key] as Placement
  const nextLabels: Record<string, string> = {}
  for (const key of labelKeys) if (sessions.has(key)) nextLabels[key] = labels[key] as string

  return {
    order: staleOrder ? nextOrder : order,
    labels: staleLabels ? nextLabels : labels,
  }
}
