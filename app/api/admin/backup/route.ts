import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
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
        { status: 400 },
      );
    }

    let data: any[] = [];
    let headers: string[] = [];

    // 分页获取所有数据的函数
    const fetchAllData = async (
      tableName: string,
      orderBy: string = 'id',
      ascending: boolean = true,
      limitCount: number | null = null,
    ) => {
      const pageSize = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from(tableName)
          .select('*')
          .order(orderBy, { ascending })
          .range(from, to);

        if (limitCount && allData.length >= limitCount) {
          break;
        }

        const result = await query;
        if (result.data && result.data.length > 0) {
          allData = allData.concat(result.data);
          page++;
          // 如果返回的数据少于 pageSize，说明没有更多数据了
          hasMore = result.data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    };

    switch (table) {
      case 'categories':
        data = await fetchAllData('categories', 'id');
        // 使用第一条数据的键作为表头（确保顺序正确）
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'sub_categories':
        data = await fetchAllData('sub_categories', 'id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'videos':
        data = await fetchAllData('videos', 'vod_id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'api_sources':
        data = await fetchAllData('api_sources', 'id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'sync_schedules':
        data = await fetchAllData('sync_schedules', 'id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'api_config':
        data = await fetchAllData('api_config', 'id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'ip_blacklist':
        data = await fetchAllData('ip_blacklist', 'id');
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      case 'api_logs':
        // API 日志限制最近 50000 条
        data = await fetchAllData('api_logs', 'request_time', false, 50000);
        if (data.length > 0) {
          headers = Object.keys(data[0]);
        }
        break;
      default:
        return NextResponse.json(
          { success: false, error: '无效的表名' },
          { status: 400 },
        );
    }

    // 转换为 CSV（一行一条记录）
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map((header) => {
        let value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          value = JSON.stringify(value);
        }
        // 转义引号和逗号
        const stringValue = String(value);
        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
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
      { status: 500 },
    );
  }
}
