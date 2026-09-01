/**
 * Centralized UI strings for the Pixel Office plugin.
 *
 * All user-visible text lives here. This is a lightweight alternative to a
 * full i18n framework: the plugin currently supports Chinese + English inline,
 * but extracting the strings makes it straightforward to add proper
 * localization later.
 * @module dsh-client-pixel-office/strings
 */

export const STR = {
  // ── Top view ──────────────────────────────────────────────────────────
  TOP_TRAIL: '工作区 / WORKSPACE',
  TOOLBAR_TITLE: '工作空间 / WORKSPACES',
  TOOLBAR_SUB: (desks: number, online: number) => `· ${desks} 工位 · ${online} 在线`,
  SORT_LABEL: '排序',
  SORT_MANUAL: '手动',
  SORT_ACTIVITY: '活跃度',
  FILTER_ALL: 'ALL · 全部',
  FILTER_ONLINE: 'LIVE · 在线节点',
  NEW_STATION: '+ 新建工位',
  NEW_STATION_LABEL: '新建工位 / NEW STATION',
  CAPTION: '01 / 神经节点矩阵 — 6×4 WORKGRID',
  POWERED_BY: (version: string | undefined) =>
    `POWERED BY DSH${version === undefined ? '' : ` ${version}`}`,

  // ── Desk tiles ────────────────────────────────────────────────────────
  DESK_EMPTY: 'EMPTY · 空位',
  DESK_ONLINE: 'ONLINE · LINK ACTIVE',
  DESK_IDLE: 'IDLE · 待启动',
  DESK_LIVE_LINK: '实时链路已连接 / LIVE LINK',
  DESK_STANDBY: '节点待机 / NODE STANDBY',
  DESK_EMPTY_META: '[ 点击或拖拽项目到此创建 ]',
  NOTES_COUNT: (n: number) => `${n} 便利贴`,
  RENAME_TITLE: '重命名工位',
  CLEAR_TITLE: '清空工位',
  DRAG_MOVING: '搬迁中…',
  NEW_STICKY: '新便利贴',

  // ── Desk view ─────────────────────────────────────────────────────────
  LEAVE_DESK: '← 离开工位',
  NODES_ONLINE: (n: number) => `${n} 条链路在线`,
  NODE_STANDBY: '节点待机',
  NO_SIGNAL: 'NO SIGNAL',
  NO_SIGNAL_EMPTY: '此工位暂无便利贴',
  NO_SIGNAL_PICK: '选择一张便利贴以接入会话',
  MATRIX_TITLE: '任务矩阵 / MISSION MATRIX',
  MATRIX_STATS: (used: number, limit: number) => `${used} / ${limit - 1} 节点 · 保留 1 个交换槽`,

  // ── Stickers ──────────────────────────────────────────────────────────
  STICKER_ACTIVE: (n: number) => `● ACTIVE · #${String(n + 1).padStart(2, '0')}`,
  STICKER_SESSION: (n: number) => `SESSION #${String(n + 1).padStart(2, '0')}`,
  STICKER_UPLINK_ACTIVE: 'UPLINK ACTIVE',
  STICKER_UPLINK_IDLE: 'UPLINK IDLE',
  STICKER_NODE: (n: number) => `NODE ${String(n + 1).padStart(2, '0')}`,

  // ── Sticker preview ───────────────────────────────────────────────────
  PREVIEW_RUNNING: '运行中 · UPLINK ACTIVE',
  PREVIEW_IDLE: '待机 · UPLINK IDLE',
  PREVIEW_RECENT: '最近活动 · ',
  PREVIEW_NO_MESSAGES: '— 暂无消息记录 —',
  PREVIEW_OPEN: '▶ 打开会话',
  PREVIEW_EDIT: '✎ 编辑',
  PREVIEW_TEAR: '✂ 撕下',
  PREVIEW_NODE: (n: number) => `NODE ${String(n + 1).padStart(2, '0')}`,

  // ── New sticky stack ──────────────────────────────────────────────────
  STACK_TITLE: '新便利贴堆 / NEW STICKIES',
  STACK_HINT_DRAG: '// 拖拽到计划板空位以创建新会话',
  STACK_HINT_INPUT: '// 在空位松开后弹窗输入会话标题',
  STACK_HINT_TEAR: '// 拖出计划板 = 撕下便利贴（归档）',
  STACK_HINT_RESTORE: '// 撕下后再拖回 = 重新贴上（恢复）',
  STACK_HINT_OVERLAP: '// 同一位置重叠 = 重新编辑内容',
  STACK_ARROW: '→ DRAG →',
  STACK_DRAG_TO: '拖到计划板',
  STACK_BLANK: '空白便利贴',

  // ── Dialogs ───────────────────────────────────────────────────────────
  DIALOG_NEW_TITLE: '✎ 新便利贴',
  DIALOG_NEW_DESC: '填写这张便利贴的展示内容，确认后在当前工作区创建一个新会话。',
  DIALOG_EDIT_TITLE: '✎ 重新编辑',
  DIALOG_EDIT_DESC: '便利贴重叠视为重新编辑：仅修改展示内容，不影响会话本身。',
  DIALOG_FULL_TITLE: '⚠ 计划板已满',
  DIALOG_FULL_DESC: '已达当前可用上限（始终保留一个空位用于挪动）。可在设置中提高上限，或先撕下一张便利贴。',
  DIALOG_TEAR_TITLE: '✂ 撕下便利贴？',
  DIALOG_TEAR_DESC: '撕下将归档该会话，便利贴从计划板移除（会话记录保留）；选择重新贴上则放回原位。',
  DIALOG_CLEAR_TITLE: '⌫ 清空工位？',
  DIALOG_CLEAR_DESC: (title: string) =>
    `将删除工作区「${title}」，该工位恢复为空座椅。其下的会话会一并归档，不再显示（会话日志本身保留）。`,
  DIALOG_RENAME_TITLE: '✎ 重命名工位',
  DIALOG_RENAME_DESC: '为这台工作站重新命名，仅更改显示标题，不影响其会话记录。',
  DIALOG_CANCEL: '取消',
  DIALOG_CONFIRM: '确定',
  DIALOG_SAVE: '保存',
  DIALOG_PASTE: '贴上',
  DIALOG_GOT_IT: '知道了',
  DIALOG_KEEP: '保留',
  DIALOG_CLEAR_ACTION: '清空',
  DIALOG_TEAR_ACTION: '撕下',
  DIALOG_RESTORE: '重新贴上',
  DIALOG_RENAME_ACTION: '重命名',
  DIALOG_INPUT_PLACEHOLDER: '输入便利贴展示内容…',

  // ── Settings ───────────────────────────────────────────────────────────
  SETTINGS_THEME: 'THEME MODULE',
  SETTINGS_TITLE: 'PIXEL OFFICE',
  SETTINGS_DESC: '像素办公主题 · 将工作区重绘为霓虹控制台。',
  SETTINGS_ENABLE: '启用像素办公 / ENABLE SKIN',
  SETTINGS_ENABLE_NOTE: '关闭后恢复原生界面；可随时在此重新启用。',
  SETTINGS_INTENSITY: '动效强度 / INTENSITY',
  SETTINGS_INTENSITY_NOTE: '静默模式保留配色，仅停止环境动效。',
  SETTINGS_GRID: '网格地平线 / GRID FLOOR',
  SETTINGS_GRID_NOTE: '切换俯视网格与透视地板。',
  SETTINGS_ON: 'ON',
  SETTINGS_OFF: 'OFF',
  SETTINGS_SHOWN: 'SHOWN',
  SETTINGS_HIDDEN: 'HIDDEN',
  SETTINGS_CALM: 'CALM · 静默',
  SETTINGS_OVERDRIVE: 'OVERDRIVE · 过载',

  // ── Notices / Toasts ──────────────────────────────────────────────────
  NOTICE_LINK_LOST: '链路中断 / LINK LOST',
  NOTICE_RENAME_OFFLINE: '重命名不可用 / RENAME OFFLINE',
  NOTICE_RENAME_OK: '工位重命名 / STATION RELABELED',
  NOTICE_RENAME_FAILED: '重命名失败 / RENAME FAILED',
  NOTICE_SCANNING: '正在扫描本地目录… / SCANNING DIRECTORY',
  NOTICE_LINKED: '神经链接已建立 / WORKSPACE LINKED',
  NOTICE_LINK_FAILED: '链接失败，请重试 / LINK FAILED',
  NOTICE_ENTERED: '神经握手完成 / LINK ESTABLISHED',
  NOTICE_UNGROUPED_RO: '未分组为只读 / UNGROUPED IS READ-ONLY',
  NOTICE_SESSION_OFFLINE: '会话链路不可用 / SESSION LINK OFFLINE',
  NOTICE_SPAWNING: '正在生成会话节点… / SPAWNING NODE',
  NOTICE_SPAWNED: '会话节点已上线 / NODE ONLINE',
  NOTICE_SPAWN_FAILED: '节点生成失败 / SPAWN FAILED',

  // ── Logo ───────────────────────────────────────────────────────────────
  LOGO_MAIN: 'NEON//NEXUS',
  LOGO_SUB: 'PX-77 · AUTONOMOUS WORKGRID',

  // ── Search ─────────────────────────────────────────────────────────────
  SEARCH_PLACEHOLDER: '搜索节点 / SEARCH...',

  // ── Ungrouped ─────────────────────────────────────────────────────────
  UNGROUPED_TITLE: '未分组',

  // ── Misc ───────────────────────────────────────────────────────────────
  DESK_EMPTY_NAME: '空 位',
  DESK_EMPTY_ID: (n: number) => `空位 #${String(n).padStart(2, '0')}`,
  SEARCH_ARIA: '搜索工作区',
  DESK_TRAIL_WORKSPACE: '工作空间',
  DESK_TRAIL_PREFIX: (n: number) => `桌面 #${String(n).padStart(2, '0')}`,
  STICKER_ARIA_RUNNING: '运行中',
  STICKER_ARIA_IDLE: '待机',
  STICKER_ARIA_OPEN: '，正在显示器上打开',
  PREVIEW_ARIA: (title: string) => `${title} 预览`,
  SORT_ARIA: '工位排序',
  INTENSITY_ARIA: '动效强度',
  DESK_ARIA: (name: string, state: string) => `${name}，${state}`,
} as const