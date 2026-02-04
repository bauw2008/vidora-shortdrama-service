import { NextResponse } from 'next/server';
import {
  getApiSources,
  createApiSource,
  deleteApiSource,
  activateApiSource,
} from '@/lib/db/operations';
import sourceClient from '@/lib/api-client';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const sources = await getApiSources();

    return NextResponse.json({
      success: true,
      data: sources,
    });
  } catch (error) {
    console.error('获取 API 源失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取 API 源失败',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { name, url } = body;

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 },
      );
    }

    // 默认新创建的 API 源不激活
    const source = await createApiSource({
      name,
      url,
      is_active: false,
    });

    return NextResponse.json({
      success: true,
      data: source,
    });
  } catch (error) {
    console.error('创建 API 源失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建 API 源失败',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return NextResponse.json(
        { success: false, error: '未授权' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 API 源 ID' },
        { status: 400 },
      );
    }

    await deleteApiSource(id);

    return NextResponse.json({
      success: true,
      message: 'API 源已删除',
    });
  } catch (error) {
    console.error('删除 API 源失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除 API 源失败',
      },
      { status: 500 },
    );
  }
}
