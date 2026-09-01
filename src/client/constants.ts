/**
 * Centralized constants for the Pixel Office plugin.
 *
 * All magic numbers, timing values, and layout dimensions live here.
 * When the plugin needs to be tuned for a different harness version,
 * these are the only values that need adjusting.
 * @module dsh-client-pixel-office/constants
 */

/** Desks in the top-down view: a 6x4 grid. */
export const DESKS = 24

/** Movement in CSS pixels before a pointer press counts as a drag. */
export const DRAG_THRESHOLD = 6

/** Widest a sticky note is allowed to be, in CSS pixels. */
export const MAX_NOTE_W = 156

/** Narrowest a matrix cell may become before the grid drops a column. */
export const MIN_NOTE_W = 126

/** Gap between matrix cells, in CSS pixels. */
export const CELL_GAP = 10

/** Aspect ratio of one sticky note (width / height). */
export const NOTE_RATIO = 156 / 168

/** Idle threshold beyond which the cat dozes off (30 minutes). */
export const SLEEPY_AFTER_MS = 30 * 60 * 1000

/** Synthetic key for the always-present "未分组 / Ungrouped" station. */
export const UNGROUPED_KEY = '__ungrouped__'

/** Sticky-note paper colors, chosen per session id. */
export const STICKER_COLORS = ['#ffeda8', '#ffbacf', '#bdf7c7', '#bddbff', '#b0f2eb'] as const

/** Neon accent colors, assigned per workspace id. */
export const ACCENTS = ['#5cff9e', '#5ce0ff', '#ffe35c', '#ff5cab', '#ff9e1c', '#6699ff'] as const

// ── Timing ────────────────────────────────────────────────────────────────

/** How long the "link lost" toast stays visible (ms). */
export const LINK_LOST_TOAST_MS = 8000

/** How long a notice toast stays visible (ms). */
export const NOTICE_TOAST_MS = 3500

/** Desk enter transition settle delay (ms). */
export const ENTER_TRANSITION_MS = 520

/** Desk leave transition settle delay (ms). */
export const LEAVE_TRANSITION_MS = 420

/** Retry delays for version badge lookup (ms). */
export const VERSION_RETRY_DELAYS = [120, 380, 1000, 2000, 4000] as const

/** Sticker hover preview show delay (ms). */
export const PREVIEW_SHOW_DELAY_MS = 150

/** Sticker hover preview hide delay (ms). */
export const PREVIEW_HIDE_DELAY_MS = 100

/** CRT reveal animation cleanup delay (ms). */
export const REVEAL_CLEANUP_MS = 2000

// ── Layout ─────────────────────────────────────────────────────────────────

/** Width of the sticker preview card, in CSS pixels. */
export const PREVIEW_CARD_W = 268

/** Plugin identifier used for slot registrations, theme overrides, and logs. */
export const PLUGIN_ID = 'pixel-office'