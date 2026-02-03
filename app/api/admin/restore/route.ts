import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const table = formData.get('table') as string;
    const clearBeforeRestore = formData.get('clearBeforeRestore') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '未上传文件' },
        { status: 400 }
      );
    }

    if (!table) {
      return NextResponse.json(
        { success: false, error: '请指定表名' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const filename = file.name.toLowerCase();

    // 只支持 CSV 格式
    if (!filename.endsWith('.csv')) {
      return NextResponse.json(
        { success: false, error: '只支持 CSV 备份文件' },
        { status: 400 }
      );
    }

    // 去除所有回车符，统一使用换行符分隔
    const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, error: 'CSV 文件为空或格式错误' },
        { status: 400 }
      );
    }

    // 解析 CSV 表头
    const headers = parseCSVLine(lines[0]);
    let rows: any[] = [];

    // 解析每一行数据
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: any = {};

      headers.forEach((header, index) => {
        let value = values[index] || '';

        // 尝试解析 JSON
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            row[header] = JSON.parse(value);
          } catch {
            row[header] = value;
          }
        } else if (value === '' || value === 'null') {
          // 对于非空字段，使用默认值
          if (['name', 'cover', 'description', 'play_urls', 'updated_at'].includes(header)) {
            row[header] = '';
          } else if (['tags', 'episode_count', 'vod_id'].includes(header)) {
            row[header] = header === 'episode_count' || header === 'vod_id' ? 0 : [];
          } else if (['id', 'category_id', 'sub_category_id'].includes(header)) {
            row[header] = null;
          } else {
            row[header] = null;
          }
        } else if (!isNaN(Number(value))) {
          row[header] = Number(value);
        } else {
          row[header] = value;
        }
      });

      rows.push(row);
    }

    // 获取冲突列
    let conflictColumn = 'id';
    switch (table) {
      case 'videos':
        conflictColumn = 'vod_id';
        break;
      case 'ip_blacklist':
        conflictColumn = 'ip_address';
        break;
      default:
        conflictColumn = 'id';
    }

    // 如果是 videos 表，移除 id 字段（如果存在）
    if (table === 'videos') {
      rows = rows.map((row) => {
        const { id, ...rest } = row;
        return rest;
      });
    }

    // 如果需要，先清空表数据
    if (clearBeforeRestore) {
      const deleteQuery = supabase.from(table).delete();
      
      // RLS 要求必须有 WHERE 条件，使用不存在的值
      if (table === 'videos') {
        deleteQuery.neq('vod_id', -1);
      } else if (table === 'sub_categories') {
        deleteQuery.neq('id', -1);
      } else {
        deleteQuery.neq('id', -1);
      }
      
      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.error(`清空表 ${table} 失败:`, deleteError);
        return NextResponse.json(
          { success: false, error: `清空表 ${table} 失败: ${deleteError.message}` },
          { status: 500 }
        );
      }
    }

    // 批量插入
    const BATCH_SIZE = 100;
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: conflictColumn as any });

      if (error) {
        console.error(`${table} 批次插入失败:`, error);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      message: '恢复完成',
      data: {
        table,
        inserted,
        failed,
        total: rows.length,
        cleared: clearBeforeRestore,
      },
    });
  } catch (error) {
    console.error('恢复失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '恢复失败',
      },
      { status: 500 }
    );
  }
}

// CSV 解析函数，处理引号和逗号
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}