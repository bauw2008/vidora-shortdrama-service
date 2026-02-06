// Supabase REST API helpers (from shared)
import {
  supabaseUpdate,
  setServiceRoleKey,
  resetServiceRoleKey,
  verifyAdminApiKey,
} from "./shared/helpers.js";

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

  // 设置 service_role key 用于写入操作
  setServiceRoleKey(env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await request.json();
    const { subCategoryId, categoryId } = body;

    if (!subCategoryId) {
      resetServiceRoleKey();
      return new Response(
        JSON.stringify({ success: false, error: "缺少 subCategoryId 参数" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const updateData = { category_id: categoryId || null };

    const data = await supabaseUpdate(
      supabaseUrl,
      supabaseAnonKey,
      "sub_categories",
      updateData,
      `id=eq.${subCategoryId}`,
    );

    resetServiceRoleKey();

    return new Response(
      JSON.stringify({
        success: true,
        data: data || { subCategoryId, categoryId },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    resetServiceRoleKey();
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "更新映射失败",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}
