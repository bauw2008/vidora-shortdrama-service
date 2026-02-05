# EdgeOne Edge Functions 部署指南

## 项目结构

```
vidora-shortdrama-service/
├── edge-functions/          # EdgeOne Edge Functions
│   └── api/
│       ├── health.js       # 健康检查
│       ├── list.js         # 视频列表
│       ├── detail.js       # 视频详情
│       ├── search.js       # 搜索
│       ├── play.js         # 播放链接
│       ├── categories.js   # 分类
│       └── admin/          # 管理 API
│           ├── stats.js
│           ├── sync.js
│           ├── backup.js
│           ├── api-config.js
│           └── api-logs.js
├── app/                    # Next.js 前端
└── lib/                    # 共享库
```

## 前置要求

1. 安装 EdgeOne CLI
```bash
npm install -g edgeone
```

2. 登录 EdgeOne
```bash
edgeone login
```

## 配置环境变量

在 EdgeOne Pages 项目中设置以下环境变量：

1. 访问 EdgeOne Pages 控制台
2. 进入项目设置 -> 环境变量
3. 添加以下变量：

```
NEXT_PUBLIC_SUPABASE_URL=https://fmuuefnplextwaufhawh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdXVlZm5wbGV4dHdhdWZoYXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODg4MzMsImV4cCI6MjA4NTY2NDgzM30.BlEg3gCSNzPC_6B9DtZIUkDcmIR1t7Q_CqwtuGbkYcE
ADMIN_API_KEY=3UF2hnRMXeNDABKhwYK4
```

## 本地开发

```bash
# 启动本地开发服务器
edgeone pages dev

# 访问 http://localhost:8080
```

## 部署

### 自动部署

将代码推送到 Git 仓库，EdgeOne Pages 会自动构建和部署。

### 手动部署

```bash
edgeone pages deploy
```

## API 端点

部署后，Edge Functions 将在以下路径可用：

### 公共 API 端点
- `GET /api/health` - 健康检查
- `GET /api/list` - 获取视频列表
- `GET /api/detail` - 获取视频详情
- `GET /api/search` - 搜索视频
- `GET /api/play` - 获取播放链接
- `GET /api/categories` - 获取分类

### 管理 API 端点（需要 ADMIN_API_KEY）
- `GET /api/admin/stats` - 获取统计数据
- `POST /api/admin/sync` - 启动同步
- `POST /api/admin/backup` - 备份/恢复数据
- `GET /api/admin/api-config` - 获取 API 配置
- `POST /api/admin/api-config` - 更新 API 配置
- `GET /api/admin/api-logs` - 获取 API 日志

## API 使用示例

### 公共 API 请求（带 API Key）
```bash
curl "https://your-domain.com/api/list?page=1&pageSize=20" \
  -H "X-API-Key: 3UF2hnRMXeNDABKhwYK4"
```

### 管理 API 请求（带 Admin API Key）
```bash
curl "https://your-domain.com/api/admin/stats" \
  -H "Authorization: Bearer 3UF2hnRMXeNDABKhwYK4"
```

## EdgeOne Edge Functions 特性

### Function Handlers

EdgeOne 使用 Function Handlers 模式：

- `onRequest(context)` - 处理所有 HTTP 方法
- `onRequestGet(context)` - 处理 GET 请求
- `onRequestPost(context)` - 处理 POST 请求
- `onRequestPut(context)` - 处理 PUT 请求
- `onRequestDelete(context)` - 处理 DELETE 请求

### Context 对象

```javascript
export async function onRequestGet(context) {
  const { request, params, env, waitUntil } = context;
  // request: Request 对象
  // params: 动态路由参数
  // env: 环境变量
  // waitUntil: 延迟 Promise 完成
}
```

### 路由规则

- `/edge-functions/index.js` → `/`
- `/edge-functions/api/list.js` → `/api/list`
- `/edge-functions/api/admin/stats.js` → `/api/admin/stats`
- `/edge-functions/api/[id].js` → `/api/:id`

### 使用限制

| 内容 | 限制 |
|------|------|
| 代码包大小 | 5 MB |
| 请求 body 大小 | 1 MB |
| CPU 时间 | 200 ms |
| 开发语言 | JavaScript (ES2023+) |

## 监控和日志

在 EdgeOne Pages 控制台查看函数日志和监控数据。

## 故障排查

1. **函数未响应**
   - 检查函数路径是否正确
   - 查看控制台日志

2. **数据库连接问题**
   - 确认环境变量已正确设置
   - 检查 Supabase 数据库状态

3. **权限问题**
   - 确认 API Key 正确
   - 检查 RLS 策略

## 注意事项

1. Edge Functions 有 CPU 时间限制（200ms）
2. 单个函数代码包最大 5MB
3. 请求 body 最大 1MB
4. 建议定期清理 `api_logs` 表