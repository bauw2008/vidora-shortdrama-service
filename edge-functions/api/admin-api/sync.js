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

  // 设置 service_role key 用于写入操作
  serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const body = await context.request.json();
    const { type = "incremental", hours = 24 } = body;

    console.log("DEBUG [sync POST]: body =", body);
    console.log("DEBUG [sync POST]: type =", type);
    console.log("DEBUG [sync POST]: hours =", hours);

    const syncStatusList = await select(supabaseUrl, supabaseAnonKey, "sync_status", {
      limit: 1,
      orderBy: "id.asc"
    });
    const syncStatus = syncStatusList && syncStatusList.length > 0 ? syncStatusList[0] : null;

    console.log("DEBUG [sync POST]: syncStatusList =", syncStatusList);
    console.log("DEBUG [sync POST]: syncStatus =", syncStatus);
    console.log("DEBUG [sync POST]: syncStatus.id =", syncStatus?.id);
    console.log("DEBUG [sync POST]: syncStatus.is_syncing =", syncStatus?.is_syncing);

    if (!syncStatus) {
      return new Response(
        JSON.stringify({ success: false, error: "同步状态未初始化" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    if (syncStatus?.is_syncing) {
      console.log("DEBUG [sync POST]: Sync already in progress");
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

    // 增量同步使用 pg_cron 自动触发
    if (type === "incremental") {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentHour = now.getHours();
      
      // 生成 cron 表达式（在当前分钟执行）
      const cronExpression = `${currentMinute} ${currentHour} * * *`;
      const jobName = `incremental-sync-${Date.now()}`;
      
      console.log(`DEBUG [sync POST]: Scheduling pg_cron job: ${jobName} at ${cronExpression}`);
      
      // 调用 add_cron_job RPC 函数
      const cronScheduleUrl = `${supabaseUrl}/rest/v1/rpc/add_cron_job`;
      const cronResponse = await fetch(cronScheduleUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          job_name: jobName,
          schedule: cronExpression,
          command: 'SELECT trigger_cron_sync()'
        })
      });
      
      if (!cronResponse.ok) {
        console.error("Failed to schedule pg_cron job:", await cronResponse.text());
        // 如果 pg_cron 调用失败，回滚同步状态
        await supabaseUpdate(supabaseUrl, supabaseAnonKey, "sync_status", { is_syncing: false }, filter);
        return new Response(
          JSON.stringify({ success: false, error: "安排定时任务失败，请检查 pg_cron 扩展是否已启用" }),
          {
            headers: { "Content-Type": "application/json" },
            status: 500,
          },
        );
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          message: "增量同步已启动，将在 1 分钟内自动执行",
          type,
          hours,
          scheduledAt: cronExpression
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
    }
    
    // 完整同步和补充同步：只设置状态，等待 GitHub Actions 或手动执行
    return new Response(
      JSON.stringify({
        success: true,
        message: type === "full" 
          ? "完整同步任务已启动，请使用 GitHub Actions 或手动运行 pnpm run sync:full"
          : "补充同步任务已启动，请使用 GitHub Actions 或手动运行 pnpm run sync:resync",
        type,
        hours,
        requiresManual: true
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
