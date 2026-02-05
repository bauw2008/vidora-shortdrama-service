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

async function insert(supabaseUrl, supabaseKey, table, data) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: getHeaders(supabaseKey),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function supabaseUpdate(supabaseUrl, supabaseKey, table, data, filter = '') {
  let url = `${supabaseUrl}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;

  const headers = getHeaders(supabaseKey);
  headers['Prefer'] = 'return=representation';

  const response = await fetch(url, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(data)
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  // 204 状态码表示成功但没有返回数据
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function verifyAdminApiKey(context, adminApiKey) {
  const authHeader = context.request.headers.get("Authorization");
  const apiKey = context.request.headers.get("X-API-Key");

  if (!adminApiKey) return false;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7) === adminApiKey;
  }

  if (apiKey) {
    return apiKey === adminApiKey;
  }

  return false;
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const data = await select(supabaseUrl, supabaseAnonKey, "api_config", {
      columns: "*",
      orderBy: "id.asc",
      limit: "1",
      single: true
    });

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("获取 API 配置失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取 API 配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await context.request.json();
    console.log("DEBUG [api-config POST]: body =", body);
    const existing = await select(supabaseUrl, supabaseAnonKey, "api_config", {
      columns: "id",
      orderBy: "id.asc",
      limit: "1",
      single: true
    });
    console.log("DEBUG [api-config POST]: existing =", existing);

    let data;
    if (!existing || !existing.id) {
      console.log("DEBUG [api-config POST]: Inserting new config");
      data = await insert(supabaseUrl, supabaseAnonKey, "api_config", body);
    } else {
      console.log("DEBUG [api-config POST]: Updating existing config, id =", existing.id);
      data = await supabaseUpdate(supabaseUrl, supabaseAnonKey, "api_config", body, `id=eq.${existing.id}`);
      // 如果更新返回 null，使用传入的 body 作为返回数据
      if (!data) {
        data = { ...body, id: existing.id };
      }
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("更新 API 配置失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "更新 API 配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}