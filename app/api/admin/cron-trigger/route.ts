import { NextResponse } from 'next/server';
import {
  getSyncSchedules,
  updateSyncScheduleRunTime,
} from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { createHmac } from 'crypto';

// 使用固定的签名密钥（这个密钥在 GitHub Actions 中配置）
const SIGNING_SECRET = 'cron-trigger-signing-key';

// 生成预期的时间戳签名
function generateTimestampSignature(timestamp: number, secret: string): string {
  const message = `${timestamp}-${SIGNING_SECRET}`;
  return createHmac('sha256', secret).update(message).digest('hex');
}

export async function GET(request: Request) {
  try {
    // 验证安全性（使用 CRON_SECRET 或 ADMIN_API_KEY）
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');

    const authValid = await verifyApiKey(request);

    // 验证 CRON_SECRET：使用 HMAC-SHA256 签名验证
    let secretValid = false;
    if (cronSecret) {
      try {
        // 预期格式: timestamp:signature
        const [timestampStr, signature] = cronSecret.split(':');
        const timestamp = parseInt(timestampStr);

        // 检查时间戳是否在 5 分钟内（防止重放攻击）
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) <= 300) {
          // 使用 GitHub Secrets 中的 CRON_SECRET 生成签名
          const expectedSignature = generateTimestampSignature(
            timestamp,
            cronSecret,
          );
          secretValid = signature === expectedSignature;
        }
      } catch (error) {
        console.error('[CronTrigger] 签名验证失败:', error);
        secretValid = false;
      }
    }

    if (!authValid && !secretValid) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    // 获取当前时间（使用北京时间 UTC+8）
    const now = new Date();
    const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const currentHour = utc8Time.getHours();
    const currentMinute = utc8Time.getMinutes();

    console.log(
      `[CronTrigger] 检查定时任务 - 当前时间: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} (UTC+8)`,
    );

    // 查询所有启用的定时任务
    const schedules = await getSyncSchedules();
    const activeSchedules = schedules.filter((s) => s.is_active);

    if (activeSchedules.length === 0) {
      console.log('[CronTrigger] 没有启用的定时任务');
      return NextResponse.json({
        success: true,
        message: '没有启用的定时任务',
        executed: [],
      });
    }

    // 查找需要执行的任务（当前时间匹配）
    const pendingTasks = activeSchedules.filter(
      (s) => s.hour === currentHour && s.minute === currentMinute,
    );

    if (pendingTasks.length === 0) {
      console.log('[CronTrigger] 当前时间没有需要执行的任务');
      return NextResponse.json({
        success: true,
        message: '当前时间没有需要执行的任务',
        executed: [],
      });
    }

    console.log(`[CronTrigger] 找到 ${pendingTasks.length} 个需要执行的任务`);

    // 构建基础 URL
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // 执行每个任务
    const results = [];
    for (const task of pendingTasks) {
      try {
        console.log(
          `[CronTrigger] 执行任务: ${task.name} (${task.hour}:${task.minute.toString().padStart(2, '0')})`,
        );

        // 调用同步 API
        const syncResponse = await fetch(`${baseUrl}/api/admin/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ADMIN_API_KEY}`,
          },
          body: JSON.stringify({
            type: 'incremental',
            hours: 24,
          }),
        });

        if (syncResponse.ok) {
          console.log(`[CronTrigger] 任务执行成功: ${task.name}`);
          results.push({
            id: task.id,
            name: task.name,
            status: 'success',
          });

          // 更新任务的运行时间
          await updateSyncScheduleRunTime(task.id);
        } else {
          const errorData = await syncResponse.json();
          console.error(`[CronTrigger] 任务执行失败: ${task.name}`, errorData);
          results.push({
            id: task.id,
            name: task.name,
            status: 'failed',
            error: errorData.error || '未知错误',
          });
        }
      } catch (error) {
        console.error(`[CronTrigger] 任务执行异常: ${task.name}`, error);
        results.push({
          id: task.id,
          name: task.name,
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    console.log(
      `[CronTrigger] 所有任务执行完成，成功: ${results.filter((r) => r.status === 'success').length}/${results.length}`,
    );

    return NextResponse.json({
      success: true,
      message: `执行了 ${results.length} 个任务`,
      executed: results,
    });
  } catch (error) {
    console.error('[CronTrigger] 处理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '处理失败',
      },
      { status: 500 },
    );
  }
}
