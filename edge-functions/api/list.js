// Supabase REST API helpers (lightweight)
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

// KV 缓存辅助函数
async function getCachedValue(kv, key, ttl, fetchFn) {
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    console.log(`DEBUG [KV Cache]: KV not available, fetching directly - ${key}`);
    return await fetchFn();
  }

  try {
    const cached = await kv.get(key, { type: 'json' });
    if (cached) {
      console.log(`DEBUG [KV Cache]: HIT - ${key}`);
      return cached;
    }
  } catch (error) {
    console.log(`DEBUG [KV Cache]: GET ERROR - ${key}`, error);
  }

  console.log(`DEBUG [KV Cache]: MISS - ${key}`);
  const value = await fetchFn();
  if (value) {
    try {
      await kv.put(key, JSON.stringify(value));
    } catch (error) {
      console.log(`DEBUG [KV Cache]: PUT ERROR - ${key}`, error);
    }
  }
  return value;
}

// 使用 RPC 获取过滤后的 count，避免 EdgeOne Pages fetch 头部解析问题
// 接受 subCategoryId 作为参数，查询其对应的 category_id
async function getFilteredCount(supabaseUrl, supabaseKey, categoryId, subCategoryId) {
  let count = 0;

  // 构建查询
  let filter = '';
  if (categoryId) filter += `&category_id=eq.${categoryId}`;

  // 如果有 subCategoryId，获取 category_id 并直接查询
  if (subCategoryId) {
    let subCategoryIdResult = null;
    if (typeof vidora_cache !== 'undefined' && vidora_cache !== null) {
      // 使用 KV 缓存，30 分钟过期
      const cacheKey = `sub_category_category_id_${subCategoryId}`;
      subCategoryIdResult = await getCachedValue(
        vidora_cache,
        cacheKey,
        1800,
        async () => {
          const subCategoryResponse = await fetch(
            `${supabaseUrl}/rest/v1/sub_categories?select=category_id&id=eq.${subCategoryId}`,
            { headers: getHeaders(supabaseKey) }
          );
          const subCategoryData = await subCategoryResponse.json();
          return subCategoryData?.[0]?.category_id || null;
        }
      );
    } else {
      // 没有 KV，直接查询
      const subCategoryResponse = await fetch(
        `${supabaseUrl}/rest/v1/sub_categories?select=category_id&id=eq.${subCategoryId}`,
        { headers: getHeaders(supabaseKey) }
      );
      const subCategoryData = await subCategoryResponse.json();
      subCategoryIdResult = subCategoryData?.[0]?.category_id;
    }

    if (subCategoryIdResult) {
      filter += `&category_id=eq.${subCategoryIdResult}`;
    }
  }

  // 获取总数
  const countUrl = `${supabaseUrl}/rest/v1/videos?select=vod_id${filter}`;
  const countResponse = await fetch(countUrl,
    { headers: { ...getHeaders(supabaseKey), 'Prefer': 'count=exact' } }
  );

  const contentRange = countResponse.headers.get('content-range');
  if (contentRange) {
    count = parseInt(contentRange.split('/')[1]) || 0;
  }

  return count;
}

async function select(supabaseUrl, supabaseKey, table, options = {}) {
  const { columns = '*', filter = '', orderBy = '', limit = '', offset = '', single = false, count = false } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (offset) url += `&offset=${offset}`;
  if (single) url += '&limit=1';

  // 对于 count 查询，添加 Prefer 头
  const headers = getHeaders(supabaseKey);
  if (count) {
    headers['Prefer'] = 'count=exact';
  }

  const response = await fetch(url, { headers });

  console.log("DEBUG [select]: url =", url);
  console.log("DEBUG [select]: response.status =", response.status);

  if (!response.ok) {
    const text = await response.text();
    console.log("DEBUG [select]: error text =", text);
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  if (count) {
    // 打印所有响应头用于调试
    console.log("DEBUG [select]: Getting all response headers...");
    const contentRange = response.headers.get('content-range');
    console.log("DEBUG [select]: content-range =", contentRange);

    if (contentRange) {
      const total = contentRange.split('/')[1];
      console.log("DEBUG [select]: total count from content-range =", total);
      return parseInt(total, 10);
    }
    // 如果没有 Content-Range，返回数据长度作为备用
    console.log("DEBUG [select]: No content-range, using data length as fallback");
    try {
      const data = await response.json();
      return Array.isArray(data) ? data.length : 0;
    } catch {
      return 0;
    }
  }

  const data = await response.json();
  return single ? (data[0] || null) : data;
}

async function getApiConfig(supabaseUrl, supabaseKey) {
  if (typeof vidora_cache === 'undefined' || vidora_cache === null) {
    // 如果没有 KV，直接查询
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/api_config?select=auth_enabled&limit=1`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data[0];
      }
    } catch (error) {
      console.error("获取 API 配置失败:", error);
    }
    return { auth_enabled: false };
  }
  // 使用 KV 缓存，5 分钟过期
  return getCachedValue(
    vidora_cache,
    'api_config',
    300,
    async () => {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/api_config?select=auth_enabled&limit=1`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          return data[0];
        }
      } catch (error) {
        console.error("获取 API 配置失败:", error);
      }
      return { auth_enabled: false };
    }
  );
}

// /api/list 支持认证开关
async function verifyApiKey(context, adminApiKey, supabaseUrl, supabaseKey) {
  // 先获取 API 配置
  const config = await getApiConfig(supabaseUrl, supabaseKey, vidora_cache);
  
  // 如果认证未启用，直接允许访问
  if (!config.auth_enabled) {
    return true;
  }
  
  // 认证已启用，验证 API Key
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
      single: true
    });
    return !!data;
  } catch {
    return false;
  }
}

async function getRateLimitConfig(supabaseUrl, supabaseKey) {
  if (typeof vidora_cache === 'undefined' || vidora_cache === null) {
    // 如果没有 KV，直接查询
    try {
      return await select(supabaseUrl, supabaseKey, "api_config", {
        columns: "rate_limit_minute,rate_limit_hourly,rate_limit_daily",
        orderBy: "id.asc",
        limit: "1",
        single: true
      });
    } catch {
      return null;
    }
  }
  // 使用 KV 缓存，5 分钟过期
  return getCachedValue(
    vidora_cache,
    'rate_limit_config',
    300,
    () => select(supabaseUrl, supabaseKey, "api_config", {
      columns: "rate_limit_minute,rate_limit_hourly,rate_limit_daily",
      orderBy: "id.asc",
      limit: "1",
      single: true
    }).catch(() => null)
  );
}

// 检查并记录速率限制
async function checkAndRecordRateLimit(supabaseUrl, supabaseKey, identifier, type, config) {
  const now = new Date();
  const minuteWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0
  );
  const hourWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0
  );
  const dayWindow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );

  try {
    const existing = await select(supabaseUrl, supabaseKey, "api_rate_limits", {
      columns: "*",
      filter: `identifier=eq.${identifier}&type=eq.${type}`,
      single: true
    });

    let minuteCount = 0;
    let hourlyCount = 0;
    let dailyCount = 0;

    if (existing) {
      const isNewMinute = new Date(existing.minute_window) < minuteWindow;
      const isNewHour = new Date(existing.hour_window) < hourWindow;
      const isNewDay = new Date(existing.day_window) < dayWindow;

      minuteCount = isNewMinute ? 0 : existing.minute_count;
      hourlyCount = isNewHour ? 0 : existing.hourly_count;
      dailyCount = isNewDay ? 0 : existing.daily_count;

      // 先检查是否超过限制，再决定是否允许
      if (minuteCount >= config.rate_limit_minute) {
        return {
          success: false,
          error: `超过每分钟限制 (${config.rate_limit_minute} 次/分钟)`,
          remaining_minute: 0
        };
      }
      if (hourlyCount >= config.rate_limit_hourly) {
        return {
          success: false,
          error: `超过每小时限制 (${config.rate_limit_hourly} 次/小时)`,
          remaining_hourly: 0
        };
      }
      if (dailyCount >= config.rate_limit_daily) {
        return {
          success: false,
          error: `超过每天限制 (${config.rate_limit_daily} 次/天)`,
          remaining_daily: 0
        };
      }

      // 更新记录
      await fetch(`${supabaseUrl}/rest/v1/api_rate_limits?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: getHeaders(supabaseKey),
        body: JSON.stringify({
          minute_count: minuteCount + 1,
          hourly_count: hourlyCount + 1,
          daily_count: dailyCount + 1,
          minute_window: minuteWindow.toISOString(),
          hour_window: hourWindow.toISOString(),
          day_window: dayWindow.toISOString()
        })
      });
    } else {
      // 创建新记录
      await fetch(`${supabaseUrl}/rest/v1/api_rate_limits`, {
        method: 'POST',
        headers: getHeaders(supabaseKey),
        body: JSON.stringify({
          identifier,
          type,
          minute_count: 1,
          hourly_count: 1,
          daily_count: 1,
          minute_window: minuteWindow.toISOString(),
          hour_window: hourWindow.toISOString(),
          day_window: dayWindow.toISOString()
        })
      });

      minuteCount = 1;
      hourlyCount = 1;
      dailyCount = 1;
    }

    return {
      success: true,
      remaining_minute: config.rate_limit_minute - minuteCount,
      remaining_hourly: config.rate_limit_hourly - hourlyCount,
      remaining_daily: config.rate_limit_daily - dailyCount
    };
  } catch (error) {
    console.error("速率限制检查失败:", error);
    return {
      success: true,
      remaining_minute: config.rate_limit_minute,
      remaining_hourly: config.rate_limit_hourly,
      remaining_daily: config.rate_limit_daily
    };
  }
}

// 记录 API 调用日志
async function logApiCall(supabaseUrl, supabaseKey, data) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/api_logs`, {
      method: 'POST',
      headers: getHeaders(supabaseKey),
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error("API 日志记录失败:", error);
  }
}

// 获取时区配置
async function getTimezoneConfig(supabaseUrl, supabaseKey) {
  if (typeof vidora_cache === 'undefined' || vidora_cache === null) {
    // 如果没有 KV，直接查询
    try {
      return await select(supabaseUrl, supabaseKey, "api_config", {
        columns: "timezone",
        orderBy: "id.asc",
        limit: "1",
        single: true
      });
    } catch {
      return { timezone: "Asia/Shanghai" };
    }
  }
  // 使用 KV 缓存，1 小时过期
  return getCachedValue(
    vidora_cache,
    'timezone_config',
    3600,
    () => select(supabaseUrl, supabaseKey, "api_config", {
      columns: "timezone",
      orderBy: "id.asc",
      limit: "1",
      single: true
    }).catch(() => ({ timezone: "Asia/Shanghai" }))
  );
}

// 根据时区生成当前时间字符串
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
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find((p) => p.type === type)?.value || "";
  const localDate = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
  let hour = parseInt(getPart("hour"), 10);
  // 处理 24 小时格式问题，如果 hour 是 24，改为 0
  if (hour === 24) {
    hour = 0;
  }
  const hourStr = hour.toString().padStart(2, '0');
  const localTime = `${hourStr}:${getPart("minute")}:${getPart("second")}`;
  // 返回 ISO 格式的时间字符串，不带时区信息
  return `${localDate}T${localTime}`;
}

async function getEnabledFields(supabaseUrl, supabaseKey, endpoint) {
  if (typeof vidora_cache === 'undefined' || vidora_cache === null) {
    // 如果没有 KV，直接查询
    try {
      console.log("DEBUG [getEnabledFields]: endpoint =", endpoint);
      const filter = `api_endpoint=eq.${endpoint}`;
      console.log("DEBUG [getEnabledFields]: filter =", filter);
      const data = await select(supabaseUrl, supabaseKey, "api_field_config", {
        columns: "field_name,display_order,is_enabled",
        filter: filter,
        orderBy: "display_order.asc"
      });
      console.log("DEBUG [getEnabledFields]: data =", data);
      const enabledData = data?.filter(f => f.is_enabled === true) || [];
      console.log("DEBUG [getEnabledFields]: enabledData =", enabledData);
      return enabledData.map((f) => f.field_name);
    } catch (error) {
      console.log("DEBUG [getEnabledFields]: error =", error);
      return [];
    }
  }
  // 使用 KV 缓存，10 分钟过期
  const cacheKey = `enabled_fields_${endpoint}`;
  return getCachedValue(
    vidora_cache,
    cacheKey,
    600,
    async () => {
      try {
        console.log("DEBUG [getEnabledFields]: endpoint =", endpoint);
        const filter = `api_endpoint=eq.${endpoint}`;
        console.log("DEBUG [getEnabledFields]: filter =", filter);
        const data = await select(supabaseUrl, supabaseKey, "api_field_config", {
          columns: "field_name,display_order,is_enabled",
          filter: filter,
          orderBy: "display_order.asc"
        });
        console.log("DEBUG [getEnabledFields]: data =", data);
        const enabledData = data?.filter(f => f.is_enabled === true) || [];
        console.log("DEBUG [getEnabledFields]: enabledData =", enabledData);
        return enabledData.map((f) => f.field_name);
      } catch (error) {
        console.log("DEBUG [getEnabledFields]: error =", error);
        return [];
      }
    }
  );
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [list GET]: supabaseUrl =", supabaseUrl);
  console.log("DEBUG [list GET]: adminApiKey =", adminApiKey);
  console.log("DEBUG [list GET]: KV available =", !!vidora_cache);

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  const startTime = Date.now();
  const clientIp = getClientIp(context);
  const userAgent = context.request.headers.get("user-agent") || "";
  const requestParams = new URL(context.request.url).searchParams
    .toString()
    .replace(/api_key=[^&]+/g, "api_key=***");

  let responseStatus = 200;
  let errorMessage = null;
  let rateLimitResult = null;

  try {
    console.log("DEBUG [list GET]: Checking rate limit...");
    const config = await getRateLimitConfig(supabaseUrl, supabaseAnonKey);
    console.log("DEBUG [list GET]: config =", config);
    if (config && (await checkIpBlacklist(supabaseUrl, supabaseAnonKey, clientIp))) {
      responseStatus = 429;
      errorMessage = "IP 地址已被封禁";
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { "Content-Type": "application/json" }, status: responseStatus }
      );
    }

    // 检查速率限制（始终生效，不受认证开关影响）
    if (config) {
      rateLimitResult = await checkAndRecordRateLimit(supabaseUrl, supabaseAnonKey, clientIp, "ip", config);
      if (!rateLimitResult.success) {
        responseStatus = 429;
        errorMessage = rateLimitResult.error;
        return new Response(
          JSON.stringify({ success: false, error: errorMessage }),
          { headers: { "Content-Type": "application/json" }, status: responseStatus }
        );
      }
    }

    console.log("DEBUG [list GET]: Verifying API key...");
    const authValidated = await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseAnonKey);
    if (!authValidated) {
      responseStatus = 401;
      errorMessage = "未授权，需要有效的 API Key";
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { "Content-Type": "application/json" }, status: responseStatus }
      );
    }
    console.log("DEBUG [list GET]: API key verified");

    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const categoryId = url.searchParams.get("categoryId")
      ? parseInt(url.searchParams.get("categoryId"))
      : undefined;
    const subCategoryId = url.searchParams.get("subCategoryId")
      ? parseInt(url.searchParams.get("subCategoryId"))
      : undefined;

    if (page < 1) {
      return new Response(
        JSON.stringify({ success: false, error: "页码必须大于 0" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return new Response(
        JSON.stringify({ success: false, error: "每页数量必须在 1-100 之间" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log("DEBUG [list GET]: Getting enabled fields...");
    const enabledFields = await getEnabledFields(supabaseUrl, supabaseAnonKey, "list");
    console.log("DEBUG [list GET]: enabledFields =", enabledFields);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let filter = '';

    if (categoryId) filter += `&category_id=eq.${categoryId}`;

    // 如果有 subCategoryId，获取 category_id 并直接查询
    try {
      if (subCategoryId) {
        // 使用 KV 缓存，30 分钟过期
        const cacheKey = `sub_category_category_id_${subCategoryId}`;
        const subCategoryIdResult = await getCachedValue(
          vidora_cache,
          cacheKey,
          1800,
          async () => {
            const subCategoryResponse = await fetch(
              `${supabaseUrl}/rest/v1/sub_categories?select=category_id&id=eq.${subCategoryId}`,
              { headers: getHeaders(supabaseAnonKey) }
            );
            const subCategoryData = await subCategoryResponse.json();
            return subCategoryData?.[0]?.category_id || null;
          }
        );
        if (subCategoryIdResult) {
          filter += `&category_id=eq.${subCategoryIdResult}`;
        }
      } else {
        // 没有 KV，直接查询
        const subCategoryResponse = await fetch(
          `${supabaseUrl}/rest/v1/sub_categories?select=category_id&id=eq.${subCategoryId}`,
          { headers: getHeaders(supabaseAnonKey) }
        );
        const subCategoryData = await subCategoryResponse.json();
        const subCategoryIdResult = subCategoryData?.[0]?.category_id;
        if (subCategoryIdResult) {
          filter += `&category_id=eq.${subCategoryIdResult}`;
        }
      }
    } catch (error) {
      console.error("Error fetching subCategoryId:", error);
    }

    console.log("DEBUG [list GET]: filter =", filter);
    console.log("DEBUG [list GET]: Fetching videos data and count...");

    // 使用 RPC 函数获取 count，避免 EdgeOne Pages fetch 头部解析问题
    const dataPromise = select(supabaseUrl, supabaseAnonKey, "videos", {
      columns: "*",
      filter: filter.substring(1),
      orderBy: "synced_at.desc",
      limit: pageSize.toString(),
      offset: from.toString()
    });

    // 使用 RPC 获取过滤后的 count，传入 subCategoryId
    const countPromise = getFilteredCount(supabaseUrl, supabaseAnonKey, categoryId, subCategoryId);

    const [data, count] = await Promise.all([dataPromise, countPromise]);

    console.log("DEBUG [list GET]: data length =", data.length);
    console.log("DEBUG [list GET]: count =", count);

    const filteredData =
      data?.map((video) => {
        const filtered = {};
        enabledFields.forEach((field) => {
          if (field in video) {
            filtered[field] = video[field];
          }
        });
        return filtered;
      }) || [];

    // 异步记录日志（不阻塞响应）
    // 使用 then 完全异步执行，不阻塞响应
    getTimezoneConfig(supabaseUrl, supabaseAnonKey).then(timezoneConfig => {
      const logData = {
        ip_address: clientIp,
        api_endpoint: "/api/list",
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
        request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone)
      };
      logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: filteredData,
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / pageSize),
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("获取视频列表失败:", error);
    const errorMsg = error instanceof Error ? error.message : "获取视频列表失败";

    // 异步记录错误日志
    // 使用 then 完全异步执行，不阻塞响应
    getTimezoneConfig(supabaseUrl, supabaseAnonKey).then(timezoneConfig => {
      const logData = {
        ip_address: clientIp,
        api_endpoint: "/api/list",
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
        request_time: getCurrentTimeInTimezone(timezoneConfig?.timezone)
      };
      logApiCall(supabaseUrl, supabaseAnonKey, logData).catch(() => {});
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}