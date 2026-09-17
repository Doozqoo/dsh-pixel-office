/**
 * DOM adapter — isolates all harness DOM structure queries.
 *
 * Every selector that targets the host shell's DOM is defined here. When the
 * harness changes a `data-slot` attribute, a CSS class naming convention, or
 * the sidebar structure, only this module needs updating.
 *
 * Mirrored against `dsh-v0.1.6-alpha.2`:
 *
 * - `[data-slot="details"]` no longer exists. The old right-hand details column
 *   was replaced by the dockable right sidebar, whose own markers are
 *   `[data-rightbar-col]`, `[data-sidebar-right-panel]` (with
 *   `[data-sidebar-right-open]` while shown), and `[data-sidebar-right-float-host]`
 *   for panels that portal out of the column.
 * - The docking kit marks its own parts in `ui-dockkit`: `[data-dockkit-pane]`,
 *   `[data-dockkit-strip]`, `[data-dockkit-tab]`, `[data-dockkit-divider]`,
 *   `[data-dockkit-float]`, `[data-dockkit-tab-menu]`.
 * @module dsh-client-pixel-office/adapters/dom
 */

export const SELECTORS = {
  /** The sidebar slot anchor. */
  SIDEBAR: '[data-slot="sidebar"]',
  /** The build version badge inside the sidebar. */
  BUILD_VERSION: '[class*="buildVersion"]',
  /** The conversation slot anchor. */
  CONVERSATION: '[data-slot="conversation"]',
  /** The right column track (present even while the panel is collapsed). */
  RIGHTBAR_COL: '[data-rightbar-col]',
  /** The right sidebar panel box; carries `data-sidebar-right-open` while shown. */
  RIGHTBAR_PANEL: '[data-sidebar-right-panel]',
  /** The portal host for the right sidebar's floating panels. */
  FLOAT_HOST: '[data-sidebar-right-float-host]',
  /** The settings trigger button. */
  SETTINGS_TRIGGER: '[data-slot="settings.trigger"]',
} as const

/** Docking-kit part markers, used only by the stylesheet. */
export const DOCKKIT_SELECTORS = {
  PANE: '[data-dockkit-pane]',
  STRIP: '[data-dockkit-strip]',
  STRIP_TABS: '[data-dockkit-strip-tabs]',
  TAB: '[data-dockkit-tab]',
  TAB_TITLE: '[data-dockkit-tab-title]',
  TAB_MENU: '[data-dockkit-tab-menu]',
  DIVIDER: '[data-dockkit-divider]',
  FLOAT: '[data-dockkit-float]',
  FLOAT_TITLE: '[data-dockkit-float-title]',
} as const

/**
 * Click the shipped settings trigger.
 * @returns whether the trigger was found and clicked.
 */
export function clickSettingsTrigger(): boolean {
  const seat = document.querySelector(SELECTORS.SETTINGS_TRIGGER)
  const button = seat?.closest('button') ?? null
  if (button === null) return false
  button.click()
  return true
}

/**
 * Locate the conversation slot element in the DOM.
 * @returns the element, or null when absent.
 */
export function findConversationSlot(): Element | null {
  return document.querySelector(SELECTORS.CONVERSATION)
}

/**
 * Locate the sidebar element.
 * @returns the element, or null when absent.
 */
export function findSidebar(): Element | null {
  return document.querySelector(SELECTORS.SIDEBAR)
}

/**
 * Locate the right column track.
 * @returns the element, or null when the shell has no right bar.
 */
export function findRightbar(): Element | null {
  return document.querySelector(SELECTORS.RIGHTBAR_COL)
}

/**
 * Whether the right sidebar panel is currently drawn.
 *
 * Read straight off the DOM rather than from a service: the panel keeps its
 * open state in the sidebar-right store, which is not a service this plugin
 * declares. The attribute is the published contract for it.
 * @returns true while the panel is shown.
 */
export function isRightbarOpen(): boolean {
  return document.querySelector(`${SELECTORS.RIGHTBAR_PANEL}[data-sidebar-right-open]`) !== null
}

/**
 * Locate the build version badge inside the sidebar.
 * @returns the element, or null when absent.
 */
export function findBuildBadge(): Element | null {
  const sidebar = findSidebar()
  if (sidebar === null) return null
  return sidebar.querySelector(SELECTORS.BUILD_VERSION)
}
