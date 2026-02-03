import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    const table = searchParams.get('table');

    // 只支持 CSV 格式单表备份
    if (format !== 'csv' || !table) {
      return NextResponse.json(
        { success: false, error: '请指定表名和格式（CSV）' },
        { status: 400 }
      );
    }

    let data: any[] = [];
    let headers: string[] = [];

    switch (table) {
      case 'categories':
        headers = ['id', 'name', 'sort', 'is_active', 'created_at'];
        const categoriesResult = await supabase.from('categories').select('*').order('id');
        data = categoriesResult.data || [];
        break;
      case 'sub_categories':
        headers = ['id', 'name', 'category_id', 'created_at'];
        const subCategoriesResult = await supabase.from('sub_categories').select('*').order('id');
        data = subCategoriesResult.data || [];
        break;
      case 'videos':
        headers = ['id', 'vod_id', 'name', 'category_id', 'sub_category_id', 'tags', 'episode_count', 'cover', 'description', 'play_urls', 'actor', 'director', 'writer', 'area', 'lang', 'year', 'remarks', 'hits', 'hits_day', 'hits_week', 'hits_month', 'up', 'down', 'score', 'score_num', 'updated_at', 'added_at', 'synced_at'];
        const videosResult = await supabase.from('videos').select('*').order('vod_id');
        data = videosResult.data || [];
        break;
      case 'api_sources':
        headers = ['id', 'name', 'url', 'is_active', 'created_at', 'updated_at'];
        const apiSourcesResult = await supabase.from('api_sources').select('*');
        data = apiSourcesResult.data || [];
        break;
      case 'sync_schedules':
        headers = ['id', 'name', 'hour', 'minute', 'is_active', 'last_run_time', 'next_run_time', 'created_at', 'updated_at'];
        const syncSchedulesResult = await supabase.from('sync_schedules').select('*').order('id');
        data = syncSchedulesResult.data || [];
        break;
      case 'api_config':
        headers = ['id', 'api_key', 'auth_enabled', 'rate_limit_hourly', 'rate_limit_daily', 'updated_at'];
        const apiConfigResult = await supabase.from('api_config').select('*').order('id');
        data = apiConfigResult.data || [];
        break;
      case 'ip_blacklist':
        headers = ['id', 'ip_address', 'reason', 'created_at'];
        const ipBlacklistResult = await supabase.from('ip_blacklist').select('*').order('id');
        data = ipBlacklistResult.data || [];
        break;
      case 'api_logs':
        headers = ['id', 'ip_address', 'api_endpoint', 'http_method', 'request_params', 'response_status', 'auth_validated', 'error_message', 'request_time', 'user_agent'];
        const apiLogsResult = await supabase.from('api_logs').select('*').order('request_time', { ascending: false }).limit(10000);
        data = apiLogsResult.data || [];
        break;
      default:
        return NextResponse.json(
          { success: false, error: '无效的表名' },
          { status: 400 }
        );
    }

    // 转换为 CSV（一行一条记录）
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        // 转义引号和逗号
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${table}_backup_${timestamp}.csv`;

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('备份失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '备份失败',
      },
      { status: 500 }
    );
  }
}
