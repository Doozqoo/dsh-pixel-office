/**
 * Pixel Office React views: header/toolbar + the top-down desk grid; planning
 * board + CRT-cutout monitor + new-note stack on the desk front view.
 * @module dsh-client-pixel-office/views
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ACCENTS, DESKS, NOTE_RATIO, STICKER_COLORS, hashIndex, swapCells } from './placement.ts'
import { DRAG_THRESHOLD, hitIndex } from './store.ts'
import type { SceneState, Store } from './store.ts'

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

/** Pointer-targets populated by the planning-board drag handlers. */
const SLOTS: Registry = {}
/** Pointer-targets populated by the desk-grid drag handlers. */
const DESK_REGISTRY: Registry = {}

/**
 * Widest a sticky note is allowed to be, in CSS pixels.
 *
 * The note never exceeds this, no matter how much room a cell has: past it a
 * sticker stops reading as paper. Surplus cell space becomes margin around the
 * note instead.
 */
const MAX_NOTE_W = 156

/**
 * Narrowest a matrix cell may become before the grid drops a column.
 *
 * Letting a cell shrink this far buys another column on viewports where the
 * natural width would leave nearly a full column of dead space. The note
 * itself is capped at {@link MAX_NOTE_W} and centred, so a roomy cell shows
 * margin rather than a stretched sticker.
 */
const MIN_NOTE_W = 126

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

/** Gap between matrix cells, in CSS pixels; must match the `gap` in the stylesheet. */
const CELL_GAP = 10

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
          <div className="pxo-logo-main" data-text="NEON//NEXUS">NEON//NEXUS</div>
          <div className="pxo-logo-sub">PX-77 · AUTONOMOUS WORKGRID</div>
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
        placeholder="搜索节点 / SEARCH..."
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
  readonly onCreate: () => void
}): ReactNode {
  const state = props.isEmpty
    ? 'off'
    : props.isOnline
      ? 'run'
      : 'idle'
  const stateText = props.isEmpty
    ? 'EMPTY · 空位'
    : props.isOnline
      ? 'ONLINE · LINK ACTIVE'
      : 'IDLE · 待启动'
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
        if (props.isEmpty) props.onCreate()
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
          {props.isEmpty
            ? null
            : (
                <button
                  type="button"
                  className="pxo-ico"
                  title="清空工位"
                  aria-label={`清空工位 ${props.name}`}
                  onPointerDown={(event) => { event.stopPropagation() }}
                  onClick={(event) => { event.stopPropagation(); props.onClear() }}
                >×</button>
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
              title="点击或拖拽项目到此创建"
              onClick={(e) => { e.stopPropagation(); props.onCreate() }}
            >
              <span className="plus">+</span>
              <span className="label">新建工位 / NEW STATION</span>
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
  readonly onCreate: () => void
  readonly onEnter: (wsId: string) => void
  readonly onClear: (wsId: string) => void
  readonly onSettings: () => void
}): ReactNode {
  const { store, desks, running } = props
  const scene = useScene(store)
  const drag = scene.drag
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'online'>('all')
  const onlineCount = useMemo(
    () => scene.layout.reduce((acc, id) => acc + ((id !== null && running[id] === true) ? 1 : 0), 0),
    [scene.layout, running],
  )

  const onDown = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    if (scene.layout[i] === null) return
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
    if (current === null || current.kind !== 'desk') return
    if (!current.moved) {
      const wsId = scene.layout[i]
      if (wsId !== null && wsId !== undefined) props.onEnter(wsId)
      return
    }
    const target = hitIndex(DESK_REGISTRY, e.clientX, e.clientY)
    if (target < 0 || target === current.from) return
    store.set({ layout: swapCells(scene.layout, current.from, target) })
  }

  return (
    <div className="pxo-fill" data-mode="top">
      <Backdrop />
      <OfficeHeader
        trail={['工作区', 'WORKSPACE']}
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
        <span className="pxo-toolbar-title">工作空间 / WORKSPACES</span>
        <span className="pxo-toolbar-sub">· {DESKS} 工位 · {onlineCount} 在线</span>
        <div className="pxo-toolbar-right">
          <button
            type="button"
            className={filter === 'all' ? 'pxo-chip is-active' : 'pxo-chip'}
            aria-pressed={filter === 'all'}
            onClick={() => { setFilter('all') }}
          >
            <span className="dot" /> ALL · 全部
          </button>
          <button
            type="button"
            className={filter === 'online' ? 'pxo-chip is-active' : 'pxo-chip'}
            aria-pressed={filter === 'online'}
            onClick={() => { setFilter('online') }}
          >
            LIVE · 在线节点
          </button>
          <button type="button" className="pxo-btn-new" onClick={props.onCreate}>
            + 新建工位
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
            ? '[ 点击或拖拽项目到此创建 ]'
            : isOnline ? '实时链路已连接 / LIVE LINK' : '节点待机 / NODE STANDBY'
          // Count the notes the matrix actually pins, not every id the
          // workspace remembers: archived sessions and ids the session list
          // has not published are absent from the board.
          const countLabel = wsId === null
            ? '0 便利贴'
            : `${props.liveCounts[wsId] ?? 0} 便利贴`
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
              onCreate={props.onCreate}
            />
          )
        })}
      </div>
      <div className="pxo-caption">
        01 / <b>神经节点矩阵 — 6×4 WORKGRID</b>
      </div>
      <div className="pxo-scan" />
    </div>
  )
}

/* =============================================================================
 * Desk-view: planning board on the left, CRT-cutout monitor on the right.
 * ===========================================================================*/

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
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        props.onOpen()
      }}
    >
      <span className="tape" style={{ background: props.note?.running === true ? 'var(--pxo-neon)' : 'var(--pxo-magenta)' }} />
      <span className="tag">
        {props.note?.running === true
          ? `● ACTIVE · #${String(props.index + 1).padStart(2, '0')}`
          : `SESSION #${String(props.index + 1).padStart(2, '0')}`}
      </span>
      <span className="title">{props.label}</span>
      <span className="meta">
        <span>{props.note?.running === true ? 'UPLINK ACTIVE' : 'UPLINK IDLE'}</span>
        <span>{`NODE ${String(props.index + 1).padStart(2, '0')}`}</span>
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
              {i === 0 ? '空白便利贴' : ''}
            </div>
          )
        })}
      </div>
      <div className="pxo-stack-info">
        <div><b>新便利贴堆 / NEW STICKIES</b></div>
        <div className="pxo-stack-hint">// 拖拽到计划板空位以创建新会话</div>
        <div className="pxo-stack-hint">// 在空位松开后弹窗输入会话标题</div>
        <div className="pxo-stack-hint">// 拖出计划板 = 撕下便利贴（归档）</div>
        <div className="pxo-stack-hint">// 撕下后再拖回 = 重新贴上（恢复）</div>
        <div className="pxo-stack-hint">// 同一位置重叠 = 重新编辑内容</div>
      </div>
      <div>
        <div className="pxo-stack-arrow">→ DRAG →</div>
        <div className="pxo-stack-hint" style={{ marginTop: 4 }}>拖到计划板</div>
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
}): ReactNode {
  const { store, desk, notes } = props
  const scene = useScene(store)
  const limit = scene.limit
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
              ← 离开工位
            </button>
            <span className={runningCount > 0 ? 'pxo-status-pill' : 'pxo-status-pill is-idle'}>
              <span className="dot" /> {runningCount > 0 ? `${runningCount} 条链路在线` : '节点待机'}
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
          <span className="ttl">NO SIGNAL</span>
          <span className="sub">
            {used === 0 ? '此工位暂无便利贴' : '选择一张便利贴以接入会话'}
          </span>
          <span className="cursor" />
        </div>
      </div>

      <div className="pxo-board">
        <div className="pxo-board-hd">
          <span>任务矩阵 / MISSION MATRIX</span>
          <span className="trail">{used} / {limit - 1} 节点 · 保留 1 个交换槽</span>
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
                  if (isInvite) store.set({ modal: { kind: 'new', pos: i } })
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
                  onOpen={() => { if (sid !== null) props.onOpen(sid) }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <NewStickyStack
        onPointerDown={(e) => { startDrag(e, { kind: 'stack' }) }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        consumed={props.consumed}
      />

      <div className="pxo-scan" />
    </div>
  )
}

/** Runtime controls for the cyberpunk presentation; state lasts for this plugin run. */
export function CyberSettings({ store }: { readonly store: Store }): ReactNode {
  const scene = useScene(store)
  const preview = ['#20f6ff', '#ff2bd6', '#b6ff3b', '#ffb300', '#775cff']
  return (
    <section className="pxo-settings" aria-labelledby="pxo-settings-title">
      <div className="pxo-settings-hero">
        <span className="pxo-settings-kicker">NEON NEXUS / CONTROL DECK</span>
        <h2 id="pxo-settings-title">赛博工位协议</h2>
        <p>切换像素皮肤，或调整任务矩阵密度、环境动效与网格投影。选择保存在本浏览器。</p>
      </div>

      {/* The master switch. Deliberately first and styled to stay legible with
          the skin off: this section is the only way back on, so it must not
          depend on the stylesheet it toggles. */}
      <div className="pxo-set-card pxo-set-master">
        <div className="pxo-set-row">
          <span>像素工位皮肤</span>
          <output>{scene.enabled ? 'ENGAGED' : 'BYPASSED'}</output>
        </div>
        <button
          type="button"
          className="pxo-toggle"
          aria-pressed={scene.enabled}
          onClick={() => { store.set({ enabled: !scene.enabled }) }}
        >
          <span />
          {scene.enabled ? '切回原版界面' : '启用像素工位'}
        </button>
        <p className="pxo-note">
          {scene.enabled
            ? '关闭后立即移除样式与场景，原版界面原样返回，插件仍保持加载；工位摆放不会丢失。'
            : '当前为原版界面。像素工位的工位布局与便利贴摆放都还留着，重新启用即恢复。'}
        </p>
      </div>

      {/* The rest tunes the skin, so it is hidden while the skin is bypassed —
          those controls would have no visible effect. */}
      {!scene.enabled ? null : (
        <>
          <div className="pxo-set-card">
            <div className="pxo-set-row">
              <label>任务矩阵容量</label>
              <output>{Math.max(0, scene.limit - 1)} + 1 SPARE</output>
            </div>
            {/* No slider: the matrix measures the board and uses every cell
                that fits, so capacity is derived, not chosen. A control here
                would be overwritten by the next measurement. */}
            <p className="pxo-note">
              容量随计划板尺寸自动铺满，窗口越大格子越多。系统始终保留一个交换槽，让拖拽重排不会锁死。
            </p>
          </div>
          <div className="pxo-set-card">
            <div className="pxo-set-row"><span>动效协议</span><output>{scene.intensity.toUpperCase()}</output></div>
            <div className="pxo-segment" role="group" aria-label="动效强度">
              <button
                type="button"
                aria-pressed={scene.intensity === 'calm'}
                onClick={() => { store.set({ intensity: 'calm' }) }}
              >CALM</button>
              <button
                type="button"
                aria-pressed={scene.intensity === 'overdrive'}
                onClick={() => { store.set({ intensity: 'overdrive' }) }}
              >OVERDRIVE</button>
            </div>
          </div>
          <div className="pxo-set-card">
            <div className="pxo-set-row"><span>空间网格</span><output>{scene.grid ? 'ONLINE' : 'OFFLINE'}</output></div>
            <button
              type="button"
              className="pxo-toggle"
              aria-pressed={scene.grid}
              onClick={() => { store.set({ grid: !scene.grid }) }}
            ><span />{scene.grid ? '关闭投影网格' : '启动投影网格'}</button>
            <div className="pxo-preview" aria-hidden="true">
              {preview.map(color => <span className="pxo-pv" key={color} style={{ background: color }} />)}
            </div>
          </div>
        </>
      )}
    </section>
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
    ? '搬迁中…'
    : drag.kind === 'stack'
      ? '新便利贴'
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
}

/** A pixel-framed dialog. */
function Modal(props: ModalProps): ReactNode {
  const { anchor = 'viewport', onCancel } = props
  return (
    <div
      className={anchor === 'board' ? 'pxo-modal-bg board' : 'pxo-modal-bg'}
      role="presentation"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="pxo-modal" role="dialog" aria-modal="true" aria-label={props.title}>
        <h3>{props.title}</h3>
        {props.desc === undefined ? null : <p>{props.desc}</p>}
        {props.children}
        <div className="pxo-row">
          <button type="button" className="pxo-btn" onClick={onCancel}>
            {props.cancelText ?? '取消'}
          </button>
          {props.onOk === undefined
            ? null
            : (
                <button
                  type="button"
                  className={props.danger === true ? 'pxo-btn danger' : 'pxo-btn'}
                  onClick={props.onOk}
                >
                  {props.okText ?? '确定'}
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
      okText={props.okText ?? '贴上'}
    >
      <input
        className="pxo-input"
        value={text}
        autoFocus
        aria-label={props.title}
        placeholder="输入便利贴展示内容…"
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
          title="✎ 新便利贴"
          desc="填写这张便利贴的展示内容，确认后在当前工作区创建一个新会话。"
          onCancel={close}
          onOk={(text) => { props.onAdd(modal.pos, text) }}
        />
      )
    case 'edit':
      return (
        <InputModal
          title="✎ 重新编辑"
          desc="便利贴重叠视为重新编辑：仅修改展示内容，不影响会话本身。"
          initial={scene.labels[modal.sid] ?? notes[modal.sid]?.title ?? ''}
          okText="保存"
          onCancel={close}
          onOk={(text) => {
            store.set({ labels: { ...scene.labels, [modal.sid]: text }, modal: null })
          }}
        />
      )
    case 'full':
      return (
        <Modal
          title="⚠ 计划板已满"
          desc="已达当前可用上限（始终保留一个空位用于挪动）。可在设置中提高上限，或先撕下一张便利贴。"
          anchor="board"
          cancelText="知道了"
          onCancel={close}
        />
      )
    case 'tear':
      return (
        <Modal
          title="✂ 撕下便利贴？"
          desc="撕下将归档该会话，便利贴从计划板移除（会话记录保留）；选择重新贴上则放回原位。"
          anchor="board"
          cancelText="重新贴上"
          okText="撕下"
          danger
          onCancel={close}
          onOk={() => { close(); props.onTear(modal.sid) }}
        />
      )
    case 'clear':
      return (
        <Modal
          title="⌫ 清空工位？"
          desc={`将删除工作区「${modal.title}」，该工位恢复为空座椅。其会话记录本身不会被删除。`}
          cancelText="保留"
          okText="清空"
          danger
          onCancel={close}
          onOk={() => { close(); props.onClear(modal.wsId) }}
        />
      )
  }
}
