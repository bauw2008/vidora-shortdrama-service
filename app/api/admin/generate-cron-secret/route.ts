import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 验证管理员认证
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    // 生成一个安全的随机密钥（32字节，转换为十六进制字符串）
    const secret = randomBytes(32).toString('hex');
    
    return NextResponse.json({
      success: true,
      secret: secret,
      message: '已生成新的 CRON_SECRET，请在 GitHub Secrets 中设置此值',
    });
  } catch (error) {
    console.error('生成 CRON_SECRET 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '生成密钥失败',
      },
      { status: 500 }
    );
  }
}