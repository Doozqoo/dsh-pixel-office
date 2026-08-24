# Pixel Office

一套给 DeepSeek Harness Web GUI 的数字 + 像素风格工作区主题。

它把会话列表换成一间俯视的像素办公室：24 个「田」字形工位（6 列 × 4 行），每个工位对应一个工作区。空工位只有一把座椅；已建立的工作区在桌上摆一台电脑，工作区有会话在跑时显示器点亮并跳动。点进工位是桌面正视图——左边一块计划板贴着代表会话的便利贴，右边一台 CRT 显示器，**里面是真正的对话界面**，聊天、发送、工具调用全部照常工作。

## 它做了什么

| 表面 | 行为 |
| --- | --- |
| 侧边栏 | 裁剪隐藏（不是 `display:none`，原因见下） |
| 工位俯视图 | 6×4 工位网格；拖拽可搬迁设备、交换位置；空位点击新建工作区；「清空」删除工作区 |
| 工位桌面 | 计划板 + 显示器；显示器内嵌真实会话界面 |
| 便利贴 | 一张 = 一个会话；点击在显示器打开；拖拽交换位置；拖出计划板撕下（归档会话） |
| 显示器 | 进入工位默认黑屏待机，点便利贴才接入会话；当前打开的那张便利贴带青色高亮 |
| 新会话 | 桌面左下一叠便利贴，拖到计划板空位弹框填写展示内容 |
| 设置 | 保留原生设置面板并重绘为像素风；新增「像素工位」分区可调动效档位与网格投影 |
| 一键切换 | 设置 →「赛博工位」→「像素工位皮肤」，可随时在像素主题与原版界面之间来回切换，选择记在本浏览器 |
| 持久化 | 工位布局、便利贴摆放、自定义文字与动效设置存进 `localStorage`，刷新后保持原样 |
| 外观 | 亮色 / 暗色两套完整像素调色板，跟随原生外观偏好 |
| 背景 | 五层视差：漂移极光、透视地板与天顶网格、三层像素浮尘、暗角与地平线泛光 |
| 动画 | 便利贴不同步摆动与悬停抬起、指示灯呼吸、CRT 扫描线；进出工位都是 CRT 开机转场（动画加在**进入**的那一侧），工位以级联延迟入场 |
| 猫猫 | **仅在该工作区有会话运行时出现**：显示器里一只黑白像素猫脸，静止不动，偶尔眨眼。待机时不显示 |
| 动效档位 | 设置里 `CALM` / `OVERDRIVE` 真正生效；另尊重系统 `prefers-reduced-motion` |

## 在像素主题与原版界面之间切换

设置 →「赛博工位」→ 第一张卡「像素工位皮肤」，点按钮即可来回切换，即时生效、无需刷新或重启：

- **关闭**：样式表、token 覆盖、场景 overlay 三样一起撤掉，原版界面**原样**回来（走的是和卸载插件相同的清理路径，不是遮挡）。插件仍保持加载，设置分区还在，随时能开回来。
- **开启**：像素工位恢复，工位布局与便利贴摆放都还是原来的——关皮肤不会清掉摆放数据。

选择存在 `localStorage`，刷新后保持。皮肤关闭时，这张卡用宿主自己的主题 token 渲染，在原生亮色 / 暗色下都是原生外观。

> 如果想彻底不加载这个插件，运行 `dsh plugin --profile web remove dsh-client-pixel-office` 并重启 `dsh web`；日常来回切换用上面的开关即可。

便利贴容量不再是手调的数字：计划板会用 `ResizeObserver` 量自己的实际尺寸，铺满能放下的行列数，**始终保留一个空位**以便拖拽调整位置。1280×800 大约 12 格（可用 11），1920×1080 约 30 格，2560×1440 约 56 格；窗口变化时自动重排。

单元格按便利贴的长宽比（156×168）取整分配，两个方向都用 `1fr` 精确铺满，所以计划板不会剩下空带；便利贴自身按 `--pxo-note-w` 限宽并居中，格子富余时留白边而不是把便利贴拉宽。

另外三个已修的坑，改动前值得知道：

- **计划板与显示器共用一条底线。** 两者的底边都由 `--pxo-dock` 推导（`--pxo-sh` 依赖它），不要再给任何一侧写死高度——之前两边各算各的，差了 120px，显示器的机颈和 `PWR` 角标就压到了便利贴叠和脚注上。
- **俯视图底部的 `--pxo-foot` 是保留带。** 工位网格停在它的上沿，脚注在带内垂直居中。之前网格停在 `bottom:30px`、脚注浮在 `bottom:18px`，中间只剩 12px，最后一行工位直接压住脚注的字。加行列或改网格高度时改这个变量，别再写死数值。
- **工位卡上的便利贴数量必须和计划板一致。** 用 `notes[id] !== undefined && !archivedIds.includes(id)` 过滤后再计数——直接用 `sessionIds.length` 会把已归档的会话、以及会话列表还没发布的 id 都算进去，卡片显示的数字比板上实际贴着的多。
- **定时器只能用 `window.setTimeout`，不能用 `ctx.timeout`。** `ctx.timeout` 是 `@deepseek-ai/cordis-plugin-timer` 通过 `ctx.mixin` 混入的，而**浏览器侧的 composition 根本没装这个插件**——`packages/bundle/web-app/cordis.patch.yml` 的 roster 里没有 timer 行，vendored cordis 核心也不带 `timeout`。把 `ctx` 断言成带 `timeout` 的类型能骗过 `tsc`，运行时则在每次进出工位时抛 `timers.timeout is not a function`。现在改用 `window.setTimeout`，并由一个 fiber effect 持有全部未决句柄，卸载或关皮肤时统一 `clearTimeout`——既拿回了生命周期归属，又不依赖不存在的服务。
- **`dsh.client.inject` 要写真正提供服务的包。** 它是 informational 的（不影响激活顺序，顺序由 `slots.inject()` 保证），但会进 preflight 显示与 HMR diffing。本插件消费的 `slots` / `sessions` / `workspaces` 来自 `dsh-client-runtime`，`theme` 来自 `dsh-client-ui-theme`；`ui-layout` 与 `ui-settings` 提供的是 `shell.overlay` 和 `settings.section` 两个座位。四个都列上才是完整的依赖图。
- **没有 `leaving` 过渡态。** 「离开工位」直接切 `mode`，转场动画加在**进入**的那一侧。旧写法把切换压在 260ms 定时器后面，窗口期内任何一次 store 写入都会让守卫失配，`pxo-power-off` 的 `both` 填充就把整个场景永久留在 `scaleY(0)`——表现为按钮点了没反应、屏幕全黑。
- **新建会话时 `pending` 锁住该工位的摆放。** 建会话是异步的，工作区列表可能在 `connectWorkspace` 返回前就发布了新 id，协调 effect 会把它放进第一个空位，随后拖拽回调再按落点写一次——同一个会话占两格，塌缩时就吃掉了上一张便利贴。`pending` 期间协调 effect 跳过这个工位，由回调独占写入。
- **持久化必须连 `limit` 一起存。** `order` 里的网格是按当时量出的格数建的，而 `limit` 初始值只是占位的 12。只恢复 `order` 不恢复 `limit`，首次协调会用 `fitInto` 把网格截到 12 格，第 12 格之后的便利贴全部重排——`ResizeObserver` 量完再改回来已经晚了。
- **持久化订阅要先比较再序列化。** `store.set` 在拖拽期间每次指针移动都触发；持久化的五个字段用引用比较（浅合并保证未改动字段引用不变），50 次拖拽写入 0 次 storage。
- **会话窗口的显示要用 `data-screen` 单独控制，不能只看 `data-mode`。** 会话是 shell 自己 portal 出来的 slot，它会一直渲染最后一次 `sessions.open()` 打开的那个会话，而且**没有"关闭"状态可读**。只按 desk 模式显示，就会在新工作区里显示上一个工作区的会话——哪怕这个工位一张便利贴都没有。现在由 `opened` 记录用户点开的便利贴，进入／离开工位时清空，并且每帧对照实时列表校验（撕下或归档后自动黑屏），只有校验通过才 `data-screen="on"`。
- **`opened` 不进持久化。** 它是"这次进工位点开了哪张"，不是摆放数据；存下来会让刷新后一进工位就直接亮屏，正好绕开上面这条修复。
- **样式表分两张，总开关那张永远在。** 皮肤样式表是被开关摘掉的那张，而总开关本身就在设置分区里——如果它的样式也写在那张表里，关掉皮肤后这个唯一的"回去"入口会变成没有样式的裸标签。所以总开关的样式单独一张 `BASE_CSS`，用宿主自己的 `--dsw-alias-*` token（**每个都带 fallback**，因为关掉皮肤后插件的 token 覆盖也一并撤了）。
- **总开关的两类选择器要成对写。** `.pxo-set-master .pxo-toggle` 是双类选择器，比皮肤表里通用的 `.pxo-toggle` 优先级高，光靠样式表顺序压不住。皮肤开启时如果不写同等优先级的覆盖，面板中间会卡着一个原生风格的按钮；滑块旋钮同理（基础表把它做成小圆灯，会盖掉像素表的 34×16 滑轨）。
- **关皮肤不能只靠隐藏。** `enabled` 为 false 时，样式表、token 覆盖、场景 overlay 三样一起撤——走的是和卸载插件完全相同的清理路径，所以原版界面是真的原样回来，而不是被盖住。overlay 的 `return null` 必须放在所有 hook 之后，提前 return 会改变 hook 顺序导致 React 崩溃。

## 安装

需要 Node.js 22+、pnpm，以及一个能运行 `dsh web` 的 DeepSeek Harness。Pixel Office 是标准的 DSH Profile Bundle；安装命令会同时安装软件包并把它的 `cordis.patch.yml` 加入 `web` Profile，不需要手工编辑 composition。

### 从 npm 安装

发布到 npm 后运行：

```sh
dsh plugin --profile web add dsh-client-pixel-office
```

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:Doozqoo/dsh-pixel-office
```

Git 依赖会通过 `prepare` 构建 `lib/index.js` 和 `lib/client.js`。如果 pnpm 阻止依赖的构建脚本，请按命令输出的路径，在该 Profile 的 `pnpm-workspace.yaml` 中允许 `dsh-client-pixel-office` 构建，然后重新运行安装命令。

### 本地开发安装

在插件仓库中先安装依赖并构建，再把当前目录链接到 Profile：

```sh
npm install
npm run build
dsh plugin --profile web add .
```

修改源码后重新运行 `npm run build`。插件注册表提供的是 `lib/client.js`，不是 `src/`。

安装、升级或卸载后重启当前 `dsh web` 进程并刷新页面。当前 Web Profile 不承诺对持久化 Bundle layer 热重载。

### 从旧版手工配置迁移

如果以前在 `~/.dsh/profiles/web/cordis.patch.yml` 手工加入过下面这段，先删除它：

```yaml
- insert:
    - id: pixel-office
      name: dsh-client-pixel-office
```

然后执行上面的安装命令。Bundle 自带同一配置项，保留旧配置会造成重复来源。

## 升级

npm 安装：

```sh
dsh plugin --profile web update dsh-client-pixel-office
```

GitHub 安装可重新运行对应的 `add` 命令，或者让 pnpm 更新锁定的 Git revision。

## 卸载

```sh
dsh plugin --profile web remove dsh-client-pixel-office
```

该命令会删除 Profile 依赖并从 Bundle layer 列表移除 Pixel Office。重启 `dsh web` 后，Cordis 会撤销插件持有的样式表、主题覆盖和 slot 注册，原生界面完整恢复。浏览器 `localStorage` 中的布局偏好默认保留，方便以后重装；需要清除数据时再通过浏览器站点数据管理删除。

## 三个不显然的实现决定

这几处都是踩过坑之后定下来的，改动前值得先读。

**侧边栏是裁剪掉的，不是 `display:none`。** 设置面板由 settings 插件渲染进 `sidebar.settings` 座位，而那个座位嵌在侧边栏自己的 wrapper 元素里，并不是 slot 锚点的直接子元素。给这条链上任何祖先加 `display:none` 会无条件删掉整棵子树——没有任何后代规则能救回来——连带删掉导航栏、所有原生分区，以及触发器要打开的那个面板。表现是按钮"点了没反应"：React 确实把面板 open 了，只是渲染进了一棵被删除的子树。所以这里裁剪到一个 `0x0` 的 fixed 盒子：正常流里的侧边栏外观被裁走，子树仍然存活，而面板自己的 `position:fixed` 覆盖层以视口为包含块，天然不受这个裁剪影响。

**侧边栏锚点的 z-index 是 500，不能再往上抬。** 它需要高于工位显示器（40）和显示器外框（45），但必须**低于 1100**——原生下拉菜单 `portal` 到 `document.body` 并用 1100 保证"对话框里的菜单仍在对话框之上"。把锚点抬到 2000 会把设置面板顶到下拉列表上面，菜单照常展开但完全被盖住，看起来就是设置项点不动。

**主题覆盖必须给亮暗两套**不同的值。校验只检查每个值提供了 `light` 和 `dark`，不检查两者是否有差异。两边填同一个色值会让外观偏好变成死的：选择照常持久化，两套方案解析结果一致，屏幕上不可能有任何变化。

另外，会话输入框是**两层**结构：textarea 故意全透明，只贡献光标和原生选区，真正画出每个字形的是它的兄弟 backdrop 层。给 textarea 设 `color` 会让草稿变成两份错位副本或深底深字。样式里刻意重申了这个透明设计，让 backdrop 的 `--dsw-alias-label-primary` 去承担墨色。

## 目录

```
src/index.ts            node 半边（空 apply；Loader 需要一个可导入的行）
src/client/index.tsx    浏览器入口：服务读取、slot 注册、生命周期
src/client/views.tsx    俯视图、桌面正视图、弹窗
src/client/styles.ts    样式表文本 + 注入 effect
src/client/tokens.ts    亮 / 暗两套调色板
src/client/placement.ts 摆放与呈现逻辑（无 React、无 DOM）
src/client/store.ts     场景状态与指针拖拽
src/client/persist.ts   摆放持久化（localStorage 读写与校验）
src/client/contracts.ts 所需 DSH 表面的结构化类型
tsdown.config.ts        产物构建（四条契约写在文件头注释里）
```

`placement.ts` 特意不含 React 与 DOM，是唯一能脱离浏览器直接测的部分。

`contracts.ts` 在本地声明所需类型，而不是从 `@deepseek-ai/*` 导入：独立仓库要能在没有那些包的环境里 install 和 typecheck。这些是结构化镜像而非上游 API 的分叉——如果某个签名与运行中的 harness 不一致，以 harness 为准。

## 已知限制

- **摆放持久化只在本浏览器生效。** 工位布局、便利贴摆放、自定义文字与动效设置写在 `localStorage`，换浏览器或清缓存会回到默认推导。存的是纯数据切片，运行时对象不会被序列化；隐私模式下 storage 抛错会静默降级为仅内存。
- **俯视图只显示前 6 个工作区。** 超出的工作区仍然存在、仍可从原生界面访问，只是没有工位可放。
- **亮色模式下的会话内部**可能仍有组件写死的颜色 token 层够不到。代码块、表格、输入框有兜底规则，未必覆盖全。
- **模型 / 插件 / Agent 预设分区只做了外观皮肤**（直角 + 等宽字体），内部控件未逐项验证。如有失灵，大概率是同一类 portal 层级问题。
- **无自动化测试。** `placement.ts` 是为可测而抽出来的，但测试还没写。

## License

MIT
