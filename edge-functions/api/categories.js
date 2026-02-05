function getHeaders(supabaseKey) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function supabaseFetch(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Supabase error: ${response.status}`);
  }
  return response.json();
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

export async function onRequestGet(context) {
  const { env } = context;
  const adminApiKey = env.ADMIN_API_KEY;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ success: false, error: "缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 环境变量" }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }

  try {
    if (!(await verifyApiKey(context, adminApiKey, supabaseUrl, supabaseKey))) {
      return new Response(
        JSON.stringify({ success: false, error: "未授权，需要有效的 API Key" }),
        { headers: { "Content-Type": "application/json" }, status: 401 },
      );
    }

    const headers = getHeaders(supabaseKey);
    const categories = await supabaseFetch(`${supabaseUrl}/rest/v1/categories?select=*&order=sort.asc`, headers);
    const subCategories = await supabaseFetch(`${supabaseUrl}/rest/v1/sub_categories?select=*&order=name`, headers);

    const result = categories.map((category) => ({
      ...category,
      sub_categories: subCategories.filter((sc) => sc.category_id === category.id) || [],
    })) || [];

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
      },
      status: 200,
    });
  } catch (error) {
    console.error("获取分类失败:", error);
    return new Response(
      JSON.stringify({ success: false, error: "获取分类失败" }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}