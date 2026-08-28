# Pixel Office

一款给 [DeepSeek Harness](https://github.com/Doozqoo/deepseek-harness) Web GUI 的 **digital + pixel-art** 工作区主题插件。

它把会话列表换成一间俯视的像素办公室：6×4（24 工位）"田"字形工位网格，每个工位对应一个工作区。空工位只有一把座椅；已建立的工作区在桌上摆一台电脑；工作区有会话在跑时显示器点亮并跳动。点进工位是桌面正视图——左边一块计划板贴着代表会话的便利贴，右边一台 CRT 显示器，**里面是真正的对话界面**：聊天、发送、工具调用全部照常工作。

整套主题使用 CRT 扫描线、马赛克瓦片消除、CRT 开机转场、像素猫眨眼、便利贴悬停抬起等动效；侧栏被裁切掉、控制台顶部 HUD 横贯、霓虹色板覆盖整套界面。

## ⚠️ 版本兼容性（安装前请先看）

| DeepSeek Harness | 支持情况 |
|---|---|
| **≥ 0.1.2-alpha.1**（`master` 分支，客户端 runtime 已拆分为 `api/*` + `ui/*`） | ✅ 支持 |
| **0.1.1-rc.2**（`v2` 分支，仍是单体 `packages/client/runtime`） | ❌ 不支持 |

**为什么不能一份清单通吃两个基座**：两个版本的 `dsh.client.inject` 依赖互不兼容——

- v2 的 `packages/api/` 下只有 `gateway` 与 `remotes`，**没有** `session-controller` / `workspace-controller`；
- master 已**删除** `@deepseek-ai/dsh-client-runtime`（v2 清单里还引着它）。

因此 manifest 必须按基座分别维护。本仓库当前**只维护 master 版本**。若你仍在使用 v2，请停在本仓库的旧提交，或自行把 `package.json` 的 `dsh.client.inject` 改回 v2 包集。

**切换基座后务必重新挂载**（`dsh.client.inject` 在插件加入 profile 时解析一次，重启 `dsh web` **不会**重读）：

```powershell
dsh plugin --profile web remove dsh-client-pixel-office
dsh plugin --profile web add <本仓库绝对路径>
```

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
| **工位排序** | 顶视图工具栏「排序」分段控件：**手动**（默认，布局完全交给拖拽）/ **活跃度**（按各工位最近会话活动时间重排，一次性应用，之后仍可继续拖拽微调）。「未分组」始终钉在第 1 格 |
| **事件响应** | 订阅 `connection/reset`（断线提示）、`theme/change`（外观信号） |
| **版本标识** | 顶视图底部状态条右端与设置页 hero 显示 `POWERED BY DSH <基座版本号>`（如 `0.1.2-alpha.1-cd5ef81-dirty`）。显示的是**宿主基座**的版本，不是本插件的——基座只在侧边栏品牌区把这串文本渲染出来（由 `process.env.DSH_CLIENT_VERSION/COMMIT_HASH/GIT_DIRTY` 构建期内联），没有 cordis 服务、没有 `window` 全局、也没有 meta 标签，因此插件从 `[data-slot="sidebar"]` 里读。读不到时只显示 `POWERED BY DSH`，绝不猜一个版本号 |
| **依赖的服务** | 通过 `export const inject` 声明 `slots` / `theme` / `workspaces` / `uiWorkspace` / `sessions` 五个服务——master 的插件守卫**只把声明过的服务交给插件**，未声明的一律解析为 `undefined` |

## 安装

Pixel Office 是标准的 DSH Profile Bundle。安装的本质是把一个声明了 `dsh.bundle.patch` 的包加为某个 dsh profile 的依赖，dsh 会把它激活进 `dsh.profile.bundles` 层序。命令背地里就是 `pnpm add`，跑在当前 profile 目录里。

**前置条件**

- Node.js 22+（`engines` 锁定）
- pnpm 10+（`packageManager` 锁定，建议 corepack）
- 一个能运行 `dsh web` 的 DeepSeek Harness

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

`opened`（"这次进工位点开了哪张"）刻意**不**持久化，刷新后自动从黑屏待机开始。持久化写入已做引用比较：拖拽 50 次最多写 0 次 storage。隐私模式下 storage 抛错会静默降级为仅内存。

## 目录结构

```
src/index.ts            node 半边（占位 apply；Loader 需要一个可导入行）
src/client/index.tsx    浏览器入口：服务读取、slot 注册、生命周期
src/client/views.tsx    俯视图、桌面正视图、弹窗、设置面板
src/client/styles.ts    样式表文本 + 注入 effect
src/client/tokens.ts    亮 / 暗两套调色板
src/client/placement.ts 摆放与呈现逻辑（无 React、无 DOM）
src/client/store.ts     场景状态与指针拖拽
src/client/persist.ts   摆放持久化（localStorage 读写与校验）
src/client/contracts.ts 所需 DSH 表面的结构化类型
assets/                 README 截图（top-view / desk-view / settings）
tsdown.config.ts        产物构建配置
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

1. **服务必须先声明才能拿到。** master 的 `cordis-client-runner` 守卫只把插件 fiber 在 `export const inject` 中声明过的服务交给插件；未声明的服务 `ctx.get` 一律返回 `undefined`。加新能力时先把服务名加进 `inject`。
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
- **俯视图固定 24 工位，第 1 格（左上角）常驻为「未分组」工位**，展示未被任何工作区收纳的会话（与官方 UI 的「未分组」分组一致）。其余 23 格用于真实工作区，超出的工作区仍存在、仍可从原生界面访问，只是没有工位可放。「未分组」工位可点击进入，其下会话可继续对话或拖出归档；但工位本身为只读：不可重命名 / 清空 / 删除，也不能在其下新建会话——官方不提供「无所属工作区」的建会能力，插件保持与官方一致，不自行扩展该功能。
- **宿主处于亮色模式时，会话内部（host 渲染的 conversation）仍按宿主主题显示**，可能与插件强制深色的 CRT 边框不一致；代码块、表格、输入框有兜底规则，未必覆盖全。
- **模型 / Agent 预设分区只做了外观皮肤**（直角 + 等宽字体），内部控件未逐项验证。
- **暂无自动化测试。** `placement.ts` 抽象出来便于测试，但测试还没写，欢迎 PR。

## License

MIT — 见 [LICENSE](./LICENSE)。
