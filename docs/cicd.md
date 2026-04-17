# CI/CD 配置说明

## 1. 工作流概览

- `Backend CI`：后端 `lint + build + test`
- `Build And Push Backend Image`：后端镜像构建并推送
- `Deploy To Production`：通过 SSH 到服务器拉取并部署

前端仓库 `lms-react` 对应：

- `Frontend CI`：前端 `lint + build`
- `Build And Push Frontend Image`：前端镜像构建并推送

## 2. GitHub Secrets（两个仓库都要配）

- `REGISTRY`：镜像仓库地址（例：`registry.cn-beijing.aliyuncs.com`）
- `REGISTRY_USERNAME`：镜像仓库用户名
- `REGISTRY_PASSWORD`：镜像仓库密码或访问令牌

前端仓库额外：

- `FRONTEND_IMAGE`：前端镜像完整名（例：`registry.cn-beijing.aliyuncs.com/xxx/lms-frontend`）

后端仓库额外：

- `BACKEND_IMAGE`：后端镜像完整名（例：`registry.cn-beijing.aliyuncs.com/xxx/lms-backend`）
- `FRONTEND_IMAGE`：前端镜像完整名（和前端仓库保持一致）
- `SERVER_HOST`：服务器公网 IP
- `SERVER_PORT`：SSH 端口（默认 `22`）
- `SERVER_USER`：SSH 用户（例：`root`）
- `SERVER_SSH_KEY`：SSH 私钥内容
- `DEPLOY_PATH`：服务器上的后端仓库路径（例：`/opt/apps/server-nest`）

## 3. 服务器准备

在服务器 `DEPLOY_PATH` 下保持：

- `docker-compose.deploy.yml`
- `.env`（运行环境变量）
- `infra/nginx/default.conf`

并确保服务器已安装：

- Docker
- Docker Compose Plugin

## 4. 发布流程

1. 开发分支合并到 `main`
2. 前后端镜像工作流推送镜像（默认标签 `latest` + `sha-xxxx`）
3. 在后端仓库手动触发 `Deploy To Production`
4. 传入 `backend_tag`、`frontend_tag`（默认 `latest`）
5. 工作流 SSH 到服务器执行部署并做健康检查

## 5. 本地手动部署（兜底）

```bash
export BACKEND_IMAGE=registry.cn-beijing.aliyuncs.com/xxx/lms-backend
export FRONTEND_IMAGE=registry.cn-beijing.aliyuncs.com/xxx/lms-frontend
export BACKEND_TAG=latest
export FRONTEND_TAG=latest
sh scripts/deploy-prod.sh
```
