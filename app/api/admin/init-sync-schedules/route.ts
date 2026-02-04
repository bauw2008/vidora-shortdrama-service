import { NextResponse } from 'next/server';
import { getSyncSchedules, createSyncSchedule } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// POST - 初始化默认定时同步配置
export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    // 检查是否已经有定时同步配置
    const existingSchedules = await getSyncSchedules();

    if (existingSchedules.length > 0) {
      return NextResponse.json({
        success: true,
        message: '定时同步配置已存在，无需初始化',
        data: existingSchedules,
      });
    }

    // 创建默认定时同步配置
    const schedules = [
      { name: '凌晨增量同步', hour: 2, minute: 0 },
      { name: '早晨增量同步', hour: 6, minute: 0 },
    ];

    const createdSchedules = [];
    for (const schedule of schedules) {
      const created = await createSyncSchedule(
        schedule.name,
        schedule.hour,
        schedule.minute,
      );
      createdSchedules.push(created);
    }

    return NextResponse.json({
      success: true,
      message: '默认定时同步配置初始化成功',
      data: createdSchedules,
    });
  } catch (error) {
    console.error('初始化定时同步配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `初始化定时同步配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 },
    );
  }
}
