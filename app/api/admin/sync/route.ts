import { NextResponse } from 'next/server';
import {
  fullSync,
  incrementalSync,
  resync,
  DEFAULT_SYNC_CONFIG,
} from '@/lib/sync';
import { getSyncStatus, getDatabaseStats } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// ============================================
// GET - 获取同步状态
// ============================================

export async function GET(request: Request) {
  try {
    // 验证认证
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const [status, stats] = await Promise.all([
      getSyncStatus(),
      getDatabaseStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        status: status || {
          is_syncing: false,
          last_sync_time: null,
          total_videos: 0,
          total_categories: 0,
        },
        stats: {
          totalVideos: stats.totalVideos,
          totalCategories: stats.totalCategories,
          totalSubCategories: stats.totalSubCategories,
        },
      },
    });
  } catch (error) {
    console.error('获取同步状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取同步状态失败',
      },
      { status: 500 },
    );
  }
}

// ============================================
// POST - 触发同步
// ============================================

export async function POST(request: Request) {
  try {
    // 验证认证
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const type = body.type || 'full'; // 'full', 'incremental', 'resync', 'continue'
    const hours = body.hours || 24; // 增量同步的时间范围（小时）
    const batchSize = body.batchSize || DEFAULT_SYNC_CONFIG.batchSize;
    const requestInterval =
      body.requestInterval || DEFAULT_SYNC_CONFIG.requestInterval;
    const forceRestart = body.forceRestart || false;

    // 验证参数
    if (
      type !== 'full' &&
      type !== 'incremental' &&
      type !== 'resync' &&
      type !== 'continue'
    ) {
      return NextResponse.json(
        { success: false, error: '无效的同步类型' },
        { status: 400 },
      );
    }

    if (type === 'incremental' && (hours < 1 || hours > 168)) {
      return NextResponse.json(
        { success: false, error: '时间范围必须在 1-168 小时之间' },
        { status: 400 },
      );
    }

    // 异步执行同步
    let syncPromise;

    if (type === 'resync') {
      syncPromise = resync(
        {
          batchSize,
          requestInterval,
          maxRetries: DEFAULT_SYNC_CONFIG.maxRetries,
        },
        (progress) => {
          console.log(`[Sync Progress] ${progress.message}`);
        },
      );
    } else if (type === 'incremental') {
      syncPromise = incrementalSync(
        hours,
        {
          batchSize,
          requestInterval,
          maxRetries: DEFAULT_SYNC_CONFIG.maxRetries,
        },
        (progress) => {
          console.log(`[Sync Progress] ${progress.message}`);
        },
      );
    } else {
      syncPromise = fullSync(
        {
          batchSize,
          requestInterval,
          maxRetries: DEFAULT_SYNC_CONFIG.maxRetries,
        },
        (progress) => {
          console.log(`[Sync Progress] ${progress.message}`);
        },
        forceRestart,
      );
    }

    // 不等待同步完成，立即返回
    syncPromise
      .then((result) => {
        console.log(
          `[Sync] 完成: ${type} - 新增 ${result.added}, 更新 ${result.updated}`,
        );
      })
      .catch((error) => {
        console.error(`[Sync] 失败: ${error}`);
      });

    return NextResponse.json({
      success: true,
      message: `${type === 'resync' ? '补充' : type === 'continue' ? '继续' : type === 'full' ? '完整' : '增量'}同步已启动`,
      type,
    });
  } catch (error) {
    console.error('触发同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '触发同步失败',
      },
      { status: 500 },
    );
  }
}
