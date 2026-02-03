import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 检查数据库连接
    const { error } = await supabase.from('sync_status').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          status: 'unhealthy',
          error: '数据库连接失败',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 503 }
    );
  }
}