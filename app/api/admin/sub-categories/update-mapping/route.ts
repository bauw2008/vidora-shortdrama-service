import { NextResponse } from 'next/server';
import { updateSubCategoryCategory } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { subCategoryId, categoryId } = body;

    if (!subCategoryId || !categoryId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 },
      );
    }

    await updateSubCategoryCategory(subCategoryId, categoryId);

    return NextResponse.json({
      success: true,
      message: '映射更新成功',
    });
  } catch (error) {
    console.error('更新映射失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新映射失败',
      },
      { status: 500 },
    );
  }
}
