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
    const categoryId = url.searchParams.get("categoryId");
    const subCategoryIdsParam = url.searchParams.get("subCategoryIds");

    if (!categoryId) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少 categoryId 参数" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    let tagNames = [];
    if (subCategoryIdsParam) {
      const subCategoryIds = subCategoryIdsParam.split(",").map(Number);
      
      // 获取二级分类名称列表
      const subCategories = await select(supabaseUrl, supabaseAnonKey, "sub_categories", {
        columns: "name",
        filter: subCategoryIds.map(id => `id=eq.${id}`).join("&")
      });
      
      tagNames = subCategories?.map((sc) => sc.name) || [];
    }

    // 构建查询：使用 JSONB overlaps 操作符
    let filter = '';
    if (tagNames.length > 0) {
      // 使用 PostgreSQL 的 overlaps 操作符：tags ?| array['tag1', 'tag2']
      const tagsArray = tagNames.map(t => `'${t}'`).join(',');
      filter = `tags=cs.{${tagsArray}}`; // contains 操作符
    }

    // 获取总数
    let countUrl = `${supabaseUrl}/rest/v1/videos?select=id`;
    if (filter) countUrl += `&${filter}`;
    
    const countResponse = await fetch(countUrl, { 
      headers: { ...getHeaders(supabaseAnonKey), 'Prefer': 'count=exact' } 
    });
    
    const countHeader = countResponse.headers.get('content-range');
    const total = countHeader ? parseInt(countHeader.split('/')[1]) : 0;

    // 获取样本视频
    let sampleUrl = `${supabaseUrl}/rest/v1/videos?select=vod_id,name,tags`;
    if (filter) sampleUrl += `&${filter}`;
    sampleUrl += `&limit=5&order=synced_at.desc`;
    
    const sampleResponse = await fetch(sampleUrl, { headers: getHeaders(supabaseAnonKey) });
    const sampleVideos = await sampleResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          count: total,
          sampleVideos: sampleVideos || [],
          tagNames
        }
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "预览批量更新失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}