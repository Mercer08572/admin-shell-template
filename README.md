# Admin Shell Template

一个可直接复用的 Vue 3 管理端模板：**外壳（菜单 / 顶栏 / 多标签工作台）+ 配置驱动的 CRUD 脚手架 + 进程内 mock 后端 + 开箱即用的测试基线**。

拿到新项目时把它整目录拷走，改品牌、删演示模块、接上自己的后端即可开工。

## 特性

- **固定外壳**：顶栏与多标签条常驻，内容区是唯一滚动容器；工作台标签不可关闭，其余页面按访问顺序追加、可单独关闭。
- **侧栏可收窄**：一键把左侧菜单收成图标栏（悬浮图标显示菜单名），状态记在 `localStorage`。
- **零后端可跑**：内置进程内 mock（`src/api/mock`），`pnpm dev` 就能登录、看列表、增删改，不需要任何服务。
- **一条开关切真后端**：`VITE_USE_MOCK=false` + 代理地址即可，业务代码零改动；mock 模块是动态导入的，关掉后不会进产物。
- **配置驱动的 CRUD**：`src/lib/crud` + `src/components/crud` 提供「列表页 + 抽屉表单」的通用实现，新增一个资源只需写一份配置（照 `src/features/customers` 抄）。
- **统一错误模型**：响应信封、`ApiError`（status / code / errorCode / traceId）、错误码→中文文案一条链，见 `src/api`。
- **测试基线**：Vitest（jsdom）+ Playwright（桌面 + 移动双跑），含外壳布局契约与 320 px 回归。
- **工具链**：ESLint + Prettier + vue-tsc + CI（`.github/workflows/ci.yml`）。

## 快速开始

需要 Node.js 22+ 与 pnpm 10+。

```bash
pnpm install
pnpm dev
```

开发服务器在 [http://127.0.0.1:5273](http://127.0.0.1:5273)（**不是** 5173，避免与相邻项目抢端口）。

默认使用 mock 数据，用登录页上提示的演示账号登录：

| 账号      | 密码         | 用途                               |
| --------- | ------------ | ---------------------------------- |
| `admin`   | `admin123`   | 普通管理员，直接进工作台           |
| `starter` | `starter123` | 演示「首次登录强制改密」的守卫分支 |

演示账号定义在 `src/config/demo.ts`（登录页提示与 mock 校验共用同一份来源）。

## 目录结构

```text
src/api/         传输层（client.ts）、错误模型、接口包装、进程内 mock
src/app/         根级提供者、主题、404
src/components/
  ├─ layout/     外壳：AdminShell + 多标签规则（shell-tabs.ts）
  ├─ common/     PageHeader、AsyncState、DataTable（表格适配层）
  └─ crud/       通用列表页与抽屉表单
src/config/      演示配置（演示账号；接真后端后可删）
src/features/    业务功能：auth（登录/改密）、dashboard（工作台）、customers（示例模块）
src/lib/crud/    配置驱动的 CRUD 状态机与表单/列描述
src/router/      路由表与全局守卫
src/stores/      Pinia 安装配置
src/styles/      设计令牌、外壳 band 变量、页面高度契约
tests/           Playwright 端到端测试 + API 造桩
docs/            架构说明
tasks/           Agent 任务说明模板
```

## 加一个业务模块（照 `features/customers` 抄）

1. **类型**：在 `src/types/api.ts` 里给实体加类型，字段对齐 `BaseEntity`（`id / code / name / status`）。
2. **接口包装**：在 `src/api/` 加 `xxxApi`（`list / get / create / update / remove`），只调 `api.get/post/put/delete`，不直接 `fetch`。
3. **配置**：在 `src/features/<模块>/xxx.ts` 里声明列、字段、下拉选项、`load/remove` 绑定、`detailRoute`。
4. **视图**：列表页用 `EntityListPage`（薄到只剩配置），需要详情页就再加一个视图，子表按父实体 id 取数。
5. **路由与菜单**：在 `src/router/index.ts` 注册路由，在 `AdminShell.vue` 的 `menuOptions` 加一项（菜单项就是路由路径，支持 `children` 分组）。
6. **mock**：在 `src/api/mock/handlers.ts` 加路由与种子数据（`src/api/mock/fixtures.ts`），顺带把新错误码补进 `src/api/error-messages.ts`。
7. **测试**：单测覆盖纯逻辑；端到端在 `tests/` 里用 `tests/support/api-mock.ts` 造桩。

## mock 与真后端

| 变量                    | 作用                                               |
| ----------------------- | -------------------------------------------------- |
| `VITE_USE_MOCK`         | `true` 时全部接口走进程内 mock（开发环境默认开启） |
| `VITE_API_BASE_URL`     | 接口前缀，默认 `/api/v1`                           |
| `VITE_API_PROXY_TARGET` | `VITE_USE_MOCK=false` 时开发代理的目标地址         |
| `VITE_MOCK_DELAY_MS`    | mock 的人为延迟（默认 120ms，设 `0` 可瞬间返回）   |

切成自己的后端：

```bash
# .env.development（或 .env.local）
VITE_USE_MOCK=false
VITE_API_PROXY_TARGET=http://localhost:8080
```

页面代码不需要改：mock 与真实请求共用 `src/api/client.ts` 的信封解包与错误模型。

mock 的行为约定见 `src/api/mock/handlers.ts`：写操作真的改内存数据、`DELETE` 成功返回 204、未注册的路径返回 404（避免「页面空白但测试通过」）。

## 常用命令

| 命令             | 用途                                       |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | 启动开发服务器（5273）                     |
| `pnpm build`     | 类型检查 + 生产构建                        |
| `pnpm typecheck` | vue-tsc 类型检查                           |
| `pnpm lint`      | ESLint                                     |
| `pnpm format`    | Prettier 格式化（可传路径收窄范围）        |
| `pnpm test:run`  | 单元测试一次                               |
| `pnpm test:e2e`  | 端到端测试（桌面 + 移动；不依赖后端）      |
| `pnpm check`     | 提交前完整校验（格式/检查/类型/单测/构建） |

首次跑端到端测试前安装浏览器：

```bash
pnpm exec playwright install chromium
```

## 用这个模板开新项目

1. 复制目录、改 `package.json` 的 `name`、`index.html` 的标题与 `src/app/theme.ts` 的主色。
2. 删掉演示模块：`src/features/customers`、`src/api/mock`（若已接好后端）、`src/config/demo.ts`、`tests/crud.spec.ts`、`tests/customer-detail.spec.ts`，以及 `AdminShell.vue` 里对应的菜单项与路由。
3. 按上面的「加一个业务模块」清单开始写第一块业务。
4. 接后端：设置 `VITE_USE_MOCK=false` 与 `VITE_API_PROXY_TARGET`，然后按后端实际契约核对 `src/types/api.ts` 与 `src/api/*.ts`。

## 进一步阅读

- 架构与外壳布局契约（**改外壳前必读**）：[docs/architecture.md](docs/architecture.md)
- 任务说明模板：[tasks/README.md](tasks/README.md)
