// Supabase REST API helpers
let serviceRoleKey = null;

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

async function insert(supabaseUrl, supabaseKey, table, data, useServiceRole = false) {
  const key = serviceRoleKey || supabaseKey;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: getHeaders(key),
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

  const key = serviceRoleKey || supabaseKey;
  const headers = getHeaders(key);
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
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [sync GET]: env.ADMIN_API_KEY =", adminApiKey);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    // 返回同步状态（不再使用 sync_status 表）
    return new Response(
      JSON.stringify({
        success: true,
        data: { 
          status: "idle",
          message: "同步状态：请使用 GitHub Actions 查看实际同步状态"
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
  const adminApiKey = env.ADMIN_API_KEY;

  console.log("DEBUG [sync POST]: env.ADMIN_API_KEY =", adminApiKey);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await context.request.json();
    const { type = "incremental", hours = 24 } = body;

    console.log("DEBUG [sync POST]: body =", body);
    console.log("DEBUG [sync POST]: type =", type);
    console.log("DEBUG [sync POST]: hours =", hours);

    // 注意：实际同步由 GitHub Actions 执行
    // 这个端点只是用于触发同步请求
    // 同步逻辑需要在 GitHub Actions 中实现（调用实际的数据源 API）

    const typeNames = {
      'full': '完整同步',
      'incremental': '增量同步',
      'supplement': '补充同步'
    };

    return new Response(
      JSON.stringify({
        success: true,
        message: `${typeNames[type] || type}同步请求已接收`,
        type,
        hours,
        note: "注意：实际同步逻辑需要在 GitHub Actions 中实现，这里只接收请求"
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
