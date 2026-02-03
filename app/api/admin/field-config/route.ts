import { NextResponse } from 'next/server';
import { getFieldConfigs, updateFieldConfig } from '@/lib/db/operations';
import { verifyAuth } from '@/lib/auth';

// GET - 获取字段配置
export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const apiEndpoint = searchParams.get('apiEndpoint') as 'list' | 'detail';

    if (!apiEndpoint || (apiEndpoint !== 'list' && apiEndpoint !== 'detail')) {
      return NextResponse.json(
        { success: false, error: 'apiEndpoint 参数无效，必须是 list 或 detail' },
        { status: 400 }
      );
    }

    const configs = await getFieldConfigs(apiEndpoint);

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('获取字段配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取字段配置失败',
      },
      { status: 500 }
    );
  }
}

// PUT - 更新字段配置
export async function PUT(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, is_enabled, is_required, display_order } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 id 参数' },
        { status: 400 }
      );
    }

    const config = await updateFieldConfig(id, {
      is_enabled,
      is_required,
      display_order,
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('更新字段配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新字段配置失败',
      },
      { status: 500 }
    );
  }
}