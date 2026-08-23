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
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ClientContext, Disposer, OverlayProps, SessionsService,
  SettingsSectionProps, SlotsService, ThemeService, TimerContext, WorkspacesService,
} from './contracts.ts'
import { loadScene, persistScene, pruneScene } from './persist.ts'
import { DESKS, fitInto, sameGrid } from './placement.ts'
import { createStore } from './store.ts'
import { insertBaseStyles, insertStyles } from './styles.ts'
import { DARK_TOKENS, LIGHT_TOKENS, pairTokens } from './tokens.ts'
import { CyberSettings, DeskView, Dialogs, DragGhost, TopView, useScene } from './views.tsx'
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
  const timers = ctx as ClientContext & TimerContext

  // The arrangement is user-authored data, so it is restored as the store's
  // seed and mirrored back on every change. Volatile fields stay at their
  // defaults; a reload always opens on the top view.
  const store = createStore(loadScene())
  ctx.effect(() => persistScene(store), `${PLUGIN_ID}:persist`)

  // Always present, skin or not: it styles the master switch, which must stay
  // usable exactly when the skin sheet is gone. Registered before the skin
  // effect so its tag sits earlier in <head> and equal-specificity pixel rules
  // win while the skin is on.
  ctx.effect(() => insertBaseStyles(), `${PLUGIN_ID}:base-styles`)

  /**
   * Apply or remove the whole skin as `enabled` changes.
   *
   * The stylesheet and the token overrides cannot be plain `ctx.effect` calls
   * any more: those run once at apply time, and the skin has to be switchable
   * while the plugin stays loaded. So one fiber-owned effect subscribes to the
   * store and holds the two inner disposers, adding and removing them in step
   * with the flag. Turning the skin off runs exactly the same teardown that
   * unloading the plugin does, which is why the shipped GUI comes back intact
   * rather than merely being covered up.
   */
  ctx.effect(() => {
    let applied: Disposer | null = null

    const sync = (): void => {
      const on = store.get().enabled
      if (on && applied === null) {
        const removeStyles = insertStyles()
        const removeTokens = theme?.overrideTokens(
          PLUGIN_ID, pairTokens(DARK_TOKENS, LIGHT_TOKENS),
        )
        applied = () => { removeStyles(); removeTokens?.() }
      } else if (!on && applied !== null) {
        applied()
        applied = null
      }
    }

    sync()
    const unsubscribe = store.subscribe(sync)
    return () => {
      unsubscribe()
      if (applied !== null) applied()
    }
  }, `${PLUGIN_ID}:skin`)

  function Settings(_props: SettingsSectionProps): ReactNode {
    return <CyberSettings store={store} />
  }

  function Scene(props: OverlayProps): ReactNode {
    const scene = useScene(store)
    // Tick that bumps every time a new sticker is dropped on the planning
    // board, so NewStickyStack can rotate its queue and animate the swap.
    const [consumed, setConsumed] = useState(0)

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
    // Live note count per desk: exactly the sessions the task matrix would pin,
    // so the tile agrees with the board. `sessionIds` alone counts archived
    // sessions and ids the session list has not published, both of which the
    // matrix omits — the tile claimed notes that were not there.
    const liveCounts: Record<string, number> = {}
    for (const desk of desks) {
      const live = desk.sessionIds.filter(
        id => notes[id] !== undefined && !archivedIds.includes(id),
      )
      liveCounts[desk.id] = live.length
      running[desk.id] = live.some(id => notes[id]?.running === true)
    }

    const deskIdKey = desks.map(d => d.id).join(',')
    useEffect(() => {
      const ids = deskIdKey === '' ? [] : deskIdKey.split(',')
      const next = fitInto(store.get().layout, ids, DESKS, false)
      if (!sameGrid(next, store.get().layout)) store.set({ layout: next })
    }, [deskIdKey])

    // Drop stored grids and labels for workspaces and sessions that are gone.
    // Restored state can name ids that no longer exist, and without this the
    // payload would keep every deleted workspace's board forever.
    const sessionIdKey = Object.keys(notes).join(',')
    useEffect(() => {
      const current = store.get()
      const pruned = pruneScene(
        current.order,
        current.labels,
        deskIdKey === '' ? [] : deskIdKey.split(','),
        sessionIdKey === '' ? [] : sessionIdKey.split(','),
      )
      // pruneScene returns the same references when nothing was stale, so this
      // only writes when something actually changed.
      if (pruned.order !== current.order || pruned.labels !== current.labels) {
        store.set({ order: pruned.order, labels: pruned.labels })
      }
    }, [deskIdKey, sessionIdKey])

    const active = scene.active
    const activeDesk = active === null ? undefined : desks.find(d => d.id === active)
    const liveKey = activeDesk === undefined
      ? ''
      : activeDesk.sessionIds.filter(id => notes[id] !== undefined && !archivedIds.includes(id)).join(',')

    useEffect(() => {
      if (active === null) return
      // A drop is mid-flight for this desk: the handler owns the grid until
      // the new id lands, otherwise both writers place the same session.
      if (store.get().pending?.wsId === active) return
      const current = store.get().order[active]
      const ids = liveKey === '' ? [] : liveKey.split(',')
      const next = fitInto(current, ids, store.get().limit, true)
      if (!sameGrid(next, current)) {
        store.set({ order: { ...store.get().order, [active]: next } })
      }
    }, [liveKey, scene.limit, active, scene.pending])

    // The active workspace can be deleted from another surface; fall back to
    // the top view rather than rendering a desk that no longer exists.
    const missing = scene.mode === 'desk' && activeDesk === undefined
    useEffect(() => {
      if (missing) store.set({ mode: 'top', active: null })
    }, [missing])

    const createWorkspace = async () => {
      if (workspaces === undefined) {
        store.set({ notice: '工作区服务离线 / WORKSPACE LINK OFFLINE' })
        return
      }
      try {
        store.set({ notice: '正在扫描本地目录… / SCANNING DIRECTORY' })
        const path = await workspaces.pickDirectory()
        if (path === null || path === '') {
          store.set({ notice: null })
          return
        }
        await workspaces.create({ path })
        store.set({ notice: '神经链接已建立 / WORKSPACE LINKED' })
      } catch (error) {
        console.error(`${PLUGIN_ID}: workspace creation failed`, error)
        store.set({ notice: '链接失败，请重试 / LINK FAILED' })
      }
    }

    const openSession = (sessionId: string) => {
      sessions?.open(sessionId)
      // Records which note is on screen. The shell's conversation slot has no
      // "closed" state to read, so the monitor's power is tracked here.
      store.set({ opened: sessionId })
    }

    const enterDesk = (workspaceId: string) => {
      // `opened: null` is the fix for the cross-workspace bleed: the shell still
      // holds the previously opened session, so without this the new desk lights
      // up showing the old workspace's conversation.
      store.set({ mode: 'desk', active: workspaceId, opened: null, transition: 'entering', notice: '神经握手完成 / LINK ESTABLISHED' })
      timers.timeout(() => {
        // Unconditional: a competing write to `transition` must not strand the
        // scene mid-animation. Only ever settles to the resting phase.
        if (store.get().mode === 'desk') store.set({ transition: 'idle' })
      }, 520)
    }

    // Leaving is committed immediately and the exit animation plays over the
    // outgoing view. Deferring the mode switch to a timer made the button look
    // dead whenever another store write landed inside the 260ms window: the
    // guard stopped matching, `mode` stayed 'desk', and `pxo-power-off`'s
    // `both` fill left .pxo-fill collapsed at scaleY(0) — a black screen with
    // no way back.
    const leaveDesk = () => {
      store.set({ mode: 'top', active: null, opened: null, transition: 'entering', notice: null })
      timers.timeout(() => {
        if (store.get().mode === 'top') store.set({ transition: 'idle' })
      }, 420)
    }

    const openSettings = () => {
      if (!openShippedSettings()) {
        console.error(`${PLUGIN_ID}: settings trigger not found`)
      }
    }

    const clearWorkspace = (workspaceId: string) => {
      const desk = desks.find(d => d.id === workspaceId)
      store.set({ modal: { kind: 'clear', wsId: workspaceId, title: desk?.title ?? '' } })
    }

    const addSession = async (pos: number, text: string) => {
      if (workspaces === undefined || activeDesk === undefined) {
        store.set({ modal: null, notice: '会话链路不可用 / SESSION LINK OFFLINE' })
        return
      }
      const wsId = activeDesk.id
      // Claim the target cell BEFORE awaiting. The workspace list can publish
      // the new session id while this promise is still pending, and the
      // reconcile effect would then drop it into the lowest free cell; the
      // handler's own `placed[pos] = sid` would afterwards land on top of an
      // earlier note. The claim suspends that effect for this desk.
      store.set({ modal: null, pending: { wsId, pos }, notice: '正在生成会话节点… / SPAWNING NODE' })
      try {
        const sid = await workspaces.connectWorkspace(wsId)
        const labels = { ...store.get().labels }
        if (text !== '') labels[sid] = text
        // Re-read: the grid may legitimately have changed while awaiting.
        const placed = (store.get().order[wsId] ?? []).slice()
        while (placed.length < store.get().limit) placed.push(null)
        // Drop anywhere the id already landed, then place it once, at the
        // cell the user actually aimed at.
        for (let i = 0; i < placed.length; i += 1) if (placed[i] === sid) placed[i] = null
        const free = placed[pos] === null || placed[pos] === undefined
        const target = free ? pos : placed.indexOf(null)
        if (target >= 0) placed[target] = sid
        store.set({
          labels,
          order: { ...store.get().order, [wsId]: placed },
          pending: null,
          notice: '会话节点已上线 / NODE ONLINE',
        })
        setConsumed(value => value + 1)
        openSession(sid)
      } catch (error) {
        console.error(`${PLUGIN_ID}: session creation failed`, error)
        store.set({ pending: null, notice: '节点生成失败 / SPAWN FAILED' })
      }
    }

    // The monitor is powered only while the opened session is still pinned to
    // the active desk. Validated against the live list rather than trusted, so
    // tearing off the open note, or archiving it elsewhere, darkens the screen
    // instead of leaving a conversation for a note that is no longer there.
    const openedLive = scene.opened !== null
      && activeDesk !== undefined
      && activeDesk.sessionIds.includes(scene.opened)
      && notes[scene.opened] !== undefined
      && !archivedIds.includes(scene.opened)

    useEffect(() => {
      if (scene.opened !== null && !openedLive && store.get().mode === 'desk') {
        store.set({ opened: null })
      }
    }, [scene.opened, openedLive])

    // Skin off: render nothing, so the shipped GUI is untouched rather than
    // covered. Placed after every hook above — an early return before them
    // would change the hook order between renders and crash React.
    if (!scene.enabled) return null

    return (
      <div
        className="pxo-root"
        data-mode={scene.mode}
        data-screen={openedLive ? 'on' : 'off'}
        data-intensity={scene.intensity}
        data-grid={scene.grid ? 'on' : 'off'}
        data-transition={scene.transition}
      >
        {scene.mode === 'top'
          ? (
              <TopView
                store={store}
                desks={desks}
                running={running}
                liveCounts={liveCounts}
                onCreate={() => { void createWorkspace() }}
                onEnter={enterDesk}
                onClear={clearWorkspace}
                onSettings={openSettings}
              />
            )
          : activeDesk === undefined
            ? null
            : (
                <DeskView
                  store={store}
                  desk={activeDesk}
                  notes={notes}
                  onOpen={openSession}
                  onBack={leaveDesk}
                  onSettings={openSettings}
                  consumed={consumed}
                />
              )}
        <DragGhost store={store} notes={notes} />
        {scene.notice === null
          ? null
          : <div className="pxo-toast" role="status" aria-live="polite"><span />{scene.notice}</div>}
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

  // `inject` defers each registration until the host slot is actually
  // declared, so apply order between this plugin and the shell surfaces does
  // not matter, and a collapsing declaration removes the contribution.
  ctx.effect(
    () => slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: PLUGIN_ID, order: 72, label: '赛博工位' },
      Settings,
    )) as Disposer,
    `${PLUGIN_ID}:settings`,
  )

  ctx.effect(
    () => slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: PLUGIN_ID, order: 100 },
      Scene,
    )) as Disposer,
    `${PLUGIN_ID}:overlay`,
  )
}
