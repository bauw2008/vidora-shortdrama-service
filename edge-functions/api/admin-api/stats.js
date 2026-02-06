// Supabase REST API helpers
function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function rpc(supabaseUrl, supabaseKey, functionName, params = {}) {
  const url = `${supabaseUrl}/rest/v1/rpc/${functionName}`;
  
  const response = await fetch(url, { 
    method: 'POST',
    headers: getHeaders(supabaseKey),
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data;
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

  console.log("DEBUG [stats GET]: env.ADMIN_API_KEY =", adminApiKey);
  console.log("DEBUG [stats GET]: env.ADMIN_USERNAME =", env.ADMIN_USERNAME);
  console.log("DEBUG [stats GET]: supabaseUrl =", supabaseUrl);

  if (!verifyAdminApiKey(context, adminApiKey)) {
    return new Response(JSON.stringify({ success: false, error: "未授权" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    // 使用 RPC 函数获取准确的统计数据
    console.log("DEBUG [stats]: Fetching videos count via RPC...");
    const videoCount = await rpc(supabaseUrl, supabaseAnonKey, 'get_total_videos_count');
    console.log("DEBUG [stats]: Videos count =", videoCount);

    // 使用 RPC 函数获取分类数量
    const categoryCount = await rpc(supabaseUrl, supabaseAnonKey, 'get_table_count', { table_name: 'categories' });
    console.log("DEBUG [stats]: Categories count =", categoryCount);

    const subCategoryCount = await rpc(supabaseUrl, supabaseAnonKey, 'get_table_count', { table_name: 'sub_categories' });
    console.log("DEBUG [stats]: SubCategories count =", subCategoryCount);

    // 使用 RPC 函数获取今日更新数量
    const todayCount = await rpc(supabaseUrl, supabaseAnonKey, 'get_today_updated_count');
    console.log("DEBUG [stats]: Today updated count =", todayCount);

    const stats = {
      totalVideos: videoCount,
      totalCategories: categoryCount,
      totalSubCategories: subCategoryCount,
      todayUpdated: todayCount
    };

    return new Response(
      JSON.stringify({ success: true, data: stats }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("获取统计数据失败:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "获取统计数据失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
