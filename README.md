# Pixel Office

一套给 DeepSeek Harness Web GUI 的数字 + 像素风格工作区主题。

它把会话列表换成一间俯视的像素办公室：6 个「田」字形工位（一行 3 个、共 2 列），每个工位对应一个工作区。空工位只有一把座椅；已建立的工作区在桌上摆一台电脑，工作区有会话在跑时显示器点亮并跳动。点进工位是桌面正视图——左边一块计划板贴着代表会话的便利贴，右边一台 CRT 显示器，**里面是真正的对话界面**，聊天、发送、工具调用全部照常工作。

## 它做了什么

| 表面 | 行为 |
| --- | --- |
| 侧边栏 | 裁剪隐藏（不是 `display:none`，原因见下） |
| 工位俯视图 | 6 工位网格；拖拽可搬迁设备、交换位置；空位点击新建工作区；「清空」删除工作区 |
| 工位桌面 | 计划板 + 显示器；显示器内嵌真实会话界面 |
| 便利贴 | 一张 = 一个会话；点击在显示器打开；拖拽交换位置；拖出计划板撕下（归档会话） |
| 新会话 | 桌面左下一叠便利贴，拖到计划板空位弹框填写展示内容 |
| 设置 | 保留原生设置面板并重绘为像素风；新增「像素工位」分区可调便利贴上限 |
| 外观 | 亮色 / 暗色两套完整像素调色板，跟随原生外观偏好 |
| 动画 | 纯 CSS `steps()`：显示器扫描跳动、便利贴不同步摆动与卷边、运行指示灯闪烁、CRT 扫描线 |

便利贴上限默认 12，**始终保留一个空位**（实际可用 11）以便拖拽调整位置。上限可在设置里调 4–24，调多则单张更小。

## 安装

需要一个能跑 `dsh web` 的 DeepSeek Harness。

```sh
git clone https://github.com/YOUR_USER/dsh-pixel-office.git
cd dsh-pixel-office
npm install
npm run build
```

构建产出两个产物，两个都必需：

- `lib/index.js` — node 半边，host Loader 导入这一行来读取插件
- `lib/client.js` — 浏览器半边，插件注册表通过 HTTP 提供给页面

然后把它加进你的 composition。浏览器 roster 是**扫描 host Loader 已加载的行**得来的（不是扫某个目录），所以装载方式就是加一行指向这个包：

```yaml
# 你的 cordis.yml 或 bundle 的 cordis.patch.yml
- insert:
    - id: pixel-office
      name: dsh-client-pixel-office
```

行名要能被 Node 解析到。本地开发最省事的是链接进去：

```sh
npm link                                   # 在本仓库
cd /path/to/your-harness && npm link dsh-client-pixel-office
```

重启 `dsh web` 后刷新页面。插件被 Loader 加载后，`dsh.client` 声明会被扫到，`lib/client.js` 随之送到浏览器。

> 改完源码要重新 `npm run build`：注册表提供的是 `lib/client.js`，不是 `src/`。

## 卸载

从 composition 里删掉那一行并重启。插件的每个副作用都挂在 Cordis fiber 上——样式表、主题覆盖、两处 slot 注册——所以卸载后原生主题完整回归，不残留任何东西。

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
src/client/contracts.ts 所需 DSH 表面的结构化类型
tsdown.config.ts        产物构建（四条契约写在文件头注释里）
```

`placement.ts` 特意不含 React 与 DOM，是唯一能脱离浏览器直接测的部分。

`contracts.ts` 在本地声明所需类型，而不是从 `@deepseek-ai/*` 导入：独立仓库要能在没有那些包的环境里 install 和 typecheck。这些是结构化镜像而非上游 API 的分叉——如果某个签名与运行中的 harness 不一致，以 harness 为准。

## 已知限制

- **工位布局与便利贴文字不持久化。** 都存在进程内存里，刷新后按会话 id 重新推导摆放，自定义的便利贴文字会丢。要持久化得接一个 storage 服务，目前没做。
- **俯视图只显示前 6 个工作区。** 超出的工作区仍然存在、仍可从原生界面访问，只是没有工位可放。
- **亮色模式下的会话内部**可能仍有组件写死的颜色 token 层够不到。代码块、表格、输入框有兜底规则，未必覆盖全。
- **模型 / 插件 / Agent 预设分区只做了外观皮肤**（直角 + 等宽字体），内部控件未逐项验证。如有失灵，大概率是同一类 portal 层级问题。
- **无自动化测试。** `placement.ts` 是为可测而抽出来的，但测试还没写。

## License

MIT
