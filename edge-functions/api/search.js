// Supabase REST API helpers (lightweight)
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function select(supabaseUrl, supabaseKey, table, options = {}) {
  const { columns = '*', filter = '', orderBy = '', limit = '', offset = '', single = false } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (offset) url += `&offset=${offset}`;
  if (single) url += '&limit=1';

  const response = await fetch(url, { headers: getHeaders(supabaseKey) });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
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

// /api/search 支持认证开关
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

async function getEnabledFields(supabaseUrl, supabaseKey, endpoint) {
  try {
    const data = await select(supabaseUrl, supabaseKey, "api_field_config", {
      columns: "field_name,display_order,is_enabled",
      filter: `api_endpoint=eq.${endpoint}`,
      orderBy: "display_order.asc"
    });
    const enabledData = data?.filter(f => f.is_enabled === true) || [];
    return enabledData.map((f) => f.field_name);
  } catch {
    return [];
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  try {
    if (!(await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseAnonKey))) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，需要有效的 API Key" }),
        { headers: { "Content-Type": "application/json" }, status: 401 }
      );
    }

    const url = new URL(context.request.url);
    const keyword = url.searchParams.get("keyword");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    if (!keyword) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少 keyword 参数" }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

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

    const enabledFields = await getEnabledFields(supabaseUrl, supabaseAnonKey, "list");

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 使用 or 过滤进行模糊搜索
    const filter = `or=(name.ilike.*${keyword}*,description.ilike.*${keyword}*)`;
    const data = await select(supabaseUrl, supabaseAnonKey, "videos", {
      columns: "*",
      filter,
      orderBy: "synced_at.desc",
      limit: pageSize.toString(),
      offset: from.toString()
    });

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
          total: filteredData.length,
          totalPages: Math.ceil(filteredData.length / pageSize),
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
    console.error("搜索视频失败:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "搜索视频失败" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}