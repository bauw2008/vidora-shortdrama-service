// Supabase REST API helpers (lightweight)
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

// 使用 RPC 获取过滤后的 count，避免 EdgeOne Pages fetch 头部解析问题
async function getFilteredCount(supabaseUrl, supabaseKey, categoryId, subCategoryId) {
  const url = `${supabaseUrl}/rest/v1/rpc/get_filtered_videos_count`;
  const params = {};
  if (categoryId) params.category_id = categoryId;
  if (subCategoryId) params.sub_category_id = subCategoryId;

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(supabaseKey),
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    // 如果 RPC 不存在，返回 0 或使用备用方法
    console.log("DEBUG [getFilteredCount]: RPC failed, returning 0");
    return 0;
  }

  const result = await response.json();
  return typeof result === 'number' ? result : 0;
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

// /api/list 支持认证开关
async function verifyApiKey(context, adminApiKey, supabaseUrl, supabaseKey) {
  // 先获取 API 配置
  const config = await getApiConfig(supabaseUrl, supabaseKey);
  
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

async function getEnabledFields(supabaseUrl, supabaseKey, endpoint) {
  try {
    console.log("DEBUG [getEnabledFields]: endpoint =", endpoint);
    // 尝试不带 is_enabled 过滤，获取所有字段配置
    const filter = `api_endpoint=eq.${endpoint}`;
    console.log("DEBUG [getEnabledFields]: filter =", filter);
    const data = await select(supabaseUrl, supabaseKey, "api_field_config", {
      columns: "field_name,display_order,is_enabled",
      filter: filter,
      orderBy: "display_order.asc"
    });
    console.log("DEBUG [getEnabledFields]: data =", data);
    // 在代码中过滤 is_enabled 为 true 的记录
    const enabledData = data?.filter(f => f.is_enabled === true) || [];
    console.log("DEBUG [getEnabledFields]: enabledData =", enabledData);
    return enabledData.map((f) => f.field_name);
  } catch (error) {
    console.log("DEBUG [getEnabledFields]: error =", error);
    return [];
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [list GET]: supabaseUrl =", supabaseUrl);
  console.log("DEBUG [list GET]: adminApiKey =", adminApiKey);

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

  try {
    console.log("DEBUG [list GET]: Checking rate limit...");
    const config = await getRateLimitConfig(supabaseUrl, supabaseAnonKey);
    console.log("DEBUG [list GET]: config =", config);
    if (config && (await checkIpBlacklist(supabaseUrl, supabaseAnonKey, clientIp))) {
      return new Response(
        JSON.stringify({ success: false, error: "IP 地址已被封禁" }),
        { headers: { "Content-Type": "application/json" }, status: 429 }
      );
    }

    console.log("DEBUG [list GET]: Verifying API key...");
    if (!(await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseAnonKey))) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，需要有效的 API Key" }),
        { headers: { "Content-Type": "application/json" }, status: 401 }
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
    if (subCategoryId) filter += `&sub_category_id=eq.${subCategoryId}`;

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

    // 使用 RPC 获取过滤后的 count
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
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "获取视频列表失败" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}