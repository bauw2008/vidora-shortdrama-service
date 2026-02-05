// Supabase REST API helpers
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function select(supabaseUrl, supabaseKey, table, options = {}) {
  const { columns = '*', filter = '', orderBy = '', limit = '', single = false } = options;
  let url = `${supabaseUrl}/rest/v1/${table}?select=${columns}`;

  if (filter) url += `&${filter}`;
  if (orderBy) url += `&order=${orderBy}`;
  if (limit) url += `&limit=${limit}`;
  if (single) url += '&limit=1';

  const response = await fetch(url, { headers: getHeaders(supabaseKey) });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
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
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}

async function supabaseUpdate(supabaseUrl, supabaseKey, table, data, filter = '') {
  let url = `${supabaseUrl}/rest/v1/${table}`;
  if (filter) url += `?${filter}`;

  console.log("DEBUG [supabaseUpdate]: URL =", url);
  console.log("DEBUG [supabaseUpdate]: data =", data);

  const headers = getHeaders(supabaseKey);
  headers['Prefer'] = 'return=representation';

  const response = await fetch(url, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify(data)
  });

  console.log("DEBUG [supabaseUpdate]: Response status =", response.status);
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    console.log("DEBUG [supabaseUpdate]: Error response =", text);
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  // 204 状态码表示成功但没有返回数据
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function remove(supabaseUrl, supabaseKey, table, filter) {
  const url = `${supabaseUrl}/rest/v1/${table}?${filter}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(supabaseKey)
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }

  return response.json();
}

function verifyAdminApiKey(context, adminApiKey) {
  const authHeader = context.request.headers.get("Authorization");
  const apiKey = context.request.headers.get("X-API-Key");

  console.log("DEBUG [verifyAdminApiKey]: authHeader =", authHeader);
  console.log("DEBUG [verifyAdminApiKey]: apiKey =", apiKey);
  console.log("DEBUG [verifyAdminApiKey]: adminApiKey =", adminApiKey);

  if (!adminApiKey) return false;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    console.log("DEBUG [verifyAdminApiKey]: Bearer token =", token);
    console.log("DEBUG [verifyAdminApiKey]: match =", token === adminApiKey);
    return token === adminApiKey;
  }

  if (apiKey) {
    console.log("DEBUG [verifyAdminApiKey]: X-API-Key match =", apiKey === adminApiKey);
    return apiKey === adminApiKey;
  }

  console.log("DEBUG [verifyAdminApiKey]: No valid auth header");
  return false;
}

export async function onRequestGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [sync GET]: env.ADMIN_API_KEY =", adminApiKey);
  console.log("DEBUG [sync GET]: env.ADMIN_USERNAME =", env.ADMIN_USERNAME);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const syncStatus = await select(supabaseUrl, supabaseAnonKey, "sync_status", {
      limit: 1,
      orderBy: "id.asc"
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { status: syncStatus[0]?.is_syncing ? "running" : "idle" },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error("获取同步状态失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取同步状态失败",
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

  console.log("DEBUG [sync POST]: env.ADMIN_API_KEY =", adminApiKey);
  console.log("DEBUG [sync POST]: env.ADMIN_USERNAME =", env.ADMIN_USERNAME);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await context.request.json();
    const { type = "incremental", hours = 24 } = body;

    const syncStatusList = await select(supabaseUrl, supabaseAnonKey, "sync_status", {
      limit: 1,
      orderBy: "id.asc"
    });
    const syncStatus = syncStatusList[0];

    console.log("DEBUG [sync POST]: syncStatus =", syncStatus);
    console.log("DEBUG [sync POST]: syncStatus.id =", syncStatus?.id);

    if (syncStatus?.is_syncing) {
      return new Response(
        JSON.stringify({ success: false, error: "同步正在进行中" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const filter = `id=eq.${syncStatus.id}`;
    console.log("DEBUG [sync POST]: filter =", filter);
    await supabaseUpdate(supabaseUrl, supabaseAnonKey, "sync_status", { is_syncing: true, sync_type: type, last_sync_time: new Date().toISOString() }, filter);

    return new Response(
      JSON.stringify({
        success: true,
        message: "同步任务已启动",
        type,
        hours,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-API-Key",
        },
        status: 200,
      },
    );
  } catch (error) {
    console.error("同步失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "同步失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
