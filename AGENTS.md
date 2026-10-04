# Admin Shell Template — AGENTS.md

本文件是本项目的**通用开发规范**，适用于仓库内所有文件。

## 项目概述

Vue 3 管理端模板：外壳（菜单 / 顶栏 / 多标签工作台）、配置驱动的 CRUD 脚手架、
进程内 mock 后端与测试基线。使用方式是「整个目录拷走，改品牌、删演示模块、接自己的后端」。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router + Pinia
- Naive UI（控件与业务表格）+ Lucide 图标
- Vitest + Vue Test Utils（单元）、Playwright（端到端）
- ESLint + Prettier

## 必须执行的命令

```bash
pnpm install
pnpm dev          # 开发服务器，默认 http://127.0.0.1:5273
pnpm check        # format:check + lint + typecheck + test:run + build
pnpm test:e2e     # 端到端（桌面 + 移动），不依赖后端
```

交付前：先跑与改动最相关且范围最小的测试，再跑 `pnpm check`；浏览器可见的改动还要跑 `pnpm test:e2e`，
并检查桌面端与 320 px 窄屏两种宽度。

## 源码目录结构

```text
src/api/           共享传输层、错误模型、接口包装、进程内 mock
src/app/           根级提供者、主题、应用级视图
src/components/    layout（外壳）/ common（通用展示组件）/ crud（配置驱动的列表与表单）
src/config/        演示配置（演示账号）
src/features/      业务功能；功能专属状态与视图放在一起
src/lib/crud/      CRUD 状态机、表单与列描述的纯逻辑
src/router/        路由定义与全局守卫
src/stores/        Pinia 安装配置与真正跨功能共享的 store
src/styles/        设计令牌、外壳 band 变量、页面高度契约
src/types/         共享 API 类型
tests/             Playwright 端到端测试与 API 造桩
docs/              架构说明
tasks/             Agent 任务说明
```

## 架构规则

- 视图只调用 `src/api/*.ts` 的接口包装，**禁止**直接 `fetch`。
- `src/api/client.ts` 是唯一的传输层：mock 与真实请求都经它解包信封并转成 `ApiError`，
  错误必须保留 `status / code / errorCode / traceId`。
- 认证走 HttpOnly Cookie：前端只保留当前身份与会话状态，**禁止**在浏览器存储里持久化令牌。
- 路由专属状态留在对应功能模块内；只有跨路由共享或导航后仍需保留的状态才进 Pinia。
- 服务端数据保持为服务端数据：没有明确失效设计时，不要把接口记录复制进长期存活的 store。
- 业务实体字段对齐 `BaseEntity`（`id / code / name / status`），这样通用列表与表单才能完全配置化。
- 控件用 Naive UI、图标用 Lucide；业务表格一律经 `src/components/common/DataTable.vue` 适配层接入
  （列描述见 `data-table.ts`），页面不直接调用表格库的列 API。
- 每个异步页面都要有加载、空数据、错误与重试状态（用 `AsyncState`）。
- 保持键盘可访问性、清晰可见的焦点状态、语义化标签，并确保布局在 320 px 宽度下不横向溢出。
- 新增后端错误码时同步补 `src/api/error-messages.ts` 的中文文案（不补也能回退后端原文）。

## 变更边界

- 除非任务明确要求，否则不要改动 `src/api/mock/**` 之外的 mock 行为（示例模块与它的桩测试相互依赖）。
- **改外壳布局前先读 [docs/architecture.md](docs/architecture.md)**：顶栏与标签条不能用 `position: sticky`、
  页面不能设视口相关的最小高度，这两条都有实测原因，违反会出现「按钮点不到 / 页面滚不动」。
- 除非现有技术栈无法清晰解决需求，否则避免引入新依赖。
- 禁止提交 `.env`、构建产物、覆盖率报告或 Playwright 报告。
- 外壳、传输层、错误模型的改动要同步更新 `docs/architecture.md`。

## 完成标准

- 满足 `tasks/` 任务说明中的验收标准。
- `pnpm check` 执行通过；浏览器可见的改动 `pnpm test:e2e` 通过，且已在桌面与 320 px 下检查。
- 面向用户的工作流具备正确的加载、空数据、错误、成功与会话状态。
- 不引入虚假的生产数据，不做静默的 API 降级。
- 命令、架构或配置变化时同步更新文档与 `.env.example`。

## Git 提交与推送规范

### 提交与推送授权（硬性约束）

- **绝对不可擅自执行 `git commit`**。
- **绝对不可擅自执行 `git push`**。
- 只有当用户在**当次对话中明确要求**提交或推送时，才可以执行对应的操作。
- **禁止丢弃用户改动**：不得擅自执行 `git restore`、`git checkout -- <path>`、`git reset --hard`、
  `git stash`、`git clean`；需要清理未提交改动时必须先取得用户明确同意。

### Commit message 格式（必须严格遵守）

- 始终使用**中文**编写 commit message。
- 严格遵循 Conventional Commits 规范，格式为：`<type>(<scope>): <subject>`。
- `type` 必须是以下之一：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`。
- `subject` 需用祈使句简要概括核心改动，不超过 72 字符，确保能清晰体现修改内容和意图。
