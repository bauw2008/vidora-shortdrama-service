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

  const url = new URL(context.request.url);
  const vodId = url.searchParams.get("vodId");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  if (!vodId) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 vodId 参数" }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }

  try {
    if (!(await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseAnonKey))) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，需要有效的 API Key" }),
        { headers: { "Content-Type": "application/json" }, status: 401 }
      );
    }

    const enabledFields = await getEnabledFields(supabaseUrl, supabaseAnonKey, "detail");

    const data = await select(supabaseUrl, supabaseAnonKey, "videos", {
      columns: "*",
      filter: `vod_id=eq.${parseInt(vodId, 10)}`,
      single: true
    });

    if (!data) {
      return new Response(
        JSON.stringify({ success: false, error: "视频不存在" }),
        { headers: { "Content-Type": "application/json" }, status: 404 }
      );
    }

    const filteredData = {};
    enabledFields.forEach((field) => {
      if (field in data) {
        filteredData[field] = data[field];
      }
    });

    return new Response(JSON.stringify({ success: true, data: filteredData }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("获取视频详情失败:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "获取视频详情失败" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}