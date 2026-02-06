"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface Stats {
  totalVideos: number;
  totalCategories: number;
  totalSubCategories: number;
  todayUpdated: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const statsRes = await fetch("/api/admin-api/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      "⚠️ 警告：重置数据库\n\n" +
        "这将：\n" +
        "- 清空所有视频数据\n" +
        "- 清空所有分类数据\n" +
        "- 此操作不可恢复！\n\n" +
        "确定要重置吗？",
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      "⚠️ 最后确认：确定要清空所有数据吗？",
    );
    if (!doubleConfirmed) return;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        alert("数据库已重置");
        fetchData();
      } else {
        const data = await res.json();
        alert(`重置失败: ${data.error}`);
      }
    } catch (error) {
      console.error("重置失败:", error);
      alert("重置失败");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Vidora 短剧管理后台
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700"
            >
              退出登录
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  视频总数
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {stats?.totalVideos || 0}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  今日更新
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">
                  {stats?.todayUpdated || 0}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  一级分类
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {stats?.totalCategories || 0}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">
                  二级分类
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {stats?.totalSubCategories || 0}
                </dd>
              </div>
            </div>
          </div>

          {/* 同步说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-blue-900 mb-4">
                📅 同步说明
              </h3>
              <div className="space-y-2 text-sm text-blue-800">
                <p>
                  • <strong>增量同步</strong>：每天凌晨 2 点和早上 5
                  点自动执行（GitHub Actions）
                </p>
                <p>
                  • <strong>完整同步</strong>：手动触发，覆盖所有数据（GitHub
                  Actions）
                </p>
                <p>
                  • <strong>补充同步</strong>：手动触发，补充缺失数据（GitHub
                  Actions）
                </p>
                <p className="mt-4 text-xs text-blue-600">
                  请在 GitHub 仓库的 Actions 页面手动触发完整同步和补充同步
                </p>
              </div>
            </div>
          </div>

          {/* 快捷链接 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                管理功能
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push("/admin/sources")}
                  className="text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900">API 源管理</div>
                  <div className="text-sm text-gray-500">
                    管理视频数据 API 源
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/categories")}
                  className="text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900">分类管理</div>
                  <div className="text-sm text-gray-500">
                    管理一级分类和二级分类映射
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/field-config")}
                  className="text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900">API 字段配置</div>
                  <div className="text-sm text-gray-500">
                    配置 /list 和 /detail 接口返回字段
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/api-config")}
                  className="text-left px-4 py-3 border border-purple-300 rounded-md hover:bg-purple-50"
                >
                  <div className="font-medium text-purple-900">API 配置</div>
                  <div className="text-sm text-purple-500">
                    配置 API Key、认证开关和速率限制
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/ip-blacklist")}
                  className="text-left px-4 py-3 border border-red-300 rounded-md hover:bg-red-50"
                >
                  <div className="font-medium text-red-900">IP 黑名单</div>
                  <div className="text-sm text-red-500">
                    管理被封禁的 IP 地址
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/api-logs")}
                  className="text-left px-4 py-3 border border-green-300 rounded-md hover:bg-green-50"
                >
                  <div className="font-medium text-green-900">API 调用日志</div>
                  <div className="text-sm text-green-500">
                    查看 API 调用记录和统计
                  </div>
                </button>
                <button
                  onClick={handleReset}
                  className="text-left px-4 py-3 border border-red-300 rounded-md hover:bg-red-50"
                >
                  <div className="font-medium text-red-900">重置数据库</div>
                  <div className="text-sm text-red-500">
                    清空所有数据（⚠️ 危险操作）
                  </div>
                </button>
                <button
                  onClick={() => router.push("/admin/backup-restore")}
                  className="text-left px-4 py-3 border border-blue-300 rounded-md hover:bg-blue-50"
                >
                  <div className="font-medium text-blue-900">
                    数据备份与恢复
                  </div>
                  <div className="text-sm text-blue-500">
                    备份和恢复所有数据库数据
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
