import { NextResponse } from 'next/server';
import { activateApiSource } from '@/lib/db/operations';
import sourceClient from '@/lib/api-client';
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 API 源 ID' },
        { status: 400 }
      );
    }

    // 激活指定的 API 源
    await activateApiSource(id);

    // 清除客户端缓存
    sourceClient.clearApiUrlCache();

    return NextResponse.json({
      success: true,
      message: 'API 源已激活',
    });
  } catch (error) {
    console.error('激活 API 源失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '激活 API 源失败',
      },
      { status: 500 }
    );
  }
}