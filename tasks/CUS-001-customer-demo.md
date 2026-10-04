# CUS-001 客户 + 联系人示例模块

> 这个文件既是「已实现功能的说明」，也是任务说明的参考写法：照它的结构写你自己的任务即可。
> 实现见 `src/features/customers/`（配置与视图）、`src/lib/crud/` 与 `src/components/crud/`（通用脚手架）。

## Context

模板需要一个**能跑通、能被照抄**的业务模块，用来演示三件事：

1. 配置驱动的列表页（列、筛选、分页、行操作、详情跳转）；
2. 抽屉表单的增改（含必填校验与错误分支）；
3. 主子表详情页（子表只按父实体 id 取数，就地增改）。

它同时是「接后端之前先把前端写完」的样板：接口全部由进程内 mock 提供，不依赖任何服务。
通用脚手架是从既有的管理端项目里抽出来的，这里只保留可复用的部分，业务术语已全部去掉。

## Scope

- 客户列表：关键词 / 状态 / 等级筛选，`limit + offset` 分页，新增、编辑、删除（二次确认），详情跳转。
- 客户详情：基础信息 + 联系人子表（只按 `customer_id` 取数），联系人就地新增 / 编辑 / 删除。
- mock：客户与联系人的种子数据、写操作、错误分支（编码重复、删除被业务规则拒绝、未登录）。
- 测试：通用脚手架的单元测试；列表与详情页的端到端测试（含 409 文案与请求形状断言）。

## Out Of Scope

- 客户导入 / 导出、批量操作、软删除（停用）流程。
- 权限点与角色（模板只有单一管理员身份）。
- 服务端真实实现：本任务只定义契约与 mock 行为。

## API Contract

统一信封 `{ code, message, error_code?, data, trace_id, timestamp }`；列表统一返回 `{ items, limit, offset }`（无总数）。

| 方法   | 路径             | 说明                                                  |
| ------ | ---------------- | ----------------------------------------------------- |
| GET    | `/customers`     | query：`status?` `level?` `keyword?` `limit` `offset` |
| POST   | `/customers`     | 新增；编码重复 → 409 `CUSTOMER_CODE_DUPLICATE`        |
| GET    | `/customers/:id` | 不存在 → 404 `CUSTOMER_NOT_FOUND`                     |
| PUT    | `/customers/:id` | 全量替换（只保留 `id` 与 `created_at`）               |
| DELETE | `/customers/:id` | 还有联系人 → 409 `CUSTOMER_HAS_CONTACTS`；成功 204    |
| GET    | `/contacts`      | query：`customer_id`（必填语义）`limit` `offset`      |
| POST   | `/contacts`      | `customer_id` 不存在 → 404 `CUSTOMER_NOT_FOUND`       |
| PUT    | `/contacts/:id`  | 全量替换                                              |
| DELETE | `/contacts/:id`  | 成功 204                                              |

必填缺失 → 400 `VALIDATION_FAILED`；未登录访问业务接口 → 401 `AUTH_REQUIRED`。

契约里**没有** `GET /contacts/:id`：联系人只作为子表存在，因此「编辑联系人」的预填
直接用子表里已经加载的那一行，不额外发请求。

## 验收标准

- `pnpm dev` + 演示账号即可完成「列表筛选 → 新建 → 编辑 → 删除 → 进详情 → 维护联系人」全流程。
- 删除仍有联系人的客户时看到中文提示「该客户下还有联系人，请先删除」；编码重复时看到「编码已存在，请更换后重试」。
- 联系人子表的请求 URL 一定带 `customer_id`，新增联系人的载荷里 `customer_id` 固定为当前客户。
- `pnpm check` 通过；`pnpm test:e2e` 覆盖上述流程并在桌面与 320 px 下通过，页面不横向溢出。

## 影响面

- 新增：`src/features/customers/**`、`src/api/{customers,contacts}.ts`、`src/api/mock/**` 中对应路由与种子数据。
- 复用：`src/lib/crud/**`、`src/components/crud/**`、`src/components/common/**`（不修改通用层的行为契约）。
- 路由：`/customers`（`customer-list`）与 `/customers/:id`（`customer-detail`）；菜单挂在 `AdminShell.vue` 的「业务示例」分组下。
- 不触碰外壳布局契约（见 `docs/architecture.md`）。
