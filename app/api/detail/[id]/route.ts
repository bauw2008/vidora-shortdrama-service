import { NextResponse } from 'next/server';
import { getVideoByVodId, getEnabledFields } from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logApiCall, getRequestParams, getUserAgent } from '@/lib/api-logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientIp = getClientIp(request);
  const requestParams = getRequestParams(request);
  const userAgent = getUserAgent(request);
  const apiEndpoint = `/api/detail/${id}`;

  // 检查速率限制
  const rateLimitCheck = await checkRateLimit(request);
  if (!rateLimitCheck.success) {
    logApiCall({
      ip_address: clientIp,
      api_endpoint: apiEndpoint,
      http_method: 'GET',
      request_params: requestParams,
      response_status: 429,
      auth_validated: false,
      error_message: rateLimitCheck.error,
      user_agent: userAgent,
    });
    return NextResponse.json(
      { success: false, error: rateLimitCheck.error },
      { status: 429 }
    );
  }

  // 验证 API Key
  const authValid = await verifyApiKey(request);
  if (!authValid) {
    logApiCall({
      ip_address: clientIp,
      api_endpoint: apiEndpoint,
      http_method: 'GET',
      request_params: requestParams,
      response_status: 401,
      auth_validated: false,
      error_message: '未授权',
      user_agent: userAgent,
    });
    return NextResponse.json(
      { success: false, error: '未授权，需要有效的 API Key' },
      { status: 401 }
    );
  }

  try {
    const vodId = parseInt(id);

    if (isNaN(vodId)) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: apiEndpoint,
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '无效的视频 ID',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '无效的视频 ID' },
        { status: 400 }
      );
    }

    // 获取视频数据
    const video = await getVideoByVodId(vodId);

    if (!video) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: apiEndpoint,
        http_method: 'GET',
        request_params: requestParams,
        response_status: 404,
        auth_validated: true,
        error_message: '视频不存在',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '视频不存在' },
        { status: 404 }
      );
    }

    // 获取启用的字段列表
    const enabledFields = await getEnabledFields('detail');

    // 根据启用的字段过滤数据
    const filteredData: any = {};
    enabledFields.forEach(field => {
      if (field in video) {
        filteredData[field] = (video as any)[field];
      }
    });

    logApiCall({
      ip_address: clientIp,
      api_endpoint: apiEndpoint,
      http_method: 'GET',
      request_params: requestParams,
      response_status: 200,
      auth_validated: true,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      data: filteredData,
    });
  } catch (error) {
    console.error('获取视频详情失败:', error);
    logApiCall({
      ip_address: clientIp,
      api_endpoint: apiEndpoint,
      http_method: 'GET',
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message: error instanceof Error ? error.message : '获取视频详情失败',
      user_agent: userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        error: '获取视频详情失败',
      },
      { status: 500 }
    );
  }
}