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

  const response = await fetch(url, {
    method: 'PATCH',
    headers: getHeaders(supabaseKey),
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
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

  if (!adminApiKey) return false;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    return token === adminApiKey;
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

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const data = await select(supabaseUrl, supabaseAnonKey, "sync_schedules", {
      orderBy: "hour.asc,minute.asc"
    });

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取定时同步配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const data = await insert(supabaseUrl, supabaseAnonKey, "sync_schedules", body);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "创建定时同步配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    const data = await supabaseUpdate(supabaseUrl, supabaseAnonKey, "sync_schedules", updateData, `id=eq.${id}`);

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "更新定时同步配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const adminApiKey = env.ADMIN_API_KEY;

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    await remove(supabaseUrl, supabaseAnonKey, "sync_schedules", `id=eq.${id}`);

    return new Response(
      JSON.stringify({ success: true, message: "定时同步配置已删除" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "删除定时同步配置失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}