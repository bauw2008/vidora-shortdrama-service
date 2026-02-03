import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// 日志存储限制配置
const MAX_LOG_COUNT = 100000; // 最多保留 10 万条记录
const AUTO_CLEAN_THRESHOLD = 80000; // 超过 8 万条时自动清理
const AUTO_CLEAN_DAYS = 30; // 自动清理 30 天前的日志

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const ip = searchParams.get('ip');
    const endpoint = searchParams.get('endpoint');
    const status = searchParams.get('status');
    const isRateLimitWarning = searchParams.get('isRateLimitWarning');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('api_logs')
      .select('*', { count: 'exact' })
      .order('request_time', { ascending: false });

    if (ip) {
      query = query.ilike('ip_address', `%${ip}%`);
    }
    if (endpoint) {
      query = query.ilike('api_endpoint', `%${endpoint}%`);
    }
    if (status) {
      query = query.eq('response_status', parseInt(status));
    }
    if (isRateLimitWarning) {
      query = query.eq('is_rate_limit_warning', isRateLimitWarning === 'true');
    }
    if (startDate) {
      query = query.gte('request_time', startDate);
    }
    if (endDate) {
      query = query.lte('request_time', endDate);
    }

    // 分页
    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // 获取日志总数
    const { count: totalCount } = await supabase
      .from('api_logs')
      .select('*', { count: 'exact', head: true });

    // 估算存储大小（每条约 500 字节）
    const estimatedSizeMB = ((totalCount || 0) * 500) / (1024 * 1024);

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
      stats: {
        totalCount: totalCount || 0,
        estimatedSizeMB: estimatedSizeMB.toFixed(2),
        maxLogCount: MAX_LOG_COUNT,
        autoCleanThreshold: AUTO_CLEAN_THRESHOLD,
        autoCleanDays: AUTO_CLEAN_DAYS,
      },
    });
  } catch (error) {
    console.error('获取 API 日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取 API 日志失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const beforeDate = searchParams.get('beforeDate');
    const autoClean = searchParams.get('autoClean') === 'true';

    let deletedCount = 0;

    if (autoClean) {
      // 自动清理模式
      const { count: totalCount } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true });

      const currentCount = totalCount || 0;

      if (currentCount > AUTO_CLEAN_THRESHOLD) {
        // 删除最旧的记录，保留 MAX_LOG_COUNT 条
        const deleteCount = currentCount - MAX_LOG_COUNT;
        
        // 获取要删除的记录的时间阈值
        const { data: oldestRecords } = await supabase
          .from('api_logs')
          .select('request_time')
          .order('request_time', { ascending: true })
          .limit(deleteCount);

        if (oldestRecords && oldestRecords.length > 0) {
          const cutoffTime = oldestRecords[oldestRecords.length - 1].request_time;
          
          const { error } = await supabase
            .from('api_logs')
            .delete()
            .lte('request_time', cutoffTime);

          if (!error) {
            deletedCount = deleteCount;
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: '自动清理完成',
        data: {
          deletedCount,
          currentCount: Math.max(currentCount - deletedCount, 0),
        },
      });
    } else {
      // 手动清理模式
      if (!beforeDate) {
        return NextResponse.json(
          { success: false, error: '请指定日期' },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('api_logs')
        .delete()
        .lt('request_time', beforeDate);

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: '日志清理完成',
      });
    }
  } catch (error) {
    console.error('清理 API 日志失败:', error);
    return NextResponse.json(
      { success: false, error: '清理 API 日志失败' },
      { status: 500 }
    );
  }
}