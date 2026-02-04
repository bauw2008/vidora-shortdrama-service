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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const { data, error, count } = await supabase
      .from('ip_blacklist')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('获取 IP 黑名单失败:', error);
    return NextResponse.json(
      { success: false, error: '获取 IP 黑名单失败' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { ip_address, reason } = body;

    if (!ip_address) {
      return NextResponse.json(
        { success: false, error: 'IP 地址不能为空' },
        { status: 400 },
      );
    }

    // 简单的 IP 地址验证
    const ipPattern =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipPattern.test(ip_address)) {
      return NextResponse.json(
        { success: false, error: '无效的 IP 地址格式' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('ip_blacklist')
      .upsert(
        { ip_address, reason: reason || '' },
        { onConflict: 'ip_address' },
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'IP 已添加到黑名单',
      data,
    });
  } catch (error) {
    console.error('添加 IP 到黑名单失败:', error);
    return NextResponse.json(
      { success: false, error: '添加 IP 到黑名单失败' },
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
    const body = await request.json();
    const { ip_address } = body;

    if (!ip_address) {
      return NextResponse.json(
        { success: false, error: 'IP 地址不能为空' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('ip_blacklist')
      .delete()
      .eq('ip_address', ip_address);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'IP 已从黑名单移除',
    });
  } catch (error) {
    console.error('从黑名单移除 IP 失败:', error);
    return NextResponse.json(
      { success: false, error: '从黑名单移除 IP 失败' },
      { status: 500 },
    );
  }
}
