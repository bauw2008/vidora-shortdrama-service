import { NextResponse } from 'next/server';
import { incrementalSync } from '@/lib/sync';

// 管理员认证
async function verifyAdminAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return false;
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username] = decoded.split(':');
    return username === process.env.ADMIN_USERNAME;
  } catch {
    return false;
  }
}

// 定时同步 API 端点
// 可以由外部 cron 服务（如 Vercel Cron、GitHub Actions）定期调用
export async function POST(request: Request) {
  // 可选：验证请求来源（通过 secret token）
  const authHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== cronSecret) {
    // 如果配置了 CRON_SECRET，则验证
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  console.log('=================================');
  console.log('定时任务触发: 增量同步');
  console.log(`触发时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('=================================\n');

  try {
    // 异步执行增量同步
    incrementalSync()
      .then(() => {
        console.log('\n定时同步任务完成');
      })
      .catch((error) => {
        console.error('\n定时同步任务失败:', error);
      });

    return NextResponse.json({
      success: true,
      message: '增量同步任务已启动',
    });
  } catch (error) {
    console.error('启动增量同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '启动增量同步失败',
      },
      { status: 500 },
    );
  }
}

// GET 方法获取定时任务配置
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      description: '定时同步 API 端点',
      usage: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET
            ? '(从环境变量 CRON_SECRET 获取)'
            : '(可选，建议配置)',
        },
        cronExamples: [
          {
            name: '每天凌晨 2 点执行',
            expression: '0 2 * * *',
          },
          {
            name: '每 6 小时执行一次',
            expression: '0 */6 * * *',
          },
          {
            name: '每天中午 12 点执行',
            expression: '0 12 * * *',
          },
        ],
        deployment: {
          vercel: '在 vercel.json 中配置 cron 字段',
          githubActions: '在 .github/workflows 中创建定时任务',
          custom: '使用任何支持 HTTP 请求的 cron 服务',
        },
      },
    },
  });
}
