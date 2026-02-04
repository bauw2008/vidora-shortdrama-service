import { NextResponse } from 'next/server';
import { getSubCategories } from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logApiCall, getRequestParams, getUserAgent } from '@/lib/api-logger';

export async function GET(request: Request) {
  const clientIp = getClientIp(request);
  const requestParams = getRequestParams(request);
  const userAgent = getUserAgent(request);

  // 检查速率限制
  const rateLimitCheck = await checkRateLimit(request);
  if (!rateLimitCheck.success) {
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/sub-categories',
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
      api_endpoint: '/api/sub-categories',
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
    const categoryId = searchParams.get('categoryId')
      ? parseInt(searchParams.get('categoryId')!)
      : undefined;

    const subCategories = await getSubCategories(categoryId);

    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/sub-categories',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 200,
      auth_validated: true,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      data: subCategories,
    });
  } catch (error) {
    console.error('获取二级分类失败:', error);
    logApiCall({
      ip_address: clientIp,
      api_endpoint: '/api/sub-categories',
      http_method: 'GET',
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message:
        error instanceof Error ? error.message : '获取二级分类失败',
      user_agent: userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        error: '获取二级分类失败',
      },
      { status: 500 },
    );
  }
}
