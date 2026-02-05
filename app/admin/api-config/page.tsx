"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";

export default function ApiConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState({
    api_key: "",
    auth_enabled: false,
    rate_limit_minute: 60,
    rate_limit_hourly: 1000,
    rate_limit_daily: 10000,
    timezone: "Asia/Shanghai",
    auto_clean_threshold: 80000,
    max_log_count: 100000,
  });
  const [newApiKey, setNewApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rateLimitSaving, setRateLimitSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error("获取配置失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApiKey = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ api_key: newApiKey }),
      });

      if (res.ok) {
        alert("API Key 已更新");
        setNewApiKey("");
        fetchConfig();
      } else {
        const data = await res.json();
        alert(`更新失败: ${data.error}`);
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateApiKey = async () => {
    const confirmed = window.confirm(
      "确定要自动生成新的 API Key 吗？这将替换当前的 API Key。",
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ generateApiKey: true }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data.api_key) {
          const content = `Vidora API Key
================

API Key: ${data.data.api_key}

生成时间: ${new Date().toLocaleString("zh-CN")}

请妥善保存此密钥，不要泄露给他人！
`;

          const blob = new Blob([content], {
            type: "text/plain;charset=utf-8",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `api-key-${Date.now()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          alert("新 API Key 已生成，请查看下载的文件");
        }
        fetchConfig();
      } else {
        const data = await res.json();
        alert(`生成失败: ${data.error}`);
      }
    } catch (error) {
      console.error("生成失败:", error);
      alert("生成失败");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAuth = async () => {
    const newStatus = !config.auth_enabled;
    const message = newStatus
      ? "开启认证后，所有 API 请求都需要提供有效的 API Key。确定要开启吗？"
      : "关闭认证后，API 将可以被公开访问。确定要关闭吗？";

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ auth_enabled: newStatus }),
      });

      if (res.ok) {
        setConfig({ ...config, auth_enabled: newStatus });
        alert(newStatus ? "认证已开启" : "认证已关闭");
      } else {
        const data = await res.json();
        alert(`更新失败: ${data.error}`);
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRateLimit = async () => {
    setRateLimitSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rate_limit_minute: config.rate_limit_minute,
          rate_limit_hourly: config.rate_limit_hourly,
          rate_limit_daily: config.rate_limit_daily,
        }),
      });

      if (res.ok) {
        alert("速率限制配置已更新");
      } else {
        const data = await res.json();
        alert(`更新失败: ${data.error}`);
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    } finally {
      setRateLimitSaving(false);
    }
  };

  const handleUpdateTimezone = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ timezone: config.timezone }),
      });

      if (res.ok) {
        console.log("时区已更新为:", config.timezone);
      }
    } catch (error) {
      console.error("更新时区失败:", error);
    }
  };

  const handleUpdateLogConfig = async () => {
    setRateLimitSaving(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/api-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auto_clean_threshold: config.auto_clean_threshold,
          max_log_count: config.max_log_count,
        }),
      });

      if (res.ok) {
        alert("日志配置已更新");
      } else {
        const data = await res.json();
        alert(`更新失败: ${data.error}`);
      }
    } catch (error) {
      console.error("更新失败:", error);
      alert("更新失败");
    } finally {
      setRateLimitSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push("/admin")}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">API 配置</h1>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <p className="text-gray-600">
              配置 API 访问密钥、认证开关和速率限制
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      🔐 API 认证开关
                    </h2>
                    <p className="text-gray-600 text-sm">
                      {config.auth_enabled
                        ? "认证已开启，所有 API 请求都需要提供有效的 API Key"
                        : "认证已关闭，API 可以被公开访问"}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleAuth}
                    disabled={saving}
                    className={`px-6 py-3 rounded-lg font-medium ${
                      config.auth_enabled
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-green-600 text-white hover:bg-green-700"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {saving
                      ? "切换中..."
                      : config.auth_enabled
                        ? "关闭认证"
                        : "开启认证"}
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  🔑 API Key 设置
                </h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前 API Key
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={config.api_key || "（未设置）"}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (config.api_key) {
                          navigator.clipboard.writeText(config.api_key);
                          alert("已复制到剪贴板");
                        }
                      }}
                      disabled={!config.api_key}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      复制
                    </button>
                    <button
                      onClick={handleGenerateApiKey}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      自动生成
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新 API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="输入新的 API Key"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <button
                      onClick={handleUpdateApiKey}
                      disabled={saving || !newApiKey}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "更新中..." : "更新"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  🌍 时区配置
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  选择系统使用的时区，用于日志记录和时间显示。默认为
                  Asia/Shanghai (UTC+8)。
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前时区
                  </label>
                  <select
                    value={config.timezone}
                    onChange={(e) =>
                      setConfig({ ...config, timezone: e.target.value })
                    }
                    onBlur={handleUpdateTimezone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                    <option value="Asia/Hong_Kong">
                      Asia/Hong_Kong (UTC+8)
                    </option>
                    <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                    <option value="Asia/Singapore">
                      Asia/Singapore (UTC+8)
                    </option>
                    <option value="America/New_York">
                      America/New_York (UTC-5/-4)
                    </option>
                    <option value="America/Los_Angeles">
                      America/Los_Angeles (UTC-8/-7)
                    </option>
                    <option value="Europe/London">
                      Europe/London (UTC+0/+1)
                    </option>
                    <option value="Europe/Paris">
                      Europe/Paris (UTC+1/+2)
                    </option>
                    <option value="Australia/Sydney">
                      Australia/Sydney (UTC+10/+11)
                    </option>
                    <option value="UTC">UTC (UTC+0)</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  📊 日志配置
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  配置日志自动清理的阈值和最大保留数量。
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      自动清理阈值（条）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.auto_clean_threshold}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          auto_clean_threshold:
                            parseInt(e.target.value) || 80000,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      超过此数量时提示自动清理
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      最大日志数量（条）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.max_log_count}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          max_log_count: parseInt(e.target.value) || 100000,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      自动清理后保留的最大数量
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleUpdateLogConfig}
                  disabled={rateLimitSaving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rateLimitSaving ? "更新中..." : "更新日志配置"}
                </button>
              </div>

              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  ⚡ 速率限制配置
                </h2>
                <p className="text-gray-600 text-sm mb-4">
                  限制每个 IP 地址的 API
                  调用频率，防止恶意请求。始终生效，不受认证开关影响。
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      每分钟限制（次）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.rate_limit_minute}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rate_limit_minute: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      每小时限制（次）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.rate_limit_hourly}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rate_limit_hourly: parseInt(e.target.value) || 1000,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      每天限制（次）
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.rate_limit_daily}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rate_limit_daily: parseInt(e.target.value) || 10000,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleUpdateRateLimit}
                  disabled={rateLimitSaving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rateLimitSaving ? "更新中..." : "更新速率限制"}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  📖 使用说明
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>关闭认证后，API 可以被公开访问，适合测试环境</li>
                  <li>开启认证后，调用方需要在请求头中提供 API Key</li>
                  <li>
                    请求头格式:{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      Authorization: Bearer YOUR_API_KEY
                    </code>
                  </li>
                  <li>建议使用自动生成的 API Key，定期更换以提高安全性</li>
                  <li>
                    速率限制始终生效，不受认证开关影响，每个 IP 地址独立计算
                  </li>
                  <li>超过限制后，API 将返回 429 错误（Too Many Requests）</li>
                </ul>
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
