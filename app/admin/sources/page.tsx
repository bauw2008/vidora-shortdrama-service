"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface ApiSource {
  id: string;
  name: string;
  url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<ApiSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSource, setNewSource] = useState({ name: "", url: "" });
  const [testing, setTesting] = useState<string | null>(null);

  const fetchSources = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/sources", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setSources(data.data);
      }
    } catch (error) {
      console.error("获取 API 源失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSource = async (url: string, id: string) => {
    setTesting(id);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/sources-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          alert(`测试成功！视频总数: ${data.data.total}`);
        } else {
          alert(`测试失败: ${data.error}`);
        }
      }
    } catch (error) {
      console.error("测试失败:", error);
      alert("测试失败");
    } finally {
      setTesting(null);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      alert("请填写完整信息");
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newSource),
      });

      if (res.ok) {
        alert("API 源创建成功");
        setShowAddModal(false);
        setNewSource({ name: "", url: "" });
        fetchSources();
      }
    } catch (error) {
      console.error("创建失败:", error);
      alert("创建失败");
    }
  };

  const handleActivateSource = async (id: string) => {
    if (!confirm("确定要激活此 API 源吗？这将停用其他所有 API 源。")) {
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/sources/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        alert("API 源已激活");
        fetchSources();
      }
    } catch (error) {
      console.error("激活失败:", error);
      alert("激活失败");
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm("确定要删除此 API 源吗？")) {
      return;
    }

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/admin/sources?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        alert("API 源已删除");
        fetchSources();
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败");
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-500">加载中...</div>
        </div>
      </AuthGuard>
    );
  }

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
              API 源管理
            </h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 操作按钮 */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              添加 API 源
            </button>
          </div>

          {/* API 源列表 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                API 源列表
              </h3>

              {sources.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无 API 源，请点击上方按钮添加
                </div>
              ) : (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between p-4 border rounded-md hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {source.name}
                          </span>
                          {source.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              激活中
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500 break-all">
                          {source.url}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          创建于{" "}
                          {new Date(source.created_at).toLocaleString("zh-CN")}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() =>
                            handleTestSource(source.url, source.id)
                          }
                          disabled={testing === source.id}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          {testing === source.id ? "测试中..." : "测试"}
                        </button>
                        {!source.is_active && (
                          <button
                            onClick={() => handleActivateSource(source.id)}
                            className="px-3 py-1 text-sm text-green-600 hover:text-green-700"
                          >
                            激活
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSource(source.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 使用说明 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">使用说明</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 可以添加多个 API 源，但同一时间只能激活一个</li>
              <li>• 激活新的 API 源会自动停用其他所有 API 源</li>
              <li>• 建议在激活前先测试 API 源是否可用</li>
              <li>• 数据同步时会使用当前激活的 API 源</li>
            </ul>
          </div>
        </main>

        {/* 添加 API 源弹窗 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                添加 API 源
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名称
                  </label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) =>
                      setNewSource({ ...newSource, name: e.target.value })
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="例如：默认视频源"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API 地址
                  </label>
                  <input
                    type="url"
                    value={newSource.url}
                    onChange={(e) =>
                      setNewSource({ ...newSource, url: e.target.value })
                    }
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="https://api.example.com/api.php/provide/vod/"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    API 地址应以 / 结尾
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSource}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
