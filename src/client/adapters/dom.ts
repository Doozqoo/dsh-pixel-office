/**
 * DOM adapter — isolates all harness DOM structure queries.
 *
 * Every selector that targets the host shell's DOM is defined here. When the
 * harness changes a `data-slot` attribute, a CSS class naming convention, or
 * the sidebar structure, only this module needs updating.
 * @module dsh-client-pixel-office/adapters/dom
 */

export const SELECTORS = {
  /** The sidebar slot anchor. */
  SIDEBAR: '[data-slot="sidebar"]',
  /** The build version badge inside the sidebar. */
  BUILD_VERSION: '[class*="buildVersion"]',
  /** The conversation slot anchor. */
  CONVERSATION: '[data-slot="conversation"]',
  /** The details panel slot anchor. */
  DETAILS: '[data-slot="details"]',
  /** The settings trigger button. */
  SETTINGS_TRIGGER: '[data-slot="settings.trigger"]',
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
 * Locate the build version badge inside the sidebar.
 * @returns the element, or null when absent.
 */
export function findBuildBadge(): Element | null {
  const sidebar = findSidebar()
  if (sidebar === null) return null
  return sidebar.querySelector(SELECTORS.BUILD_VERSION)
}