import { NextResponse } from 'next/server';
import {
  getSyncSchedules,
  createSyncSchedule,
  updateSyncSchedule,
  deleteSyncSchedule,
} from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// GET - 获取所有定时同步配置
export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const schedules = await getSyncSchedules();

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error('获取定时同步配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `获取定时同步配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}

// POST - 创建定时同步配置
export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, hour, minute } = body;

    if (!name || hour === undefined || minute === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: name, hour, minute' },
        { status: 400 }
      );
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return NextResponse.json(
        { success: false, error: '时间参数无效: hour (0-23), minute (0-59)' },
        { status: 400 }
      );
    }

    const schedule = await createSyncSchedule(name, hour, minute);

    return NextResponse.json({
      success: true,
      message: '定时同步配置创建成功',
      data: schedule,
    });
  } catch (error) {
    console.error('创建定时同步配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `创建定时同步配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}

// PUT - 更新定时同步配置
export async function PUT(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: id' },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 }
      );
    }

    // 验证时间参数
    if (updates.hour !== undefined && (updates.hour < 0 || updates.hour > 23)) {
      return NextResponse.json(
        { success: false, error: 'hour 参数无效: 0-23' },
        { status: 400 }
      );
    }

    if (updates.minute !== undefined && (updates.minute < 0 || updates.minute > 59)) {
      return NextResponse.json(
        { success: false, error: 'minute 参数无效: 0-59' },
        { status: 400 }
      );
    }

    const schedule = await updateSyncSchedule(id, updates);

    return NextResponse.json({
      success: true,
      message: '定时同步配置更新成功',
      data: schedule,
    });
  } catch (error) {
    console.error('更新定时同步配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `更新定时同步配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除定时同步配置
export async function DELETE(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: id' },
        { status: 400 }
      );
    }

    await deleteSyncSchedule(parseInt(id));

    return NextResponse.json({
      success: true,
      message: '定时同步配置删除成功',
    });
  } catch (error) {
    console.error('删除定时同步配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: `删除定时同步配置失败: ${error instanceof Error ? error.message : '未知错误'}`,
      },
      { status: 500 }
    );
  }
}