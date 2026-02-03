import { NextResponse } from 'next/server';
import { getVideoByVodId } from '@/lib/db/operations';
import { verifyApiKey } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { logApiCall, getRequestParams, getUserAgent } from '@/lib/api-logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; episode: string }> }
) {
  const { id, episode } = await params;
  const clientIp = getClientIp(request);
  const requestParams = getRequestParams(request);
  const userAgent = getUserAgent(request);
  const apiEndpoint = `/api/play/${id}/${episode}`;

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
    const episodeNum = parseInt(episode);

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

    if (isNaN(episodeNum) || episodeNum < 1) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: apiEndpoint,
        http_method: 'GET',
        request_params: requestParams,
        response_status: 400,
        auth_validated: true,
        error_message: '无效的集数',
        user_agent: userAgent,
      });
      return NextResponse.json(
        { success: false, error: '无效的集数' },
        { status: 400 }
      );
    }

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

    // 查找指定集数的播放链接
    const playUrl = video.play_urls.find((p) => p.episode === episodeNum);

    if (!playUrl) {
      logApiCall({
        ip_address: clientIp,
        api_endpoint: apiEndpoint,
        http_method: 'GET',
        request_params: requestParams,
        response_status: 404,
        auth_validated: true,
        error_message: `第 ${episodeNum} 集不存在`,
        user_agent: userAgent,
      });
      return NextResponse.json(
        {
          success: false,
          error: `第 ${episodeNum} 集不存在`,
          availableEpisodes: video.play_urls.map((p) => p.episode),
        },
        { status: 404 }
      );
    }

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
      data: {
        url: playUrl.url,
        episode: playUrl.episode,
        totalEpisodes: video.episode_count,
        name: video.name,
        cover: video.cover,
        description: video.description,
      },
    });
  } catch (error) {
    console.error('获取播放链接失败:', error);
    logApiCall({
      ip_address: clientIp,
      api_endpoint: apiEndpoint,
      http_method: 'GET',
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message: error instanceof Error ? error.message : '获取播放链接失败',
      user_agent: userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        error: '获取播放链接失败',
      },
      { status: 500 }
    );
  }
}