import { NextResponse } from 'next/server';
import { batchUpdateVideoCategory } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { subCategoryId, categoryId } = body;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: '缺少 categoryId 参数' },
        { status: 400 }
      );
    }

    const count = await batchUpdateVideoCategory(categoryId, subCategoryId);

    return NextResponse.json({
      success: true,
      message: `成功更新 ${count} 个视频`,
      data: { count },
    });
  } catch (error) {
    console.error('批量更新失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '批量更新失败',
      },
      { status: 500 }
    );
  }
}