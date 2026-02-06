// Supabase REST API helpers
function getHeaders(supabaseKey) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
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
    const { categoryId, subCategoryIds } = body;

    if (!categoryId) {
      return new Response(
        JSON.stringify({ success: false, error: "缺少 categoryId 参数" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // 获取二级分类名称列表
    let filter = "";
    let tagNames = [];

    if (subCategoryIds && subCategoryIds.length > 0) {
      const subCategoriesResponse = await fetch(
        `${supabaseUrl}/rest/v1/sub_categories?select=name&id=in.(${subCategoryIds.join(",")})`,
        { headers: getHeaders(supabaseAnonKey) },
      );
      const subCategories = await subCategoriesResponse.json();
      tagNames = subCategories?.map((sc) => sc.name) || [];

      // 使用 PostgreSQL 的 contains 操作符
      if (tagNames.length > 0) {
        const tagsArray = tagNames.map((t) => `'${t}'`).join(",");
        filter = `tags=cs.{${tagsArray}}`;
      }
    }

    // 执行批量更新
    let updateUrl = `${supabaseUrl}/rest/v1/videos`;
    if (filter) updateUrl += `?${filter}`;

    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        ...getHeaders(supabaseAnonKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify({ category_id: categoryId }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`批量更新失败: ${updateResponse.status} - ${errorText}`);
    }

    const updatedVideos = await updateResponse.json();
    const count = Array.isArray(updatedVideos) ? updatedVideos.length : 0;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          count,
          message: `成功更新 ${count} 个视频的分类`,
        },
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
        error: error instanceof Error ? error.message : "批量更新失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
