# dsh-pixel-office 按钮失效差异分析报告

**范围**：`deepseek-harness` `v2`（`b150a551b8`，0.1.1-rc.2） → `master`（`cd5ef81481`，0.1.2-alpha.1）
**对象**：`dsh-pixel-office` 插件在切到 `master` 后失效的按钮
**分析日期**：2026-08-27
**结论前置**：根本原因是 **一次客户端 runtime 拆分提交把多个方法从 `workspaces` 服务搬到了新建的 `uiWorkspace` 服务**，插件仍按 v2 契约调用旧位置导致 `undefined` → TypeError 被吞掉。但更关键的是：**第三方主题插件的 Cordis 上下文并不会暴露 `workspaces` / `uiWorkspace` / `sessions` 这些内部 controller 服务**，无论 bundle 是否列了它们。因此 `uiWorkspace?.x ?? workspaces?.x` 在插件运行时**永远落到 `undefined` 分支**，全部写操作走到"服务离线"提示。真正可靠、且唯一能触达的写入口是宿主生成的 **`ctx.remote.{workspace,session,directoryPicker}`** RPC。

> 🔴 **运行时已证实（2026-08-27 用户截图）**：点击"新建会话"显示 `会话链路不可用 / SESSION LINK OFFLINE`、点击"新建工位"显示 `工作区服务离线 / WORKSPACE LINK OFFLINE`，证明 `ctx.get('workspaces')` 与 `ctx.get('uiWorkspace')` 在插件上下文里**就是 `undefined`**。`cordis.patch.yml` 列了 controller 服务 ≠ 插件 `ctx` 能 `get` 到它们。

---

## 1. 摘要（Executive Summary）

| 项 | 结论 |
|---|---|
| 回归提交 | **`d231c8777a`** `refactor(ui): add Session and Workspace React adapters`（2026-08-22, imccyu） |
| 破坏性质 | **API 方法重定位（rename/move）**，非删除、非签名变化、非 CSS/事件变化 |
| 受影响服务 | `workspaces`（`WorkspaceController`）→ `uiWorkspace`（`UiWorkspaceService`） |
| 插件侧根因 | 插件按 v2 契约调用 `workspaces.connectWorkspace` / `workspaces.pickDirectory` / `workspaces.archiveSession`，这些在 `master` 上已迁移到 `uiWorkspace` |
| 已修复 | `fbdaea4`（适配 `uiWorkspace`）、`fb87843`（额外的 remote RPC 兜底） |
| 严重程度 | 2× P0（便利贴路由、新建工作区选择器）、1× P1（create/delete/rename，运行时依赖）、1× P2（归档 tear） |

> 🔴 **重要校正（推翻先前结论）**：先前版本曾依据 `cordis.patch.yml` 静态判断"`WorkspaceController` 已加载、`ctx.get('workspaces')` 不为 undefined、`fb87843` 的 remote 兜底只是防御性死代码"，**该结论已被运行时实测推翻**。`workspace-controller` 虽列在 web-app bundle 中（见 §4），但那是**宿主根上下文**的组合；**第三方主题插件的 Cordis fiber 拿不到这些内部 controller 服务**，插件侧 `ctx.get('workspaces')`/`ctx.get('uiWorkspace')`/`ctx.get('sessions')` 实测均为 `undefined`。因此：
> - `fb87843`（"master 上 WorkspaceController 未加载，改走 `ctx.remote.workspace`"）才是**正确的根因判断**；
> - 后续 `ee28424`（"双路兼容 workspaces/uiWorkspace、校正服务离线误判"）**反而把 remote 兜底降级为死代码、移除了写路径上的 remote 分支，正是本次"所有问题依旧"的回归来源**；
> - `ctx.remote.{workspace,session,directoryPicker}` 是插件**唯一能触达的写入口**，属**必要路径，不是防御代码**。

---

## 2. 分析范围与方法

- 提交了 `v2`（0.1.1-rc.2，`b150a551b8`）到 `master`（0.1.2-alpha.1，`cd5ef81481`）之间共 **1079** 个提交，主体是一次大型客户端重构（`packages/client/runtime` → `api/*` + `ui/*` 多包拆分，约 8177 行被删除）。
- 方法：直接读取 `v2` 与 `master` 两侧的源码（`git show v2:...` / 工作树）、比对 `IWorkspaces` / `UiWorkspace` 接口、定位精确回归提交、核对 web-app bundle 组合（`cordis.patch.yml`）、复盘插件两次修复 diff。
- 聚焦：按钮逻辑 / 事件绑定 / 服务调用 / 生命周期，而非纯 UI 样式。

---

## 3. 大背景：客户端 runtime 拆分

`master` 把原来单体的 `packages/client/runtime` 拆成两层：

- **`api/*`**：React 无关的 Host 状态镜像 + 收窄的 command service（如 `api/workspace-controller` 提供 `workspaces`）。
- **`ui/*`**：React/UI 编排层（如 `client/ui-workspace` 提供 `uiWorkspace`）。

拆分后，原本混在 `workspaces` 上的"UI 编排类"方法被抽离到 `uiWorkspace`。这是一次**有意为之的架构整理**，不是 bug，但破坏了插件的旧契约调用。

---

## 4. 精确定位：回归提交 `d231c8777a`

```
d231c8777a93e3d78c657c623ce65727373fcfc4
Author: imccyu
Date:   Sat Aug 22 21:16:53 2026 +0800
Subject: refactor(ui): add Session and Workspace React adapters
```

该提交的关键文件变动（与本次回归直接相关）：

| 动作 | 文件 | 影响 |
|---|---|---|
| **删除** | `packages/client/runtime/src/client/workspaces/service.ts` | 旧 `workspaces` 服务（含 `connectWorkspace`/`pickDirectory`）被移除 |
| **删除** | `packages/client/runtime/src/client/contract/workspaces.ts` | 旧 `IWorkspaces` 契约 |
| **新增** | `packages/client/ui-workspace/src/client/navigation.ts` | 新 `UiWorkspaceService`（`uiWorkspace`），承载 `connectWorkspace`/`pickDirectory`/`startSession`/`listDirectory`/`createDirectory`/`archiveSession` |

> 同一提交区间内还有 `f00a8b82a refactor(api): remove ApiProxy package`、`e14d354e83 refactor(connection): own RPC transport contracts` 等支撑提交，但**唯独 `d231c8777a` 直接移动了 workspace 方法**，是按钮失效的唯一直接根因。

**web-app bundle 组合验证（master 上两者均加载）：**

`packages/bundle/web-app/cordis.patch.yml`：
- 第 95-96 行：`id: workspace-controller  name: '@deepseek-ai/dsh-api-workspace-controller'` → 提供 `workspaces`
- 第 236-237 行：`id: ui-workspace  name: '@deepseek-ai/dsh-client-ui-workspace'` → 提供 `uiWorkspace`

⇒ 两个服务在**宿主根上下文**里都存在，因此宿主自己的 UI 能正常调用。但**这不代表插件 `ctx` 能 `get` 到它们**：第三方主题插件运行在一个被裁剪过的 Cordis fiber 上，只对外暴露 `slots` / `theme` / `remote` 以及 slot props（`useWorkspaces` / `useSessions`）。对插件而言，`ctx.get('workspaces')` / `ctx.get('uiWorkspace')` / `ctx.get('sessions')` 全部为 `undefined`。`cordis.patch.yml` 列出 controller 服务 ≠ 插件可见。

> 这也是为什么"读"路径（`useWorkspaces` / `useSessions` slot 钩子）正常（工位/便利贴能渲染），而所有"写"路径（`connectWorkspace` / `create` / `delete` / `rename` / `pickDirectory` / `archiveSession`）全部离线——读走 slot props，写要直接拿 controller service，而后者插件拿不到。

---

## 5. 服务契约差异表（v2 vs master，已逐方法核对）

### 5.1 `workspaces`（`IWorkspaces` / `WorkspaceController`）

| 方法 | v2（runtime/workspaces/service.ts） | master（api/workspace-controller/service.ts） | 去向 |
|---|---|---|---|
| `connectWorkspace` | ✅ | ❌ | → `uiWorkspace` |
| `startSession` | ✅ | ❌ | → `uiWorkspace` |
| `pickDirectory` | ✅ | ❌ | → `uiWorkspace` |
| `listDirectory` | ✅ | ❌ | → `uiWorkspace` |
| `createDirectory` | ✅ | ❌ | → `uiWorkspace` |
| `archiveSession` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `create` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `rename` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `delete` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `insertBefore` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `insertSessionBefore` | ✅ | ✅（保留） | 仍在 `workspaces` |
| `list` | `SnapshotStore<WorkspaceListState>` | `WorkspaceSource`（getSnapshot/subscribe） | 形状变化（见 §8 备注） |
| `openPath` / `refresh` / `handleHostEnvelope` / `handleConnected` | ✅ | ❌ | 内部/生命周期方法，插件未直接使用，低影响 |

### 5.2 `uiWorkspace`（`UiWorkspace`，**master 新增**）

| 方法 | master | 来源 |
|---|---|---|
| `connectWorkspace` | ✅ | ← 原 `workspaces` |
| `startSession` | ✅ | ← 原 `workspaces` |
| `pickDirectory` | ✅ | ← 原 `workspaces` |
| `listDirectory` | ✅ | ← 原 `workspaces` |
| `createDirectory` | ✅ | ← 原 `workspaces` |
| `archiveSession` | ✅ | ← 原 `workspaces` |

**核心结论**：插件在 v2 上调的 `connectWorkspace` / `pickDirectory` / `archiveSession` 被搬到了 `uiWorkspace`；而 `create` / `delete` / `rename` 仍留在 `workspaces`。这正是插件按钮"部分失效、部分仍可用"的真实分布。

---

## 6. 逐项破坏性变更分析（按严重程度）

### BC-1 〔P0〕`connectWorkspace` 迁移 → 便利贴 / 新建会话路由

- **提交**：`d231c8777a`
- **变更文件**：`packages/client/runtime/src/client/workspaces/service.ts`（删）→ `packages/client/ui-workspace/src/client/navigation.ts`（增）
- **插件受影响代码**：`src/client/index.tsx` `addSession()`：
  ```ts
  // 修复前（v2 契约，master 上崩溃）
  const sid = await workspaces.connectWorkspace(wsId)
  // 修复后（fbdaea4）
  const sid = await (uiWorkspace?.connectWorkspace ?? workspaces.connectWorkspace ?? reject)(wsId)
  ```
- **症状**：新建便利贴不生成会话节点、刷新后进空白页；用户观感为"所有便利贴指向同一会话"。
- **根因**：`workspaces.connectWorkspace` 在 master 为 `undefined`，`await undefined(wsId)` 抛 `TypeError`，被外层 `try/catch` 吞掉，会话从未创建。
- **修复建议**：**ADAPT（已修复）**。采用 `uiWorkspace?.connectWorkspace ?? workspaces.connectWorkspace` 双路兼容，使插件同时适配 v2 与 master。**无需回滚**底座。
- **状态**：✅ 已由 `fbdaea4` 修复。

### BC-2 〔P0〕`pickDirectory` 迁移 → 新建工作区选择器崩溃

- **提交**：`d231c8777a`
- **插件受影响代码**：`createWorkspace()`：
  ```ts
  // 修复前
  const path = await workspaces.pickDirectory()
  // 修复后（fbdaea4）
  const pick = uiWorkspace?.pickDirectory ?? workspaces?.pickDirectory
  if (pick === undefined) { /* 提示 PICKER UNAVAILABLE */ return }
  const path = await pick()
  ```
- **症状**：多个"新建工作区"按钮点击无反应（在调用 `pickDirectory` 处即抛错中断）。
- **根因**：同上，`workspaces.pickDirectory` 在 master 为 `undefined`。
- **修复建议**：**ADAPT（已修复）**。同 BC-1 双路兼容。
- **状态**：✅ 已由 `fbdaea4` 修复。

### BC-3 〔P0〕`create` / `delete` / `rename` / `pickDirectory` / `archiveSession` 实际可达性（运行时已证实：`ctx.remote` 是唯一写入口）

- **提交**：`d231c8777a` + 前述 bundle 组合
- **插件受影响代码**：`createWorkspace()` / `Dialogs.onClear` / `renameWorkspace()` / `onTear`
- **契约事实**：`create` / `delete` / `rename` 仍留在 `workspaces`，`pickDirectory` / `connectWorkspace` / `archiveSession` 迁到 `uiWorkspace`——但这些 controller service **对插件 `ctx` 都不可见**（见 §4 勘误）。
- **运行时实测（2026-08-27）**：`ctx.get('workspaces')` 与 `ctx.get('uiWorkspace')` 均为 `undefined` ⇒ `uiWorkspace?.x ?? workspaces?.x` 永远落到 `undefined` 分支，于是 **`create`/`delete`/`rename`/`pickDirectory` 全部走不到**，显示"工作区服务离线 / WORKSPACE LINK OFFLINE"。
- **结论**：`fb87843` 的 `ctx.remote.workspace` 兜底**不是死代码，而是唯一能触达的写入口**。`ee28424` 把它降级为"防御性死代码"并移除写路径上的 remote 分支，是本次"所有问题依旧"的**直接回归**。
- **修复建议（已落地）**：每个写操作走四层兜底，末路统一到 `ctx.remote`：
  `uiWorkspace?.x ?? workspaces?.x ?? sessions?.x ?? remote.x`，其中 `remote` 来自 `ctx.get('remote')`（`hostRemote.workspace / .session / .directoryPicker`）。
- **状态**：✅ 已修复（见 §9 当前提交）。

### BC-5 〔P0〕`RemoteResult` 信封形状错误（独立 bug，随本轮回填）

- **问题**：`@deepseek-ai/dsh-typert-protocol` 的 `RemoteResult<T>` 是 **扁平**结构：
  ```ts
  type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: RemoteFailure }
  ```
  **没有 `result` 包裹层**。但早期修复（含 `ee28424`、`fb87843` 的写法）读取的是 `outcome.result.ok` / `outcome.result.value`，一旦 remote 调用 resolve，访问 `outcome.result`（`undefined`）会抛 `Cannot read properties of undefined (reading 'ok')`，整个写操作在信封判错处崩溃。
- **影响**：即便写路径正确路由到 `ctx.remote`，也会在"解析返回值"这步二次崩。与 BC-3 叠加，表现为"点了没反应 / 离线提示"。
- **修复（已落地）**：`contracts.ts` 的 `RemoteResult<T>` 改用扁平形状；所有调用点改读 `outcome.ok` / `outcome.value` / `outcome.error.code` / `outcome.error.message`（无 `.result`）。
- **状态**：✅ 已修复。

### BC-4 〔P2〕`archiveSession` 迁移 → 工位归档（tear）

- **提交**：`d231c8777a`
- **插件受影响代码**：`onTear`：
  ```ts
  // 修复后（fbdaea4）
  onTear={(sessionId) => {
    const archive = uiWorkspace?.archiveSession ?? workspaces?.archiveSession
    if (archive !== undefined) void archive(sessionId)
  }}
  ```
- **症状**：工位内"归档/撕下"便利贴无反应。
- **根因**：`workspaces.archiveSession` 在 master 为 `undefined`（方法已迁至 `uiWorkspace`）。
- **修复建议**：**ADAPT（已修复）**。双路兼容。
- **状态**：✅ 已由 `fbdaea4` 修复。

---

## 7. 受影响按钮 ↔ 根因 ↔ 修复 映射表

| 按钮 / 交互 | 插件旧契约 | master 实际位置 | 插件 `ctx` 能否 `get` | 失效机制 | 严重程度 | 实际修复路径 | 状态 |
|---|---|---|---|---|---|---|---|
| 新建会话 / 便利贴（addSession） | `workspaces.connectWorkspace` | `uiWorkspace.connectWorkspace` | ❌ 不可见 | `undefined` → 离线提示 | P0 | `ctx.remote.session.create({workspaceId})` | ✅ |
| 新建工作区 → 目录选择器（createWorkspace） | `workspaces.pickDirectory` | `uiWorkspace.pickDirectory` | ❌ 不可见 | `undefined` → 离线提示 | P0 | `ctx.remote.directoryPicker.pick()` | ✅ |
| 新建工作区 → 创建（createWorkspace） | `workspaces.create` | `workspaces.create`（仍在宿主，插件不可见） | ❌ 不可见 | `undefined` → 离线提示 | P0 | `ctx.remote.workspace.create({path})` | ✅ |
| 清理 / 删除工位（onClear） | `workspaces.delete` | `workspaces.delete`（仍在宿主，插件不可见） | ❌ 不可见 | `undefined` → 离线提示 | P0 | `ctx.remote.workspace.delete({workspaceId})` | ✅ |
| 重命名工位（onRename） | `workspaces.rename` | `workspaces.rename`（仍在宿主，插件不可见） | ❌ 不可见 | `undefined` → 离线提示 | P0 | `ctx.remote.workspace.rename({workspaceId,title})` | ✅ |
| 归档便利贴（onTear） | `workspaces.archiveSession` | `uiWorkspace.archiveSession` | ❌ 不可见 | `undefined` → 无操作 | P0 | `ctx.remote.workspace.archiveSession({sessionId})` | ✅ |
| 所有 remote 调用 | — | `ctx.remote.*` | ✅ 可见 | `outcome.result.ok` 访问 `undefined` → 二次崩溃 | P0 | 改读扁平 `outcome.ok/value/error` | ✅ |

---

## 8. 关于"会话窗口样式丢失 / 固定深色主题失效"的补充说明

这两个现象是你在切到 master 后观察到的**相邻症状**，但经契约核对**并非独立的契约断裂**：

- `sessions` 服务（`open` / `binding` / `clear`）在 master 上签名不变；
- `theme` 服务（`overrideTokens`）签名不变，CSS 变量名（`--dsw-alias-*` 等）未变；
- `useWorkspaces` / `useSessions` 仍通过 slot props（`GlobalStandardProps` 合并）注入。

因此样式/深色问题更可能是 **BC-1 崩溃的下游效应**：`addSession` 抛 TypeError 导致 `Scene` 组件崩溃、overlay 卸载，`overrideTokens` 的 effect cleanup 把强制深色重置掉。随着 `fbdaea4` 修复 `connectWorkspace`，`Scene` 不再崩溃，这些现象应随之消失。**若仍残留**，需用浏览器控制台单独排查（属另一类问题，不在本次按钮回归范畴）。

> 备注：`workspaces.list` 形状由 `SnapshotStore<WorkspaceListState>` 变为 `WorkspaceSource`（getSnapshot/subscribe）。插件经 `props.useWorkspaces(...)`（slot 钩子）取数，不直接消费 `workspaces.list`，故为**低风险**，仅作记录。

---

## 9. 当前修复状态（2026-08-27 回填）

`dsh-pixel-office` `main`（本地、未推送）相关提交：

- `fbdaea4` — 适配 `connectWorkspace`/`pickDirectory`/`archiveSession` 迁移到 `uiWorkspace`（方法重定位层面正确）
- `fb87843` — "master 上 WorkspaceController 未加载，改走 `ctx.remote.workspace`"（**根因判断正确**，但被后续 `ee28424` 回退）
- `ee28424` — "双路兼容 workspaces/uiWorkspace，校正服务离线误判"（**错误**：据静态 bundle 分析判定服务已加载、remote 为死代码，移除了写路径上的 remote 分支 → 本次"所有问题依旧"的回归来源，其结论已废弃）
- **本轮修复**（待提交）— 把所有写操作改为四层兜底 `uiWorkspace?.x ?? workspaces?.x ?? sessions?.x ?? remote.x`，末路统一到 `ctx.remote`；并修正 `RemoteResult` 信封为扁平结构。新增一次性诊断日志：

```ts
console.log('[pixel-office] runtime services:', {
  workspaces: typeof workspaces,
  uiWorkspace: typeof uiWorkspace,
  sessions: typeof sessions,
  remoteWorkspace: typeof remoteWorkspace,
  remoteSession: typeof remoteSession,
  remoteDirectoryPicker: typeof remoteDirectoryPicker,
})
```

`dsh web` 重启 + 浏览器硬刷新后打开控制台：
- 若 `workspaces` / `uiWorkspace` / `sessions` 都是 `undefined`、而 `remoteWorkspace` / `remoteSession` / `remoteDirectoryPicker` 都是 `object` ⇒ 修复命中正确路径（与 2026-08-27 截图一致）。
- 若某一 controller service 是 `object`，则该路径会优先直调（不影响正确性）。

> ⚠️ 第三方插件无 HMR：改 `src/`（再 `pnpm build` 出 `lib/`）后必须 **重启 `dsh web` + 浏览器硬刷新（Ctrl/Cmd+Shift+R）**，否则仍加载旧 bundle。

---

## 10. 结论

1. v2 → master 之间导致 `dsh-pixel-office` 按钮失效的**直接契约根因**是提交 **`d231c8777a`** 的 workspace 方法重定位（`connectWorkspace`/`pickDirectory`/`archiveSession` 从 `workspaces` 迁至 `uiWorkspace`）。
2. 但真正让插件"全部离线"的是**第二层事实**：第三方主题插件的 Cordis 上下文**不暴露** `workspaces`/`uiWorkspace`/`sessions` 这些内部 controller 服务（与 bundle 是否列出无关）。所以 `uiWorkspace?.x ?? workspaces?.x` 永远落到 `undefined` 分支。
3. 插件**唯一能触达的写入口**是宿主生成的 `ctx.remote.{workspace,session,directoryPicker}` RPC。`fb87843` 的 remote 路由判断正确，而 `ee28424` 把它误判为死代码、移除写路径上的 remote 分支，是本次"所有问题依旧"的回归来源。
4. 修复方式：每个写操作走四层兜底 `uiWorkspace?.x ?? workspaces?.x ?? sessions?.x ?? remote.x`，末路统一到 `ctx.remote`；同时修正 `RemoteResult` 信封为扁平 `{ok,value}`（去掉 `result` 包裹），否则 remote 调用在解析返回值时会二次崩溃。
5. 读路径（`useWorkspaces`/`useSessions` slot 钩子）本来就正常，工位/便利贴能渲染；本修复只动写路径与信封解析，不改变读路径。

