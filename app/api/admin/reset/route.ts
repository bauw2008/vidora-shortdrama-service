import { NextResponse } from 'next/server';
import { clearVideos, clearSubCategories, resetSyncStatus } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// ============================================
// POST - 重置数据库
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

    // 清空视频数据
    const videosCleared = await clearVideos();
    console.log(`[Reset] 清空视频: ${videosCleared} 条`);

    // 清空二级分类
    const subCategoriesCleared = await clearSubCategories();
    console.log(`[Reset] 清空二级分类: ${subCategoriesCleared} 条`);

    // 重置同步状态
    await resetSyncStatus();
    console.log(`[Reset] 重置同步状态`);

    return NextResponse.json({
      success: true,
      message: '数据库已重置',
      data: {
        videosCleared,
        subCategoriesCleared,
      },
    });
  } catch (error) {
    console.error('重置数据库失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '重置数据库失败',
      },
      { status: 500 }
    );
  }
}