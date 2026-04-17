# server-nest

学习任务管理系统后端（NestJS + MongoDB），提供认证鉴权、课程管理、任务管理、题库管理、通知推送与文件上传能力。

## 仓库关系

- 后端：<https://github.com/Zy15922994624/server-nest>
- 前端：<https://github.com/Zy15922994624/lms-react>

## 技术栈

- NestJS 11 + TypeScript
- MongoDB + Mongoose
- JWT + Passport
- Socket.IO
- Swagger

## 快速启动

### 本地启动

```bash
npm install
npm run start:dev
npm run seed:users
```

默认地址：

- API：`http://localhost:3000/api`
- 文档：`http://localhost:3000/api/docs`

### Docker 一体化联调（推荐）

```bash
docker compose up -d --build
docker exec lms-backend npm run seed:users
```

访问：`http://localhost:8080/api/docs`

## 演示账号

- 管理员：`admin001 / Admin@123456`
- 教师：`teacher001 / Teacher@123456`
- 学生：`student001 / Student@123456`

## 环境变量示例

```env
PORT=3000
MONGO_URL=mongodb://admin:admin@localhost:27017/lms_demo?authSource=admin
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=1d
UPLOADS_DIR=./uploads
```

## 常用命令

```bash
npm run start:dev
npm run build
npm run start:prod
npm run seed:users
npm run test
npm run lint
```
