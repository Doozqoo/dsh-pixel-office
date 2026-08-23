/**
 * Browser half of the Pixel Office plugin: reads the workspace and session
 * lists, registers the scene into `shell.overlay`, and adds its own section to
 * the shipped settings panel.
 *
 * Every side effect is owned by the Cordis fiber, so unloading the plugin
 * removes the stylesheet, the theme overrides, and both registrations, and the
 * shipped theme returns with no page reload.
 * @module dsh-client-pixel-office/client
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type {
  ClientContext, Disposer, OverlayProps, SessionsService, SettingsSectionProps,
  SlotsService, ThemeService, WorkspacesService,
} from './contracts.ts'
import { DESKS, fitInto, sameGrid } from './placement.ts'
import { createStore } from './store.ts'
import { insertStyles } from './styles.ts'
import { DARK_TOKENS, LIGHT_TOKENS, pairTokens } from './tokens.ts'
import { DeskView, Dialogs, DragGhost, LimitControl, TopView, useScene } from './views.tsx'
import type { DeskRecord, NoteRecord } from './views.tsx'

/** Identifier used for slot registrations, the theme override, and log lines. */
const PLUGIN_ID = 'pixel-office'

/**
 * Click the shipped settings trigger.
 *
 * The settings plugin owns the panel's open state, so the HUD button drives
 * the real trigger rather than rendering a competing dialog that would not
 * share that state. The slot anchor is a stable contract; the button's own
 * class name is a build hash, so it is reached by `closest` instead.
 * @returns whether the trigger was found and clicked.
 */
function openShippedSettings(): boolean {
  const seat = document.querySelector('[data-slot="settings.trigger"]')
  const button = seat?.closest('button') ?? null
  if (button === null) return false
  button.click()
  return true
}

/**
 * Services this plugin consumes. `slots` is the hard dependency: without it
 * the scene cannot mount at all, so Cordis holds the fiber PENDING until it
 * appears. The remaining services are read optionally through `ctx.get` so a
 * composition lacking one degrades instead of never activating.
 */
export const inject = ['slots']

/**
 * Mount the Pixel Office scene.
 *
 * A function plugin with named exports, never a default export: mixing the two
 * forms makes the Loader discard the function plugin's namespace, and the row
 * then contributes nothing.
 * @param ctx - the client plugin context.
 */
export function apply(ctx: ClientContext): void {
  const slots = ctx.get('slots') as SlotsService | undefined
  if (slots === undefined) {
    console.error(`${PLUGIN_ID}: slots service unavailable; the scene cannot mount`)
    return
  }
  const workspaces = ctx.get('workspaces') as WorkspacesService | undefined
  const sessions = ctx.get('sessions') as SessionsService | undefined
  const theme = ctx.get('theme') as ThemeService | undefined

  const store = createStore()

  ctx.effect(() => insertStyles(), `${PLUGIN_ID}:styles`)
  if (theme !== undefined) {
    ctx.effect(
      () => theme.overrideTokens(PLUGIN_ID, pairTokens(DARK_TOKENS, LIGHT_TOKENS)),
      `${PLUGIN_ID}:tokens`,
    )
  }

  function Scene(props: OverlayProps): ReactNode {
    const scene = useScene(store)

    // Selectors project the live lists down to plain owned data before it
    // reaches component state. Live service objects must never be copied or
    // serialized wholesale; only the leaf fields below cross this boundary.
    const desks = props.useWorkspaces(state => state.items.map(w => ({
      id: w.workspaceId,
      title: w.title,
      sessionIds: [...w.sessionIds],
    }))) as readonly DeskRecord[]
    const archived = props.useWorkspaces(state => state.archivedSessionIds.join(','))
    const noteEntries = props.useSessions(state => state.ids.map((id) => {
      const record = state.byId[id]
      return record === undefined
        ? null
        : [id, { title: record.displayTitle, running: record.running }] as const
    }))

    const archivedIds = archived === '' ? [] : archived.split(',')
    const notes: Record<string, NoteRecord> = {}
    for (const entry of noteEntries) if (entry !== null) notes[entry[0]] = entry[1]

    const running: Record<string, boolean> = {}
    for (const desk of desks) {
      running[desk.id] = desk.sessionIds.some(
        id => notes[id]?.running === true && !archivedIds.includes(id),
      )
    }

    const deskIdKey = desks.map(d => d.id).join(',')
    useEffect(() => {
      const ids = deskIdKey === '' ? [] : deskIdKey.split(',')
      const next = fitInto(store.get().layout, ids, DESKS, false)
      if (!sameGrid(next, store.get().layout)) store.set({ layout: next })
    }, [deskIdKey])

    const active = scene.active
    const activeDesk = active === null ? undefined : desks.find(d => d.id === active)
    const liveKey = activeDesk === undefined
      ? ''
      : activeDesk.sessionIds.filter(id => notes[id] !== undefined && !archivedIds.includes(id)).join(',')

    useEffect(() => {
      if (active === null) return
      const current = store.get().order[active]
      const ids = liveKey === '' ? [] : liveKey.split(',')
      const next = fitInto(current, ids, store.get().limit, true)
      if (!sameGrid(next, current)) {
        store.set({ order: { ...store.get().order, [active]: next } })
      }
    }, [liveKey, scene.limit, active])

    // The active workspace can be deleted from another surface; fall back to
    // the top view rather than rendering a desk that no longer exists.
    const missing = scene.mode === 'desk' && activeDesk === undefined
    useEffect(() => {
      if (missing) store.set({ mode: 'top', active: null })
    }, [missing])

    const createWorkspace = async () => {
      if (workspaces === undefined) return
      const path = await workspaces.pickDirectory()
      if (path === undefined || path === '') return
      await workspaces.create({ path })
    }

    const openSession = (sessionId: string) => {
      sessions?.open(sessionId)
    }

    const addSession = async (pos: number, text: string) => {
      store.set({ modal: null })
      if (workspaces === undefined || activeDesk === undefined) return
      const sid = await workspaces.connectWorkspace(activeDesk.id)
      const labels = { ...store.get().labels }
      if (text !== '') labels[sid] = text
      const placed = (store.get().order[activeDesk.id] ?? []).slice()
      while (placed.length < store.get().limit) placed.push(null)
      if (!placed.includes(sid)) placed[pos] = sid
      store.set({ labels, order: { ...store.get().order, [activeDesk.id]: placed } })
      openSession(sid)
    }

    return (
      <div className="pxo-root" data-mode={scene.mode}>
        {scene.mode === 'top'
          ? (
              <TopView
                store={store}
                desks={desks}
                running={running}
                onCreate={() => { void createWorkspace() }}
              />
            )
          : activeDesk === undefined
            ? null
            : <DeskView store={store} desk={activeDesk} notes={notes} onOpen={openSession} />}
        <div className="pxo-hud">
          {scene.mode === 'desk'
            ? (
                <button
                  type="button"
                  className="pxo-btn"
                  onClick={() => { store.set({ mode: 'top', active: null }) }}
                >
                  ⏏ 离开工位
                </button>
              )
            : null}
          <button
            type="button"
            className="pxo-btn"
            onClick={() => {
              if (!openShippedSettings()) {
                console.error(`${PLUGIN_ID}: settings trigger not found`)
              }
            }}
          >
            ⚙ 设置
          </button>
        </div>
        <DragGhost store={store} notes={notes} />
        <Dialogs
          store={store}
          notes={notes}
          onAdd={(pos, text) => { void addSession(pos, text) }}
          onTear={(sessionId) => { workspaces?.archiveSession(sessionId) }}
          onClear={(workspaceId) => { workspaces?.delete(workspaceId) }}
        />
      </div>
    )
  }

  function SettingsSection(props: SettingsSectionProps): ReactNode {
    return (
      <div className="pxo-root" style={{ pointerEvents: 'auto', padding: '4px 0' }}>
        <h3 style={{ color: 'var(--pxo-neon)', fontSize: '13px', letterSpacing: '2px', margin: '0 0 8px' }}>
          ◼ 像素工位
        </h3>
        <p style={{ color: 'var(--pxo-dim)', fontSize: '11px', lineHeight: 1.7, margin: '0 0 14px' }}>
          便利贴上限决定计划板格子数；上限越大单张越小。系统始终保留一个空位用于挪动位置。
        </p>
        <LimitControl store={store} box={140} />
        <div style={{ marginTop: '18px' }}>
          <button
            type="button"
            className="pxo-btn"
            onClick={() => {
              store.set({ mode: 'top', active: null })
              props.close()
            }}
          >
            ⏏ 离开工位
          </button>
        </div>
        <p className="pxo-note">
          外观已适配亮色与暗色两套像素调色板；通用、模型、插件等分区均为原生设置，像素主题只重绘外观，功能不变。
        </p>
      </div>
    )
  }

  // `inject` defers each registration until the host slot is actually
  // declared, so apply order between this plugin and the shell surfaces does
  // not matter, and a collapsing declaration removes the contribution.
  ctx.effect(
    () => slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: PLUGIN_ID, order: 100 },
      Scene,
    )) as Disposer,
    `${PLUGIN_ID}:overlay`,
  )
  ctx.effect(
    () => slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: PLUGIN_ID, order: 30, label: '像素工位' },
      SettingsSection,
    )) as Disposer,
    `${PLUGIN_ID}:settings`,
  )
}
