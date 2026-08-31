# zsagent 前端

基于 [Vue Vben Admin v5](https://github.com/vbenjs/vue-vben-admin)（web-antd / Ant Design Vue）裁剪的中后台前端，承载 zsagent 的智能问答与知识管理界面。

## 功能

| 模块 | 说明 | 状态 |
|---|---|---|
| 基座 | 登录、布局、主题、国际化 | ✅ |
| 智能问答 | 与 agent 的流式对话 | ✅ |
| 知识管理 | 目录管理 + 文档管理（上传、版本、ETL 状态） | ✅ |
| 权限接入 | 对接真实后端认证 | ⏳（当前为 mock 登录） |

## 技术栈

- **Vue 3** + **TypeScript** + **Vite**
- **Ant Design Vue**（web-antd 版本）
- **Pinia** + **Vue Router**
- **pnpm** 管理 monorepo（`apps` + `packages` + `internal`）

## 目录结构

```
frontend
├── apps
│   ├── web-antd        # 主应用（业务代码所在）
│   └── backend-mock    # Nitro mock 服务（仅用于开发登录）
├── packages            # vben 内核包（access / layouts / preferences 等）
├── internal            # 构建与工具链（vite-config / eslint 等）
└── scripts             # 工程脚本
```

业务代码集中在 `apps/web-antd/src`：

- `api/zsagent/` — 后端接口封装（agent / knowledge / file）
- `views/agent/chat/` — 智能问答
- `views/knowledge/` — 目录管理与文档管理
- `router/routes/modules/` — 业务路由

## 快速开始

环境要求：**Node ≥ 22.18**、**pnpm ≥ 11**（建议 11.16）。

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务
pnpm dev:antd
```

- 前端地址：http://localhost:5666
- 登录账号：`admin` / `123456`（mock 登录，由 `backend-mock` 提供）

### 依赖的后端

业务接口来自 zsagent 后端（Java / Spring Boot），需在 8080 端口运行：

```bash
cd .. # 回到 zsagent 仓库根目录
mvn spring-boot:run -pl bootstrap
```

### 开发代理（`apps/web-antd/vite.config.ts`）

| 前缀 | 目标 | 用途 |
|---|---|---|
| `/api/v1` | `http://localhost:8080`（不重写路径） | zsagent 业务接口 |
| `/api` | `http://localhost:5320/api` | mock 登录 |

## 构建

```bash
pnpm build:antd            # 产物输出至 apps/web-antd/dist
cd apps/web-antd && pnpm preview   # 本地预览构建产物
```

生产环境如需指向真实后端，可通过环境变量 `VITE_ZSAGENT_API_URL` 覆盖接口地址（否则默认 `/api/v1`，需反向代理转发）。

## 说明

- 当前无真实权限，`accessMode: 'frontend'`，所有业务接口注入固定 `DEFAULT_USER_ID`。
- 该仓库为独立 git 仓库（基于 vben 裁剪），`dev` 分支承载本项目开发内容。
