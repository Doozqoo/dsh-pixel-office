/**
 * Browser half of the Pixel Office plugin: reads the workspace and session
 * lists and registers the scene into `shell.overlay`.
 *
 * Every side effect is owned by the Cordis fiber, so unloading the plugin
 * removes the stylesheet, theme overrides, and overlay registration, and the
 * shipped theme returns with no page reload.
 * @module dsh-client-pixel-office/client
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  ClientContext, Disposer, HostRemote, OverlayProps, SessionsService,
  SessionFaceMirror, SlotsService, ThemeService, UiWorkspaceService,
  WorkspacesService,
} from './contracts.ts'
import { loadScene, persistScene, pruneScene } from './persist.ts'
import { DESKS, UNGROUPED_KEY, fitInto, sameGrid } from './placement.ts'
import { createStore } from './store.ts'
import { insertBaseStyles, insertStyles } from './styles.ts'
import { DARK_TOKENS, LIGHT_TOKENS, pairTokens } from './tokens.ts'
import { DeskView, Dialogs, DragGhost, PixelOfficeSettings, TopView, lastMessageFromFace, useScene } from './views.tsx'
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
 * Read the host appearance scheme from a `theme/change` snapshot.
 *
 * Appearance is folded into the theme snapshot (`active.colorScheme` or the
 * top-level `preference`); there is no separate `onAppearanceChange` callback.
 * @param snapshot - the payload of the `theme/change` event.
 * @returns the scheme, or undefined when the shape is unexpected.
 */
function readScheme(snapshot: unknown): 'light' | 'dark' | undefined {
  const snap = snapshot as
    | { active?: { colorScheme?: string }; preference?: string }
    | undefined
  const scheme = snap?.active?.colorScheme
  if (scheme === 'light' || scheme === 'dark') return scheme
  const preference = snap?.preference
  if (preference === 'light' || preference === 'dark') return preference
  return undefined
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
  /**
   * `master` (>= 0.1.2-alpha.1) moved `connectWorkspace` / `pickDirectory`
   * out of the `workspaces` (WorkspaceController) service into a separate
   * `uiWorkspace` (UiWorkspaceService). Either side may carry the methods;
   * the runtime below picks whichever service exposes them.
   */
  const uiWorkspace = ctx.get('uiWorkspace') as UiWorkspaceService | undefined
  const sessions = ctx.get('sessions') as SessionsService | undefined
  const theme = ctx.get('theme') as ThemeService | undefined
  /**
   * `WorkspaceController` is NOT loaded by the web client composition on
   * `master` — `ctx.get('workspaces')` resolves to `undefined`. The host
   * gateway does publish the `remote` namespace, so `create` / `delete` /
   * `rename` go straight through `ctx.remote.workspace`.
   */
  const hostRemote = ctx.get('remote') as HostRemote | undefined
  const remoteWorkspace = hostRemote?.workspace

  /**
   * Resolve the most recent message of a session for the hover preview.
   *
   * `sessions.binding(id).session` is the live `SessionFace`, whose snapshot
   * exposes the full message history — the harness does expose message
   * contents (the old placeholder was wrong). Returns undefined when the
   * service or binding is unavailable.
   */
  const readLastMessage = (sessionId: string): { role: string; text: string } | undefined => {
    const face = sessions?.binding?.(sessionId)?.session as SessionFaceMirror | undefined
    return lastMessageFromFace(face)
  }

  // Deferred transition settles, owned by the fiber.
  //
  // NOT `ctx.timeout`: that method is mixed in by the Timer plugin
  // (`@deepseek-ai/cordis-plugin-timer`), which the web composition does not
  // mount on the browser side — the shipped roster has no timer row and the
  // Cordis core carries no `timeout` of its own. Casting `ctx` to a
  // timer-shaped type compiled fine and then threw
  // `timers.timeout is not a function` on every desk enter and leave.
  //
  // So the scene schedules through `window.setTimeout` and this effect owns
  // every pending handle: unloading the plugin cancels callbacks that would
  // otherwise fire into a torn-down store.
  const pendingTimers = new Set<number>()
  ctx.effect(() => () => {
    for (const handle of pendingTimers) window.clearTimeout(handle)
    pendingTimers.clear()
  }, `${PLUGIN_ID}:timers`)

  /**
   * Run `callback` once after `delay`, tracked for fiber-owned cancellation.
   * @param callback - the transition settle to run.
   * @param delay - milliseconds to wait.
   */
  const later = (callback: () => void, delay: number): void => {
    const handle = window.setTimeout(() => {
      pendingTimers.delete(handle)
      callback()
    }, delay)
    pendingTimers.add(handle)
  }

  // The arrangement is user-authored data, so it is restored as the store's
  // seed and mirrored back on every change. Volatile fields stay at their
  // defaults; a reload always opens on the top view.
  const store = createStore(loadScene())
  ctx.effect(() => persistScene(store), `${PLUGIN_ID}:persist`)

  /**
   * Rename a workspace (the "re-label the workstation" action). Degrades to a
   * toast when the running harness does not expose `workspaces.rename`.
   */
  const renameWorkspace = async (workspaceId: string, title: string): Promise<void> => {
    if (workspaces === undefined || (workspaces.rename === undefined && remoteWorkspace === undefined)) {
      store.set({ notice: '重命名不可用 / RENAME OFFLINE' })
      return
    }
    try {
      // Prefer WorkspaceController wrapper on v2; on `master` the controller
      // is not loaded, so go through the gateway Remote namespace.
      if (workspaces.rename !== undefined) {
        await workspaces.rename(workspaceId, title)
      } else if (remoteWorkspace !== undefined) {
        const outcome = await remoteWorkspace.rename({ workspaceId, title })
        if (!outcome.result.ok) throw new Error(`workspace.rename failed: ${outcome.result.error.code} ${outcome.result.error.message}`)
      } else {
        throw new Error('workspace.rename unavailable')
      }
      store.set({ notice: '工位重命名 / STATION RELABELED' })
    } catch (error) {
      console.error(`${PLUGIN_ID}: workspace rename failed`, error)
      store.set({ notice: '重命名失败 / RENAME FAILED' })
    }
  }

  // ---------------------------------------------------------------------------
  // Styles: base sheet (always present, host-themed) + skin sheet (pixel,
  // toggled by the master switch). Merged into a SINGLE ctx.effect so the
  // DOM insertion order is deterministic: BASE <style> is always injected
  // BEFORE SKIN <style>. This is critical because equal-specificity rules
  // (e.g. .pxo-set-master .pxo-toggle > span) exist in both sheets; the
  // later one wins. Two separate effects would race — Cordis does not
  // guarantee execution order between independent fibers — causing the
  // master toggle to render with base styles on first paint and only
  // "self-heal" after the user clicks the toggle (which tears down and
  // re-creates the skin tag, placing it after base).
  // ---------------------------------------------------------------------------
  ctx.effect(() => {
    const removeBase = insertBaseStyles()
    let removeSkin: Disposer | undefined
    let removeTokens: Disposer | undefined
    const applySkin = (on: boolean): void => {
      if (on && removeSkin === undefined) {
        removeSkin = insertStyles()
        // Force the Pixel Office surface to stay dark regardless of the host's
        // global Appearance preference. Passing DARK_TOKENS for both schemes
        // makes the theme override resolve to the dark palette in every mode;
        // the rest of the application can still switch themes freely.
        removeTokens = theme?.overrideTokens(PLUGIN_ID, pairTokens(DARK_TOKENS, DARK_TOKENS))
      } else if (!on && removeSkin !== undefined) {
        removeSkin(); removeTokens?.(); removeSkin = undefined; removeTokens = undefined
      }
    }
    applySkin(store.get().enabled)
    const unsubscribe = store.subscribe(() => applySkin(store.get().enabled))
    return () => { unsubscribe(); applySkin(false); removeBase() }
  }, `${PLUGIN_ID}:styles`)

  // Host transport / appearance signals — the only cross-cutting events the
  // harness emits (workspace, session, and settings changes are snapshot-driven,
  // not event-driven). `connection/reset` drops the link banner; `theme/change`
  // tracks the host appearance for any scheme-aware chrome.
  const offReset = ctx.on('connection/reset', () => {
    store.set({ link: 'lost', notice: '链路中断 / LINK LOST' })
    later(() => store.set({ link: 'ok' }), 8000)
  })
  const offTheme = ctx.on('theme/change', (...args: readonly unknown[]) => {
    const scheme = readScheme(args[0])
    if (scheme !== undefined) store.set({ scheme })
  })
  ctx.effect(() => () => { offReset(); offTheme() }, `${PLUGIN_ID}:events`)

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

    // Ungrouped sessions = every live session that is not archived and not
    // already claimed by a real workspace. The harness groups these under the
    // virtual "未分组" bucket (it has no workspace entity of its own), so the
    // plugin mirrors that bucket as a fixed station at cell 0.
    const archived = props.useWorkspaces(state => state.archivedSessionIds.join(','))
    const archivedIds = archived === '' ? [] : archived.split(',')

    const allIds = props.useSessions(state => [...state.ids])
    const realSessionIds = props.useWorkspaces(
      state => state.items.flatMap(w => [...w.sessionIds]),
    ) as readonly string[]
    const ungroupedIds = allIds.filter(
      id => !archivedIds.includes(id) && !realSessionIds.includes(id),
    )

    // Prepend the synthetic 未分组 station so it is always present (and first).
    const stationList = [
      { id: UNGROUPED_KEY, title: '未分组', sessionIds: ungroupedIds },
      ...desks,
    ] as readonly DeskRecord[]
    const noteEntries = props.useSessions(state => state.ids.map((id) => {
      const record = state.byId[id]
      return record === undefined
        ? null
        : [id, { title: record.displayTitle, running: record.running }] as const
    }))
    const notes: Record<string, NoteRecord> = {}
    for (const entry of noteEntries) if (entry !== null) notes[entry[0]] = entry[1]

    const running: Record<string, boolean> = {}
    // Live note count per desk: exactly the sessions the task matrix would pin,
    // so the tile agrees with the board. `sessionIds` alone counts archived
    // sessions and ids the session list has not published, both of which the
    // matrix omits — the tile claimed notes that were not there.
    const liveCounts: Record<string, number> = {}
    for (const desk of stationList) {
      const live = desk.sessionIds.filter(
        id => notes[id] !== undefined && !archivedIds.includes(id),
      )
      liveCounts[desk.id] = live.length
      running[desk.id] = live.some(id => notes[id]?.running === true)
    }

    const deskIdKey = stationList.map(d => d.id).join(',')
    useEffect(() => {
      const ids = deskIdKey === '' ? [] : deskIdKey.split(',')
      // A workspace creation is mid-flight with an aimed cell: hold the
      // reconcile so the fresh id is not swept into the lowest free cell,
      // and place it at the aimed cell once it publishes.
      const aimed = scene.pendingLayout
      if (aimed !== null) {
        const before = aimed.before === '' ? [] : aimed.before.split(',')
        const fresh = ids.find(id => !before.includes(id))
        if (fresh !== undefined) {
          const layout = store.get().layout.slice()
          // Drop at the aimed cell unless another write took it meanwhile;
          // then fall back to the lowest free cell so creation never fails.
          const free = layout[aimed.pos] === null || layout[aimed.pos] === undefined
            ? aimed.pos
            : layout.indexOf(null)
          if (free >= 0) layout[free] = fresh
          store.set({ layout, pendingLayout: null })
        }
        return
      }
      // The workspace list has not published yet (async mount): leave the
      // restored layout alone so a reload does not discard the saved
      // arrangement. Once the list publishes — and the always-present
      // 未分组 station publishes immediately — this branch no longer fires.
      if (ids.length === 0) return
      const reconciled = fitInto(store.get().layout, ids, DESKS, false)
      // `fitInto` returns a readonly grid; copy it so 未分组 can be pinned.
      const next: (string | null)[] = [...reconciled]
      // The 未分组 station is pinned to cell 0 so it never moves. If a real
      // workspace had drifted into cell 0 (e.g. a layout restored from before
      // ungrouped existed), swap it out rather than overwrite it.
      if (next[0] !== UNGROUPED_KEY) {
        const displaced = next[0] ?? null
        const at = next.indexOf(UNGROUPED_KEY)
        if (at > 0) next[at] = displaced
        next[0] = UNGROUPED_KEY
      }
      if (!sameGrid(next, store.get().layout)) store.set({ layout: next })
    }, [deskIdKey, scene.pendingLayout])

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
    const activeDesk = active === null ? undefined : stationList.find(d => d.id === active)
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

    const createWorkspace = async (pos?: number) => {
      if (workspaces === undefined && remoteWorkspace === undefined) {
        store.set({ notice: '工作区服务离线 / WORKSPACE LINK OFFLINE' })
        return
      }
      try {
        store.set({ notice: '正在扫描本地目录… / SCANNING DIRECTORY' })
        // `master` moved `pickDirectory` to `uiWorkspace`; fall back to `workspaces` on v2.
        const pick = uiWorkspace?.pickDirectory ?? workspaces?.pickDirectory
        if (pick === undefined) {
          store.set({ notice: '目录选择不可用 / PICKER UNAVAILABLE' })
          return
        }
        const path = await pick()
        if (path === null || path === '') {
          store.set({ notice: null, pendingLayout: null })
          return
        }
        // Claim the aimed cell BEFORE awaiting. The workspace list can publish
        // the new id while the create promise is pending; without the lock the
        // layout reconcile would sweep it into the lowest free cell instead of
        // the empty station the user clicked. `before` is the desk-id snapshot
        // at creation time, so the reconcile can recognise the fresh id.
        if (pos !== undefined) {
          store.set({ pendingLayout: { pos, before: deskIdKey } })
        }
        // Prefer the WorkspaceController wrapper on v2; on `master` the
        // controller is not loaded, so go through the gateway Remote namespace.
        if (workspaces?.create !== undefined) {
          await workspaces.create({ path })
        } else if (remoteWorkspace !== undefined) {
          const outcome = await remoteWorkspace.create({ path })
          if (!outcome.result.ok) throw new Error(`workspace.create failed: ${outcome.result.error.code} ${outcome.result.error.message}`)
        } else {
          throw new Error('workspace.create unavailable')
        }
        store.set({ notice: '神经链接已建立 / WORKSPACE LINKED' })
      } catch (error) {
        console.error(`${PLUGIN_ID}: workspace creation failed`, error)
        store.set({ notice: '链接失败，请重试 / LINK FAILED', pendingLayout: null })
      }
    }

    const openSession = (sessionId: string) => {
      sessions?.open(sessionId)
      // Records which note is on screen. The shell's conversation slot has no
      // "closed" state to read, so the monitor's power is tracked here.
      // Stamps the activity clock for this session too: the v2 features (sticker
      // preview, cat state, desk lamp, today panel, standby thumbnails) all read
      // `activity` to decide what to show. This is an approximation — opening a
      // session is treated as "touched" — not a real event stream; a future
      // build can replace it with the harness's own activity source.
      store.set({
        opened: sessionId,
        activity: { ...store.get().activity, [sessionId]: Date.now() },
      })
    }

    const enterDesk = (workspaceId: string) => {
      // `opened: null` is the fix for the cross-workspace bleed: the shell still
      // holds the previously opened session, so without this the new desk lights
      // up showing the old workspace's conversation.
      store.set({ mode: 'desk', active: workspaceId, opened: null, transition: 'entering', notice: '神经握手完成 / LINK ESTABLISHED' })
      later(() => {
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
      // Closing any open modal so the dialog (e.g. edit/rename/new) does not
      // stay visible after leaving the desk and returning to the office view.
      store.set({ mode: 'top', active: null, opened: null, modal: null, transition: 'entering', notice: null })
      later(() => {
        if (store.get().mode === 'top') store.set({ transition: 'idle' })
      }, 420)
    }

    const openSettings = () => {
      if (!openShippedSettings()) {
        console.error(`${PLUGIN_ID}: settings trigger not found`)
      }
    }

    const clearWorkspace = (workspaceId: string) => {
      const desk = stationList.find(d => d.id === workspaceId)
      store.set({ modal: { kind: 'clear', wsId: workspaceId, title: desk?.title ?? '' } })
    }

    const renameWorkspaceReq = (workspaceId: string) => {
      const desk = stationList.find(d => d.id === workspaceId)
      store.set({ modal: { kind: 'rename', wsId: workspaceId, title: desk?.title ?? '' } })
    }

    const addSession = async (pos: number, text: string) => {
      // 未分组 has no workspace entity and the harness exposes no verb to
      // create a session without one, so it stays read-only — matching the
      // harness, which also routes session creation through a workspace.
      if (activeDesk?.id === UNGROUPED_KEY) {
        store.set({ notice: '未分组为只读 / UNGROUPED IS READ-ONLY' })
        return
      }
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
        const sid = await (uiWorkspace?.connectWorkspace ?? workspaces.connectWorkspace ?? (() => Promise.reject(new Error('connectWorkspace unavailable'))))(wsId)
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

    // Auto-dismiss the bottom-island notice after 3.5 s so it never
    // goes stale against the current page state (rename done, link
    // restored, workspace linked, etc.).
    useEffect(() => {
      if (scene.notice === null) return
      const id = setTimeout(() => { store.set({ notice: null }) }, 3500)
      return () => { clearTimeout(id) }
    }, [scene.notice])

    // Full-bleed CRT scanline layer, injected at <body>'s top stacking context
    // (same pattern as the session reveal) so the CRT monitor — which paints an
    // opaque `--pxo-crt` backdrop at z-index 40 while a session is open — can
    // never bury the scanlines under the conversation. `pointer-events:none`
    // keeps it a pure film layer; nothing about the UI interaction changes.
    useEffect(() => {
      if (!scene.enabled) return
      const el = document.createElement('div')
      el.className = 'pxo-scan'
      document.body.appendChild(el)
      return () => { el.remove() }
    }, [scene.enabled])

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
                desks={stationList}
                running={running}
                liveCounts={liveCounts}
                onCreate={(index) => { void createWorkspace(index) }}
                onEnter={enterDesk}
                onClear={clearWorkspace}
                onRename={renameWorkspaceReq}
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
                  isUngrouped={activeDesk?.id === UNGROUPED_KEY}
                  readLastMessage={readLastMessage}
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
          onTear={(sessionId) => {
            const archive = uiWorkspace?.archiveSession ?? workspaces?.archiveSession
            if (archive !== undefined) void archive(sessionId)
          }}
          onClear={async (workspaceId) => {
            // Prefer WorkspaceController on v2; on `master` the controller is
            // not loaded, so go through the gateway Remote namespace.
            if (workspaces?.delete !== undefined) {
              await workspaces.delete(workspaceId)
            } else if (remoteWorkspace !== undefined) {
              const outcome = await remoteWorkspace.delete({ workspaceId })
              if (!outcome.result.ok) throw new Error(`workspace.delete failed: ${outcome.result.error.code} ${outcome.result.error.message}`)
            } else {
              throw new Error('workspace.delete unavailable')
            }
          }}
          onRename={(workspaceId, title) => { void renameWorkspace(workspaceId, title) }}
        />
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

  // The Pixel Office settings page, mounted into the host's settings panel via
  // the canonical `settings.section` slot — the supported home for a feature's
  // own preferences. The previous build had the section CSS but never
  // registered it and instead opened the panel by faking a click on
  // `settings.trigger`; this registers a real, discoverable section that
  // receives the host `close` affordance via its owner props.
  ctx.effect(
    () => slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: PLUGIN_ID, order: 60, label: 'Pixel Office' },
      (owner: { close: () => void }) => <PixelOfficeSettings store={store} close={owner.close} />,
    )) as Disposer,
    `${PLUGIN_ID}:settings`,
  )
}
