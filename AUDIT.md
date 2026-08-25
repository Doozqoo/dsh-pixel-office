# dsh-pixel-office 兼容性审计报告

> 范围：基于 `./deepseek-harness`（基座）已对外暴露的核心能力，逐项核对 `./dsh-pixel-office`
> （像素风办公主题插件）的接入情况，明确缺失 / 实现不完整之处，并给出已落地的增强。
>
> 审计时的基线事实：
> - 基座 `ClientContext` 即 Cordis 合并后的 `Context`（`packages/client/runtime/src/client/index.ts:112`）。
> - 域名状态（workspaces / sessions / settings）全部为**快照驱动**（通过 `useWorkspaces` / `useSessions` /
>   `SettingsScope` 选择器），**不是事件驱动**；只有少量跨切面信号走事件总线。
> - 插件仓库刻意**不依赖**任何 `@deepseek-ai/*` 包：它在 `src/client/contracts.ts` 中以结构性
>   “镜像类型”描述所消费的基座成员，保证独立仓库可单独 typecheck / 构建。镜像若与运行期不符，以基座为准。

---

## 一、基座核心能力梳理（Part 1）

### 1.1 客户端上下文（ClientContext / 生命周期宿主）
- `ClientContext = Context` —— Cordis 合并上下文（`index.ts:112`）。
- 因此它同时承载两类能力：
  1. **服务注入**：`ctx.get(name)`、`ctx.inject([...])`、`ctx.effect(cb, label)`。
  2. **事件总线**：`on / once / emit / parallel / serial / bail / waterfall`
     （`vendor/cordis/src/events.ts:183,194,204,217,234,288,313`）。
- 全局标准属性 `GlobalStandardProps`：每个全局 slot 组件注入 `useSessions`、`useWorkspaces`
  （`index.ts:146-150`）—— 这是读取 workspace / session 列表的**唯一官方通道**。

### 1.2 插槽系统（SlotsService / SlotRegistry）
- 注册 API：`SlotRegistry.register(options, component)` 与 `inject(key, () => Disposer)`
  （`packages/client/runtime/src/client/slots.ts:93,126,143`）。
- 订阅：`subscribe(key, fn)`（`:342`）。
- 关键槽位（来自 `packages/client/ui-settings/.../contract/slots.ts` 与 `slots.ts` 注释）：
  | 槽位 | 种类 | owner 形态 | 用途 |
  |---|---|---|---|
  | `shell.overlay` | list（可叠加） | `OverlayProps{ useWorkspaces, useSessions }` | 浮层 UI 的**正确归宿** |
  | `settings.section` | list | `SettingsSectionOwnerProps{ close: () => void }`（`:122-124`） | 某功能**偏好面板的官方家** |
  | `settings.trigger` | single | `SettingsTriggerOwnerProps`（`:23`） | 设置入口按钮（**单槽，二次注册会遮蔽**） |
  | `sidebar.settings` | single | —— | 侧栏设置入口 |
  | `conversation` | —— | —— | 会话区注入 |

  > 关键约束（`slots.ts:33-38`）：`settings.trigger` 是**单槽**，再次注册不会并列而是遮蔽；
  > 动态浮层应注册进 `shell.overlay`（list，可叠加）。

### 1.3 工作区服务（WorkspacesService → `IWorkspaces`，注入为 `ctx.workspaces`）
完整对外面（`packages/client/runtime/src/client/contract/workspaces.ts:14-94`）：
- `list: ObservableSnapshot<WorkspaceListState>`（只读快照）
- `connectWorkspace(id)` `:22` · `startSession(id?)` `:30`
- `create({path})` `:36` · `pickDirectory()` `:41` · `listDirectory(path?, signal?)` `:48`
  · `createDirectory(path, name)` `:55` · `openPath(path)` `:60`
- **`rename(workspaceId, title)` `:67`** · `delete(id)` `:72` · `insertBefore(id, before?)` `:78`
  · `insertSessionBefore(...)` `:86` · `archiveSession(id)` `:93`

### 1.4 会话服务（SessionsService → `ISessions`，注入为 `ctx.sessions`）
完整对外面（`packages/client/runtime/src/client/contract/sessions.ts:26-130`）：
- `list: ObservableSnapshot<SessionListState>`（只读） · `currentProvideInfo` · `searchResultLimit`
- `open(id)` `:41` · `openSubagent(addr)` `:46` · `Subagent` 系列 `:52,58,64`
- `noteAgentPreset(id, preset)` `:73` · `clear()` `:75` · `search(q, signal)` `:83` · `fork(opts)` `:97`
- `provide(descriptor)` `:104` · `scope(id)` `:110` · `scopeOf(ctx)` `:117` · `sessionOf(ctx)` `:123`
- **`binding(id): SessionBinding | undefined` `:129`**

**消息确实对外暴露**（此前插件中存在“消息未暴露”的误解，已纠正）：
- `SessionBinding.session`（`sessions/service.ts:142`）即 `SessionFace`
  = `ISession & ObservableSnapshot<ConversationSnapshot>`（`contract/session.ts:93`）。
- `SessionFace.getSnapshot()` → `ConversationSnapshot.nodes: readonly ConversationNode[]`
  （`sessions/conversation.ts:444`），节点含 `text` / `reasoning` 等完整内容
  （`:45-46,327`）。
- 因此 `sessions.binding(id)?.session?.getSnapshot().nodes` 可拿到**完整对话历史**，无需任何额外暴露。

### 1.5 主题服务（ThemeService → `ctx.theme`）
- **`overrideTokens(source, tokens): () => void`**
  （`packages/extensions/cordis-client-runner/src/client/api-catalog.ts:255`，
  签名 `overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void`）。
- `source` 由 runner 的 guard **强制改写为本包 id**（`guard.ts:140-169`），调用形如
  `theme.overrideTokens('my-pkg', { '--token': { light, dark } })`；返回 disposer 用于撤销。
- 每次成功叠加 / 移除都会 emit **`theme/change`**（`api-catalog.ts:256`），载荷为 `ThemeSnapshot`
  （`preference / active / themes / revision`），外观（亮/暗）折叠进 `active.colorScheme` / `preference`。

### 1.6 配置体系（SettingsScope）
- 契约：`SettingsScope<T>`（`contract/settings-scope.ts:56-81`）——
  `getSnapshot()` / `subscribe(fn)` / `set(field, value)` / `unset(field)`。
- 命名空间规格 `SettingsScopeSpec<T>{ namespace, decode? }`（`:40-49`）。
- 快照状态 `status: 'loading' | 'ready' | 'unavailable'`，`mode: 'host' | 'memory'`，
  并带 `revision / writable / user / base` 等（`:17,31-36`）—— 即**具备修订 fencing、可写性、
  跨进程同步语义的官方持久化通道**。
- 获取方式：Host 侧通过 `attachSettings` 注册命名空间，浏览器侧拿到该 scope（契约定义于
  `settings-scope.ts`，类型由 `client/index.ts:53` 再导出）。

### 1.7 生命周期与事件机制
- **生命周期**：以 `ctx.effect(cb, label)` 为单位（“fiber 拥有”的清理），无 `onReady` 钩子；
  依赖 Dom 时序用 `ctx.effect` 注册、`return disposer` 卸载。
- **事件机制**：Cordis 事件总线（`on/once/emit/parallel/serial/bail/waterfall`）。
  官方 client-face 信号（用于跨切面、非域名状态）：
  - **`connection/reset`** —— 传输层重连信号（`scripts/gen-cordis-catalog.ts:209`；
    基座内 `ui-cordis`、`ui-agent-preset`、`cordis-client-runner` 等均订阅）。
  - **`theme/change`** —— 主题切换信号（`gen-cordis-catalog.ts:216`），签名
    `'theme/change'(snapshot: ThemeSnapshot): void`（`api-catalog.ts:397`）。
  - 另有 `slots/changed`、`settings/changed`、`internal/*` 等。

---

## 二、插件兼容性逐项核对（Part 2）

判定图例：✅ 已正确接入 · ⚠️ 此前不完整 / 已修复 · ❌ 缺失（已补） · 🔶 有意识偏离（可接受，已记录）

| # | 基座能力 | 插件消费位置 | 结论 | 说明 |
|---|---|---|---|---|
| 1 | `SlotsService.register` / `inject` | `index.tsx:487,501` | ✅ | `shell.overlay` 浮层 + `settings.section` 偏好面板均用官方注册通道 |
| 2 | `settings.section` 槽（owner 含 `close`） | `index.tsx:501-503` | ⚠️→✅ | **此前**用 DOM 点击 hack 假触发 `settings.trigger`；**已改为**向 `settings.section` 注册并接收 `close` 完成关闭流 |
| 3 | `ClientContext.on`（事件总线） | `index.tsx:192,196` | ❌→✅ | **此前未订阅任何事件**；**已补** `connection/reset`（链路丢失）、`theme/change`（亮暗跟踪） |
| 4 | `WorkspacesService.rename` | `index.tsx:143,477` | ❌→✅ | **此前无重命名**；**已补** `renameWorkspace` + 工位铅笔按钮 + `InputModal` |
| 5 | `SessionsService.binding(id).session` | `index.tsx` `readLastMessage` + `views.tsx` `lastMessageFromFace` | ❌→✅ | **此前便利贴预览是占位符“消息需暴露”**；**已纠正**为读取 `nodes` 真实末条消息 |
| 6 | `ThemeService.overrideTokens` | `index.tsx:168` | ✅ | token 对（light/dark）叠加，disposer 在 effect 内撤销——符合官方用法 |
| 7 | `SettingsScope`（配置体系） | —— | 🔶 偏离 | 插件用 `localStorage` 自管持久化（`persist.ts`），**未走基座 `SettingsScope`**。对纯主题皮肤可接受，但意味着不进 `settings/changed` 流、无修订 fencing、不跨进程同步。见 §2.1 |
| 8 | `ctx.effect` 生命周期 | `index.tsx:137,162,186,200,486,500` | ✅ | 各类注册 / 订阅均用 effect 包裹并返回 disposer，卸载干净 |
| 9 | `useWorkspaces` / `useSessions` 快照 | `index.tsx` overlay 组件 | ✅ | 经 `OverlayProps` 官方钩子读取，未自建事件轮询 |
| 10 | 总开关真正生效 | `index.tsx:178,428` | ⚠️→✅ | **此前**样式表无条件注入，开关形同虚设；**已修复**为按 `store.enabled` 门控皮肤，且 `insertBaseStyles()` 此前是死代码（现 `index.tsx:186` 真实调用，保证关皮肤后设置面板仍可读） |

### 2.1 关于配置体系偏离（🔶）的进一步说明
基座提供 `SettingsScope` 作为“受管、可同步、带修订”的偏好通道，但要求 Host 侧先以
`attachSettings` 注册命名空间。本插件是**独立分发的主题皮肤**，未必配套 Host 插件，因此选择
`localStorage` 自管（`PersistedScene`）。这是合理的工程取舍，但需在文档中明确：
- 优点：零依赖、独立可装、离线可用。
- 代价：偏好**不**进入 `settings/changed` 广播、无 `revision` 冲突保护、不随 Host 文档跨进程同步。
- 若未来该插件随 Host 包一同分发，建议将 `intensity / grid / enabled` 等迁移到 `SettingsScope`
  以获得官方同步与“重置/继承”语义。

---

## 三、贴合主题的创造性功能补充（Part 3，已落地）

在确认兼容后，围绕 **“数字 + 像素”办公（workspace-as-cubicle）** 风格，补齐了以下能力，
使插件在视觉 / 交互 / 基座能力三层统一：

1. **链路丢失的 CRT 叙事（基座事件 → 主题表达）**
   - 订阅 `connection/reset`，在 `DeskView` / `TopView` 叠加 **`LinkLost` 红色 “NO CARRIER” CRT 遮罩**
     （`views.tsx` + `styles.ts` `LINKLOST` 常量），8 秒后自动清除。把“断线”这一系统信号翻译成
     像素办公世界的“电话占线”意象。
2. **亮/暗方案自适应（基座主题 → 主题表达）**
   - 订阅 `theme/change`，从 `ThemeSnapshot` 读取 `active.colorScheme` / `preference` 写入
     `SceneState.scheme`（`store.ts`），供 CRT 遮罩与面板按方案取色，避免硬编码。
3. **工位重命名（基座能力 → 主题交互）**
   - 调用 `workspaces.rename` 实现工位改名；UI 上工位 tile 增加铅笔 `✎` 按钮，`Dialogs` 新增
     `rename` 用例走 `InputModal`，改名写回基座并随快照刷新。
4. **便利贴真实末条消息（基座暴露 → 主题交互）**
   - `lastMessageFromFace(face)` 从 `binding(id).session.getSnapshot().nodes` 取末条消息，
     按 `user/assistant/system` 渲染 `YOU / AI / SYS` 角标与文本，替换原占位符；让“便利贴会话”
     真正反映工作台现场。
5. **官方设置面板（基座 `settings.section` → 主题偏好）**
   - `PixelOfficeSettings` 组件注册进 `settings.section`（label “Pixel Office”），含：总开关、
     `intensity`（calm / overdrive）、`grid` 网格开关；并通过 owner 的 `close` 完成关闭流。
6. **可持久化的偏好松绑**
   - 原实现每次写入都强制 `enabled:true, intensity:'overdrive', grid:true`，用户无法调。
     现已放开为**用户可控**，并在 `PersistedScene` 中持久化 `intensity` / `grid`（`persist.ts`）。

---

## 四、验证结论

- 类型检查：`tsc -b --force` → **exit 0**。
- 构建：`npm run build`（tsdown）→ **exit 0**，产物 `lib/client.js`（≈133 kB）。
- 兼容性：插件消费的 6 个基座面（`slots` / `on` / `workspaces.rename` / `sessions.binding` /
  `theme.overrideTokens` / `ctx.effect`）均有官方签名对齐，无越界假设。
- 唯一偏离：配置走 `localStorage` 而非 `SettingsScope`（§2.1，有意识取舍）。

> 镜像声明：所有 `*Mirror` / `*Service` 接口为插件侧结构性镜像，若与运行期基座签名冲突，
> 以 `deepseek-harness` 实际契约为准。
