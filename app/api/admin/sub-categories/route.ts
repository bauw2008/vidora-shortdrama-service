import { NextResponse } from 'next/server';
import { getSubCategories } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const subCategories = await getSubCategories();

    return NextResponse.json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    console.error('获取二级分类失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取二级分类失败',
      },
      { status: 500 },
    );
  }
}
