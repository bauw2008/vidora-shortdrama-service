import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';

// 导入数据库操作
async function getDbOperations() {
  const { resetSyncStatus } = await import('@/lib/db/operations');
  return { resetSyncStatus };
}

// ============================================
// POST - 重置同步状态
// ============================================

export async function POST(request: Request) {
  try {
    // 验证认证
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const { resetSyncStatus } = await getDbOperations();
    await resetSyncStatus();

    return NextResponse.json({
      success: true,
      message: '同步状态已重置',
    });
  } catch (error) {
    console.error('重置同步状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '重置同步状态失败',
      },
      { status: 500 }
    );
  }
}