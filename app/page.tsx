export default function HomePage() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3010';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold mb-2">Vidora 短剧数据服务 API</h1>
          <p className="text-blue-100 text-lg">数据接口文档</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Introduction */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">API 简介</h2>
          <p className="text-gray-600 mb-4">
            Vidora 短剧数据服务提供标准化的 RESTful API，用于获取短剧视频数据。
            所有接口均返回 JSON 格式数据，支持分页、分类筛选和搜索功能。
          </p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
            <p className="text-blue-900 font-medium">
              📌 基础 URL: <code className="bg-blue-100 px-2 py-1 rounded">{baseUrl}/api</code>
            </p>
          </div>
        </section>

        {/* API Endpoints */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">API 认证</h2>
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <p className="text-yellow-900 font-medium mb-2">
              ⚠️ 所有 API 端点（除 /health 外）都需要提供有效的 API Key
            </p>
            <p className="text-yellow-800 text-sm">
              请在请求头中添加 <code className="bg-yellow-100 px-1 rounded">Authorization: Bearer YOUR_API_KEY</code>
            </p>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-4">API 端点</h3>

          {/* Health Check */}
          <div className="mb-8 border-b pb-8">
            <div className="flex items-center mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-2">GET</span>
              <code className="text-lg font-mono text-gray-800">/api/health</code>
            </div>
            <p className="text-gray-600 mb-3">健康检查接口，用于验证服务是否正常运行。</p>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm font-mono text-gray-700">
                响应示例: {`{"success": true, "status": "healthy", "timestamp": "..."}`}
              </p>
            </div>
          </div>

          {/* Video List */}
          <div className="mb-8 border-b pb-8">
            <div className="flex items-center mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-2">GET</span>
              <code className="text-lg font-mono text-gray-800">/list</code>
            </div>
            <p className="text-gray-600 mb-3">获取视频列表（精简字段）。</p>
            <div className="mb-4">
              <p className="font-medium text-gray-700 mb-2">查询参数:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">page</code> - 页码（默认: 1）</li>
                <li><code className="bg-gray-100 px-1 rounded">pageSize</code> - 每页数量（默认: 20，最大: 100）</li>
                <li><code className="bg-gray-100 px-1 rounded">categoryId</code> - 一级分类 ID（可选）</li>
                <li><code className="bg-gray-100 px-1 rounded">subCategoryId</code> - 二级分类 ID（可选）</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-500 mb-2">请求示例 (curl):</p>
              <p className="text-xs font-mono text-gray-700 break-all whitespace-pre-wrap">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     "${baseUrl}/api/list?page=1&pageSize=20"`}
              </p>
            </div>
          </div>

          {/* Video Detail */}
          <div className="mb-8 border-b pb-8">
            <div className="flex items-center mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-2">GET</span>
              <code className="text-lg font-mono text-gray-800">/detail/:id</code>
            </div>
            <p className="text-gray-600 mb-3">获取视频详情（完整字段）。</p>
            <div className="mb-4">
              <p className="font-medium text-gray-700 mb-2">路径参数:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">id</code> - 视频 vod_id</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-500 mb-2">请求示例 (curl):</p>
              <p className="text-xs font-mono text-gray-700 break-all whitespace-pre-wrap">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     "${baseUrl}/api/detail/27196"`}
              </p>
            </div>
          </div>

          {/* Categories */}
          <div className="mb-8 border-b pb-8">
            <div className="flex items-center mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-2">GET</span>
              <code className="text-lg font-mono text-gray-800">/categories</code>
            </div>
            <p className="text-gray-600 mb-3">获取所有一级分类。</p>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-500 mb-2">请求示例 (curl):</p>
              <p className="text-xs font-mono text-gray-700 break-all whitespace-pre-wrap">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     "${baseUrl}/api/categories"`}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-8">
            <div className="flex items-center mb-3">
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-2">GET</span>
              <code className="text-lg font-mono text-gray-800">/search</code>
            </div>
            <p className="text-gray-600 mb-3">搜索视频（支持标题和描述）。</p>
            <div className="mb-4">
              <p className="font-medium text-gray-700 mb-2">查询参数:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">keyword</code> - 搜索关键词（必需）</li>
                <li><code className="bg-gray-100 px-1 rounded">page</code> - 页码（默认: 1）</li>
                <li><code className="bg-gray-100 px-1 rounded">pageSize</code> - 每页数量（默认: 20，最大: 100）</li>
              </ul>
            </div>
            <div className="bg-gray-50 rounded p-4">
              <p className="text-sm text-gray-500 mb-2">请求示例 (curl):</p>
              <p className="text-xs font-mono text-gray-700 break-all whitespace-pre-wrap">
{`curl -H "Authorization: Bearer YOUR_API_KEY" \\
     "${baseUrl}/api/search?keyword=总裁&page=1&pageSize=20"`}
              </p>
            </div>
          </div>
        </section>

        {/* Response Format */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">响应格式</h2>
          <div className="bg-gray-50 rounded p-4">
            <pre className="text-sm text-gray-700 overflow-x-auto">
{`{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 26970,
    "totalPages": 1349
  }
}`}
            </pre>
          </div>
        </section>

        {/* List Fields */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">列表返回字段</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-bold text-green-900 mb-2">视频列表（/list）</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• vod_id - 视频 ID</li>
                <li>• name - 片名</li>
                <li>• category_id - 一级分类 ID</li>
                <li>• sub_category_id - 二级分类 ID</li>
                <li>• tags - 标签数组</li>
                <li>• episode_count - 总集数</li>
                <li>• cover - 海报图片</li>
                <li>• score - 评分</li>
                <li>• score_num - 评分人数</li>
                <li>• hits - 点击数</li>
                <li>• updated_at - 更新时间</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-bold text-blue-900 mb-2">视频详情（/detail）</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 包含列表所有字段</li>
                <li>• description - 简介</li>
                <li>• play_urls - 播放链接数组</li>
                <li>• actor - 演员</li>
                <li>• director - 导演</li>
                <li>• writer - 编剧</li>
                <li>• area - 地区</li>
                <li>• lang - 语言</li>
                <li>• year - 年份</li>
                <li>• hits_day - 日点击</li>
                <li>• hits_week - 周点击</li>
                <li>• hits_month - 月点击</li>
                <li>• up - 点赞数</li>
                <li>• down - 下载数</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Error Codes */}
        <section className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">错误码</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">状态码</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm"><code className="bg-red-100 px-1 rounded">200</code></td>
                  <td className="px-4 py-3 text-sm text-gray-700">成功</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm"><code className="bg-yellow-100 px-1 rounded">400</code></td>
                  <td className="px-4 py-3 text-sm text-gray-700">请求参数错误</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm"><code className="bg-yellow-100 px-1 rounded">404</code></td>
                  <td className="px-4 py-3 text-sm text-gray-700">资源不存在</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm"><code className="bg-red-100 px-1 rounded">500</code></td>
                  <td className="px-4 py-3 text-sm text-gray-700">服务器内部错误</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm"><code className="bg-red-100 px-1 rounded">503</code></td>
                  <td className="px-4 py-3 text-sm text-gray-700">服务不可用</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">注意事项</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>所有接口需认证访问</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>建议客户端实现缓存机制，减少重复请求</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>分页参数 page 从 1 开始</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>播放链接格式: <code>{`[{"episode": 1, "url": "https://..."}, ...]`}</code></span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-2">•</span>
              <span>数据更新频率: 每日定时同步</span>
            </li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400">© 2026 Vidora 短剧数据服务</p>
            <p className="text-gray-400 mt-2 md:mt-0">API Version: 1.0</p>
          </div>
        </div>
      </footer>
    </div>
  );
}