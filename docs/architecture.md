# 架构

## 依赖方向

```text
views/components -> feature 里的接口包装 / store -> api/client.ts -> 后端或进程内 mock
        |                        |
        +------ shared types ----+
```

- 页面负责组合与交互，不处理 HTTP 细节。
- feature 模块负责自己的业务状态与会话生命周期。
- 接口包装负责路径、请求参数与响应类型。
- `api/client.ts` 负责信封解包、错误模型，以及在 mock 与真实请求之间切换。

**禁止**在视图里直接 `fetch`；**禁止**绕过 `client.ts` 自己拼装错误对象。

## 传输层与 mock

```
apiRequest(path, options)
  ├─ VITE_USE_MOCK=true  → await import('./mock') → mockRespond(...)   ← 浏览器内应答
  └─ 否则                 → fetch(`${VITE_API_BASE_URL}${path}`)        ← 真实请求
        ↓ 两条路径都得到 { status, isJson, payload }
  统一解包：204 → undefined；非 2xx 或 code !== 200 → ApiError
```

- 响应信封：`{ code, message, error_code?, data, trace_id, timestamp }`。
- `ApiError` 必须保留 `status / code / errorCode / traceId`：页面靠它区分 401 清会话、409 提示重试，
  以及把 traceId 交给运维排查。
- `error_code` → 中文文案的映射在 `src/api/error-messages.ts`；未命中的码回退后端 message，不吞信息。
- mock 层（`src/api/mock`）与真实后端遵守同一套约定：写操作真的改内存数据、`DELETE` 成功返回 204、
  未注册路径返回 404 并带上方法名（避免「页面空白但测试通过」）。
- mock 模块是**动态导入**的：`VITE_USE_MOCK=false` 的构建里不会包含演示数据。
- 端到端测试跑在 `--mode test`（`.env.test` 里 `VITE_USE_MOCK=false`），请求由
  `tests/support/api-mock.ts` 用 `page.route` 拦截；进程内 mock 由 `src/api/mock/mock.test.ts` 覆盖。

## 认证

后端用 HttpOnly Cookie 承载会话，前端只保留当前身份与会话状态，不读取、复制或持久化 token。

路由进入受保护页面时：

1. 首次导航调用 `GET /auth/admin/me` 恢复会话。
2. `401` 清除内存态并跳转登录页，同时保留目标路径。
3. `must_change_password=true` 强制进入修改密码页。
4. 退出登录无论请求结果如何都会清理本地内存态。

演示账号（`src/config/demo.ts`）里的 `starter` 用来验证第 3 条分支。

## 应用外壳与多标签

登录后的页面统一渲染在 `src/components/layout/AdminShell.vue`：
左侧菜单 + 顶栏 + 标签条 + 内容区。标签规则在 `shell-tabs.ts`（纯函数，单测见 `shell-tabs.test.ts`）。

### 布局契约（固定 band + 单一滚动容器）

- 外壳高度锁在 `100vh`/`100dvh`；顶栏与标签条是固定高度的 flex 项
  （`--shell-topbar-height` / `--shell-tabbar-height`），内容区 `.app-content` 是**全应用唯一的滚动容器**，
  窗口本身不滚动。
- **不要**给这些 band 用 `position: sticky`：naive 的 `NLayout` 会额外渲染一层
  `.n-layout-scroll-container`（`overflow-x: hidden` 会被 CSS 规则计算成 `overflow-y: auto`），
  sticky 的吸附基准会落到那一层而不是视口，band 会被整体下移并盖住页面头部的操作按钮。
- 页面（`.page`）**不要**设视口相关的最小高度：内容区受限时确定的高度会让 flex 列容器压缩子项
  （列表页表格被压扁且滚不动），而不是让内容区产生滚动。页面比内容区矮时露出的内容区背景与页面同色。
- `DataTable` 的最大高度算式要减掉 `--shell-tabbar-height`，否则列表页会固定多出一条约标签条高度的滚动条。
- 路由的 `scrollBehavior` 重置的是 `.app-content` 的滚动位置（登录页 / 404 没有外壳，回退窗口滚动）。

以上四条都有对应的端到端回归：`tests/tabs.spec.ts` 的「固定外壳 / 短页面」用例。

### 多标签规则

- 内容区按多标签组织：工作台常驻第 0 位且不可关闭，其余页面按访问顺序追加、可单独关闭。
- 标签的唯一键是 `route.path`，标签集合恒等于「工作台 + 访问过的路由」；同一路由只占一个标签，
  重复进入（菜单、详情跳转、浏览器前进/后退、深链）都只是切回已有标签。
- **不缓存页面状态**（未启用 `KeepAlive`）：切换标签会重新挂载视图并重新取数，
  宁可多一次请求，也不让跨标签读到过期数据。
- 关闭当前页的标签时激活它左侧的标签（工作台保底）；关闭非当前页的标签不改变当前页面。
- 标签集合不持久化：刷新或深链后重建为「工作台 + 当前页」；退出登录时外壳卸载，标签随之清空。

### 左侧菜单

- 菜单项就是路由路径，高亮按**路径前缀最长命中**：详情页（`/customers/101`）仍然高亮列表页那一项。
- 展开态由外壳控制（`:expanded-keys`）：Naive UI 只在挂载时自动展开当前项的祖先分组，
  而会话内导航（快捷入口、标签、详情跳转）进入分组内页面时不会展开，菜单会看起来「什么都没选中」。
  因此路由变化时把当前页面所在分组补进展开列表；用户手动折叠当前分组不会被强行拉开。

### 侧栏折叠

- 侧栏（`NLayoutSider` + `NMenu`）可收窄为图标栏：`collapse-mode="width"` 让宽度真的从 232 → 64；
  Naive 的默认值 `transform` 是把侧栏移出屏幕，内容区不重排，不是这里要的效果。
  折叠状态存在 `localStorage`（键 `admin-shell-template:sidebar-collapsed`，只存一个布尔偏好、不涉及凭据），
  读写与异常兜底在 `sidebar-collapsed.ts`（含单测）；移动端不适用（那里侧栏由抽屉代替）。
- 折叠后**名称怎么还能被看到，交给 Naive 内建行为**：叶子项由 `MenuOption` 的 `NTooltip` 承担、
  分组由 `Submenu` 的 `NDropdown`（hover 触发）承担，两者都只在 `collapsed` 时启用。
  名称元素仍留在 DOM 里（被设成 `opacity: 0`），因此**不要**用可见性判断名称是否隐藏，断言请看 `opacity`。
- 折叠开关是外壳自绘的**原生 `<button class="sider-toggle">`**，钉在侧栏底部（三段式：品牌固定 /
  菜单滚动 / 开关固定），带 `aria-label` 与 `:focus-visible` 焦点环。不用 `NButton`：它内部有
  「`1em` 图标尺寸 + 内容层居中 + 图标层固定宽度」三层规则，外部很难把图标精确对齐到菜单图标那一列；
  也不用 Naive 自带的 `show-trigger`：那个裸 `div` 没有 `role`/`tabindex`/`aria-label`，键盘不可达。
- 开关的取值全部来自对当前主题的实测（不靠猜）：行高 42px、图标 20px 落在 x=22..42
  （中心 32，与菜单图标同列）、文字起点 x=52（与菜单项文字同列）、非选中态图标与文字同为 `#bbb`、
  悬浮同为 `#fff`、悬浮不改背景；折叠态图标 24px 并与菜单图标一起居中在 64px 栏内。
- 底部固定依赖 sider 的**原生滚动容器**（`.n-layout-sider-scroll-container`）：
  外壳把它设为 flex 列、滚动交给菜单那一块。一旦改回 `:native-scrollbar="false"`，
  内容会被包进 `.n-scrollbar`，这些规则全部失效、开关会被菜单顶走。

### 侧栏宽度过渡期间的「不变量」

侧栏只做**宽度过渡**（`min/max-width .3s var(--n-bezier)`），因此侧栏内部不能有「瞬时翻转的布局」，
否则过渡期间会抖动。以下每条都是踩过坑后写下的，并有端到端用例逐帧采样锁定
（`tests/sidebar.spec.ts` 的「宽度过渡期间」用例）：

1. **尺寸不该变的元素必须 `flex: none`。** 默认的 `flex-shrink: 1` 会把它们压扁：
   折叠栏只有 64px，而品牌区一行需要 `15 + 34 + 11 + 文字 + 20`，
   实测品牌标记被压成 20×34（正方形变形）。
   与之相对，**文字层**要保留 `overflow: hidden`（溢出非 visible 时自动最小尺寸才降为 0，
   文字才会先被压到 0 而不是去挤 logo）。
2. **图标位置恒定。** 开关用固定 24px 图标盒 + 固定 `padding-left: 20px`，图标中心恒在 x=32；
   不要用 `justify-content: center` 之类的状态切换，否则图标会先跳到中间再缩回左边。
   品牌区**需要**随折叠把标记从「与菜单图标左对齐」移到「栏内居中」（20 → 15），
   所以改成过渡一个**连续量** `padding-left`，且与 sider 的宽度过渡**同参**
   （`var(--shell-collapse-duration)` + `var(--n-bezier)`；实测单帧位移从 14.4px 降到 0.9px，半程进度差 0.00~0.01）。
3. **文字不换行、且常驻 DOM。** `white-space: nowrap` + `overflow: hidden` 让宽度不足时被裁掉；
   折叠时只做 `opacity` 过渡——用 `display: none`（或 `v-if`）会在过渡中途把文字抽走，表现为突然跳动。
4. **时长只有一个来源。** 与折叠相关的四条过渡（品牌区位移、品牌标题淡出、开关配色、开关文字淡出）
   全部引用 `--shell-collapse-duration`（定义在 `.app-shell` 上）。它必须与 Naive 侧栏内部的
   `min/max-width` 过渡一致：Naive 没有导出任何时长变量（源码里就是写死的 `.3s var(--n-bezier)`），
   只能写同一个字面量；缓动则复用它的 `--n-bezier`。两边一旦不同，就会出现
   「栏宽还在动、标记已经走完」的错位感——`tests/sidebar.spec.ts` 会逐帧比对两者的进度（容差 ±20%），改错即失败。
5. **不出现横向滚动条。** Naive 给 sider 内容区打了**内联** `overflow: auto`，样式表里的
   `overflow: hidden` 挡不住它（内联优先）；而列方向 flex 子项的 `min-width` 默认是 `auto`
   （= min-content），容器还窄时子项拒绝收缩 → 溢出 → 滚动条一闪而过。
   修法：给品牌区 / 菜单 / 底部区都加 `min-width: 0` 并各自 `overflow: hidden`，
   菜单再显式写 `overflow: hidden auto`（只写 `overflow-y: auto` 会让 `overflow-x` 被算成 auto）。
   这个坑**只在展开方向出现**：收起时 collapsed 类立刻生效，菜单项自己先收成 64px，min-content 随之变小。

> 改这段样式时留意：同名规则的**重复定义**很隐蔽——同优先级时后出现的规则生效，
> 若旧规则没删干净，新写的过渡会被它悄悄覆盖（表现为「改了没生效」）。
> 改完跑 `pnpm test:e2e tests/sidebar.spec.ts` 即可确认这些不变量都还在。

## 配置驱动的 CRUD

通用实现分两层，业务只提供配置：

```text
src/features/<模块>/<资源>.ts   列、字段、下拉选项、load/remove 绑定、detailRoute
        ↓
src/components/crud/            EntityListPage（列表页模板）、EntityFormDrawer（抽屉表单）
src/lib/crud/                   entity-list（加载/错误/抽屉/删除状态机）、entity-form（字段与校验）、row-actions
```

- 业务实体字段对齐 `BaseEntity`（`id / code / name / status`），否则通用实现无法接管。
- 列表查询统一是 `{ items, limit, offset }`（**不带总数**）：不假装有全量 count，
  翻页用「本页是否满页」推断还有没有下一页，实现在 `EntityListPage.vue`（`hasNextPage` 在 `lib/crud/entity-list.ts`）。
- 写操作遵守三条不变量：删除必须二次确认；同一时刻只允许一个写请求；`PUT` 是全量替换，
  载荷只由抽屉表单构造。

## 新增功能

1. 在 `tasks/` 建任务说明，列出接口、验收标准与非目标。
2. 在 `src/types/api.ts` 加实体类型，在 `src/api/` 加接口包装。
3. 在 `src/features/<模块>/` 写配置与视图（列表页尽量只留配置）。
4. 在 `src/router/index.ts` 注册路由，并在 `AdminShell.vue` 的 `menuOptions` 加菜单项。
5. 在 `src/api/mock/handlers.ts` + `fixtures.ts` 加桩数据与错误分支，并补 `error-messages.ts`。
6. 覆盖成功、空数据、加载、错误、401 与 320 px 窄屏状态。
7. 运行 `pnpm check`，对 UI 变更运行 `pnpm test:e2e`。

## 数据表格

- 业务表格统一使用 `src/components/common/DataTable.vue`（Naive UI DataTable 的适配层）。
  页面只声明 `DataTableColumn` 列描述，不直接调用底层表格库；更换表格实现时只改适配层。
- 列宽必须有显式 `width`（同时作为可拖拽缩小的下限），数字列使用 `align: 'right'`。
- 需要格式化时使用 `render`；时间统一走 `formatDateTime`，CSV 文本走 `exportValue`。
- 远程分页、筛选与排序参数必须显式映射到后端，不在大数据集上伪装成本地全量操作。
