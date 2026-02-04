import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getApiConfig, updateApiConfig } from '@/lib/db/operations';

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 },
    );
  }

  try {
    const config = await getApiConfig();
    // 返回时隐藏 API Key 的一部分
    const maskedKey = config.api_key
      ? config.api_key.substring(0, 4) +
        '****' +
        config.api_key.substring(config.api_key.length - 4)
      : '';

    return NextResponse.json({
      success: true,
      data: {
        api_key: maskedKey,
        auth_enabled: config.auth_enabled,
        rate_limit_minute: config.rate_limit_minute,
        rate_limit_hourly: config.rate_limit_hourly,
        rate_limit_daily: config.rate_limit_daily,
        timezone: config.timezone || 'Asia/Shanghai',
        auto_clean_threshold: config.auto_clean_threshold || 80000,
        max_log_count: config.max_log_count || 100000,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    console.error('获取 API 配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取 API 配置失败' },
      { status: 500 },
    );
  }
}

// 生成随机 API Key
function generateRandomApiKey(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 6; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
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
    const {
      api_key,
      auth_enabled,
      rate_limit_minute,
      rate_limit_hourly,
      rate_limit_daily,
      timezone,
      auto_clean_threshold,
      max_log_count,
      generateApiKey,
    } = body;

    const updates: any = {};

    // 自动生成 API Key
    if (generateApiKey === true) {
      updates.api_key = generateRandomApiKey();
    } else if (typeof api_key === 'string') {
      updates.api_key = api_key;
    }

    if (typeof auth_enabled === 'boolean') {
      updates.auth_enabled = auth_enabled;
    }

    if (typeof rate_limit_minute === 'number' && rate_limit_minute > 0) {
      updates.rate_limit_minute = rate_limit_minute;
    }

    if (typeof rate_limit_hourly === 'number' && rate_limit_hourly > 0) {
      updates.rate_limit_hourly = rate_limit_hourly;
    }

    if (typeof rate_limit_daily === 'number' && rate_limit_daily > 0) {
      updates.rate_limit_daily = rate_limit_daily;
    }

    if (typeof timezone === 'string' && timezone.length > 0) {
      updates.timezone = timezone;
    }

    if (typeof auto_clean_threshold === 'number' && auto_clean_threshold > 0) {
      updates.auto_clean_threshold = auto_clean_threshold;
    }

    if (typeof max_log_count === 'number' && max_log_count > 0) {
      updates.max_log_count = max_log_count;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有要更新的字段' },
        { status: 400 },
      );
    }

    const config = await updateApiConfig(updates);

    return NextResponse.json({
      success: true,
      message: 'API 配置已更新',
      data: {
        api_key: updates.api_key || '',
        auth_enabled: config.auth_enabled,
        rate_limit_minute: config.rate_limit_minute,
        rate_limit_hourly: config.rate_limit_hourly,
        rate_limit_daily: config.rate_limit_daily,
        timezone: config.timezone || 'Asia/Shanghai',
        auto_clean_threshold: config.auto_clean_threshold || 80000,
        max_log_count: config.max_log_count || 100000,
        updated_at: config.updated_at,
      },
    });
  } catch (error) {
    console.error('更新 API 配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新 API 配置失败' },
      { status: 500 },
    );
  }
}
