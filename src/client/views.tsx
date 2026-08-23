/**
 * Pixel Office React views: the top-down desk grid, the desk front view with
 * its planning board, and the dialogs both use.
 * @module dsh-client-pixel-office/views
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { DESKS, STICKER_COLORS, boardShape, hashIndex, swapCells } from './placement.ts'
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
  const [, bump] = useState(0)
  useEffect(() => store.subscribe(() => { bump(n => n + 1) }), [store])
  return store.get()
}

/** A monitor on a desk, animated only while that workspace has a live session. */
function Pc({ on }: { on: boolean }): ReactNode {
  return (
    <div className="pxo-pc">
      <div className={on ? 'pxo-pc-screen on' : 'pxo-pc-screen'}>
        {on
          ? [0, 1, 2, 3, 4].map(i => (
              <div key={i} className="pxo-bar" style={{ animationDelay: `${i * 0.13}s` }} />
            ))
          : null}
      </div>
      <div className="pxo-pc-stand" />
      <div className="pxo-pc-base" />
    </div>
  )
}

/** An empty seat, shown at every desk whether or not it holds a workspace. */
function Chair(): ReactNode {
  return (
    <div className="pxo-chair">
      <div className="pxo-chair-back" />
      <div className="pxo-chair-seat" />
      <div className="pxo-chair-leg" />
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
  /**
   * `board` pins the dialog inside the planning-board rect. A viewport-centered
   * dialog lands on the monitor cutout, where the real conversation covers it.
   */
  readonly anchor?: 'board' | 'viewport'
}

/** A pixel-framed dialog. */
function Modal(props: ModalProps): ReactNode {
  const { anchor = 'viewport', onCancel } = props
  return (
    <div
      className={anchor === 'board' ? 'pxo-modal-bg board' : 'pxo-modal-bg'}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="pxo-modal">
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
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
      />
    </Modal>
  )
}

/** The note-limit control, shared by the settings section. */
export function LimitControl({ store, box }: { store: Store; box: number }): ReactNode {
  const scene = useScene(store)
  const { columns } = boardShape(scene.limit)
  const side = Math.max(6, Math.round(box / columns))
  return (
    <div>
      <div className="pxo-set-row">
        <span id="pxo-limit-label">便利贴上限</span>
        <span style={{ color: 'var(--pxo-neon)' }}>
          {scene.limit}（可用 {scene.limit - 1}）
        </span>
      </div>
      <input
        className="pxo-range"
        type="range"
        min={4}
        max={24}
        step={1}
        value={scene.limit}
        aria-labelledby="pxo-limit-label"
        onChange={(e) => { store.set({ limit: Number(e.target.value) }) }}
      />
      <div className="pxo-preview" aria-hidden="true">
        {new Array(scene.limit).fill(0).map((_, i) => (
          <div key={i} className="pxo-pv" style={{ width: `${side}px`, height: `${side}px` }} />
        ))}
      </div>
    </div>
  )
}

/** The top-down office: six desks, draggable between cells. */
export function TopView(props: {
  readonly store: Store
  readonly desks: readonly DeskRecord[]
  readonly running: Readonly<Record<string, boolean>>
  readonly onCreate: () => void
}): ReactNode {
  const { store, desks, running } = props
  const scene = useScene(store)
  const [registry] = useState<Registry>(() => ({}))
  const drag = scene.drag

  const onDown = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    if (scene.layout[i] === null || scene.layout[i] === undefined) return
    e.currentTarget.setPointerCapture(e.pointerId)
    store.set({ drag: { kind: 'desk', from: i, x: e.clientX, y: e.clientY, moved: false, over: -1 } })
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = store.get().drag
    if (current === null || current.kind !== 'desk') return
    const moved = current.moved
      || Math.abs(e.clientX - current.x) + Math.abs(e.clientY - current.y) > DRAG_THRESHOLD
    store.set({
      drag: { ...current, x: e.clientX, y: e.clientY, moved, over: hitIndex(registry, e.clientX, e.clientY) },
    })
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    const current = store.get().drag
    store.set({ drag: null })
    if (current === null || current.kind !== 'desk') return
    if (!current.moved) {
      const wsId = scene.layout[i]
      if (wsId !== null && wsId !== undefined) store.set({ mode: 'desk', active: wsId })
      return
    }
    const target = hitIndex(registry, e.clientX, e.clientY)
    if (target < 0 || target === current.from) return
    store.set({ layout: swapCells(scene.layout, current.from, target) })
  }

  return (
    <div className="pxo-fill">
      <div className="pxo-title">
        ◼ PIXEL OFFICE / 工位俯视图
        <small>点击工位进入桌面 · 拖拽工位可搬迁设备、交换位置</small>
      </div>
      <div className="pxo-grid">
        {new Array(DESKS).fill(0).map((_, i) => {
          const wsId = scene.layout[i] ?? null
          const desk = wsId === null ? undefined : desks.find(d => d.id === wsId)
          const isRunning = wsId === null ? false : running[wsId] === true
          const dragging = drag?.kind === 'desk' && drag.from === i && drag.moved
          const hovered = drag?.kind === 'desk' && drag.moved && drag.over === i && drag.from !== i
          return (
            <div
              key={i}
              className="pxo-desk"
              ref={(el) => { registry[i] = el }}
              data-drag={dragging ? '1' : '0'}
              data-over={hovered ? '1' : '0'}
              onPointerDown={(e) => { onDown(e, i) }}
              onPointerMove={onMove}
              onPointerUp={(e) => { onUp(e, i) }}
              onClick={() => { if (wsId === null) props.onCreate() }}
            >
              <div className={desk === undefined ? 'pxo-plate empty' : 'pxo-plate'}>
                {desk === undefined ? `空 工 位 ${i + 1}` : desk.title}
              </div>
              {wsId === null
                ? null
                : (
                    <div className={isRunning ? 'pxo-badge run' : 'pxo-badge idle'}>
                      {isRunning ? 'RUN' : 'IDLE'}
                    </div>
                  )}
              <div className="pxo-tian">
                {wsId === null ? null : <Pc on={isRunning} />}
                <Chair />
              </div>
              {desk === undefined
                ? <div className="pxo-empty-hint">点击放置新工作区</div>
                : (
                    <div className="pxo-deskfoot">
                      <button
                        type="button"
                        className="pxo-btn pxo-mini"
                        onPointerDown={(e) => { e.stopPropagation() }}
                        onClick={(e) => {
                          e.stopPropagation()
                          store.set({ mode: 'desk', active: desk.id })
                        }}
                      >
                        进入
                      </button>
                      <button
                        type="button"
                        className="pxo-btn pxo-mini danger"
                        onPointerDown={(e) => { e.stopPropagation() }}
                        onClick={(e) => {
                          e.stopPropagation()
                          store.set({ modal: { kind: 'clear', wsId: desk.id, title: desk.title } })
                        }}
                      >
                        清空
                      </button>
                    </div>
                  )}
            </div>
          )
        })}
      </div>
      <div className="pxo-scan" />
    </div>
  )
}

/** The desk front view: planning board on the left, monitor cutout on the right. */
export function DeskView(props: {
  readonly store: Store
  readonly desk: DeskRecord
  readonly notes: Readonly<Record<string, NoteRecord | undefined>>
  readonly onOpen: (sessionId: string) => void
}): ReactNode {
  const { store, desk, notes } = props
  const scene = useScene(store)
  const [registry] = useState<Registry>(() => ({}))
  const limit = scene.limit
  const { columns, rows } = boardShape(limit)
  const order = scene.order[desk.id] ?? []
  const drag = scene.drag
  const used = order.filter(cell => cell !== null).length

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
      drag: { ...current, x: e.clientX, y: e.clientY, moved, over: hitIndex(registry, e.clientX, e.clientY) },
    })
  }
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = store.get().drag
    store.set({ drag: null })
    if (current === null) return
    const target = hitIndex(registry, e.clientX, e.clientY)
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
    // Dropped outside every cell: the note was pulled off the board.
    if (target < 0) { store.set({ modal: { kind: 'tear', sid: current.sid } }); return }
    if (target === current.pos) return
    const padded = order.slice()
    while (padded.length < limit) padded.push(null)
    store.set({ order: { ...scene.order, [desk.id]: swapCells(padded, current.pos, target) } })
  }

  return (
    <div>
      <div className="pxo-band t" />
      <div className="pxo-band b" />
      <div className="pxo-band l" />
      <div className="pxo-band r" />
      <div className="pxo-bezel" />
      <div className="pxo-title">
        ◼ {desk.title} / 工位桌面
        <small>拖拽交换便利贴 · 拖出计划板可撕下 · 点击便利贴在右侧显示器打开</small>
      </div>
      <div className="pxo-board">
        <div className="pxo-board-hd">
          计 划 板
          <span>{used} / {limit - 1}</span>
        </div>
        <div
          className="pxo-slots"
          style={{
            gridTemplateColumns: `repeat(${columns},1fr)`,
            gridTemplateRows: `repeat(${rows},1fr)`,
          }}
        >
          {new Array(limit).fill(0).map((_, i) => {
            const sid = order[i] ?? null
            const note = sid === null ? undefined : notes[sid]
            return (
              <div
                key={i}
                className="pxo-slot"
                ref={(el) => { registry[i] = el }}
                data-over={drag?.moved === true && drag.over === i ? '1' : '0'}
              >
                {note === undefined || sid === null
                  ? null
                  : (
                      <div
                        className={note.running ? 'pxo-sticker run' : 'pxo-sticker'}
                        data-drag={drag?.kind === 'sticker' && drag.pos === i && drag.moved ? '1' : '0'}
                        style={{
                          background: STICKER_COLORS[hashIndex(sid, STICKER_COLORS.length)],
                          animationDelay: `${hashIndex(sid, 19) * 0.14}s`,
                        }}
                        onPointerDown={(e) => { startDrag(e, { kind: 'sticker', pos: i, sid }) }}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                      >
                        <div className={note.running ? 'pxo-dot run' : 'pxo-dot'} />
                        {scene.labels[sid] ?? note.title}
                      </div>
                    )}
              </div>
            )
          })}
        </div>
      </div>
      <div
        className="pxo-stack"
        onPointerDown={(e) => { startDrag(e, { kind: 'stack' }) }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
      >
        <div className="pxo-stack-l" style={{ background: '#d9c93f' }} />
        <div className="pxo-stack-l" style={{ background: '#e8d94a' }} />
        <div className="pxo-stack-top" style={{ background: '#f7e04a' }}>拖我上板</div>
        <div className="pxo-stack-cap">便利贴 / 新会话</div>
      </div>
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
    ? '搬迁中…'
    : drag.kind === 'stack'
      ? '新便利贴'
      : scene.labels[drag.sid] ?? notes[drag.sid]?.title ?? ''
  return (
    <div
      className="pxo-ghost"
      style={{
        left: `${drag.x + 12}px`,
        top: `${drag.y + 12}px`,
        width: isDesk ? '118px' : '84px',
        height: isDesk ? '68px' : '56px',
        background: isDesk ? 'var(--dsw-specific-pxo-monitor-frame)' : '#f7e04a',
        color: isDesk ? 'var(--pxo-ink)' : '#1a1f33',
      }}
    >
      {label}
    </div>
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
