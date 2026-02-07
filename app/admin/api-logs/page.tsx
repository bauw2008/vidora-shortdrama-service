"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface ApiLog {
  id: number;
  ip_address: string;
  api_endpoint: string;
  http_method: string;
  request_params: string | null;
  response_status: number;
  auth_validated: boolean;
  error_message: string | null;
  request_time: string;
  user_agent: string | null;
  remaining_minute: number | null;
  remaining_hourly: number | null;
  remaining_daily: number | null;
  response_time_ms: number | null;
  is_rate_limit_warning: boolean;
}

interface LogStats {
  totalCount: number;
  estimatedSizeMB: string;
  maxLogCount: number;
  autoCleanThreshold: number;
  autoCleanDays: number;
  timezone: string;
}

export default function ApiLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    ip: "",
    endpoint: "",
    status: "",
    isRateLimitWarning: "",
    startDate: "",
    endDate: "",
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== ""),
        ),
      });

      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/admin-api/api-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.data);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("获取日志失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSearch = () => {
    setPagination({ ...pagination, page: 1 });
    fetchLogs();
  };

  const handleCleanOldLogs = async () => {
    const days = prompt(
      "请输入要删除多少天之前的日志（例如：30 表示删除30天前的日志）：",
    );
    if (!days) return;

    const daysNum = parseInt(days);
    if (isNaN(daysNum) || daysNum < 1) {
      alert("请输入有效的天数");
      return;
    }

    // 使用配置的时区计算截止时间
    const timezone = stats?.timezone || "Asia/Shanghai";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";
    const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
    const localTime = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
    const nowInTimezone = new Date(`${localDate}T${localTime}`);
    nowInTimezone.setDate(nowInTimezone.getDate() - daysNum);
    const beforeDateStr = nowInTimezone.toISOString();

    const confirmed = window.confirm(
      `确定要删除 ${daysNum} 天之前的所有日志吗？\n\n` +
        `删除截止时间（${timezone}）： ${nowInTimezone.toLocaleString("zh-CN")}\n` +
        `此操作不可恢复！`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams({ beforeDate: beforeDateStr });

      const res = await fetch(`/api/admin-api/api-logs?${params}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // DELETE 请求可能返回 204，没有响应体
        let message = "清理成功";
        try {
          const data = await res.json();
          if (data.message) message = data.message;
        } catch (e) {
          // 忽略 JSON 解析错误
        }
        alert(message);
        fetchLogs();
      } else {
        const data = await res.json();
        alert(`清理失败: ${data.error}`);
      }
    } catch (error) {
      console.error("清理失败:", error);
      alert("清理失败");
    } finally {
      setDeleting(false);
    }
  };

  const handleAutoClean = async () => {
    if (!stats) return;

    const confirmed = window.confirm(
      `自动清理将删除最旧的日志，保留最多 ${stats.maxLogCount} 条记录。\n\n` +
        `当前记录数： ${stats.totalCount}\n` +
        `自动清理阈值： ${stats.autoCleanThreshold}\n` +
        `预计删除: ${Math.max(0, stats.totalCount - stats.maxLogCount)} 条\n\n` +
        `确定要执行自动清理吗？`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams({ autoClean: "true" });

      const res = await fetch(`/api/admin-api/api-logs?${params}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        alert(`自动清理完成，删除了 ${data.data.deletedCount} 条记录`);
        fetchLogs();
      } else {
        const data = await res.json();
        alert(`清理失败: ${data.error}`);
      }
    } catch (error) {
      console.error("清理失败:", error);
      alert("清理失败");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page]);

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return "bg-green-100 text-green-800";
    } else if (status >= 400 && status < 500) {
      return "bg-yellow-100 text-yellow-800";
    } else if (status >= 500) {
      return "bg-red-100 text-red-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push("/admin")}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              API 调用日志
            </h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {stats && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                存储统计
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">日志总数</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.totalCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">估算大小</div>
                  <div
                    className={`text-2xl font-bold ${parseFloat(stats.estimatedSizeMB) > 10 ? "text-red-600" : "text-green-600"}`}
                  >
                    {stats.estimatedSizeMB} MB
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">最大限制</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.maxLogCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">自动清理阈值</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {stats.autoCleanThreshold.toLocaleString()}
                  </div>
                </div>
              </div>
              {stats.totalCount > stats.autoCleanThreshold && (
                <div className="mt-4 flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <span className="text-sm text-yellow-800">
                    ⚠️ 日志数量接近上限，建议执行自动清理
                  </span>
                  <button
                    onClick={handleAutoClean}
                    disabled={deleting}
                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {deleting ? "清理中..." : "自动清理"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              筛选条件
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP 地址
                </label>
                <input
                  type="text"
                  value={filters.ip}
                  onChange={(e) => handleFilterChange("ip", e.target.value)}
                  placeholder="例如: 192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API 端点
                </label>
                <input
                  type="text"
                  value={filters.endpoint}
                  onChange={(e) =>
                    handleFilterChange("endpoint", e.target.value)
                  }
                  placeholder="例如: /api/list"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  响应状态
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全部</option>
                  <option value="200">200 成功</option>
                  <option value="400">400 请求错误</option>
                  <option value="401">401 未授权</option>
                  <option value="404">404 未找到</option>
                  <option value="429">429 限流</option>
                  <option value="500">500 服务器错误</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  限流警告
                </label>
                <select
                  value={filters.isRateLimitWarning}
                  onChange={(e) =>
                    handleFilterChange("isRateLimitWarning", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">全部</option>
                  <option value="true">仅限流警告</option>
                  <option value="false">无警告</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  开始日期
                </label>
                <input
                  type="datetime-local"
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  结束日期
                </label>
                <input
                  type="datetime-local"
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                搜索
              </button>
              <button
                onClick={() => {
                  setFilters({
                    ip: "",
                    endpoint: "",
                    status: "",
                    isRateLimitWarning: "",
                    startDate: "",
                    endDate: "",
                  });
                  setPagination({ ...pagination, page: 1 });
                  fetchLogs();
                }}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                重置
              </button>
              <button
                onClick={handleAutoClean}
                disabled={deleting}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "清理中..." : "自动清理"}
              </button>
              <button
                onClick={handleCleanOldLogs}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "清理中..." : "手动清理"}
              </button>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                日志记录 ({pagination.total})
              </h2>
            </div>

            {loading ? (
              <div className="p-6">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-500 text-center">暂无日志记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP 地址
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        API 端点
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        剩余配额
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        响应时间
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        错误信息
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className={log.is_rate_limit_warning ? "bg-red-50" : ""}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.request_time).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {log.ip_address}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {log.api_endpoint}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(log.response_status)}`}
                          >
                            {log.response_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          <div className="text-xs">
                            <div>分： {log.remaining_minute ?? "-"}</div>
                            <div>时： {log.remaining_hourly ?? "-"}</div>
                            <div>天： {log.remaining_daily ?? "-"}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {log.response_time_ms
                            ? `${log.response_time_ms}ms`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                          {log.error_message || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  第 {pagination.page} 页，共 {pagination.totalPages} 页（
                  {pagination.total} 条记录）
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page - 1,
                      })
                    }
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() =>
                      setPagination({
                        ...pagination,
                        page: pagination.page + 1,
                      })
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">使用说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>智能采样策略：只记录有价值的请求，减少存储占用</li>
              <li>
                始终记录：错误请求（4xx/5xx）、限流警告、认证失败、慢请求（大于3秒）
              </li>
              <li>
                采样记录：每100次成功请求记录1次，或每10分钟记录1次，或随机采样（1%）
              </li>
              <li>新IP首次访问会记录，之后按采样策略记录</li>
              <li>自动清理：当日志数量超过8万条时，系统会提示执行自动清理</li>
              <li>存储限制：最多保存10万条记录，估算大小控制在10MB以下</li>
              <li>手动清理：可以按日期范围清理指定天数之前的日志</li>
              <li>可以筛选"限流警告"来查看触发限流的记录（红色高亮）</li>
              <li>剩余配额显示每分钟、每小时、每天的剩余请求次数</li>
              <li>响应时间可以用于识别性能问题</li>
            </ul>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
