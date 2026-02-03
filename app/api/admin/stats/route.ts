import { NextResponse } from 'next/server';
import { getDatabaseStats } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const stats = await getDatabaseStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取统计数据失败',
      },
      { status: 500 }
    );
  }
}