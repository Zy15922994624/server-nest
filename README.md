## LMS 演示环境

本项目支持通过 Docker 一体化启动 `frontend + backend + nginx + mongo`。

### 1. 启动服务

```bash
docker compose up -d --build
```

### 2. 初始化演示账号

```bash
docker exec lms-backend npm run seed:users
```

默认演示账号：

- 管理员：`admin001 / Admin@123456`
- 教师：`teacher001 / Teacher@123456`
- 学生：`student001 / Student@123456`

### 3. 访问地址

- 前端（经 Nginx）：`http://localhost:8080`
- Swagger：`http://localhost:8080/api/docs`

### 4. 说明

- `backend` 增加了健康检查，只有后端接口真正可用后，网关才开始转发流量。
- `frontend` 增加了健康检查，避免 Nginx 在前端开发服务未完成启动时提前接流量。
- 如果修改了依赖或容器配置，建议重新执行一次 `docker compose up -d --build`。

### 5. 常用维护命令

```bash
# 停止并移除容器
docker compose down

# 连同数据库卷一起清空（重置演示数据）
docker compose down -v

# 查看后端日志
docker logs -f lms-backend

# 查看网关日志
docker logs -f lms-nginx
```
