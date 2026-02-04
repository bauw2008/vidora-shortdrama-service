import { NextResponse } from 'next/server';
import { getVideos, getEnabledFields } from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import {
  logApiCall,
  getRequestParams,
  getUserAgent,
  createPerformanceMonitor,
} from '@/lib/api-logger';
import { createEdgeClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // 搜索类接口不建议缓存

export async function GET(request: Request) {
  const startTime = Date.now();
  const performanceMonitor = createPerformanceMonitor(startTime);
  const clientIp = getClientIp(request);
  const requestParams = getRequestParams(request);
  const userAgent = getUserAgent(request);

  // 使用 Edge 专用的 Supabase 客户端
  const supabase = createEdgeClient();

  try {
    // 检查速率限制
    const rateLimitCheck = await checkRateLimit(request);
    if (!rateLimitCheck.success) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/list',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 429,
        auth_validated: false,
        error_message: rateLimitCheck.error,
        user_agent: userAgent,
        remaining_minute: rateLimitCheck.remaining_minute,
        remaining_hourly: rateLimitCheck.remaining_hourly,
        remaining_daily: rateLimitCheck.remaining_daily,
        response_time_ms: performanceMonitor.getResponseTime(),
        is_rate_limit_warning: true,
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
        api_endpoint: '/api/list',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 401,
        auth_validated: false,
        error_message: '未授权',
        user_agent: userAgent,
        response_time_ms: performanceMonitor.getResponseTime(),
      });
      return NextResponse.json(
        { success: false, error: '未授权，需要有效的 API Key' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const categoryId = searchParams.get('categoryId')
      ? parseInt(searchParams.get('categoryId')!)
      : undefined;
    const subCategoryId = searchParams.get('subCategoryId')
      ? parseInt(searchParams.get('subCategoryId')!)
      : undefined;

    // 验证参数
    if (page < 1) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/list',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '页码必须大于 0',
        user_agent: userAgent,
        response_time_ms: performanceMonitor.getResponseTime(),
      });
      return NextResponse.json(
        { success: false, error: '页码必须大于 0' },
        { status: 400 },
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: '/api/list',
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '每页数量必须在 1-100 之间',
        user_agent: userAgent,
        response_time_ms: performanceMonitor.getResponseTime(),
      });
      return NextResponse.json(
        { success: false, error: '每页数量必须在 1-100 之间' },
        { status: 400 },
      );
    }

    // 获取启用的字段列表
    const enabledFields = await getEnabledFields('list', supabase);

    // 获取视频数据，传入 Edge 客户端
    const result = await getVideos(page, pageSize, categoryId, subCategoryId, supabase);

    // 根据启用的字段过滤数据
    const filteredData = result.list.map((video) => {
      const filtered: any = {};
      enabledFields.forEach((field) => {
        if (field in video) {
          filtered[field] = (video as any)[field];
        }
      });
      return filtered;
    });

    // 记录成功的API调用，包含剩余配额信息
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/list',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 200,
      auth_validated: true,
      user_agent: userAgent,
      remaining_minute: rateLimitCheck.remaining_minute,
      remaining_hourly: rateLimitCheck.remaining_hourly,
      remaining_daily: rateLimitCheck.remaining_daily,
      response_time_ms: performanceMonitor.getResponseTime(),
    });

    return NextResponse.json({
      success: true,
      data: filteredData,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
    });
  } catch (error) {
    console.error('获取视频列表失败:', error);
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/list',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message:
        error instanceof Error ? error.message : '获取视频列表失败',
      user_agent: userAgent,
      response_time_ms: performanceMonitor.getResponseTime(),
    });
    return NextResponse.json(
      {
        success: false,
        error: '获取视频列表失败',
      },
      { status: 500 },
    );
  }
}
