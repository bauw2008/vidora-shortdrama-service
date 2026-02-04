# Vidora 短剧中转服务

基于 Supabase + EdgeOne 的短剧资源中转服务。

## 特性

- 🎬 完整的短剧视频数据同步
- 🗄️ 使用 Supabase PostgreSQL 存储（免费额度 500MB）
- 🚀 EdgeOne Functions 部署
- 🔄 支持完整同步和增量同步
- 📦 二级分类系统（一级分类自定义 + 二级分类自动提取）
- 🔌 RESTful API 接口

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pnpm install
```

### 2. 配置 Supabase

1. 访问 [Supabase](https://supabase.com) 创建项目
2. 获取 `Project URL` 和 `anon key`
3. 在 Supabase SQL Editor 中执行 `lib/db/schema.sql` 文件

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
API_SOURCE_URL=https://api/api.php/provide/vod/
ADMIN_API_KEY=your-secret-api-key
```

### 4. 运行开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000/api/health 检查健康状态。

## API 端点

### 公开 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/categories` | GET | 获取分类列表 |
| `/api/list` | GET | 获取视频列表（分页） |
| `/api/search` | GET | 搜索视频 |
| `/api/detail/[id]` | GET | 获取视频详情 |
| `/api/play/[id]/[episode]` | GET | 获取播放链接 |

### 管理 API（需要 API Key）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/sync` | GET | 获取同步状态 |
| `/api/admin/sync` | POST | 触发同步 |

### API 使用示例

```bash
# 获取分类列表
curl http://localhost:3000/api/categories

# 获取视频列表
curl http://localhost:3000/api/list?page=1&pageSize=20

# 搜索视频
curl http://localhost:3000/api/search?keyword=总裁

# 获取视频详情
curl http://localhost:3000/api/detail/27196

# 获取播放链接
curl http://localhost:3000/api/play/27196/1

# 触发完整同步（需要 API Key）
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'

# 触发增量同步（最近 24 小时）
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"type": "incremental", "hours": 24}'
```

## 数据结构

### 分类系统

- **一级分类**：管理后台自定义（如"都市短剧"、"玄幻短剧"）
- **二级分类**：从 API 的 `vod_class` 字段自动提取（如"男频"、"都市"、"马甲"）
- **标签**：保存所有标签到 `tags` 字段

### 视频数据

```typescript
{
  vod_id: number;
  name: string;
  category_id: number;
  sub_category_id?: number;
  tags: string[];
  episode_count: number;
  cover: string;
  description: string;
  play_urls: [{ episode: number; url: string }];
  actor: string;
  area: string;
  year: string;
  updated_at: string;
}
```

## EdgeOne 部署

1. 在 EdgeOne 控制台创建新项目
2. 配置环境变量（参考 `.env.example`）
3. 上传代码或连接 GitHub 仓库
4. 部署并配置自定义域名

### 定时任务

系统配置了每天凌晨 2 点自动执行增量同步：

```json
{
  "crons": [
    {
      "path": "/api/admin/sync",
      "schedule": "0 2 * * *",
      "body": { "type": "incremental", "hours": 24 }
    }
  ]
}
```

## 项目结构

```
vidora-shortdrama-service/
├── app/
│   ├── api/
│   │   ├── health/           # 健康检查
│   │   ├── categories/       # 分类列表
│   │   ├── list/             # 视频列表
│   │   ├── search/           # 搜索
│   │   ├── detail/[id]/      # 视频详情
│   │   ├── play/[id]/[episode]/  # 播放链接
│   │   └── admin/
│   │       └── sync/         # 同步管理
│   └── layout.tsx
├── lib/
│   ├── supabase.ts           # Supabase 客户端
│   ├── db/
│   │   ├── operations.ts     # 数据库操作
│   │   └── schema.sql        # 数据库 Schema
│   ├── api-client.ts         # API 客户端
│   ├── parser.ts             # 数据解析
│   └── sync.ts               # 同步逻辑
├── edgeone.json              # EdgeOne 配置
├── package.json
└── .env.example
```

## 成本估算

- **Supabase**：免费额度（500MB 存储）
- **EdgeOne**：按实际使用量计费
- **总计**：可完全在免费额度内运行

## 注意事项

1. 首次部署需要先执行数据库 Schema（`lib/db/schema.sql`）
2. 完整同步需要较长时间（约 1-2 小时），建议在低峰期执行
3. 确保设置强密码作为 `ADMIN_API_KEY`
4. API 源可能有请求限制，建议使用增量同步

## License

MIT