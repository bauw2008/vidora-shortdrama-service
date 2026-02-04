'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';

interface SyncStatus {
  id: number;
  is_syncing: boolean;
  sync_type: string;
  last_sync_time: string | null;
  total_videos: number;
  total_categories: number;
  current_page: number;
  total_pages: number;
  synced_count: number;
  updated_at: string;
}

interface Stats {
  totalVideos: number;
  totalCategories: number;
  totalSubCategories: number;
  todayUpdated: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const [statusRes, statsRes] = await Promise.all([
        fetch('/api/admin/sync', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statusRes.ok && statsRes.ok) {
        const statusData = await statusRes.json();
        const statsData = await statsRes.json();
        setSyncStatus(statusData.data.status);
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (
    type: 'full' | 'incremental' | 'resync' | 'continue',
  ) => {
    if (type === 'full') {
      const confirmed = window.confirm(
        '⚠️ 警告：完整同步（覆盖模式）\n\n' +
          '这将：\n' +
          '- 不清空现有数据\n' +
          '- 覆盖已存在的视频\n' +
          '- 添加新视频\n' +
          '- 预计耗时 15-20 分钟\n' +
          '- 消耗大量 API 流量\n\n' +
          '确定要继续吗？',
      );
      if (!confirmed) return;
    }

    if (type === 'resync') {
      const confirmed = window.confirm(
        '⚠️ 警告：补充同步\n\n' +
          '这将：\n' +
          '- 检查所有视频\n' +
          '- 补充缺失的视频\n' +
          '- 预计耗时 15-20 分钟\n' +
          '- 消耗大量 API 流量\n' +
          '- 占用服务器资源\n\n' +
          '确定要继续吗？',
      );
      if (!confirmed) return;
    }

    if (type === 'continue') {
      const confirmed = window.confirm(
        '✅ 继续上次未完成的同步\n\n' +
          '将从上次失败的页码继续同步，不会清空已有数据。\n\n' +
          '确定要继续吗？',
      );
      if (!confirmed) return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          forceRestart: type === 'continue' ? false : undefined,
        }),
      });

      if (res.ok) {
        const typeName =
          type === 'resync'
            ? '补充'
            : type === 'continue'
              ? '继续'
              : type === 'full'
                ? '完整'
                : '增量';
        alert(`${typeName}同步已启动`);
        fetchData();
      }
    } catch (error) {
      console.error('触发同步失败:', error);
      alert('同步启动失败');
    }
  };

  const handleResetSyncStatus = async () => {
    const confirmed = window.confirm(
      '重置同步状态\n\n' +
        '这将把同步状态重置为"空闲"，不会影响任何数据。\n\n' +
        '仅在同步状态异常时使用此功能。\n\n' +
        '确定要重置吗？',
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/reset-sync-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        alert('同步状态已重置');
        fetchData();
      } else {
        const data = await res.json();
        alert(`重置失败: ${data.error}`);
      }
    } catch (error) {
      console.error('重置同步状态失败:', error);
      alert('重置失败');
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      '⚠️ 警告：重置数据库\n\n' +
        '这将：\n' +
        '- 清空所有视频数据\n' +
        '- 清空所有分类数据\n' +
        '- 清空所有同步状态\n' +
        '- 此操作不可恢复！\n\n' +
        '确定要重置吗？',
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      '⚠️ 最后确认：确定要清空所有数据吗？',
    );
    if (!doubleConfirmed) return;

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        alert('数据库已重置');
        fetchData();
      } else {
        const data = await res.json();
        alert(`重置失败: ${data.error}`);
      }
    } catch (error) {
      console.error('重置失败:', error);
      alert('重置失败');
    }
  };

  const handleTestSync = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/test-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ count: 2 }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('测试同步结果:', data);

        // 下载文本文件
        if (data.data.downloadText) {
          const blob = new Blob([data.data.downloadText], {
            type: 'text/plain;charset=utf-8',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = data.data.filename || `test-sync-${Date.now()}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        alert(
          `测试同步完成！已获取 ${data.data.total} 个视频数据\n\n详细数据已下载为文本文件`,
        );
      } else {
        const errorData = await res.json();
        alert(`测试同步失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('测试同步失败:', error);
      alert('测试同步失败');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-gray-500'>加载中...</div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className='min-h-screen bg-gray-50'>
        <header className='bg-white shadow'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center'>
            <h1 className='text-2xl font-bold text-gray-900'>
              Vidora 短剧管理后台
            </h1>
            <button
              onClick={handleLogout}
              className='px-4 py-2 text-sm text-red-600 hover:text-red-700'
            >
              退出登录
            </button>
          </div>
        </header>

        <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
          {/* 统计卡片 */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8'>
            <div className='bg-white overflow-hidden shadow rounded-lg'>
              <div className='px-4 py-5 sm:p-6'>
                <dt className='text-sm font-medium text-gray-500 truncate'>
                  视频总数
                </dt>
                <dd className='mt-1 text-3xl font-semibold text-gray-900'>
                  {stats?.totalVideos || 0}
                </dd>
              </div>
            </div>
            <div className='bg-white overflow-hidden shadow rounded-lg'>
              <div className='px-4 py-5 sm:p-6'>
                <dt className='text-sm font-medium text-gray-500 truncate'>
                  今日更新
                </dt>
                <dd className='mt-1 text-3xl font-semibold text-green-600'>
                  {stats?.todayUpdated || 0}
                </dd>
              </div>
            </div>
            <div className='bg-white overflow-hidden shadow rounded-lg'>
              <div className='px-4 py-5 sm:p-6'>
                <dt className='text-sm font-medium text-gray-500 truncate'>
                  一级分类
                </dt>
                <dd className='mt-1 text-3xl font-semibold text-gray-900'>
                  {stats?.totalCategories || 0}
                </dd>
              </div>
            </div>
            <div className='bg-white overflow-hidden shadow rounded-lg'>
              <div className='px-4 py-5 sm:p-6'>
                <dt className='text-sm font-medium text-gray-500 truncate'>
                  二级分类
                </dt>
                <dd className='mt-1 text-3xl font-semibold text-gray-900'>
                  {stats?.totalSubCategories || 0}
                </dd>
              </div>
            </div>
          </div>

          {/* 同步状态 */}
          <div className='bg-white shadow rounded-lg mb-8'>
            <div className='px-4 py-5 sm:p-6'>
              <h3 className='text-lg leading-6 font-medium text-gray-900 mb-4'>
                同步状态
              </h3>
              <div className='space-y-4'>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>同步状态:</span>
                  <span
                    className={
                      syncStatus?.is_syncing
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }
                  >
                    {syncStatus?.is_syncing ? '同步中...' : '空闲'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>上次同步:</span>
                  <span className='text-gray-900'>
                    {syncStatus?.last_sync_time
                      ? new Date(syncStatus.last_sync_time).toLocaleString(
                          'zh-CN',
                        )
                      : '从未同步'}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span className='text-gray-600'>同步视频数:</span>
                  <span className='text-gray-900'>
                    {syncStatus?.total_videos || 0}
                  </span>
                </div>
              </div>

              <div className='mt-6 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 flex-wrap'>
                <button
                  onClick={() => handleSync('full')}
                  disabled={syncStatus?.is_syncing}
                  className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  完整同步（覆盖）
                </button>
                <button
                  onClick={() => handleSync('resync')}
                  disabled={syncStatus?.is_syncing}
                  className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  补充同步
                </button>
                {syncStatus?.is_syncing &&
                syncStatus?.sync_type === 'full' &&
                syncStatus?.current_page > 0 ? (
                  <button
                    onClick={() => handleSync('continue')}
                    disabled={syncStatus?.is_syncing}
                    className='px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    继续同步（第 {syncStatus.current_page} 页）
                  </button>
                ) : (
                  <button
                    onClick={handleTestSync}
                    disabled={syncStatus?.is_syncing}
                    className='px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    测试同步（2条）
                  </button>
                )}
                <button
                  onClick={() => handleSync('incremental')}
                  disabled={syncStatus?.is_syncing}
                  className='px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  增量同步（24小时）
                </button>
                {syncStatus?.is_syncing && (
                  <button
                    onClick={handleResetSyncStatus}
                    className='px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700'
                  >
                    重置同步状态
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 快捷链接 */}
          <div className='bg-white shadow rounded-lg'>
            <div className='px-4 py-5 sm:p-6'>
              <h3 className='text-lg leading-6 font-medium text-gray-900 mb-4'>
                管理功能
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <button
                  onClick={() => router.push('/admin/sources')}
                  className='text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  <div className='font-medium text-gray-900'>API 源管理</div>
                  <div className='text-sm text-gray-500'>
                    管理视频数据 API 源
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/categories')}
                  className='text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  <div className='font-medium text-gray-900'>分类管理</div>
                  <div className='text-sm text-gray-500'>
                    管理一级分类和二级分类映射
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/sync-schedules')}
                  className='text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  <div className='font-medium text-gray-900'>定时同步配置</div>
                  <div className='text-sm text-gray-500'>
                    配置自动增量同步任务
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/field-config')}
                  className='text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-gray-50'
                >
                  <div className='font-medium text-gray-900'>API 字段配置</div>
                  <div className='text-sm text-gray-500'>
                    配置 /list 和 /detail 接口返回字段
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/api-config')}
                  className='text-left px-4 py-3 border border-purple-300 rounded-md hover:bg-purple-50'
                >
                  <div className='font-medium text-purple-900'>API 配置</div>
                  <div className='text-sm text-purple-500'>
                    配置 API Key、认证开关和速率限制
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/ip-blacklist')}
                  className='text-left px-4 py-3 border border-red-300 rounded-md hover:bg-red-50'
                >
                  <div className='font-medium text-red-900'>IP 黑名单</div>
                  <div className='text-sm text-red-500'>
                    管理被封禁的 IP 地址
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/api-logs')}
                  className='text-left px-4 py-3 border border-green-300 rounded-md hover:bg-green-50'
                >
                  <div className='font-medium text-green-900'>API 调用日志</div>
                  <div className='text-sm text-green-500'>
                    查看 API 调用记录和统计
                  </div>
                </button>
                <button
                  onClick={handleReset}
                  disabled={syncStatus?.is_syncing}
                  className='text-left px-4 py-3 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <div className='font-medium text-red-900'>重置数据库</div>
                  <div className='text-sm text-red-500'>
                    清空所有数据（⚠️ 危险操作）
                  </div>
                </button>
                <button
                  onClick={() => router.push('/admin/backup-restore')}
                  disabled={syncStatus?.is_syncing}
                  className='text-left px-4 py-3 border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <div className='font-medium text-blue-900'>
                    数据备份与恢复
                  </div>
                  <div className='text-sm text-blue-500'>
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
