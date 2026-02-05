function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

export async function onRequest(context) {
  const { request } = context;
  
  // 处理 OPTIONS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  }
  
  // 处理 GET 请求
  if (request.method === 'GET') {
    return handleGet(context);
  }
  
  return new Response(
    JSON.stringify({ success: false, error: "Method not allowed" }),
    {
      headers: { "Content-Type": "application/json" },
      status: 405,
    },
  );
}

async function handleGet(context) {
  const { env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sync_status?select=*&limit=1`, { headers: getHeaders(supabaseKey) });
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "数据库连接失败",
          details: response.statusText,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
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
    return new Response(
      JSON.stringify({
        success: false,
        error: "服务异常",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}