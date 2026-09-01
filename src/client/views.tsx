/**
 * Pixel Office React views: header/toolbar + the top-down desk grid; planning
 * board + CRT-cutout monitor + new-note stack on the desk front view.
 * @module dsh-client-pixel-office/views
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  ACCENTS, DESKS, NOTE_RATIO, STICKER_COLORS, UNGROUPED_KEY,
  DRAG_THRESHOLD, MAX_NOTE_W, MIN_NOTE_W, CELL_GAP,
  PREVIEW_CARD_W, PREVIEW_SHOW_DELAY_MS, PREVIEW_HIDE_DELAY_MS, REVEAL_CLEANUP_MS,
} from './constants.ts'
import { formatRelative, hashIndex, swapCells } from './placement.ts'
import type { Placement } from './placement.ts'
import { hitIndex } from './store.ts'
import type { SceneState, Store } from './store.ts'
import type { SessionFaceMirror } from './contracts.ts'
import { useHostVersion } from './version.ts'
import { SELECTORS } from './adapters/dom.ts'
import { STR } from './strings.ts'

/** One session as the views consume it. */
export interface NoteRecord {
  readonly title: string
  readonly running: boolean
}

/** One workspace as the views consume it. */
export interface DeskRecord {
  readonly id: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** Cell index to element, populated by refs during render. */
type Registry = Record<number, HTMLElement | null>

/**
 * Subscribe to the scene store.
 * @param store - the scene store.
 * @returns the current snapshot, re-rendering on every change.
 */
export function useScene(store: Store): SceneState {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/**
 * Extract the last message from a live session face.
 *
 * `binding(id).session` is a `SessionFace` (`ISession &
 * ObservableSnapshot<ConversationSnapshot>`); its snapshot exposes `nodes`,
 * each carrying text as `content[]` (user) or `blocks[]` (assistant), or a flat
 * `text`. This replaces the old placeholder that claimed the harness hid
 * message contents — it does not. Messages are fully exposed.
 * @param face - the live session face, or undefined.
 * @returns the most recent message's role and text, or undefined.
 */
export function lastMessageFromFace(
  face: SessionFaceMirror | undefined,
): { readonly role: string; readonly text: string } | undefined {
  const snap = face?.getSnapshot?.()
  const nodes = snap?.nodes
  if (nodes === undefined || nodes.length === 0) return undefined
  const last = nodes[nodes.length - 1]
  if (last === undefined) return undefined
  const role = last.kind === 'assistant' ? 'AI' : last.kind === 'user' ? 'YOU' : 'SYS'
  let text = ''
  if (Array.isArray(last.blocks)) {
    text = last.blocks.map((b) => b?.text ?? '').filter(Boolean).join(' ')
  } else if (Array.isArray(last.content)) {
    text = last.content.map((c) => c?.text ?? '').filter(Boolean).join(' ')
  } else if (typeof last.text === 'string') {
    text = last.text
  }
  text = text.trim()
  if (text === '') return undefined
  return { role, text }
}

/**
 * The Pixel Office settings page, mounted by the host into `settings.section`.
 *
 * Reads and writes the scene store directly. The master switch toggles
 * `enabled` (the whole scene unmounts when off, but this section — rendered in
 * the host settings panel — stays reachable to turn it back on). Intensity and
 * grid are user preferences persisted across reloads.
 * @param store - the scene store.
 * @param close - the host-provided close affordance for the settings panel.
 */
export function PixelOfficeSettings(props: {
  readonly store: Store
  readonly close: () => void
}): ReactNode {
  const { store } = props
  const scene = useScene(store)
  const baseVersion = useHostVersion()
  const setEnabled = (value: boolean) => { store.set({ enabled: value }) }
  const setIntensity = (value: 'calm' | 'overdrive') => { store.set({ intensity: value }) }
  const setGrid = (value: boolean) => { store.set({ grid: value }) }
  return (
    <div className="pxo-settings">
      <div className="pxo-settings-hero">
        <span className="pxo-settings-kicker">{STR.SETTINGS_THEME}</span>
        <h2>{STR.SETTINGS_TITLE}</h2>
        <p>{STR.SETTINGS_DESC}</p>
        <PoweredBy className="pxo-settings-ver" version={baseVersion} />
      </div>

      <div className="pxo-set-master">
        <div className="pxo-set-row"><span>{STR.SETTINGS_ENABLE}</span></div>
        <button
          type="button"
          className="pxo-toggle"
          aria-pressed={scene.enabled}
          onClick={() => { setEnabled(!scene.enabled) }}
        >
          <span />{scene.enabled ? STR.SETTINGS_ON : STR.SETTINGS_OFF}
        </button>
        <p className="pxo-note">{STR.SETTINGS_ENABLE_NOTE}</p>
      </div>

      <div className="pxo-set-card">
        <div className="pxo-set-row"><span>{STR.SETTINGS_INTENSITY}</span></div>
        <div className="pxo-segment" role="group" aria-label="动效强度">
          <button
            type="button"
            aria-pressed={scene.intensity === 'calm'}
            onClick={() => { setIntensity('calm') }}
          >{STR.SETTINGS_CALM}</button>
          <button
            type="button"
            aria-pressed={scene.intensity === 'overdrive'}
            onClick={() => { setIntensity('overdrive') }}
          >{STR.SETTINGS_OVERDRIVE}</button>
        </div>
        <p className="pxo-note">{STR.SETTINGS_INTENSITY_NOTE}</p>
      </div>

      <div className="pxo-set-card">
        <div className="pxo-set-row"><span>{STR.SETTINGS_GRID}</span></div>
        <button
          type="button"
          className="pxo-toggle"
          aria-pressed={scene.grid}
          onClick={() => { setGrid(!scene.grid) }}
        >
          <span />{scene.grid ? STR.SETTINGS_SHOWN : STR.SETTINGS_HIDDEN}
        </button>
        <p className="pxo-note">{STR.SETTINGS_GRID_NOTE}</p>
      </div>
    </div>
  )
}

/** Pointer-targets populated by the planning-board drag handlers. */
const SLOTS: Registry = {}
/** Pointer-targets populated by the desk-grid drag handlers. */
const DESK_REGISTRY: Registry = {}

/**
 * Measure an element and report the grid that exactly fills it.
 *
 * The matrix fills the slate instead of deriving its shape from the note
 * limit: a fixed shape left most of the board bare, because the limit caps
 * how many notes may exist, not how much space the board has. Both axes are
 * divided exactly, so the grid reaches all four edges.
 * @param ref - the element to measure.
 * @returns column and row counts (both at least 1) and the width a note
 * should render at inside one cell.
 */
function useFittedGrid(ref: React.RefObject<HTMLElement | null>): {
  columns: number
  rows: number
  noteW: number
} {
  const [box, setBox] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (element === null) return
    // ResizeObserver rather than a window listener: the board also changes
    // size when the sidebar or the viewport chrome moves, which a resize
    // event does not report.
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect !== undefined) setBox({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => { observer.disconnect() }
  }, [ref])
  return useMemo(() => {
    if (box.width <= 0 || box.height <= 0) return { columns: 1, rows: 1, noteW: MAX_NOTE_W }
    // Cells may shrink toward MIN_NOTE_W to claim another column: sizing
    // strictly by the natural width wasted most of a column on common
    // viewports (149px spare at 1440x900).
    const columns = Math.max(1, Math.floor((box.width + CELL_GAP) / (MIN_NOTE_W + CELL_GAP)))
    const colW = (box.width - (columns - 1) * CELL_GAP) / columns
    // Rows are ROUNDED, not floored, then the height is divided exactly among
    // them: flooring discarded the remainder and left a dead band along the
    // bottom of the slate (32% of it at 1366x768). Rounding may overshoot, so
    // the count is nudged until each cell lands in the height range a note can
    // occupy without visibly distorting.
    const minH = MIN_NOTE_W / NOTE_RATIO
    const maxH = MAX_NOTE_W / NOTE_RATIO
    const heightFor = (n: number) => (box.height - (n - 1) * CELL_GAP) / n
    let rows = Math.max(1, Math.round((box.height + CELL_GAP) / (colW / NOTE_RATIO + CELL_GAP)))
    while (rows > 1 && heightFor(rows) < minH) rows -= 1
    while (heightFor(rows + 1) >= minH && heightFor(rows) > maxH) rows += 1
    // The note is capped by whichever axis is tighter, so it keeps its exact
    // proportions while the cell itself fills its share of the board.
    const noteW = Math.min(colW, heightFor(rows) * NOTE_RATIO)
    return { columns, rows, noteW }
  }, [box.width, box.height])
}

/** A leading neon block used beside HUD section labels. */
const NEON_BLOCK: CSSProperties = {
  width: 4, height: 22, background: 'var(--pxo-neon)',
  boxShadow: '0 0 6px var(--pxo-glow)',
}

/**
 * The parallax backdrop shared by both views.
 *
 * Every layer is an empty element painted entirely by the stylesheet, so the
 * depth costs five nodes and no JavaScript. Rendered first in each `.pxo-fill`
 * so it sits behind the content without needing a negative z-index.
 */
function Backdrop(): ReactNode {
  return (
    <div className="pxo-bg-layers" aria-hidden="true">
      <div className="pxo-sky" />
      <div className="pxo-grid-sky" />
      <div className="pxo-grid-floor" />
      <div className="pxo-motes a" />
      <div className="pxo-motes b" />
      <div className="pxo-motes c" />
      <div className="pxo-vign" />
    </div>
  )
}

/**
 * Top chrome: the OS-style title bar shared by every office view.
 * @param trail - breadcrumb segments, last one highlighted.
 * @param right - right-aligned extras (search, pills, settings, etc.).
 */
function OfficeHeader(props: {
  readonly trail: readonly string[]
  readonly accent?: string
  readonly right?: ReactNode
}): ReactNode {
  return (
    <div className="pxo-header">
      <div className="pxo-logo">
        <div className="pxo-logo-square" />
        <div className="pxo-logo-text">
          <div className="pxo-logo-main" data-text={STR.LOGO_MAIN}>{STR.LOGO_MAIN}</div>
          <div className="pxo-logo-sub">{STR.LOGO_SUB}</div>
        </div>
      </div>
      <div className="pxo-breadcrumb">
        {props.trail.map((seg, i, arr) => (
          <span key={i} style={{
            color: i === arr.length - 1 ? 'var(--pxo-neon)' : 'var(--pxo-dim)',
            fontWeight: i === arr.length - 1 ? 700 : 400,
          }}>
            {seg}{i < arr.length - 1 ? ' / ' : ''}
          </span>
        ))}
      </div>
      {props.right}
    </div>
  )
}

/** A small pill for "X ONLINE / IDLE / EMPTY" status badges. */
function OnlinePill({ count }: { count: number }): ReactNode {
  return (
    <span className="pxo-status-pill">
      <span className="dot" />
      <span>{count} ONLINE</span>
    </span>
  )
}

/**
 * `POWERED BY DSH <base version>`.
 *
 * The version is the harness running underneath, not this plugin's own — see
 * `version.ts` for why it has to be read out of the sidebar badge. When the
 * badge cannot be found the name prints alone: an absent version is better
 * than a wrong one, and the credit line still reads correctly either way.
 * @param version - the base version, or `undefined` when unavailable.
 * @param className - the chrome class of the surrounding surface.
 */
function PoweredBy(props: { readonly version: string | undefined; readonly className: string }): ReactNode {
  return (
    <span className={props.className}>
      POWERED BY DSH{props.version === undefined ? '' : ` ${props.version}`}
    </span>
  )
}

/** Functional command search for filtering workspaces. */
function SearchField(props: {
  readonly value: string
  readonly onChange: (value: string) => void
}): ReactNode {
  return (
    <label className="pxo-search">
      <span className="pxo-ico-search" aria-hidden="true" />
      <input
        type="search"
        value={props.value}
        placeholder={STR.SEARCH_PLACEHOLDER}
        aria-label="搜索工作区"
        onChange={(event) => { props.onChange(event.target.value) }}
      />
      <span className="kbd">/</span>
    </label>
  )
}

/** "Settings" button: delegates to the host trigger via a passed-in callback. */
function SettingsButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button type="button" className="pxo-btn-set" onClick={onClick}>
      ⚙&nbsp;SETTINGS
    </button>
  )
}

/* =============================================================================
 * Top-view: pixel office shown as a 3x2 desk grid.
 * ===========================================================================*/

/** The four pixel-art assets placed in each quadrant of a 田 desk. */
function DeskArt({ accent, accentSoft, monitorOn }: {
  readonly accent: string
  readonly accentSoft: string
  readonly monitorOn: boolean
}): ReactNode {
  return (
    <>
      {/* Top-left: CRT monitor. While the node works, a monochrome pixel cat
          face fills the screen and blinks. Gated on `monitorOn`, so an idle
          workspace shows a dark screen. */}
      <div className="pxo-tile">
        <div className={monitorOn ? 'pxo-art-monitor is-run' : 'pxo-art-monitor'} style={{
          boxShadow: `0 0 0 2px ${accent}, inset 0 0 14px ${accentSoft}`,
        } as CSSProperties}>
          <span className="beacon" />
          {monitorOn
            ? (
                <div className="pxo-catface" aria-hidden="true">
                  <span className="ear l" />
                  <span className="ear r" />
                  <span className="face">
                    <span className="eye l" />
                    <span className="eye r" />
                    <span className="nose" />
                    <span className="whisker l" />
                    <span className="whisker r" />
                  </span>
                </div>
              )
            : null}
        </div>
      </div>
      {/* Top-right: sticky note. */}
      <div className="pxo-tile">
        <div className="pxo-art-note" style={{ boxShadow: `inset -2px -2px 0 rgba(0,0,0,.4), inset 2px 2px 0 rgba(255,255,255,.06), 2px 2px 0 ${accent}` } as CSSProperties}>
          {/* tape painted by ::before */}
        </div>
      </div>
      {/* Bottom-left: notebook. */}
      <div className="pxo-tile">
        <div className="pxo-art-book">
          <span className="ln" />
          <span className="ln" />
          <span className="ln" />
          <span className="ln" />
        </div>
      </div>
      {/* Bottom-right: coffee mug. Absolutely placed inside the tile like the
          other props, so its handle stays within the tile bounds. */}
      <div className="pxo-tile">
        <div className="pxo-art-cup" />
      </div>
    </>
  )
}

/** A pixel-art "empty seat" — pure SVG so it scales clean. */
function EmptyChair(): ReactNode {
  return (
    <div className="pxo-empty-chair" aria-hidden="true">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet">
        {/* Chair back */}
        <rect x="34" y="20" width="32" height="28" fill="var(--pxo-bg3)" stroke="var(--pxo-edge)" strokeWidth="2" />
        <rect x="40" y="28" width="20" height="3" fill="var(--pxo-edge)" />
        <rect x="40" y="36" width="14" height="3" fill="var(--pxo-edge)" />
        {/* Seat */}
        <rect x="28" y="48" width="44" height="10" fill="var(--pxo-edge)" stroke="var(--pxo-line)" strokeWidth="1" />
        <rect x="28" y="48" width="44" height="3" fill="var(--pxo-line)" />
        {/* Legs */}
        <rect x="32" y="58" width="6" height="22" fill="var(--pxo-edge)" />
        <rect x="62" y="58" width="6" height="22" fill="var(--pxo-edge)" />
        {/* Back leg (slightly behind) */}
        <rect x="46" y="58" width="8" height="6" fill="var(--pxo-line)" />
      </svg>
    </div>
  )
}

/** A single station in the 3x2 desk grid. */
function DeskTile(props: {
  readonly index: number
  readonly accent: string | undefined
  readonly accentSoft: string
  readonly isEmpty: boolean
  readonly name: string
  readonly idLabel: string
  readonly meta: string
  readonly countLabel: string
  readonly isOnline: boolean
  readonly dragging: boolean
  readonly hoverOver: boolean
  readonly onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onEnter: () => void
  readonly onClear: () => void
  readonly onRename: () => void
  readonly onCreate: (index: number) => void
  /** When true this is the pinned 未分组 station: rename/clear are hidden. */
  readonly isUngrouped?: boolean
}): ReactNode {
  const state = props.isEmpty
    ? 'off'
    : props.isOnline
      ? 'run'
      : 'idle'
  const stateText = props.isEmpty
    ? STR.DESK_EMPTY
    : props.isOnline
      ? STR.DESK_ONLINE
      : STR.DESK_IDLE
  const slug = String(props.index + 1).padStart(2, '0')
  return (
    <div
      className="pxo-desk"
      role="button"
      tabIndex={0}
      aria-label={`${props.name}，${stateText}`}
      ref={(el) => { DESK_REGISTRY[props.index] = el }}
      style={{
        ...(props.accent === undefined ? {} : { '--pxo-accent': props.accent }),
        '--pxo-i': props.index,
      } as CSSProperties}
      data-drag={props.dragging ? '1' : '0'}
      data-over={props.hoverOver ? '1' : '0'}
      data-empty={props.isEmpty ? '1' : '0'}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerUp}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if (props.isEmpty) props.onCreate(props.index)
        else props.onEnter()
      }}
    >
      <div className={props.isEmpty ? 'pxo-plate empty' : 'pxo-plate'}>
        <b>{props.name}</b>
        <span className="id">#{slug}</span>
      </div>

      <div className="pxo-desk-top">
        <span className={`pxo-state ${state}`}>
          <span className="dot" />
          <span>{stateText}</span>
        </span>
        <div className="pxo-desk-actions">
          {props.isEmpty || props.isUngrouped
            ? null
            : (
                <>
                  <button
                    type="button"
                    className="pxo-ico"
                    title={STR.RENAME_TITLE}
                    aria-label={`${STR.RENAME_TITLE} ${props.name}`}
                    onPointerDown={(event) => { event.stopPropagation() }}
                    onClick={(event) => { event.stopPropagation(); props.onRename() }}
                  >✎</button>
                  <button
                    type="button"
                    className="pxo-ico"
                    title={STR.CLEAR_TITLE}
                    aria-label={`${STR.CLEAR_TITLE} ${props.name}`}
                    onPointerDown={(event) => { event.stopPropagation() }}
                    onClick={(event) => { event.stopPropagation(); props.onClear() }}
                  >×</button>
                </>
              )}
        </div>
      </div>

      <div className="pxo-tian" style={{
        boxShadow: props.accent === undefined
          ? undefined
          : `inset 0 0 0 3px ${props.accent}, 0 0 16px ${props.accentSoft}` as unknown as string,
      }}>
        {props.isEmpty
          ? <EmptyChair />
          : (
              <DeskArt
                accent={props.accent ?? 'var(--pxo-neon)'}
                accentSoft={props.accentSoft}
                monitorOn={props.isOnline}
              />
            )}
      </div>

      {props.isEmpty
        ? null
        : (
            <div className="pxo-meta">
              <span>{props.meta}</span>
              <span className="count">{props.countLabel}</span>
            </div>
          )}

      {props.isEmpty
        ? (
            <button
              type="button"
              className="pxo-empty-cta"
              title={STR.DESK_EMPTY_META}
              onClick={(e) => { e.stopPropagation(); props.onCreate(props.index) }}
            >
              <span className="plus">+</span>
              <span className="label">{STR.NEW_STATION_LABEL}</span>
            </button>
          )
        : null}
    </div>
  )
}

/** Top-down office view. */
export function TopView(props: {
  readonly store: Store
  readonly desks: readonly DeskRecord[]
  readonly running: Readonly<Record<string, boolean>>
  /** Unarchived, published note count per workspace id — what the matrix pins. */
  readonly liveCounts: Readonly<Record<string, number>>
  readonly onCreate: (index?: number) => void
  readonly onEnter: (wsId: string) => void
  readonly onClear: (wsId: string) => void
  readonly onRename: (wsId: string) => void
  readonly onSettings: () => void
}): ReactNode {
  const { store, desks, running } = props
  const scene = useScene(store)
  const drag = scene.drag
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'online'>('all')
  const baseVersion = useHostVersion()
  const onlineCount = useMemo(
    () => scene.layout.reduce((acc, id) => acc + ((id !== null && running[id] === true) ? 1 : 0), 0),
    [scene.layout, running],
  )

  const onDown = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    // Cell 0 is the pinned 未分组 station and must never be dragged.
    if (scene.layout[i] === null || scene.layout[i] === UNGROUPED_KEY) return
    e.currentTarget.setPointerCapture(e.pointerId)
    store.set({ drag: { kind: 'desk', from: i, x: e.clientX, y: e.clientY, moved: false, over: -1 } })
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = store.get().drag
    if (current === null || current.kind !== 'desk') return
    const moved = current.moved
      || Math.abs(e.clientX - current.x) + Math.abs(e.clientY - current.y) > DRAG_THRESHOLD
    store.set({
      drag: { ...current, x: e.clientX, y: e.clientY, moved, over: hitIndex(DESK_REGISTRY, e.clientX, e.clientY) },
    })
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    const current = store.get().drag
    store.set({ drag: null })
    // The 未分组 station skips the pointer-down drag (cell 0 is pinned), so a
    // plain click arrives here with no drag in flight. Recover it as an enter —
    // otherwise the station is mouse-unenterable (only keyboard Enter/Space
    // worked) and its sessions can't be reached to continue or delete them.
    if (current === null && scene.layout[i] === UNGROUPED_KEY) {
      props.onEnter(UNGROUPED_KEY)
      return
    }
    if (current === null || current.kind !== 'desk') return
    if (!current.moved) {
      const wsId = scene.layout[i]
      if (wsId !== null && wsId !== undefined) props.onEnter(wsId)
      return
    }
    const target = hitIndex(DESK_REGISTRY, e.clientX, e.clientY)
    // Never drop onto cell 0 (the pinned 未分组 station) and never drag it
    // away from cell 0 — the reconcile re-pins it, so reject early to avoid a
    // flicker where a real workspace briefly occupies the corner.
    if (target < 0 || target === current.from || target === 0 || current.from === 0) return
    store.set({ layout: swapCells(scene.layout, current.from, target) })
  }

  /**
   * Reorder the desk grid by the chosen mode (one-shot; manual drag still wins
   * afterwards). `manual` only records the mode — the user owns `layout` via
   * drag. `activity` ranks every real workspace by the most-recent session
   * activity (the plugin's own `activity` stamps) and compacts them to the
   * front, pinning 未分组 at cell 0 and pushing empty stations to the tail.
   */
  const applySort = (mode: 'manual' | 'activity'): void => {
    if (mode === 'manual') {
      store.set({ sortMode: 'manual' })
      return
    }
    const realDesks = desks.filter(d => d.id !== UNGROUPED_KEY)
    const recency = (id: string): number => {
      const desk = realDesks.find(d => d.id === id)
      if (desk === undefined) return 0
      let max = 0
      for (const sid of desk.sessionIds) {
        const t = scene.activity[sid] ?? 0
        if (t > max) max = t
      }
      return max
    }
    const ordered = [...realDesks].sort((a, b) => recency(b.id) - recency(a.id))
    const next: (string | null)[] = new Array(DESKS).fill(null)
    next[0] = UNGROUPED_KEY
    ordered.forEach((d, i) => { if (i + 1 < DESKS) next[i + 1] = d.id })
    store.set({ layout: next as Placement, sortMode: 'activity' })
  }

  return (
    <div className="pxo-fill" data-mode="top">
      <Backdrop />
      <OfficeHeader
        trail={[STR.TOP_TRAIL.split(' / ')[0]!, STR.TOP_TRAIL.split(' / ')[1]!]}
        right={
          <>
            <OnlinePill count={onlineCount} />
            <SearchField value={query} onChange={setQuery} />
            <SettingsButton onClick={props.onSettings} />
          </>
        }
      />
      <div className="pxo-toolbar">
        <span style={NEON_BLOCK} />
        <span className="pxo-toolbar-title">{STR.TOOLBAR_TITLE}</span>
        <span className="pxo-toolbar-sub">{STR.TOOLBAR_SUB(DESKS, onlineCount)}</span>
        <div className="pxo-toolbar-right">
          <div className="pxo-sort" role="group" aria-label="工位排序">
            <span className="pxo-sort-label">{STR.SORT_LABEL}</span>
            <button
              type="button"
              className={scene.sortMode === 'manual' ? 'pxo-chip is-active' : 'pxo-chip'}
              aria-pressed={scene.sortMode === 'manual'}
              onClick={() => { applySort('manual') }}
            >
              {STR.SORT_MANUAL}
            </button>
            <button
              type="button"
              className={scene.sortMode === 'activity' ? 'pxo-chip is-active' : 'pxo-chip'}
              aria-pressed={scene.sortMode === 'activity'}
              onClick={() => { applySort('activity') }}
            >
              {STR.SORT_ACTIVITY}
            </button>
          </div>
          <button
            type="button"
            className={filter === 'all' ? 'pxo-chip is-active' : 'pxo-chip'}
            aria-pressed={filter === 'all'}
            onClick={() => { setFilter('all') }}
          >
            <span className="dot" /> {STR.FILTER_ALL}
          </button>
          <button
            type="button"
            className={filter === 'online' ? 'pxo-chip is-active' : 'pxo-chip'}
            aria-pressed={filter === 'online'}
            onClick={() => { setFilter('online') }}
          >
            {STR.FILTER_ONLINE}
          </button>
          <button type="button" className="pxo-btn-new" onClick={() => { props.onCreate() }}>
            {STR.NEW_STATION}
          </button>
        </div>
      </div>

      <div className="pxo-grid">
        {new Array(DESKS).fill(0).map((_, i) => {
          const wsId = scene.layout[i] ?? null
          const desk = wsId === null ? undefined : desks.find(d => d.id === wsId)
          const isOnline = wsId === null ? false : running[wsId] === true
          const normalizedQuery = query.trim().toLocaleLowerCase()
          const matchesQuery = normalizedQuery === '' || desk?.title.toLocaleLowerCase().includes(normalizedQuery) === true
          const matchesFilter = filter === 'all' || isOnline
          if (desk !== undefined && (!matchesQuery || !matchesFilter)) return null
          const dragging = drag?.kind === 'desk' && drag.from === i && drag.moved
          const hovered = drag?.kind === 'desk' && drag.moved && drag.over === i && drag.from !== i
          const accent = wsId === null ? undefined : ACCENTS[hashIndex(wsId, ACCENTS.length)]
          const accentSoft = accent === undefined ? 'transparent' : `${accent}26`
          const name = desk?.title ?? '空 位'
          const idLabel = desk === undefined ? `空位 #${String(i + 1).padStart(2, '0')}` : `#${String(i + 1).padStart(2, '0')}`
          const meta = wsId === null
            ? STR.DESK_EMPTY_META
            : isOnline ? STR.DESK_LIVE_LINK : STR.DESK_STANDBY
          // Count the notes the matrix actually pins, not every id the
          // workspace remembers: archived sessions and ids the session list
          // has not published are absent from the board.
          const countLabel = wsId === null
            ? STR.NOTES_COUNT(0)
            : STR.NOTES_COUNT(props.liveCounts[wsId] ?? 0)
          return (
            <DeskTile
              key={i}
              index={i}
              accent={accent}
              accentSoft={accentSoft}
              isEmpty={wsId === null}
              name={name}
              idLabel={idLabel}
              meta={meta}
              countLabel={countLabel}
              isOnline={isOnline}
              dragging={dragging}
              hoverOver={hovered}
              onPointerDown={(e) => { onDown(e, i) }}
              onPointerMove={onMove}
              onPointerUp={(e) => { onUp(e, i) }}
              onEnter={() => { if (desk !== undefined) props.onEnter(desk.id) }}
              onClear={() => { if (desk !== undefined) props.onClear(desk.id) }}
              onRename={() => { if (desk !== undefined) props.onRename(desk.id) }}
              onCreate={props.onCreate}
              isUngrouped={wsId === UNGROUPED_KEY}
            />
          )
        })}
      </div>
      <div className="pxo-caption">
        {STR.CAPTION}
        <PoweredBy className="pxo-version" version={baseVersion} />
      </div>
      {null /* removed: <LinkLost /> — full-bleed NO CARRIER overlay dropped per feedback */}
      {null /* removed: <div className="pxo-scan" /> — scanlines now injected at <body> top by Scene */}

    </div>
  )
}

/* =============================================================================
 * Desk-view: planning board on the left, CRT-cutout monitor on the right.
 * ===========================================================================*/

/**
 * The lightweight summary card shown when a planning-board note is hovered.
 *
 * Read-only: it surfaces the note's title, live status, last-activity time, the
 * most recent message, and a few quick actions, but never changes any existing
 * interaction. The last message is read from the live session face via
 * `lastMessageFromFace(binding(id).session)` — the harness exposes full message
 * contents, so this is real transcript text rather than a placeholder.
 * @param rect - the hovered sticker's viewport rect, for anchoring.
 * @param title - display title (label override or session title).
 * @param running - whether the session is streaming.
 * @param lastActivity - last-activity epoch ms, or undefined.
 * @param last - the most recent message (role + text), or undefined.
 * @param nodeIndex - 0-based slot index, for the "NODE NN" glyph.
 * @param onOpen - open the session on the monitor.
 * @param onEdit - open the existing edit modal for this note.
 * @param onTear - open the existing tear modal for this note.
 * @param onEnter - pointer entered the card; keep it open.
 * @param onLeave - pointer left the card; schedule hide.
 */
function StickerPreview(props: {
  readonly rect: DOMRect
  readonly title: string
  readonly running: boolean
  readonly lastActivity: number | undefined
  readonly last: { readonly role: string; readonly text: string } | undefined
  readonly nodeIndex: number
  readonly onOpen: () => void
  readonly onEdit: () => void
  readonly onTear: () => void
  readonly onEnter: () => void
  readonly onLeave: () => void
  /** When true, the card plays its 100ms exit transition before unmount. */
  readonly closing: boolean
}): ReactNode {
  const CARD_W = PREVIEW_CARD_W
  // Anchor to the sticker's top-right; flip to the left near the right edge so
  // the card never runs off-screen. The card is position:fixed (anchored to the
  // viewport via the sticker's rect) and lives outside the board's overflow, so
  // it is never clipped.
  let left = props.rect.right + 10
  if (left + CARD_W > window.innerWidth - 12) left = props.rect.left - CARD_W - 10
  if (left < 12) left = 12
  let top = props.rect.top
  if (top < 64) top = 64
  const status = props.running
    ? <><span className="dot run" /> {STR.PREVIEW_RUNNING}</>
    : <><span className="dot idle" /> {STR.PREVIEW_IDLE}</>
  return (
    <div
      className={props.closing ? 'pxo-preview closing' : 'pxo-preview'}
      aria-label={`${props.title} 预览`}
      style={{ left: `${left}px`, top: `${top}px`, width: `${CARD_W}px` }}
      onPointerEnter={props.onEnter}
      onPointerLeave={props.onLeave}
    >
      <div className="pxo-preview-hd">
        <span className="pxo-preview-title">{props.title}</span>
        <span className="pxo-preview-node">{STR.PREVIEW_NODE(props.nodeIndex)}</span>
      </div>
      <div className="pxo-preview-status">{status}</div>
      <div className="pxo-preview-time">{STR.PREVIEW_RECENT}{formatRelative(props.lastActivity, Date.now())}</div>
      <div className="pxo-preview-msg" aria-hidden="true">
        {props.last === undefined
          ? (
              <>
                <span className="ln" />
                <span className="ln" />
                <span className="ln short" />
                <span className="ph">{STR.PREVIEW_NO_MESSAGES}</span>
              </>
            )
          : (
              <>
                <span className="pxo-preview-role">{props.last.role}</span>
                <span className="pxo-preview-text">{props.last.text}</span>
              </>
            )}
      </div>
      <div className="pxo-preview-actions">
        <button type="button" className="pxo-btn-pv open" onClick={props.onOpen}>{STR.PREVIEW_OPEN}</button>
        <button type="button" className="pxo-btn-pv" onClick={props.onEdit}>{STR.PREVIEW_EDIT}</button>
        <button type="button" className="pxo-btn-pv" onClick={props.onTear}>{STR.PREVIEW_TEAR}</button>
      </div>
    </div>
  )
}

/** One sticky note. */
function Sticker(props: {
  readonly sessionId: string | null
  readonly note: NoteRecord | undefined
  readonly index: number
  /** Whether this note is the one currently displayed on the monitor. */
  readonly active: boolean
  readonly dragging: boolean
  readonly onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onOpen: () => void
  readonly onPreviewEnter: (sid: string, el: HTMLElement) => void
  readonly onPreviewLeave: () => void
  readonly label: string
}): ReactNode {
  if (props.sessionId === null) return null
  const color = STICKER_COLORS[hashIndex(props.sessionId, STICKER_COLORS.length)]
  const phase = `${(hashIndex(props.sessionId, 19) * 0.137) % 2.6}s`
  return (
    <div
      className={[
        'pxo-sticker',
        props.note?.running === true ? 'run' : '',
        props.active ? 'is-open' : '',
      ].filter(part => part !== '').join(' ')}
      role="button"
      tabIndex={0}
      aria-current={props.active ? 'true' : undefined}
      aria-label={`${props.label}，${props.note?.running === true ? '运行中' : '待机'}${props.active ? '，正在显示器上打开' : ''}`}
      style={{
        background: color,
        animationDelay: phase,
      } as CSSProperties}
      data-drag={props.dragging ? '1' : '0'}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerUp}
      onPointerEnter={(event) => { props.onPreviewEnter(props.sessionId as string, event.currentTarget) }}
      onPointerLeave={props.onPreviewLeave}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        props.onOpen()
      }}
    >
      <span className="tape" style={{ background: props.note?.running === true ? 'var(--pxo-neon)' : 'var(--pxo-magenta)' }} />
      <span className="tag">
        {props.note?.running === true
          ? STR.STICKER_ACTIVE(props.index)
          : STR.STICKER_SESSION(props.index)}
      </span>
      <span className="title">{props.label}</span>
      <span className="meta">
        <span>{props.note?.running === true ? STR.STICKER_UPLINK_ACTIVE : STR.STICKER_UPLINK_IDLE}</span>
        <span>{STR.STICKER_NODE(props.index)}</span>
      </span>
      <span className="curl" style={{ animationDelay: phase }} />
    </div>
  )
}

/** One note in the new-sticky stack. */
interface StackNote {
  readonly id: string
  readonly color: string
}

/** The first stack the desk opens with; IDs are stable so React keeps the
 *  same DOM node across rotations, which lets the CSS transition on
 *  `left`/`top`/`transform`/`background` animate the swap. */
const INITIAL_STACK: readonly StackNote[] = [
  { id: 'pink-1', color: '#ffbacf' },
  { id: 'yellow-1', color: '#ffeda8' },
  { id: 'mint-1', color: '#b0f2eb' },
]

/** Layout of the three notes: hand-picked positions that read as "messy desk". */
const STACK_POSITIONS: ReadonlyArray<{ left: number; top: number; rotate: number }> = [
  { left: 8, top: 14, rotate: -8 },
  { left: 24, top: 6, rotate: 6 },
  { left: 44, top: 18, rotate: 0 },
]

/** A stack of 3 sticky notes that the user drags to spawn new ones. */
function NewStickyStack(props: {
  readonly onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  /** Bumped every time the user drops a new sticker on the board. */
  readonly consumed: number
}): ReactNode {
  const [stack, setStack] = useState<StackNote[]>([...INITIAL_STACK])

  // Each `consumed` bump = one sticker was just dropped on the board. Pop the
  // top of the stack, slide the rest up, and append a fresh sticker of the
  // SAME color as the one that was just consumed. With stable IDs, React
  // moves the existing DOM nodes and the CSS transition carries them.
  useEffect(() => {
    if (props.consumed <= 0) return
    setStack(prev => {
      const top = prev[0] ?? INITIAL_STACK[0]!
      const freshId = `${top.id}-r${props.consumed}`
      return [
        ...prev.slice(1),
        { id: freshId, color: top.color },
      ]
    })
  }, [props.consumed])

  return (
    <div className="pxo-stack-zone">
      <div className="pxo-stack-visual">
        {stack.map((note, i) => {
          const pos = STACK_POSITIONS[i] ?? STACK_POSITIONS[2]!
          return (
            <div
              key={note.id}
              className="pxo-stack-note"
              onPointerDown={props.onPointerDown}
              onPointerMove={props.onPointerMove}
              onPointerUp={props.onPointerUp}
              style={{
                left: pos.left,
                top: pos.top,
                transform: `rotate(${pos.rotate}deg)`,
                background: note.color,
              }}
            >
              {i === 0 ? STR.STACK_BLANK : ''}
            </div>
          )
        })}
      </div>
      <div className="pxo-stack-info">
        <div><b>{STR.STACK_TITLE}</b></div>
        <div className="pxo-stack-hint">{STR.STACK_HINT_DRAG}</div>
        <div className="pxo-stack-hint">{STR.STACK_HINT_INPUT}</div>
        <div className="pxo-stack-hint">{STR.STACK_HINT_TEAR}</div>
        <div className="pxo-stack-hint">{STR.STACK_HINT_RESTORE}</div>
        <div className="pxo-stack-hint">{STR.STACK_HINT_OVERLAP}</div>
      </div>
      <div>
        <div className="pxo-stack-arrow">{STR.STACK_ARROW}</div>
        <div className="pxo-stack-hint" style={{ marginTop: 4 }}>{STR.STACK_DRAG_TO}</div>
      </div>
    </div>
  )
}

/** The desk front view: planning board + CRT cutout + new-note stack. */
export function DeskView(props: {
  readonly store: Store
  readonly desk: DeskRecord
  readonly notes: Readonly<Record<string, NoteRecord | undefined>>
  readonly onOpen: (sessionId: string) => void
  readonly onBack: () => void
  readonly onSettings: () => void
  readonly consumed: number
  /** When true this is the 未分组 desk: it is read-only (no new sessions). */
  readonly isUngrouped?: boolean
  /** Resolve the latest message of a session for the hover preview. */
  readonly readLastMessage: (sessionId: string) => { readonly role: string; readonly text: string } | undefined
}): ReactNode {
  const { store, desk, notes } = props
  const scene = useScene(store)
  const limit = scene.limit

  // ── Sticker hover preview (Feature A).
  // Two debounce timers, both tracked for cleanup: a 150ms show delay and a
  // 100ms exit delay. The exit delay is what stops the card from flickering
  // when the pointer sweeps across several notes; re-entering cancels it.
  // While a drag is in flight the preview is suppressed entirely.
  const [preview, setPreview] = useState<{ sid: string; rect: DOMRect } | null>(null)
  const [previewClosing, setPreviewClosing] = useState(false)
  const previewShow = useRef<number | null>(null)
  const previewHide = useRef<number | null>(null)
  const clearPreviewTimers = (): void => {
    if (previewShow.current !== null) { window.clearTimeout(previewShow.current); previewShow.current = null }
    if (previewHide.current !== null) { window.clearTimeout(previewHide.current); previewHide.current = null }
  }
  useEffect(() => () => { clearPreviewTimers() }, [])
  const schedulePreview = (sid: string, el: HTMLElement): void => {
    if (store.get().drag !== null) return
    clearPreviewTimers()
    previewShow.current = window.setTimeout(() => {
      setPreviewClosing(false)
      setPreview({ sid, rect: el.getBoundingClientRect() })
    }, PREVIEW_SHOW_DELAY_MS)
  }
  const cancelPreview = (): void => {
    if (previewShow.current !== null) { window.clearTimeout(previewShow.current); previewShow.current = null }
    if (preview === null) return
    setPreviewClosing(true)
    previewHide.current = window.setTimeout(() => {
      setPreview(null)
      setPreviewClosing(false)
    }, PREVIEW_HIDE_DELAY_MS)
  }
  const keepPreview = (): void => {
    if (previewHide.current !== null) { window.clearTimeout(previewHide.current); previewHide.current = null }
    setPreviewClosing(false)
  }
  const hidePreviewNow = (): void => { clearPreviewTimers(); setPreview(null); setPreviewClosing(false) }
  // The grid fills the slate: the element is measured and drawn with exactly
  // as many whole cells as fit, so the board reads as a full pinboard instead
  // of a short row floating in empty space.
  const slotsRef = useRef<HTMLDivElement | null>(null)
  const { columns, rows, noteW } = useFittedGrid(slotsRef)
  const cells = columns * rows
  // Capacity follows the board: every cell that fits is a usable slot. Drawing
  // cells the limit forbids would fill the slate with inert backing, which
  // looks just as empty as a short grid. The measurement is published to the
  // store so placement, the full-board guard, and the header all agree.
  useEffect(() => {
    if (cells > 0 && store.get().limit !== cells) store.set({ limit: cells })
  }, [cells, store])
  // Minesweeper-style reveal: opening (or switching) a note wipes the CRT screen
  // with a dark tile mask over the conversation slot, then each cell pops away on
  // a random delay until the picture below is fully uncovered. Gated on desk mode
  // + an open session so it never leaks over the top-level workgrid; skipped
  // under reduced motion. Cells are injected at <body>'s top stacking context (no
  // react-dom) so no desk/host container can bury them, then removed after a beat.
  useEffect(() => {
    if (scene.mode !== 'desk' || scene.opened === null) return
    if (scene.intensity === 'calm') return
    // The conversation is host-portaled, so it is NOT inside .pxo-root — locate
    // it globally. The desk-mode gate above keeps this from firing in top view.
    const slot = document.querySelector(SELECTORS.CONVERSATION)
    if (slot == null) return
    const r: DOMRect = slot.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    const host = document.createElement('div')
    host.className = 'pxo-reveal'
    host.style.left = `${r.left}px`
    host.style.top = `${r.top}px`
    host.style.width = `${r.width}px`
    host.style.height = `${r.height}px`
    document.body.appendChild(host)
    const cols = Math.max(1, Math.round(r.width / 34))
    const rows = Math.max(1, Math.round(r.height / 34))
    host.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
    host.style.gridTemplateRows = `repeat(${rows}, 1fr)`
    const frag = document.createDocumentFragment()
    for (let i = 0; i < cols * rows; i += 1) {
      const cell = document.createElement('div')
      cell.className = 'pxo-cell'
      cell.style.setProperty('--pxo-cell-delay', `${(Math.random() * 1.1).toFixed(3)}s`)
      cell.style.setProperty('--pxo-cell-dur', `${(0.15 + Math.random() * 0.22).toFixed(3)}s`)
      frag.appendChild(cell)
    }
    host.appendChild(frag)
    const t = window.setTimeout(() => host.remove(), REVEAL_CLEANUP_MS)
    return () => { window.clearTimeout(t); host.remove() }
  }, [scene.mode, scene.opened, scene.intensity])
  const order = scene.order[desk.id] ?? []
  const drag = scene.drag
  const used = order.filter(cell => cell !== null).length
  // Lowest cell that is both empty and within capacity; -1 when none is.
  const firstFree = (() => {
    for (let i = 0; i < limit; i += 1) if ((order[i] ?? null) === null) return i
    return -1
  })()
  const runningCount = order.reduce((count, sessionId) => (
    sessionId !== null && notes[sessionId]?.running === true ? count + 1 : count
  ), 0)

  const startDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    payload: { kind: 'sticker'; pos: number; sid: string } | { kind: 'stack' },
  ) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    store.set({ drag: { ...payload, x: e.clientX, y: e.clientY, moved: false, over: -1 } })
    // A drag takes over the pointer, so any preview must clear immediately
    // rather than lingering at the cursor.
    hidePreviewNow()
  }
  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = store.get().drag
    if (current === null) return
    const moved = current.moved
      || Math.abs(e.clientX - current.x) + Math.abs(e.clientY - current.y) > DRAG_THRESHOLD
    store.set({
      drag: { ...current, x: e.clientX, y: e.clientY, moved, over: hitIndex(SLOTS, e.clientX, e.clientY) },
    })
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = store.get().drag
    store.set({ drag: null })
    if (current === null) return
    const target = hitIndex(SLOTS, e.clientX, e.clientY)
    if (current.kind === 'stack') {
      if (target < 0 || !current.moved) return
      const occupant = order[target] ?? null
      if (occupant !== null) store.set({ modal: { kind: 'edit', sid: occupant } })
      else if (used >= limit - 1) store.set({ modal: { kind: 'full' } })
      else store.set({ modal: { kind: 'new', pos: target } })
      return
    }
    if (current.kind !== 'sticker') return
    if (!current.moved) { props.onOpen(current.sid); return }
    if (target < 0) { store.set({ modal: { kind: 'tear', sid: current.sid } }); return }
    if (target === current.pos) return
    const padded = order.slice()
    while (padded.length < limit) padded.push(null)
    store.set({ order: { ...scene.order, [desk.id]: swapCells(padded, current.pos, target) } })
  }

  const accent = ACCENTS[hashIndex(desk.id, ACCENTS.length)]

  return (
    <div className="pxo-fill" data-mode="desk" style={{ '--pxo-accent': accent } as CSSProperties}>
      <Backdrop />
      <OfficeHeader
        trail={['工作空间', desk.title, '桌面 #' + (scene.layout.indexOf(desk.id) + 1).toString().padStart(2, '0')]}
        right={
          <>
            <button type="button" className="pxo-btn-leave" onClick={props.onBack}>
              {STR.LEAVE_DESK}
            </button>
            <span className={runningCount > 0 ? 'pxo-status-pill' : 'pxo-status-pill is-idle'}>
              <span className="dot" /> {runningCount > 0 ? STR.NODES_ONLINE(runningCount) : STR.NODE_STANDBY}
            </span>
            <SettingsButton onClick={props.onSettings} />
          </>
        }
      />

      <div className="pxo-band t" />
      <div className="pxo-band b" />
      <div className="pxo-band l" />
      <div className="pxo-band r" />
      <div className="pxo-bezel" />

      {/* Standby screen. Occupies the monitor cutout whenever no note is open,
          so an entered desk reads as a powered-down terminal rather than
          showing whichever conversation the shell opened last. Only displayed
          under [data-screen="off"] — the same gate that hides the conversation,
          so the two can never be on screen together. */}
      <div className="pxo-standby" aria-hidden="true">
        <div className="pxo-standby-in">
          <span className="ttl">{STR.NO_SIGNAL}</span>
          <span className="sub">
            {used === 0 ? STR.NO_SIGNAL_EMPTY : STR.NO_SIGNAL_PICK}
          </span>
          <span className="cursor" />
        </div>
      </div>

      <div className="pxo-board">
        <div className="pxo-board-hd">
          <span>{STR.MATRIX_TITLE}</span>
          <span className="trail">{STR.MATRIX_STATS(used, limit)}</span>
        </div>
        {/* Both axes are `1fr`: the hook already chose counts that divide the
            measured box evenly, so the tracks consume every pixel and the grid
            reaches all four edges. The note inside each cell is sized by
            `--pxo-note-w` and centred, keeping its proportions while the cell
            takes its full share. */}
        <div
          ref={slotsRef}
          className="pxo-slots"
          style={{
            gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
            gridTemplateRows: `repeat(${rows},minmax(0,1fr))`,
            ['--pxo-note-w' as string]: `${Math.round(noteW)}px`,
          }}
        >
          {new Array(cells).fill(0).map((_, i) => {
            const sid = order[i] ?? null
            const note = sid === null ? undefined : notes[sid]
            // The invite cell is the lowest free one, not a fixed index: with
            // the grid sized to the board, the last cell is rarely the one a
            // new note would actually land in.
            const isInvite = sid === null && i === firstFree && used < limit - 1
            return (
              <div
                key={i}
                className={isInvite ? 'pxo-slot empty' : 'pxo-slot'}
                ref={(el) => { SLOTS[i] = el }}
                data-over={drag?.moved === true && drag.over === i ? '1' : '0'}
                onPointerUp={endDrag}
                onPointerMove={moveDrag}
                onClick={() => {
                  if (isInvite && !props.isUngrouped) store.set({ modal: { kind: 'new', pos: i } })
                }}
              >
                <Sticker
                  sessionId={sid}
                  note={note}
                  index={i}
                  active={sid !== null && sid === scene.opened}
                  dragging={drag?.kind === 'sticker' && drag.pos === i && drag.moved}
                  label={sid === null ? '' : (scene.labels[sid] ?? note?.title ?? '')}
                  onPointerDown={(e) => { if (sid !== null) startDrag(e, { kind: 'sticker', pos: i, sid }) }}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPreviewEnter={schedulePreview}
                  onPreviewLeave={cancelPreview}
                  onOpen={() => { hidePreviewNow(); if (sid !== null) props.onOpen(sid) }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {props.isUngrouped
        ? null
        : (
          <NewStickyStack
            onPointerDown={(e) => { startDrag(e, { kind: 'stack' }) }}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            consumed={props.consumed}
          />
        )}

      {null /* removed: <LinkLost /> — full-bleed NO CARRIER overlay dropped per feedback */}
      {null /* removed: <div className="pxo-scan" /> — scanlines now injected at <body> top by Scene */}

      {preview === null ? null : (() => {
        const sid = preview.sid
        const note = notes[sid]
        const label = scene.labels[sid] ?? note?.title ?? ''
        return (
          <StickerPreview
            rect={preview.rect}
            title={label}
            running={note?.running === true}
            lastActivity={scene.activity[sid]}
            last={props.readLastMessage(sid)}
            nodeIndex={order.indexOf(sid)}
            closing={previewClosing}
            onOpen={() => { hidePreviewNow(); props.onOpen(sid) }}
            onEdit={() => { hidePreviewNow(); store.set({ modal: { kind: 'edit', sid } }) }}
            onTear={() => { hidePreviewNow(); store.set({ modal: { kind: 'tear', sid } }) }}
            onEnter={keepPreview}
            onLeave={cancelPreview}
          />
        )
      })()}
    </div>
  )
}

/** The drag ghost following the pointer. */
export function DragGhost({
  store, notes,
}: { store: Store; notes: Readonly<Record<string, NoteRecord | undefined>> }): ReactNode {
  const scene = useScene(store)
  const drag = scene.drag
  if (drag === null || !drag.moved) return null
  const isDesk = drag.kind === 'desk'
  const label = drag.kind === 'desk'
    ? STR.DRAG_MOVING
    : drag.kind === 'stack'
      ? STR.NEW_STICKY
      : scene.labels[drag.sid] ?? notes[drag.sid]?.title ?? ''
  return (
    <div
      className={isDesk ? 'pxo-ghost desk' : 'pxo-ghost note'}
      style={{
        left: `${drag.x + 12}px`,
        top: `${drag.y + 12}px`,
        width: isDesk ? '118px' : '84px',
        height: isDesk ? '68px' : '56px',
        background: isDesk ? 'var(--pxo-accent)' : '#ffeda8',
        color: isDesk ? 'var(--pxo-bg)' : '#141a24',
      }}
    >
      {label}
    </div>
  )
}

/** Props shared by every dialog. */
interface ModalProps {
  readonly title: string
  readonly desc?: string
  readonly children?: ReactNode
  readonly onCancel: () => void
  readonly onOk?: () => void
  readonly okText?: string
  readonly cancelText?: string
  readonly danger?: boolean
  /** `board` pins the dialog to the planning-board rect instead of the viewport. */
  readonly anchor?: 'board' | 'viewport'
  /** Close the dialog when the user presses/taps outside the modal card. */
  readonly closeOnOutsideClick?: boolean
}

/** A pixel-framed dialog. */
function Modal(props: ModalProps): ReactNode {
  const { anchor = 'viewport', onCancel, closeOnOutsideClick } = props
  const contentRef = useRef<HTMLDivElement>(null)

  // Global outside-click close: works for both viewport and board-anchored
  // dialogs, including the planning-board modal where the backdrop only covers
  // the board rectangle and a click on the surrounding chrome should also close.
  useEffect(() => {
    if (closeOnOutsideClick !== true) return
    const handler = (e: PointerEvent): void => {
      const content = contentRef.current
      const target = e.target
      if (content === null || !(target instanceof Node)) return
      if (content.contains(target)) return
      e.preventDefault()
      onCancel()
    }
    document.addEventListener('pointerdown', handler, true)
    return () => { document.removeEventListener('pointerdown', handler, true) }
  }, [closeOnOutsideClick, onCancel])

  return (
    <div
      className={anchor === 'board' ? 'pxo-modal-bg board' : 'pxo-modal-bg'}
      role="presentation"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div ref={contentRef} className="pxo-modal" role="dialog" aria-modal="true" aria-label={props.title}>
        <h3>{props.title}</h3>
        {props.desc === undefined ? null : <p>{props.desc}</p>}
        {props.children}
        <div className="pxo-row">
          <button type="button" className="pxo-btn" onClick={onCancel}>
            {props.cancelText ?? STR.DIALOG_CANCEL}
          </button>
          {props.onOk === undefined
            ? null
            : (
                <button
                  type="button"
                  className={props.danger === true ? 'pxo-btn danger' : 'pxo-btn'}
                  onClick={props.onOk}
                >
                  {props.okText ?? STR.DIALOG_CONFIRM}
                </button>
              )}
        </div>
      </div>
    </div>
  )
}

/** A dialog collecting the text shown on a sticky note. */
function InputModal(props: {
  readonly title: string
  readonly desc: string
  readonly initial?: string
  readonly okText?: string
  readonly anchor?: 'board' | 'viewport'
  readonly closeOnOutsideClick?: boolean
  readonly onCancel: () => void
  readonly onOk: (text: string) => void
}): ReactNode {
  const [text, setText] = useState(props.initial ?? '')
  const submit = () => { props.onOk(text.trim()) }
  return (
    <Modal
      title={props.title}
      desc={props.desc}
      anchor={props.anchor ?? 'board'}
      onCancel={props.onCancel}
      onOk={submit}
      okText={props.okText ?? STR.DIALOG_PASTE}
      {...(props.closeOnOutsideClick === true ? { closeOnOutsideClick: true } : {})}
    >
      <input
        className="pxo-input"
        value={text}
        autoFocus
        aria-label={props.title}
        placeholder={STR.DIALOG_INPUT_PLACEHOLDER}
        onChange={(e) => { setText(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') props.onCancel()
        }}
      />
    </Modal>
  )
}

/** Every dialog the scene can raise. */
export function Dialogs(props: {
  readonly store: Store
  readonly notes: Readonly<Record<string, NoteRecord | undefined>>
  readonly onAdd: (pos: number, text: string) => void
  readonly onTear: (sessionId: string) => void
  readonly onClear: (workspaceId: string) => void
  readonly onRename: (workspaceId: string, title: string) => void
}): ReactNode {
  const { store, notes } = props
  const scene = useScene(store)
  const modal = scene.modal
  const close = () => { store.set({ modal: null }) }
  if (modal === null) return null

  switch (modal.kind) {
    case 'new':
      return (
        <InputModal
          title={STR.DIALOG_NEW_TITLE}
          desc={STR.DIALOG_NEW_DESC}
          closeOnOutsideClick
          onCancel={close}
          onOk={(text) => { props.onAdd(modal.pos, text) }}
        />
      )
    case 'edit':
      return (
        <InputModal
          title={STR.DIALOG_EDIT_TITLE}
          desc={STR.DIALOG_EDIT_DESC}
          initial={scene.labels[modal.sid] ?? notes[modal.sid]?.title ?? ''}
          okText={STR.DIALOG_SAVE}
          onCancel={close}
          onOk={(text) => {
            store.set({ labels: { ...scene.labels, [modal.sid]: text }, modal: null })
          }}
        />
      )
    case 'full':
      return (
        <Modal
          title={STR.DIALOG_FULL_TITLE}
          desc={STR.DIALOG_FULL_DESC}
          anchor="board"
          cancelText={STR.DIALOG_GOT_IT}
          onCancel={close}
        />
      )
    case 'tear':
      return (
        <Modal
          title={STR.DIALOG_TEAR_TITLE}
          desc={STR.DIALOG_TEAR_DESC}
          anchor="board"
          cancelText={STR.DIALOG_RESTORE}
          okText={STR.DIALOG_TEAR_ACTION}
          danger
          onCancel={close}
          onOk={() => { close(); props.onTear(modal.sid) }}
        />
      )
    case 'clear':
      return (
        <Modal
          title={STR.DIALOG_CLEAR_TITLE}
          desc={STR.DIALOG_CLEAR_DESC(modal.title)}
          cancelText={STR.DIALOG_KEEP}
          okText={STR.DIALOG_CLEAR_ACTION}
          danger
          onCancel={close}
          onOk={() => { close(); props.onClear(modal.wsId) }}
        />
      )
    case 'rename':
      return (
        <InputModal
          title={STR.DIALOG_RENAME_TITLE}
          desc={STR.DIALOG_RENAME_DESC}
          initial={modal.title}
          okText={STR.DIALOG_RENAME_ACTION}
          closeOnOutsideClick
          onCancel={close}
          onOk={(text) => { close(); props.onRename(modal.wsId, text) }}
        />
      )
  }
}
