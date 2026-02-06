// Supabase REST API helpers (lightweight)
function getHeaders(supabaseKey) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
}

async function select(supabaseUrl, supabaseKey, table, options = {}) {
  const {
    columns = "*",
    filter = "",
    orderBy = "",
    limit = "",
    offset = "",
    single = false,
  } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (offset) url += `&offset=${offset}`;
  if (single) url += "&limit=1";

  const response = await fetch(url, { headers: getHeaders(supabaseKey) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return single ? data[0] || null : data;
}

async function getApiConfig(supabaseUrl, supabaseKey) {
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/api_config?select=auth_enabled&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (response.ok) {
      const data = await response.json();
      return data[0];
    }
  } catch (error) {
    console.error("获取 API 配置失败:", error);
  }
  return { auth_enabled: false };
}

// /api/play 支持认证开关
async function verifyApiKey(context, adminApiKey, supabaseUrl, supabaseKey) {
  const config = await getApiConfig(supabaseUrl, supabaseKey);
  if (!config.auth_enabled) {
    return true;
  }
  const apiKey =
    context.request.headers.get("X-API-Key") ||
    context.request.headers.get("Authorization")?.replace("Bearer ", "") ||
    new URL(context.request.url).searchParams.get("api_key");
  if (!adminApiKey) return true;
  return apiKey === adminApiKey;
}

function getClientIp(context) {
  const forwarded = context.request.headers.get("x-forwarded-for");
  const realIp = context.request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "unknown";
}

async function checkIpBlacklist(supabaseUrl, supabaseKey, ip) {
  try {
    const data = await select(supabaseUrl, supabaseKey, "ip_blacklist", {
      columns: "id",
      filter: `ip_address=eq.${ip}`,
      single: true,
    });
    return !!data;
  } catch {
    return false;
  }
}

async function getRateLimitConfig(supabaseUrl, supabaseKey) {
  try {
    return await select(supabaseUrl, supabaseKey, "api_config", {
      columns: "rate_limit_minute,rate_limit_hourly,rate_limit_daily",
      orderBy: "id.asc",
      limit: "1",
      single: true,
    });
  } catch {
    return null;
  }
}

async function checkAndRecordRateLimit(
  supabaseUrl,
  supabaseKey,
  identifier,
  type,
  config,
) {
  const now = new Date();
  const minuteWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  );
  const hourWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0,
  );
  const dayWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );

  try {
    const existing = await select(supabaseUrl, supabaseKey, "api_rate_limits", {
      columns: "*",
      filter: `identifier=eq.${identifier}&type=eq.${type}`,
      single: true,
    });

    let minuteCount = 0,
      hourlyCount = 0,
      dailyCount = 0;

    if (existing) {
      const isNewMinute = new Date(existing.minute_window) < minuteWindow;
      const isNewHour = new Date(existing.hour_window) < hourWindow;
      const isNewDay = new Date(existing.day_window) < dayWindow;

      minuteCount = isNewMinute ? 0 : existing.minute_count;
      hourlyCount = isNewHour ? 0 : existing.hourly_count;
      dailyCount = isNewDay ? 0 : existing.daily_count;

      if (minuteCount >= config.rate_limit_minute) {
        return {
          success: false,
          error: `超过每分钟限制 (${config.rate_limit_minute} 次/分钟)`,
          remaining_minute: 0,
        };
      }
      if (hourlyCount >= config.rate_limit_hourly) {
        return {
          success: false,
          error: `超过每小时限制 (${config.rate_limit_hourly} 次/小时)`,
          remaining_hourly: 0,
        };
      }
      if (dailyCount >= config.rate_limit_daily) {
        return {
          success: false,
          error: `超过每天限制 (${config.rate_limit_daily} 次/天)`,
          remaining_daily: 0,
        };
      }

      await fetch(
        `${supabaseUrl}/rest/v1/api_rate_limits?id=eq.${existing.id}`,
        {
          method: "PATCH",
          headers: getHeaders(supabaseAnonKey),
          body: JSON.stringify({
            minute_count: minuteCount + 1,
            hourly_count: hourlyCount + 1,
            daily_count: dailyCount + 1,
            minute_window: minuteWindow.toISOString(),
            hour_window: hourWindow.toISOString(),
            day_window: dayWindow.toISOString(),
          }),
        },
      );
    } else {
      await fetch(`${supabaseUrl}/rest/v1/api_rate_limits`, {
        method: "POST",
        headers: getHeaders(supabaseAnonKey),
        body: JSON.stringify({
          identifier,
          type,
          minute_count: 1,
          hourly_count: 1,
          daily_count: 1,
          minute_window: minuteWindow.toISOString(),
          hour_window: hourWindow.toISOString(),
          day_window: dayWindow.toISOString(),
        }),
      });
      minuteCount = hourlyCount = dailyCount = 1;
    }

    return {
      success: true,
      remaining_minute: config.rate_limit_minute - minuteCount,
      remaining_hourly: config.rate_limit_hourly - hourlyCount,
      remaining_daily: config.rate_limit_daily - dailyCount,
    };
  } catch (error) {
    console.error("速率限制检查失败:", error);
    return {
      success: true,
      remaining_minute: config.rate_limit_minute,
      remaining_hourly: config.rate_limit_hourly,
      remaining_daily: config.rate_limit_daily,
    };
  }
}

async function logApiCall(supabaseUrl, supabaseKey, data) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/api_logs`, {
      method: "POST",
      headers: getHeaders(supabaseKey),
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error("API 日志记录失败:", error);
  }
}

async function getTimezoneConfig(supabaseUrl, supabaseKey) {
  try {
    return await select(supabaseUrl, supabaseKey, "api_config", {
      columns: "timezone",
      orderBy: "id.asc",
      limit: "1",
      single: true,
    });
  } catch {
    return { timezone: "Asia/Shanghai" };
  }
}

function getCurrentTimeInTimezone(timezone) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
  const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  let hour = parseInt(getPart("hour"), 10);
  if (hour === 24) {
    hour = 0;
  }
  const hourStr = hour.toString().padStart(2, "0");
  const localTime = `${hourStr}:${getPart("minute")}:${getPart("second")}`;
  return `${localDate}T${localTime}`;
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  const url = new URL(context.request.url);
  const vodId = url.searchParams.get("vodId");
  const episode = url.searchParams.get("episode")
    ? parseInt(url.searchParams.get("episode"))
    : undefined;
  const startTime = Date.now();
  const clientIp = getClientIp(context);
  const userAgent = context.request.headers.get("user-agent") || "";
  const requestParams = `vodId=${vodId}&episode=${episode || ""}`.replace(
    /api_key=[^&]+/g,
    "api_key=***",
  );
  let rateLimitResult = null;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量",
      }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }

  try {
    const config = await getRateLimitConfig(supabaseUrl, supabaseAnonKey);

    if (
      config &&
      (await checkIpBlacklist(supabaseUrl, supabaseAnonKey, clientIp))
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "IP 地址已被封禁" }),
        { headers: { "Content-Type": "application/json" }, status: 429 },
      );
    }

    if (config) {
      rateLimitResult = await checkAndRecordRateLimit(
        supabaseUrl,
        supabaseAnonKey,
        clientIp,
        "ip",
        config,
      );
      if (!rateLimitResult.success) {
        return new Response(
          JSON.stringify({ success: false, error: rateLimitResult.error }),
          { headers: { "Content-Type": "application/json" }, status: 429 },
        );
      }
    }

    if (
      !(await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseAnonKey))
    ) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，需要有效的 API Key" }),
        { headers: { "Content-Type": "application/json" }, status: 401 },
      );
    }

    if (!vodId) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少 vodId 参数" }),
        { headers: { "Content-Type": "application/json" }, status: 400 },
      );
    }

    const data = await select(supabaseUrl, supabaseAnonKey, "videos", {
      columns: "vod_id,name,play_urls",
      filter: `vod_id=eq.${vodId}`,
      single: true,
    });

    if (!data) {
      const timezoneConfig = await getTimezoneConfig(
        supabaseUrl,
        supabaseAnonKey,
      );
      const logData = {
        ip_address: clientIp,
        api_endpoint: "/api/play",
        http_method: "GET",
        request_params: requestParams,
        response_status: 404,
        auth_validated: true,
        error_message: "视频不存在",
        user_agent: userAgent,
        remaining_minute: rateLimitResult?.remaining_minute || null,
        remaining_hourly: rateLimitResult?.remaining_hourly || null,
        remaining_daily: rateLimitResult?.remaining_daily || null,
        response_time_ms: Date.now() - startTime,
        is_rate_limit_warning: false,
        request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone),
      };
      logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});

      return new Response(
        JSON.stringify({ success: false, error: "视频不存在" }),
        { headers: { "Content-Type": "application/json" }, status: 404 },
      );
    }

    const playUrls = data.play_urls || [];
    let result = {
      vod_id: data.vod_id,
      name: data.name,
      play_urls: playUrls,
    };

    if (episode !== undefined) {
      const episodeData = playUrls.find((p) => p.episode === episode);
      if (episodeData) {
        result = {
          vod_id: data.vod_id,
          name: data.name,
          episode: episodeData.episode,
          url: episodeData.url,
        };
      } else {
        const timezoneConfig = await getTimezoneConfig(
          supabaseUrl,
          supabaseAnonKey,
        );
        const logData = {
          ip_address: clientIp,
          api_endpoint: "/api/play",
          http_method: "GET",
          request_params: requestParams,
          response_status: 404,
          auth_validated: true,
          error_message: "集数不存在",
          user_agent: userAgent,
          remaining_minute: rateLimitResult?.remaining_minute || null,
          remaining_hourly: rateLimitResult?.remaining_hourly || null,
          remaining_daily: rateLimitResult?.remaining_daily || null,
          response_time_ms: Date.now() - startTime,
          is_rate_limit_warning: false,
          request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone),
        };
        logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});
        return new Response(
          JSON.stringify({ success: false, error: "集数不存在" }),
          { headers: { "Content-Type": "application/json" }, status: 404 },
        );
      }
    }

    const timezoneConfig = await getTimezoneConfig(
      supabaseUrl,
      supabaseAnonKey,
    );
    const logData = {
      ip_address: clientIp,
      api_endpoint: "/api/play",
      http_method: "GET",
      request_params: requestParams,
      response_status: 200,
      auth_validated: true,
      error_message: null,
      user_agent: userAgent,
      remaining_minute: rateLimitResult?.remaining_minute || null,
      remaining_hourly: rateLimitResult?.remaining_hourly || null,
      remaining_daily: rateLimitResult?.remaining_daily || null,
      response_time_ms: Date.now() - startTime,
      is_rate_limit_warning: false,
      request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone),
    };
    logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("获取播放链接失败:", error);
    const errorMsg =
      error instanceof Error ? error.message : "获取播放链接失败";

    const timezoneConfig = await getTimezoneConfig(
      supabaseUrl,
      supabaseAnonKey,
    );
    const logData = {
      ip_address: clientIp,
      api_endpoint: "/api/play",
      http_method: "GET",
      request_params: requestParams,
      response_status: 500,
      auth_validated: true,
      error_message: errorMsg,
      user_agent: userAgent,
      remaining_minute: rateLimitResult?.remaining_minute || null,
      remaining_hourly: rateLimitResult?.remaining_hourly || null,
      remaining_daily: rateLimitResult?.remaining_daily || null,
      response_time_ms: Date.now() - startTime,
      is_rate_limit_warning: false,
      request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone),
    };
    logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});

    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
