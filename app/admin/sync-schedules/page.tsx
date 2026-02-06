"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

interface SyncSchedule {
  id: number;
  name: string;
  hour: number;
  minute: number;
  is_active: boolean;
  last_run_time: string | null;
  next_run_time: string | null;
  created_at: string;
  updated_at: string;
}

export default function SyncSchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<SyncSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<SyncSchedule | null>(
    null,
  );
  const [formData, setFormData] = useState({ name: "", hour: 2, minute: 0 });
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/sync-schedules", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSchedules(data.data);
      }
    } catch (error) {
      console.error("获取定时同步配置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      let res;

      if (editingSchedule) {
        res = await fetch("/api/admin-api/sync-schedules", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: editingSchedule.id,
            ...formData,
          }),
        });
      } else {
        res = await fetch("/api/admin-api/sync-schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });
      }

      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setEditingSchedule(null);
        setFormData({ name: "", hour: 2, minute: 0 });
        fetchSchedules();
        alert(editingSchedule ? "更新成功" : "创建成功");
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("操作失败:", error);
      alert("操作失败");
    }
  };

  const handleEdit = (schedule: SyncSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      hour: schedule.hour,
      minute: schedule.minute,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个定时同步配置吗？")) return;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`/api/admin-api/sync-schedules?id=${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
        alert("删除成功");
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("删除失败:", error);
      alert("删除失败");
    }
  };

  const handleInitDefault = async () => {
    if (
      !confirm(
        "确定要初始化默认定时同步配置吗？\n\n这将添加：\n- 凌晨增量同步（2:00）\n- 早晨增量同步（6:00）",
      )
    )
      return;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/init-sync-schedules", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
        alert("初始化成功");
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("初始化失败:", error);
      alert("初始化失败");
    }
  };

  const handleGenerateCronSecret = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/generate-cron-secret", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedSecret(data.secret);
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("生成密钥失败:", error);
      alert("生成密钥失败");
    }
  };

  const handleToggleActive = async (schedule: SyncSchedule) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin-api/sync-schedules", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: schedule.id,
          is_active: !schedule.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    }
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN");
  };

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
              定时同步配置
            </h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex space-x-3">
            <button
              onClick={() => {
                setShowAddModal(true);
                setEditingSchedule(null);
                setFormData({ name: "", hour: 2, minute: 0 });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              添加定时同步
            </button>
            <button
              onClick={handleGenerateCronSecret}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              生成 CRON_SECRET
            </button>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    名称
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    执行时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    上次运行
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    下次运行
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {schedule.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(schedule.hour, schedule.minute)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => handleToggleActive(schedule)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          schedule.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {schedule.is_active ? "已启用" : "已禁用"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(schedule.last_run_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(schedule.next_run_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {schedules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <p className="text-sm text-gray-500 mb-4">
                        暂无定时同步配置
                      </p>
                      <button
                        onClick={handleInitDefault}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        初始化默认配置（凌晨2:00 + 早晨6:00）
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>

        {/* 添加/编辑模态框 */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingSchedule ? "编辑定时同步" : "添加定时同步"}
                </h3>
              </div>
              <form onSubmit={handleSubmit} className="px-6 py-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    名称
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例如：凌晨增量同步"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    执行时间（小时）
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.hour}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hour: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">0-23</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    执行时间（分钟）
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.minute}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minute: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">0-59</p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingSchedule(null);
                      setFormData({ name: "", hour: 2, minute: 0 });
                    }}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    {editingSchedule ? "更新" : "添加"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CRON_SECRET 显示弹窗 */}
        {generatedSecret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  已生成 CRON_SECRET
                </h3>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600 mb-4">
                  请复制以下密钥，然后在 GitHub 仓库的 Secrets 中配置：
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CRON_SECRET
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={generatedSecret}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    配置步骤
                  </label>
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                    <li>进入 GitHub 仓库设置</li>
                    <li>Settings → Secrets and variables → Actions</li>
                    <li>点击 "New repository secret"</li>
                    <li>
                      Name:{" "}
                      <code className="bg-gray-100 px-1 rounded">
                        CRON_SECRET
                      </code>
                    </li>
                    <li>Value: 粘贴上面的密钥</li>
                    <li>点击 Add secret</li>
                  </ol>
                </div>
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setGeneratedSecret(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}