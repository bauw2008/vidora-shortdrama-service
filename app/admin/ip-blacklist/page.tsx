"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface BlacklistEntry {
  id: number;
  ip_address: string;
  reason: string;
  created_at: string;
}

export default function IpBlacklistPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchEntries();
  }, [pagination.page]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `/api/admin-api/ip-blacklist?page=${pagination.page}&pageSize=${pagination.pageSize}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const data = await res.json();
        setEntries(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("获取黑名单失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newIp) {
      alert("请输入 IP 地址");
      return;
    }

    setAdding(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/ip-blacklist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ip_address: newIp, reason: newReason }),
      });

      if (res.ok) {
        alert("IP 已添加到黑名单");
        setNewIp("");
        setNewReason("");
        fetchEntries();
      } else {
        const data = await res.json();
        alert(`添加失败: ${data.error}`);
      }
    } catch (error) {
      console.error("添加失败:", error);
      alert("添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (ip: string) => {
    const confirmed = window.confirm(`确定要将 ${ip} 从黑名单移除吗？`);
    if (!confirmed) return;

    setDeleting(Date.now());
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/ip-blacklist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ip_address: ip }),
      });

      if (res.ok) {
        alert("IP 已从黑名单移除");
        fetchEntries();
      } else {
        const data = await res.json();
        alert(`移除失败: ${data.error}`);
      }
    } catch (error) {
      console.error("移除失败:", error);
      alert("移除失败");
    } finally {
      setDeleting(null);
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
              IP 黑名单管理
            </h1>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <p className="text-gray-600">管理被禁止访问 API 的 IP 地址</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              🚫 添加 IP 到黑名单
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IP 地址
                </label>
                <input
                  type="text"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  placeholder="例如: 192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  封禁原因（可选）
                </label>
                <input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="例如: 恶意请求"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAdd}
                  disabled={adding || !newIp}
                  className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? "添加中..." : "添加到黑名单"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                黑名单列表 ({pagination.total})
              </h2>
            </div>

            {loading ? (
              <div className="p-6">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-500 text-center">黑名单为空</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP 地址
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        封禁原因
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        添加时间
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {entry.ip_address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.reason || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(entry.created_at).toLocaleString("zh-CN")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(entry.ip_address)}
                            disabled={deleting !== null}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            移除
                          </button>
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
                  第 {pagination.page} 页，共 {pagination.totalPages} 页
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

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ 注意事项
            </h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>IP 黑名单仅在 API 认证开启时生效</li>
              <li>被封禁的 IP 访问任何 API 都会被直接拒绝</li>
              <li>封禁操作是立即生效的，无需重启服务</li>
              <li>请谨慎使用 IP 黑名单，避免误封正常用户</li>
            </ul>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}