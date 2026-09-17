# Pixel Office

[English version](./README.en.md)

一款给 [DeepSeek Harness](https://github.com/Doozqoo/deepseek-harness) Web GUI 的 **digital + pixel-art** 工作区主题插件。

它把会话列表换成一间俯视的像素办公室：6×4（24 工位）"田"字形工位网格，每个工位对应一个工作区。空工位只有一把座椅；已建立的工作区在桌上摆一台电脑；工作区有会话在跑时显示器点亮并跳动。点进工位是桌面正视图——左边一块计划板贴着代表会话的便利贴，右边一台 CRT 显示器，**里面是真正的对话界面**：聊天、发送、工具调用全部照常工作。

整套主题使用 CRT 扫描线、马赛克瓦片消除、CRT 开机转场、像素猫眨眼、便利贴悬停抬起等动效；侧栏被裁切掉、控制台顶部 HUD 横贯、霓虹色板覆盖整套界面。

## ⚠️ 版本兼容性（安装前请先看）

**本插件只支持 DeepSeek Harness 的最新版本**（≥ `0.1.2-alpha.1`，客户端 runtime 已拆分为 `api/*` + `ui/*`）。更早的基座版本一律不支持，也不再做向下兼容。

当前代码已对齐并实测于 **`0.1.6-alpha.2`**（`dsh-v0.1.6-alpha.2`，2026-09-18）。

原因不是偷懒：不同基座的 `dsh.client.inject` 依赖清单互不兼容（当前基座已删除 `@deepseek-ai/dsh-client-runtime`，旧基座则缺少 `session-controller` / `workspace-controller` 等包），一份 manifest 无法通吃。**解决办法只有一个：把 DeepSeek Harness 升到最新版。还有啥不对的，能动手就别吵吵**

**升级基座后务必重新挂载**（`dsh.client.inject` 在插件加入 profile 时解析一次，重启 `dsh web` **不会**重读）：

```powershell
dsh plugin --profile web remove dsh-client-pixel-office
dsh plugin --profile web add <本仓库绝对路径>
```

## 对齐基座演进（0.1.2-alpha.1 → 0.1.6-alpha.2）

基座在这段区间里动了两处会**直接打断插件**的地方，另外长出四类新能力。下表是逐条核对后的处理结果（每行都有基座源码依据，不是推测）。

### 破坏性变更（已修）

| 基座变更 | 依据 | 插件处理 |
|---|---|---|
| `ISessions` 删除了 `open(id)` / `openSubagent(address)` / `clear()`；会话切换改为视图所有者的职责 | `packages/api/session-controller/src/client/contract/sessions.ts` | 新增导航链：`uiWorkspace.openSession(target)` → 旧 `sessions.open` 兜底。原代码在 0.1.6 上 `s?.open` 恒为 `undefined`，可选链把它变成**静默 no-op** —— 点便利贴完全没反应。同时 `openSession` 现在也接 `SubagentAddress`，子代理链路可直接打开 |
| `details` 槽被删除，右侧栏换成可停靠的 `rightbar` | `packages/client/ui-layout/src/client/index.ts`（`rightbar`）、`ui-sidebar-right/src/client/contract/slots.ts` | `SELECTORS.DETAILS` 那条 `display:none` 规则永不匹配，是死代码 —— 已替换为右侧栏整套处理（见下） |
| 基座版本号串带 commit 与 dirty 尾巴（`0.1.6-alpha.2-cd5ef81-dirty`），与里程碑裸版本号直接 `localeCompare` 会把**每个真实基座都判成"高于已知最新版"** | `compat.ts` 前后对比 | 预发布标识先切掉首个 `-` 之后的构建元数据，再按段数值比较（`alpha.10` > `alpha.9`） |
| 客户端 summary 长出新字段：`updatedAt` / `blank` / `origin`，列表状态新增 `subagentsByParent` / `jobsBySession` | `packages/api/session-controller/src/client/sessions/service.ts` | 分别接到活跃度排序、便利贴预览、空会话角标、子链路与作业计数 |

### 新增能力（已接入像素语言）

| 基座新能力 | 依据 | 插件呈现 |
|---|---|---|
| `uiWorkspace.unarchiveSession` / `workspaces.unarchiveSession` | `ui-workspace/src/client/navigation.ts:203`、`api/workspace-controller/src/client/service.ts` | **归档抽屉**。插件的文案一直在承诺"撕下后再拖回 = 重新贴上"，但基座此前没有恢复动词，那个入口只是关掉弹窗。现在撕下的便利贴落进计划板上的抽屉，可原格恢复 |
| `uiWorkspace.forkSession` / `sessions.fork` | 同上：`navigation.ts:172` | 便利贴预览新增 `⑂ 分叉`：以已完成回合为界复制一条新链路，并自动接入显示器 |
| `subagentsByParent`（durable 父子目录）+ `uiWorkspace.openSession(SubagentAddress)` | `subagent/subagent/src/control-types.ts`（`SubagentCatalog` / `SubagentAddress`） | 工位卡与便利贴显示 `⇄N` 子链路角标，预览卡显示 `⇄ N 条子链路` |
| `jobsBySession` 后台作业投影 | `sessions/service.ts:67` | 预览卡显示 `⚙ N 个后台作业`（为 0 时不出现在卡面上） |
| `SessionSummary.updatedAt` | `sessions/service.ts:47` | 「排序 · 活跃度」与预览卡的"最近活动"改用基座时间戳。原来只按插件自己写的 stamp 排，而那个 stamp 不持久化、刷新即空 —— 等于"活跃度"实际含义是"这次刷新后你点过谁" |
| `uiWorkspace.listDirectory` / `createDirectory`、`--dsw-alias-link` / `--dsw-alias-bg-document-preview` / `--dsw-corner-shape` 等新令牌 | `ui-theme/src/styles/*.css` | 新令牌补进两套色板；`--dsw-corner-shape` 显式设为 `square`（基座用全局选择器套 superellipse，而办公室没有任何曲线几何） |

### 右侧栏（新 chrome 面，此前完全没皮肤化）

基座的右侧栏是**可停靠 + 可拆分 + 可浮动**的一整套，标签页里跑计划 / 交付物 / 终端 / 文件 / 文档预览。插件的处理分两种：

- **停靠态**（`.panel`，`z-index:10`）本来就被 office 背景盖住（overlay 层是 20）——但那是 z-index 的巧合而非设计，现在**显式隐藏右列**，让 CRT 独占右半屏，桌面上不会滑进来一块宿主面板。
- **全屏态**（`z-index:40`）与**浮动面板**（`[data-sidebar-right-float-host]`，`z-index:60`）都落在 overlay **之上**，不做处理就会以原生外观飘在像素界面上。现在整套 dockkit（pane / strip / tab chip / divider / tab 菜单）都按像素面板重绘：直角、等宽字体、硬阴影、霓虹描边。

## 视觉

### 俯视图：24 工位网格

![俯视图](assets/top-view.jpeg)

每张卡显示工位编号、IDLE/LIVE 状态、便利贴计数、运行时指示灯与一个重命名 / 清空按钮。空位点击新建工作区。

### 桌面正视图：计划板 + CRT 显示器

![桌面正视图](assets/desk-view.jpeg)

进入工位看到一张完整办公桌：左侧"任务矩阵 / MISSION MATRIX"计划板（每张便利贴 = 一个会话，显示标题、YOU/AI/SYS 角标和真实末条消息），右侧 CRT 显示器（待机黑屏，点便利贴才接入）。底部"新便利贴堆 / NEW STICKIES"等待被拖到计划板空位。

### 设置：宿主面板里的 Pixel Office 分区

![设置](assets/settings.jpeg)

插件在宿主原生设置面板中注册了一个独立分区，提供总开关、动效强度（CALM / OVERDRIVE）、网格开关三项偏好。

## 特性

| 区域 | 行为 |
|---|---|
| **侧栏** | 裁切隐藏，不是 `display:none`（避免牵连 React 子树被删除） |
| **俯视图工位** | 6×4 田字网格；拖拽可搬迁设备、交换位置；空位点击新建工作区；重命名 + 清空（常驻「未分组」工位固定第 1 格，不可拖拽） |
| **桌面计划板** | `ResizeObserver` 自适应行列数；便利贴按 156×168 排版，格子按 `1fr` 精确铺满，始终保留一个空位 |
| **便利贴** | 一张 = 一个会话；点击在 CRT 打开；拖拽交换位置；拖出计划板撕下（归档）；显示末条消息 + YOU/AI/SYS 角标 |
| **CRT 显示器** | 进入工位默认黑屏待机，点便利贴才接入当前会话；当前打开的便利贴带青色高亮 |
| **新会话** | 桌面左下一叠便利贴，拖到计划板空位，弹框填写展示文字 |
| **设置分区** | 注册进 `settings.section`；总开关 / 动效强度 / 网格开关三项 |
| **持久化** | 工位布局、便利贴摆放、自定义文字存进 `localStorage`，刷新后保留 |
| **外观适配** | 插件表面强制深色（DARK_TOKENS），不随宿主外观切换；插件范围外的宿主界面不受影响 |
| **背景** | 五层视差：漂移极光、透视地板与天顶网格、三层像素浮尘、暗角与地平线泛光 |
| **动画** | 便利贴不同步摆动与悬停抬起、指示灯呼吸、CRT 扫描线、CRT 开机转场、工位级联延迟入场 |
| **马赛克消除** | 开便利贴时，conversation slot 上盖主题色马赛克遮罩，每个小方块随机逐个 pop 消失，露出下面的真实对话 |
| **像素猫** | 仅在工位有会话运行时出现于显示器里；静止偶尔眨眼；待机时不显示 |
| **动效档位** | `CALM`（仅保留配色，停止环境动效）/ `OVERDRIVE`（全动效）；尊重宿主 `prefers-reduced-motion` |
| **工位排序** | 顶视图工具栏「排序」分段控件：**手动**（默认，布局完全交给拖拽）/ **活跃度**（按各工位最近会话活动时间重排，一次性应用，之后仍可继续拖拽微调）。「未分组」始终钉在第 1 格。排序键取基座 `SessionSummary.updatedAt`，插件自己的点击 stamp 只作同分时的次键 |
| **归档抽屉** | 计划板板头的「归档 N」按钮下拉一层抽屉（与便利贴网格互斥占用同一栏位，板头始终可见可点）。列出该工位被撕下的便利贴，每张一张纸 + 一个「恢复」按钮；恢复走 `uiWorkspace.unarchiveSession`，基座把会话放回它记录的工作区位置，插件不做猜测。工作区已被删除的归档会话落到「未分组」工位名下，否则它们将永远无法恢复 |
| **分叉链路** | 便利贴预览的 `⑂ 分叉` 按钮（基座支持分叉时才出现）把会话以已完成回合为界复制一条新链路，并自动接入显示器 |
| **子链路 / 作业角标** | 工位卡与便利贴显示 `⇄N` 子代理链路数；便利贴预览额外显示 `⇄ N 条子链路` 与 `⚙ N 个后台作业`；空会话带 `空会话 · BLANK` 角标。全部为 0 时不渲染，普通会话卡面保持干净 |
| **右侧栏 / 浮动面板** | 停靠态在进入工位时随右列一起隐藏（CRT 独占右半屏）；全屏态与 dockkit 浮动面板按像素面板重绘（直角、等宽、硬阴影、霓虹描边），tab 条、tab 芯片、分隔条、tab 操作菜单一并覆盖 |
| **事件响应** | 订阅 `connection/reset`（断线提示）、`theme/change`（外观信号） |
| **版本标识** | 顶视图底部状态条右端与设置页 hero 显示 `POWERED BY DSH <基座版本号>`（如 `0.1.6-alpha.2-ddefc45`）。显示的是**宿主基座**的版本，不是本插件的——基座只在侧边栏品牌区把这串文本渲染出来（由 `process.env.DSH_CLIENT_VERSION/COMMIT_HASH/GIT_DIRTY` 构建期内联），没有 cordis 服务、没有 `window` 全局、也没有 meta 标签，因此插件从 `[data-slot="sidebar"]` 里读。读不到时只显示 `POWERED BY DSH`，绝不猜一个版本号 |
| **依赖的服务** | 通过 `export const inject` 声明 `slots` / `theme` / `workspaces` / `uiWorkspace` / `sessions` 五个服务——基座的插件守卫**只把声明过的服务交给插件**，未声明的一律解析为 `undefined` |
| **能力降级** | 探测结果里只有"硬能力"（`slots`、会话导航、`sessions.binding`）会阻止挂载；缺 `unarchiveSession` 之类的**软能力**只让对应按钮进入 disabled 并在 toast 里说明，绝不因为一个动词缺失就把整间办公室换成白屏 |

## 工程架构

为应对基座 DeepSeek Harness 的持续更新（含破坏性变更），插件在 v2 中引入三层隔离：

### 服务适配层 (`adapters/`)

所有对基座服务（`slots`、`theme`、`workspaces`、`uiWorkspace`、`sessions`）的调用全部封装在适配器中。插件其余部分（`index.tsx`、`views.tsx`）不直接接触基座 API，而是通过适配器接口操作。

**基座 API 变更时，只需修改对应适配器，插件主体无需改动。**

| 适配器 | 封装的服务 | 核心职责 |
|---|---|---|
| `workspace.ts` | `workspaces` + `uiWorkspace` | 工作区创建、删除、重命名、目录选择、会话归档**与恢复** |
| `session.ts` | `sessions` + `uiWorkspace.openSession` | 会话打开（含旧的 `sessions.open` 兜底与子代理地址）、创建、分叉、消息面读取 |
| `theme.ts` | `theme` | 主题 token 覆盖 |
| `slots.ts` | `slots` | 插槽注册与注入 |
| `events.ts` | `ctx.on` / `ctx.effect` | 事件订阅（`connection/reset`、`theme/change`） |
| `dom.ts` | — | 基座 DOM 选择器集中管理（`data-slot` / `data-dockkit-*` 属性变更时只改此处） |

> **导航为什么落在 session 适配器里**：`0.1.6-alpha.1` 把 `sessions.open` 从 `ISessions` 删掉了，会话切换改由视图所有者（`uiWorkspace`）负责。适配器把 `uiWorkspace.openSession` 与旧 `sessions.open` 串成一条链，一处改动同时喂两个基座世代 —— 调用方拿到的仍是"打开这个会话"这一个语义。

### 能力探测 (`probeAdapters`)

插件启动时对所有适配器执行能力探测。**硬依赖**（`slots`、会话导航、`sessions.binding`）失败才阻止挂载；**软依赖**（`unarchiveSession`、`forkSession`、`theme` 覆盖）缺失只报告警告并让对应入口进入 disabled，插件继续运行。

> 这条区分是刻意的：早期版本把"任何一项探测失败"都算不可用，于是一个基座少一个动词就会让整间办公室退化成白屏，代价与收益完全不匹配。

### 版本兼容矩阵 (`compat.ts`)

从侧边栏品牌区读取基座版本号，解析并与已知兼容范围比较。不兼容的基座版本会打印明确错误，兼容但有已知差异的版本会打印警告。

### 代码规范化

- **`constants.ts`** — 所有魔法数字、布局尺寸、时间延迟集中管理
- **`strings.ts`** — 所有用户可见文案集中管理（中英双语），便于未来 i18n
- 类型定义集中在各模块顶部，避免散落

## 安装

Pixel Office 是标准的 DSH Profile Bundle。安装的本质是把一个声明了 `dsh.bundle.patch` 的包加为某个 dsh profile 的依赖，dsh 会把它激活进 `dsh.profile.bundles` 层序。命令背地里就是 `pnpm add`，跑在当前 profile 目录里。

**前置条件**

- Node.js 22+（`engines` 锁定）
- pnpm 10+（`packageManager` 锁定，建议 corepack）
- **最新版** DeepSeek Harness（≥ `0.1.2-alpha.1`）；更早版本不支持，见上方「版本兼容性」

**profile 目录**：默认 `$DSH_HOME/profiles/web`，未设 `DSH_HOME` 时即 `~/.dsh/profiles/web`。

装、升、卸之后都需**重启当前 `dsh web` 进程并刷新浏览器页面**——当前 Web Profile 不承诺对持久化 Bundle layer 热重载。

### 从 GitHub 仓库安装

```powershell
npx @deepseek-ai/dsh plugin --profile web add github:Doozqoo/dsh-pixel-office
```

系统已装 `@deepseek-ai/dsh` 可简写 `dsh plugin ...`；在 Harness 源码仓库里可 `pnpm dsh plugin ...`。

Git 依赖会在安装时运行该包的 `prepare`（即 `pnpm run build`）就地构建 `lib/`。pnpm ≥10 默认拦截依赖的生命周期脚本：把 pnpm 打印的那条精确 key 加进该 profile 的 `pnpm-workspace.yaml` 的 `allowBuilds`，再重跑安装命令（pnpm 11 配置键是 `allowBuilds`，旧文档写过的 `onlyBuiltDependencies` 已弃用）。

> `github:Doozqoo/...` 解析的是**仓库名**；装进 profile 后，update/remove 用的是**包名** `dsh-client-pixel-office`。

### 本地开发调试（Harness 源码 + 本地 checkout）

如果你同时拿着 DeepSeek Harness 源码仓库和这份插件的本地 checkout，用 path 依赖把它链进 profile：

```powershell
# 1) 构建插件——注册表认 lib/client.js，不是 src/
cd D:\...\dsh-pixel-office
pnpm install
pnpm build

# 2) 从 Harness 源码根目录，把 checkout 加进 web profile（给绝对路径）
cd D:\...\deepseek-harness
pnpm dsh plugin --profile web add "D:\...\dsh-pixel-office"
```

path 依赖是链接到 checkout（不是拷贝）：改完源码重新 `pnpm build` 就地刷新 `lib/`，然后重启 `dsh web` 并硬刷新页面即可。

> **Windows：路径别带空格。** `dsh plugin` 在 Windows 上经 shell 转给 pnpm，含空格的路径会被截断，导致装上 `Program` / `dsh-pixel-office` 这类残缺依赖，之后 `remove <真包名>` 会报"no such dependency"。遇到含空格路径时建一个 junction 再 add：
> ```powershell
> New-Item -ItemType Junction -Path "C:\Users\you\dsh-pixel-office" `
>   -Target "D:\...\dsh-pixel-office" -Force
> node --import tsx/esm apps\cli\src\bin.ts plugin --profile web add `
>   "C:\Users\you\dsh-pixel-office"
> ```

确认装没装进层序，可看 profile 的 `package.json` 依赖与 `dsh.profile.bundles` 列表，或运行 `pnpm dsh --profile web --dump-config` 查看合成入口树里是否出现 `pixel-office`。

### DeepSeek Harness 工位协同注意事项

`deepseek-harness` 是**官方仓库**。你在本地该工位上所做的任何修改（例如工作区删除时的会话级联归档、布局 reconcile 逻辑等）**只活在本地 checkout**，既不会同步给其他协作者，也不会进入上游。

这意味着，基于本地改动开发 Pixel Office 时**不可避免地会遇到兼容性问题**：

- 其他协作者的 harness 仍是上游原版，没有你本地的级联归档 / 布局 reconcile 等修复，表现可能与你本地对不上；
- 插件所依赖的宿主行为（接口、slot、事件）以**运行中 harness 为准**，`contracts.ts` 只是结构性镜像，上游一旦变动就需要手动对齐；
- 本地对 harness 的修复若没回馈上游，长期会随上游演进产生分叉，merge 成本只会越积越高。

**遇到相关问题时请遵守以下约定：**

1. **优先提回上游。** 把 harness 侧的修复走 PR / 提交回馈，而不是只在本地下游永久保留分叉。
2. **明确「本地独有补丁」与「上游公共行为」。** 与协作者保持同步沟通，避免把上游行为误判成插件 Bug，或反过来把本地补丁当成通用能力。
3. **先确认对方 harness 是否含你的本地改动**再归责。排查兼容性问题时，先对齐双方 harness 状态，再决定是否归结为 Pixel Office 的问题。

## 升级

```powershell
npx @deepseek-ai/dsh plugin --profile web update dsh-client-pixel-office
```

GitHub 安装可重跑 `add` 命令，pnpm 会更新锁定的 Git revision。本地 path 开发模式没有"升级"概念——改源码 + `pnpm build` 就是新版本。

## 卸载

```powershell
npx @deepseek-ai/dsh plugin --profile web remove dsh-client-pixel-office
```

`remove` 会删除该 profile 依赖并把插件移出层序。重启 `dsh web` 后 Cordis 撤销样式表、主题覆盖、slot 注册，原生界面完整恢复。`localStorage` 中的布局偏好默认保留，便于以后重装续用；需要清除数据时通过浏览器站点数据管理删除。

## 配置（设置面板）

插件在宿主**原生设置面板**中注册 `settings.section`（label "Pixel Office"）。点右上角 SETTINGS → "Pixel Office" 进入：

| 选项 | 范围 | 说明 |
|---|---|---|
| **启用像素办公 / ENABLE SKIN** | `ON` / `OFF` | 总开关。关掉后所有样式、token 覆盖、场景 overlay 三样一起撤，回到原生界面；面板本身仍可访问以再次启用 |
| **动效强度 / INTENSITY** | `CALM · 静默` / `OVERDRIVE · 过载` | CALM 保留配色，仅停止环境动效；OVERDRIVE 启用全部动效 |
| **网格地平线 / GRID FLOOR** | `SHOWN` / `HIDDEN` | 切换俯视网格与透视地板 |

便利贴数量不再需要手调：计划板会自动铺满可用空间，1280×800 大约放 11 张，1920×1080 约 30 张，2560×1440 约 56 张；窗口变化时自动重排。

## 持久化

| 字段 | 存储位置 | 内容 | 跨浏览器 |
|---|---|---|---|
| 工位布局 | `localStorage` | 6×4 工位的渲染顺序 | 否 |
| 便利贴摆放 | `localStorage` | 每个工作区内便利贴格子的会话顺序 | 否 |
| 自定义文字 | `localStorage` | 便利贴上的展示文字 | 否 |
| 动效偏好 | `localStorage` | `intensity` / `grid` | 否 |
| `opened` | 不持久化 | 当前打开的便利贴 | —— |
| `archiveOpen` | 不持久化 | 归档抽屉是否拉开（离开工位自动收起） | —— |
| `activity` | 不持久化 | 本页点击过的会话时间戳（仅作活跃度排序的次键） | —— |

`opened`（"这次进工位点开了哪张"）刻意**不**持久化，刷新后自动从黑屏待机开始。归档抽屉同理：它是对**基座**归档集合的一扇窗，而基座那份集合完全在插件之外 —— 记住"上次拉开过"只会在用户还没看板子的时候先弹出一个面板。持久化写入已做引用比较：拖拽 50 次最多写 0 次 storage。隐私模式下 storage 抛错会静默降级为仅内存。

## 目录结构

```
src/index.ts               node 半边（占位 apply；Loader 需要一个可导入行）
src/client/index.tsx       浏览器入口：服务读取、slot 注册、生命周期
src/client/views.tsx       俯视图、桌面正视图、弹窗、设置面板
src/client/styles.ts       样式表文本 + 注入 effect
src/client/tokens.ts       亮 / 暗两套调色板
src/client/placement.ts    摆放与呈现逻辑（无 React、无 DOM）
src/client/store.ts        场景状态与指针拖拽
src/client/persist.ts      摆放持久化（localStorage 读写与校验）
src/client/contracts.ts    所需 DSH 表面的结构化类型
src/client/version.ts      从侧边栏品牌区读取宿主基座版本号
src/client/constants.ts    集中常量：布局尺寸、颜色、时间延迟
src/client/strings.ts      集中 UI 文案（中英双语，便于未来 i18n）
src/client/compat.ts       版本兼容矩阵：解析基座版本、评估兼容性
src/client/adapters/       服务适配层：隔离所有基座 API 调用
  ├── index.ts             适配器入口：创建、导出、能力探测
  ├── types.ts             适配器依赖与探测结果类型
  ├── workspace.ts         封装 workspaces + uiWorkspace 服务
  ├── session.ts           封装 sessions 服务
  ├── theme.ts             封装 theme 服务（token 覆盖）
  ├── slots.ts             封装 slots 服务（插槽注册与注入）
  ├── events.ts            封装事件订阅（统一事件名称）
  └── dom.ts               封装 DOM 查询（统一选择器）
assets/                    README 截图（top-view / desk-view / settings）
tsdown.config.ts           产物构建配置
```

`placement.ts` 故意不含 React 与 DOM，是唯一能脱离浏览器直接测的部分。`contracts.ts` 在本地声明所需类型而不是从 `@deepseek-ai/*` 导入——独立仓库要在没有那些包的环境里也能 install 和 typecheck。这些是结构性镜像而非上游 API 分叉，若与运行中 harness 不一致，以 harness 为准。

## 开发

```powershell
pnpm install              # 安装依赖
pnpm build                # 类型检查 + tsdown 打包（产物 lib/）
pnpm typecheck            # tsc -b --force
```

构建产物（`lib/client.js`、`lib/index.js`、`.d.ts`、sourcemap）由 tsdown 一次性产出。Plug-and-play：dev server 读 `lib/client.js`，不在 `src/` 上跑。

改完 `src/` 必须 `pnpm build` 并**重启 `dsh web` + 浏览器硬刷新**——第三方插件没有 HMR，否则仍在跑旧 bundle。

### 给二次开发者的两条硬约束

1. **服务必须先声明才能拿到。** 基座的 `cordis-client-runner` 守卫只把插件 fiber 在 `export const inject` 中声明过的服务交给插件；未声明的服务 `ctx.get` 一律返回 `undefined`。加新能力时先把服务名加进 `inject`。
   > 排查技巧：临时加一条 `console.log(typeof ctx.get('<服务名>'))`，按「哪个是 `undefined` 就补声明哪个」逐轮二分。**不要只靠读 `cordis.patch.yml` 判断**——bundle 里列了某个 controller 服务，不等于插件 `ctx` 能 `get` 到。
2. **`ctx.remote` 用不了。** Host Remote 属于 `@deepseek-ai/dsh-api-gateway`，而 `api-gateway` 与 `typert` 都不在 web 编排里；守卫还会直接拦截，代码里出现 `ctx.get('remote')` 就会报
   `cannot get property "remote.workspace" without inject`。
   所有写操作请走 `workspaces` / `uiWorkspace` / `sessions` 三个直接服务。

## 发布

```powershell
npm login                    # 首次：登录 npm（有 2FA 备好 TOTP）
pnpm publish --dry-run       # 先看打进包里哪些文件（确认 lib/ 与 cordis.patch.yml 都在）
pnpm publish                 # 正式发布（会自动跑 prepare 构建 lib/）
```

npm 同名包不能覆盖已发布版本，每次发布先 `npm version patch|minor|major` 升版本再 `pnpm publish`。包名 `dsh-client-pixel-office` 为非 scoped 包，默认 public，无需 `--access public`。

## 已知限制

- **持久化只在本浏览器生效。** 换浏览器或清缓存会回到默认推导。
- **俯视图固定 24 工位，第 1 格（左上角）常驻为「未分组」工位**，展示未被任何工作区收纳的会话（与官方 UI 的「未分组」分组一致）。其余 23 格用于真实工作区，超出的工作区仍存在、仍可从原生界面访问，只是没有工位可放。「未分组」工位可点击进入，其下会话可继续对话或拖出归档；但工位本身为只读：不可重命名 / 清空 / 删除，也不能在其下新建会话——官方不提供「无所属工作区」的建会能力，插件保持与官方一致，不自行扩展该功能。它的归档抽屉仍然可用（用于恢复工作区已被删除的归档会话）。
- **归档抽屉的归属靠 `workspace.sessionIds` 反推。** 基座的归档集合是 registry 级的扁平列表，不携带"属于哪个工作区"；插件用「该工作区记着这个 id」来归类，反推不到的（例如工作区本身已被删除）统一落到「未分组」。若某个基座版本的 `sessionIds` 不含已归档会话，表现会是所有归档都堆在「未分组」工位——功能仍然可用，只是分类变粗。
- **恢复后的落点由基座决定，不由插件决定。** `unarchiveSession` 把会话放回它记录的工作区位置；便利贴具体落到哪一格由 reconcile + `fitInto` 取最低空格，所以恢复不等于"回到撕下前那一格"。格子满了会顺延到下一个空格。
- **抽屉一次最多渲染 96 张便利贴**（`ARCHIVE_LIMIT`）。归档是基座级的无上界集合，不设上限就是给"历史上所有归档过的会话"各挂一个 DOM 节点；超出时抽屉底部会写明"仅显示最近 N / M 张"。
- **宿主处于亮色模式时，会话内部（host 渲染的 conversation）仍按宿主主题显示**，可能与插件强制深色的 CRT 边框不一致；代码块、表格、输入框有兜底规则，未必覆盖全。
- **右侧栏的停靠态在进入工位时被隐藏**（CRT 独占右半屏，与侧栏同一处理思路），全屏态与浮动面板保留并按像素面板重绘。若你习惯把右侧栏常驻开着用，进工位时它会让位给显示器。
- **模型 / Agent 预设分区只做了外观皮肤**（直角 + 等宽字体），内部控件未逐项验证。
- **暂无自动化测试。** `placement.ts` 抽象出来便于测试，但测试还没写，欢迎 PR。

## License

MIT — 见 [LICENSE](./LICENSE)。
