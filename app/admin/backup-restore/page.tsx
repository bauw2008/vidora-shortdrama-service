"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface RestoreResult {
  table?: string;
  inserted: number;
  failed: number;
  total?: number;
}

interface BackupRestorePageProps {}

export default function BackupRestorePage({}: BackupRestorePageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState("videos");
  const [clearBeforeRestore, setClearBeforeRestore] = useState(false);

  const tables = [
    {
      id: "categories",
      name: "一级分类 (categories)",
      icon: "📁",
      fields: ["id", "name", "sort", "is_active", "created_at"],
    },
    {
      id: "sub_categories",
      name: "二级分类 (sub_categories)",
      icon: "📂",
      fields: ["id", "name", "category_id", "created_at"],
    },
    {
      id: "videos",
      name: "视频数据 (videos)",
      icon: "🎬",
      fields: [
        "vod_id",
        "name",
        "category_id",
        "",
        "tags",
        "episode_count",
        "cover",
        "description",
        "play_urls",
        "actor",
        "director",
        "writer",
        "area",
        "lang",
        "year",
        "remarks",
        "hits",
        "hits_day",
        "hits_week",
        "hits_month",
        "up",
        "down",
        "score",
        "score_num",
        "updated_at",
        "added_at",
        "synced_at",
      ],
    },
    {
      id: "api_sources",
      name: "API 源配置 (api_sources)",
      icon: "🔌",
      fields: ["id", "name", "url", "is_active", "created_at", "updated_at"],
    },
    {
      id: "sync_schedules",
      name: "定时同步配置 (sync_schedules)",
      icon: "⏰",
      fields: [
        "id",
        "name",
        "hour",
        "minute",
        "is_active",
        "last_run_time",
        "next_run_time",
        "created_at",
        "updated_at",
      ],
    },
    {
      id: "api_config",
      name: "API 配置 (api_config)",
      icon: "🔐",
      fields: [
        "id",
        "api_key",
        "auth_enabled",
        "rate_limit_minute",
        "rate_limit_hourly",
        "rate_limit_daily",
        "updated_at",
      ],
    },
    {
      id: "ip_blacklist",
      name: "IP 黑名单 (ip_blacklist)",
      icon: "🚫",
      fields: ["id", "ip_address", "reason", "created_at"],
    },
    {
      id: "api_logs",
      name: "API 调用日志 (api_logs)",
      icon: "📊",
      fields: [
        "id",
        "ip_address",
        "api_endpoint",
        "http_method",
        "request_params",
        "response_status",
        "auth_validated",
        "error_message",
        "request_time",
        "user_agent",
        "remaining_minute",
        "remaining_hourly",
        "remaining_daily",
        "response_time_ms",
        "is_rate_limit_warning",
      ],
    },
  ];

  const handleBackup = async (table: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams({
        format: "csv",
        table: table,
      });

      const res = await fetch(`/api/admin/backup?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename =
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="(.+)"/)?.[1] || `${table}_backup.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("备份失败");
      }
    } catch (error) {
      console.error("备份失败:", error);
      alert("备份失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (
    e: React.ChangeEvent<HTMLInputElement>,
    table: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "⚠️ 警告：恢复数据\n\n" +
        `这将：\n` +
        `- 从备份文件恢复表 "${table}"\n` +
        `- 已存在的记录将被覆盖\n\n` +
        "确定要继续吗？",
    );
    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setRestoring(true);
    setRestoreResult(null);

    try {
      const token = localStorage.getItem("admin_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("table", table);
      if (clearBeforeRestore) {
        formData.append("clearBeforeRestore", "true");
      }

      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setRestoreResult(data.data);
      } else {
        alert(`恢复失败: ${data.error}`);
      }
    } catch (error) {
      console.error("恢复失败:", error);
      alert("恢复失败");
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push("/admin")}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              数据备份与恢复
            </h1>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <p className="text-gray-600">单表 CSV 备份和恢复</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📋 单表备份
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => (
                <div
                  key={table.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-2">{table.icon}</span>
                      <span className="font-medium text-gray-900 text-sm">
                        {table.name}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">字段列表：</p>
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                      {table.fields.map((field) => (
                        <code
                          key={field}
                          className="inline-block mr-1 mb-1 px-1 py-0.5 bg-gray-200 rounded text-xs"
                        >
                          {field}
                        </code>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleBackup(table.id)}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下载 CSV
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              📥 数据恢复
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择要恢复的表
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="mb-4 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.icon} {table.name}
                  </option>
                ))}
              </select>

              <label className="block mb-4">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleRestore(e, selectedTable)}
                  disabled={restoring}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-green-50 file:text-green-700
                    hover:file:bg-green-100
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>

              <label className="flex items-center mb-4">
                <input
                  type="checkbox"
                  checked={clearBeforeRestore}
                  onChange={(e) => setClearBeforeRestore(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  恢复前清空表数据（⚠️ 将删除所有现有数据）
                </span>
              </label>
            </div>
          </div>

          {restoreResult && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                ✅ 恢复结果
              </h2>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">{restoreResult.table}</span>
                <div className="flex gap-4">
                  <span className="text-green-600 font-medium">
                    成功: {restoreResult.inserted}
                  </span>
                  {restoreResult.failed > 0 && (
                    <span className="text-red-600 font-medium">
                      失败: {restoreResult.failed}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                总计: {restoreResult.total} 条记录
                {restoreResult.cleared && (
                  <span className="ml-2 text-red-600 font-medium">
                    （已清空旧数据）
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ 重要提示
            </h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>CSV 格式：一行一条记录，适合大数据量</li>
              <li>恢复操作使用 upsert，已存在的记录会被覆盖</li>
              <li>建议定期备份，防止数据丢失</li>
              <li className="font-semibold mt-2">
                恢复顺序（有外键依赖关系）：
              </li>
              <ol className="list-decimal list-inside ml-4 space-y-1">
                <li>
                  第一步：恢复 <strong>categories</strong>（一级分类）
                </li>
                <li>
                  第二步：恢复 <strong>sub_categories</strong>（二级分类，依赖
                  categories）
                </li>
                <li>
                  第三步：恢复 <strong>videos</strong>（视频数据，依赖
                  sub_categories）
                </li>
              </ol>
              <li className="text-xs mt-1">⚠️ 如果顺序错误会报外键约束错误</li>
            </ul>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
