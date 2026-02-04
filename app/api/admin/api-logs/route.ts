import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getApiConfig } from '@/lib/db/operations';

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
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

    // 获取日志配置
    const apiConfig = await getApiConfig();
    const maxLogCount = apiConfig.max_log_count || 100000;
    const autoCleanThreshold = apiConfig.auto_clean_threshold || 80000;
    const timezone = apiConfig.timezone || 'Asia/Shanghai';

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
        maxLogCount,
        autoCleanThreshold,
        autoCleanDays: 30,
        timezone,
      },
    });
  } catch (error) {
    console.error('获取 API 日志失败:', error);
    return NextResponse.json(
      { success: false, error: '获取 API 日志失败' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const beforeDate = searchParams.get('beforeDate');
    const autoClean = searchParams.get('autoClean') === 'true';

    let deletedCount = 0;

    if (autoClean) {
      // 自动清理模式
      const apiConfig = await getApiConfig();
      const maxLogCount = apiConfig.max_log_count || 100000;
      const autoCleanThreshold = apiConfig.auto_clean_threshold || 80000;

      const { count: totalCount } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true });

      const currentCount = totalCount || 0;

      if (currentCount > autoCleanThreshold) {
        // 删除最旧的记录，保留 maxLogCount 条
        const deleteCount = currentCount - maxLogCount;

        // 获取要删除的记录的时间阈值
        const { data: oldestRecords } = await supabase
          .from('api_logs')
          .select('request_time')
          .order('request_time', { ascending: true })
          .limit(deleteCount);

        if (oldestRecords && oldestRecords.length > 0) {
          const cutoffTime =
            oldestRecords[oldestRecords.length - 1].request_time;

          console.log(`自动清理：删除 ${deleteCount} 条记录，截止时间: ${cutoffTime}`);

          const { error, count } = await supabase
            .from('api_logs')
            .delete()
            .lte('request_time', cutoffTime);

          if (!error) {
            deletedCount = count || 0;
            console.log(`自动清理成功：删除了 ${deletedCount} 条记录`);
          } else {
            console.error(`自动清理失败:`, error);
            throw error;
          }
        } else {
          console.log(`没有需要清理的记录，当前数量: ${currentCount}`);
        }
      } else {
        console.log(`当前记录数 ${currentCount} 未超过阈值 ${autoCleanThreshold}，无需清理`);
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
          { status: 400 },
        );
      }

      console.log(`手动清理：删除 ${beforeDate} 之前的日志`);

      // 查询最早的一条记录时间作为参考
      const { data: earliestLog } = await supabase
        .from('api_logs')
        .select('request_time')
        .order('request_time', { ascending: true })
        .limit(1)
        .single();

      const earliestTime = earliestLog?.request_time || null;

      // 先查询有多少条符合条件的记录
      const { count: matchCount } = await supabase
        .from('api_logs')
        .select('*', { count: 'exact', head: true })
        .lt('request_time', beforeDate);

      console.log(`匹配的记录数: ${matchCount}, 最早记录时间: ${earliestTime}`);

      if (matchCount === 0) {
        return NextResponse.json({
          success: true,
          message: '没有找到需要清理的日志',
          data: {
            deletedCount: 0,
            earliestTime,
          },
        });
      }

      // 直接按时间删除
      const { error, count } = await supabase
        .from('api_logs')
        .delete()
        .lt('request_time', beforeDate);

      if (error) {
        console.error('清理失败:', error);
        throw error;
      }

      console.log(`手动清理成功：删除了 ${count || 0} 条记录`);
      deletedCount = count || 0;

      return NextResponse.json({
        success: true,
        message: '日志清理完成',
        data: {
          deletedCount,
          earliestTime,
        },
      });
    }
  } catch (error) {
    console.error('清理 API 日志失败:', error);
    return NextResponse.json(
      { success: false, error: '清理 API 日志失败' },
      { status: 500 },
    );
  }
}
