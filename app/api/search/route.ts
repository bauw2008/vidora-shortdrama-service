import { NextResponse } from 'next/server';
import { searchVideos } from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logApiCall, getRequestParams, getUserAgent } from '@/lib/api-logger';
import { createEdgeClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // 搜索类接口不建议缓存

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const requestParams = getRequestParams(request);
  const userAgent = getUserAgent(request);

  // 使用 Edge 专用的 Supabase 客户端
  const supabase = createEdgeClient();

  // 检查速率限制
  const rateLimitCheck = await checkRateLimit(request);
  if (!rateLimitCheck.success) {
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/search',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 429,
      auth_validated: false,
      error_message: rateLimitCheck.error,
      user_agent: userAgent,
    });
    return NextResponse.json(
      { success: false, error: rateLimitCheck.error },
      { status: 429 },
    );
  }

  // 验证 API Key
  const authValid = await verifyApiKey(request);
  if (!authValid) {
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/search',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 401,
      auth_validated: false,
      error_message: '未授权',
      user_agent: userAgent,
    });
    return NextResponse.json(
      { success: false, error: '未授权，需要有效的 API Key' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 验证参数
    if (!keyword || keyword.trim().length === 0) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/search',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '关键词不能为空',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '关键词不能为空' },
        { status: 400 },
      );
    }

    if (page < 1) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/search',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '页码必须大于 0',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '页码必须大于 0' },
        { status: 400 },
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/search',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '每页数量必须在 1-100 之间',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '每页数量必须在 1-100 之间' },
        { status: 400 },
      );
    }

    const result = await searchVideos(keyword.trim(), page, pageSize, supabase);

    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/search',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 200,
      auth_validated: true,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      data: result.list,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    console.error('搜索视频失败:', error);
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/search',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message: error instanceof Error ? error.message : '搜索视频失败',
      user_agent: userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        error: '搜索视频失败',
      },
      { status: 500 },
    );
  }
}
