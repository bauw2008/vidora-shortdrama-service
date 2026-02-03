import { NextResponse } from 'next/server';
import { sourceClient } from '@/lib/api-client';
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
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: '缺少 URL' },
        { status: 400 }
      );
    }

    // 测试 API 连接
    const testUrl = `${url}?ac=list&pagesize=1`;

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.code === 1) {
          return NextResponse.json({
            success: true,
            message: 'API 连接成功',
            data: {
              total: data.total || 0,
            },
          });
        } else {
          return NextResponse.json({
            success: false,
            error: `API 返回错误: ${data.msg || '未知错误'}`,
          });
        }
      } else {
        return NextResponse.json({
          success: false,
          error: `HTTP 错误: ${response.status}`,
        });
      }
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  } catch (error) {
    console.error('测试 API 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '测试 API 失败',
      },
      { status: 500 }
    );
  }
}