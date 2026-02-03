'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';

interface FieldConfig {
  id: number;
  api_endpoint: string;
  field_name: string;
  field_label: string;
  is_enabled: boolean;
  is_required: boolean;
  display_order: number;
}

export default function FieldConfigPage() {
  const router = useRouter();
  const [apiEndpoint, setApiEndpoint] = useState<'list' | 'detail'>('list');
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, [apiEndpoint]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(
        `/api/admin/field-config?apiEndpoint=${apiEndpoint}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (data.success) {
        setConfigs(data.data);
      }
    } catch (error) {
      console.error('获取字段配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, field: 'is_enabled' | 'is_required') => {
    const config = configs.find((c) => c.id === id);
    if (!config) return;

    const newValue = !config[field];

    // 乐观更新
    setConfigs(
      configs.map((c) =>
        c.id === id ? { ...c, [field]: newValue } : c
      )
    );

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/field-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          [field]: newValue,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        // 回滚
        setConfigs(configs.map((c) =>
          c.id === id ? { ...c, [field]: !newValue } : c
        ));
        alert('更新失败');
      }
    } catch (error) {
      console.error('更新字段配置失败:', error);
      // 回滚
      setConfigs(configs.map((c) =>
        c.id === id ? { ...c, [field]: !newValue } : c
      ));
      alert('更新失败');
    }
  };

  const handleOrderChange = async (id: number, newOrder: number) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/field-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id,
          display_order: newOrder,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchConfigs();
      } else {
        alert('更新失败');
      }
    } catch (error) {
      console.error('更新字段配置失败:', error);
      alert('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const moveField = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === configs.length - 1) return;

    const newConfigs = [...configs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // 交换顺序
    [newConfigs[index].display_order, newConfigs[targetIndex].display_order] = [
      newConfigs[targetIndex].display_order,
      newConfigs[index].display_order,
    ];

    // 更新 UI
    newConfigs.sort((a, b) => a.display_order - b.display_order);
    setConfigs(newConfigs);

    // 保存到服务器
    try {
      const token = localStorage.getItem('admin_token');
      await fetch('/api/admin/field-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: newConfigs[index].id,
          display_order: newConfigs[index].display_order,
        }),
      });
      await fetch('/api/admin/field-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: newConfigs[targetIndex].id,
          display_order: newConfigs[targetIndex].display_order,
        }),
      });
    } catch (error) {
      console.error('更新字段顺序失败:', error);
      await fetchConfigs();
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={() => router.push('/admin')}
              className="text-indigo-600 hover:text-indigo-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              API 字段配置
            </h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <p className="text-gray-600">
              配置视频列表和详情接口返回的字段
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex space-x-4">
              <button
                onClick={() => setApiEndpoint('list')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  apiEndpoint === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                视频列表 (/list)
              </button>
              <button
                onClick={() => setApiEndpoint('detail')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  apiEndpoint === 'detail'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                视频详情 (/detail)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {apiEndpoint === 'list' ? '视频列表' : '视频详情'}字段
              </h2>
            </div>

            {loading ? (
              <div className="px-6 py-8 text-center text-gray-500">
                加载中...
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {configs.map((config, index) => (
                  <div
                    key={config.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => moveField(index, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveField(index, 'down')}
                          disabled={index === configs.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {config.field_label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {config.field_name}
                        </div>
                      </div>

                      {config.is_required && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          必需
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={config.is_enabled}
                          onChange={() => handleToggle(config.id, 'is_enabled')}
                          className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          disabled={config.is_required}
                        />
                        <span className="ml-2 text-sm text-gray-700">启用</span>
                      </label>

                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={config.is_required}
                          onChange={() => handleToggle(config.id, 'is_required')}
                          className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          disabled={config.is_required}
                        />
                        <span className="ml-2 text-sm text-gray-700">必需</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>提示:</strong>
            </p>
            <ul className="mt-2 text-sm text-blue-800 space-y-1">
              <li>启用/禁用字段可以控制 API 返回的数据内容</li>
              <li>必需字段无法禁用</li>
              <li>使用上下箭头调整字段在返回数据中的顺序</li>
              <li>修改后立即生效，无需重启服务</li>
            </ul>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}